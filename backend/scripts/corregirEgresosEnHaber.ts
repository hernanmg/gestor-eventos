// ═══════════════════════════════════════════════════════════════════════════
// Pasa de HABER a DEBE los egresos que se crearon con la convención invertida.
//
// Convención de Movimiento: EGRESO → monto en DEBE (haber = 0), INGRESO → monto en
// HABER. Hasta el fix del 2026-09-21 los pagos de facturas (facturas.controller), las
// liquidaciones de RRHH (rrhh.controller) y el alta manual de la tabla de Egresos
// cargaban el egreso en HABER, y los reportes (conciliatoria, dashboard, macro,
// egresos = debe − haber) los RESTABAN del total en vez de sumarlos.
//
// Qué corrige (el mismo criterio del UPDATE pedido):
//   Movimiento con tipo = 'EGRESO' AND haber > 0 AND debe = 0  →  debe = haber, haber = 0
//   Después recalcula el saldo corrido de cada rubro/tab afectado (saldo = Σ(debe − haber)
//   para egresos) y deja una entrada de auditoría por evento.
//
// SIMULACIÓN por defecto: lista lo que tocaría, con su origen (pago de factura,
// liquidación de RRHH, echeq, alta manual), y NO escribe nada.
//
// Run:  npx ts-node --files scripts/corregirEgresosEnHaber.ts            (simulación)
//       npx ts-node --files scripts/corregirEgresosEnHaber.ts --apply    (aplica, en una transacción)
// Antes de --apply en una base real: npm run backup
// Es idempotente: una vez aplicado, una segunda corrida encuentra 0 filas.
// ═══════════════════════════════════════════════════════════════════════════

import 'dotenv/config';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Prisma, PrismaClient, Tipo } from '@prisma/client';
import { recalcularSaldos, recalcularSaldosRubro } from '../src/lib/recalcularSaldos';
import { registrarAuditoria } from '../src/lib/auditoria';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

interface Fila {
  id: number; evento_id: number; rubro_id: number | null; tab_numero: number | null;
  concepto: string | null; descripcion: string | null; haber: number; moneda: string;
  saldo: number; borrado: boolean; created_at: Date; empresa_id: number;
  es_pago_factura: number | null; es_liquidacion_rrhh: number | null; tiene_echeq: number | null;
}

const origen = (r: Fila) =>
  r.es_pago_factura ? 'PAGO_FACTURA' : r.es_liquidacion_rrhh ? 'LIQUIDACION_RRHH' : r.tiene_echeq ? 'ECHEQ' : 'ALTA_MANUAL/OTRO';

async function main() {
  const filas = await prisma.$queryRaw<Fila[]>`
    SELECT m.id, m.evento_id, m.rubro_id, m.tab_numero, m.concepto, m.descripcion,
           m.haber::float AS haber, m.moneda::text AS moneda, m.saldo::float AS saldo,
           (m.deleted_at IS NOT NULL) AS borrado, m.created_at, e.empresa_id,
           (SELECT 1 FROM "PagoFactura" p WHERE p.movimiento_id = m.id LIMIT 1) AS es_pago_factura,
           (SELECT 1 FROM "Liquidacion" l WHERE l.movimiento_id = m.id LIMIT 1)  AS es_liquidacion_rrhh,
           (SELECT 1 FROM "Echeq" q WHERE q.movimiento_id = m.id LIMIT 1)        AS tiene_echeq
    FROM "Movimiento" m JOIN "Evento" e ON e.id = m.evento_id
    WHERE m.tipo = 'EGRESO' AND m.haber > 0 AND m.debe = 0
    ORDER BY m.evento_id, m.id`;

  const vivos = filas.filter(f => !f.borrado).length;
  console.log(`Egresos con haber>0 y debe=0: ${filas.length} (${vivos} vivos, ${filas.length - vivos} borrados)`);
  const porOrigen: Record<string, number> = {};
  for (const f of filas) porOrigen[origen(f)] = (porOrigen[origen(f)] ?? 0) + 1;
  console.log('Por origen:', JSON.stringify(porOrigen));
  for (const f of filas) {
    console.log(`  #${f.id} evento=${f.evento_id} ${origen(f)}${f.borrado ? ' [borrado]' : ''} "${(f.concepto ?? '').slice(0, 30)}" | "${(f.descripcion ?? '').slice(0, 28)}" haber=${f.haber} ${f.moneda} saldo=${f.saldo}`);
  }
  if (filas.length === 0) { console.log('Nada que corregir.'); return; }

  const ids = filas.map(f => f.id);
  console.log(`\nSQL a ejecutar:\n  UPDATE "Movimiento" SET debe = haber, haber = 0, updated_at = NOW() WHERE id IN (${ids.join(', ')});`);
  console.log(`SQL para revertir:\n  UPDATE "Movimiento" SET haber = debe, debe = 0 WHERE id IN (${ids.join(', ')});`);

  if (!APPLY) { console.log('\nSIMULACIÓN — no se escribió nada. Repetí con --apply para aplicar.'); return; }

  // Copia de seguridad de las filas tal cual estaban (además del SQL de reversión de arriba)
  const backup = path.join(os.tmpdir(), `egresos-en-haber-${Date.now()}.json`);
  fs.writeFileSync(backup, JSON.stringify(filas, null, 2));
  console.log(`\nRespaldo de las filas originales: ${backup}`);

  // Grupos cuyo saldo corrido hay que recalcular (rubro o tab legado)
  const grupos = new Map<string, { evento_id: number; rubro_id: number | null; tab_numero: number | null }>();
  for (const f of filas) grupos.set(`${f.evento_id}|${f.rubro_id ?? ''}|${f.tab_numero ?? ''}`, f);

  await prisma.$transaction(async tx => {
    const n = await tx.$executeRaw`UPDATE "Movimiento" SET debe = haber, haber = 0, updated_at = NOW()
                                   WHERE tipo = 'EGRESO' AND haber > 0 AND debe = 0 AND id IN (${Prisma.join(ids)})`;
    console.log(`Filas actualizadas: ${n}`);
    for (const g of grupos.values()) {
      if (g.rubro_id !== null) await recalcularSaldosRubro(g.evento_id, Tipo.EGRESO, g.rubro_id, tx as any);
      else if (g.tab_numero !== null) await recalcularSaldos(g.evento_id, Tipo.EGRESO, g.tab_numero, tx as any);
    }
    const porEvento = new Map<number, { empresa_id: number; n: number }>();
    for (const f of filas) porEvento.set(f.evento_id, { empresa_id: f.empresa_id, n: (porEvento.get(f.evento_id)?.n ?? 0) + 1 });
    for (const [evento_id, { empresa_id, n: cant }] of porEvento) {
      await registrarAuditoria({
        usuarioId: null, empresaId: empresa_id, accion: 'UPDATE', entidad: 'Movimiento', eventoId: evento_id,
        descripcion: `Corrección de convención Debe/Haber: ${cant} egreso(s) pasados de HABER a DEBE (scripts/corregirEgresosEnHaber.ts)`,
        tx: tx as any,
      });
    }
  });
  console.log('Listo. Saldos recalculados en', grupos.size, 'rubro(s)/tab(s).');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
