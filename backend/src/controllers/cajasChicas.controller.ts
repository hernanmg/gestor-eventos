import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';
import { recalcularSaldosCaja } from '../lib/recalcularSaldos';
import { normTexto } from '../lib/pedidosMaterialImporter';
import { parseCajasChicas, type BloqueCajaChica } from '../lib/cajasChicasImporter';

// Cajas chicas de Enjoy (docs/especificaciones/CAJAS  2026.xlsx) → una
// CuentaBancaria EFECTIVO sin evento por rendición (persona + mes), con sus
// MovimientoCaja. Convención de caja: el ingreso va al DEBE y el gasto al HABER
// (saldo = inicial + debe − haber), igual que el importador de Andrea.

const fechaDia = (ymd: string | null) => (ymd ? new Date(`${ymd}T00:00:00.000Z`) : null);

/** Responsable: un usuario de la empresa cuyo nombre o apodo empieza igual ("DANI" → Daniel Yanello). */
function buscarResponsable(clave: string, usuarios: { id: number; nombre: string }[]): number | null {
  const equivalentes: Record<string, string[]> = { vicky: ['vicky', 'victoria'], male: ['male', 'malena'], flor: ['flor', 'florencia'] };
  const buscadas = equivalentes[clave] ?? [clave];
  const hits = usuarios.filter(u => {
    const n = normTexto(u.nombre);
    const apodo = /\(([^)]+)\)/.exec(u.nombre)?.[1];
    const candidatos = [n.split(' ')[0], apodo ? normTexto(apodo) : null].filter((x): x is string => !!x);
    return candidatos.some(c => buscadas.some(b => b.length >= 3 && (c === b || (c.startsWith(b) && b.length >= 4) || (b.startsWith(c) && c.length >= 4))));
  });
  return hits.length === 1 ? hits[0].id : null;
}

/** Clave de un movimiento para reimportar sin duplicar: fecha, texto, montos y n° de aparición. */
function clavesMovs(movs: { fecha: Date | string | null; descripcion: string | null; debe: unknown; haber: unknown }[]): string[] {
  const vistas = new Map<string, number>();
  return movs.map(m => {
    const f = m.fecha instanceof Date ? m.fecha.toISOString().slice(0, 10) : (m.fecha ?? '');
    const base = `${f}|${normTexto(m.descripcion)}|${Number(m.debe).toFixed(2)}|${Number(m.haber).toFixed(2)}`;
    const n = (vistas.get(base) ?? 0) + 1;
    vistas.set(base, n);
    return `${base}|${n}`;
  });
}

// POST /api/caja/importar-cajas-chicas?preview=true|false
// Body (multipart): archivo + omitir (JSON opcional: claves de bloque que no se
// importan). Sin "omitir", se dejan afuera los bloques repetidos.
export async function importarCajasChicas(req: Request, res: Response) {
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo .xlsx' }); return; }
  const esPreview = req.query.preview !== 'false';

  let parsed: { bloques: BloqueCajaChica[]; hojas_omitidas: string[] };
  try {
    parsed = await parseCajasChicas(req.file.buffer);
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? 'Error al procesar el archivo' }); return;
  }

  let omitir: Set<string>;
  try {
    const raw = req.body?.omitir;
    omitir = raw
      ? new Set<string>(typeof raw === 'string' ? JSON.parse(raw) : raw)
      : new Set(parsed.bloques.filter(b => b.duplicado_de).map(b => b.clave));
  } catch {
    res.status(400).json({ error: 'omitir no es un JSON válido' }); return;
  }

  const empresaId = req.empresaId!;
  const [cuentas, usuarios] = await Promise.all([
    prisma.cuentaBancaria.findMany({
      where: { ...withTenant(empresaId), deleted_at: null, nombre: { in: [...new Set(parsed.bloques.map(b => b.nombre_cuenta))] } },
      include: { movimientos: { where: { deleted_at: null }, orderBy: { orden: 'asc' }, select: { id: true, fecha: true, descripcion: true, debe: true, haber: true, orden: true } } },
    }),
    prisma.usuario.findMany({
      where: { deleted_at: null, empresaAccesos: { some: { empresa_id: empresaId } } },
      select: { id: true, nombre: true },
    }),
  ]);
  const cuentaPorNombre = new Map(cuentas.map(c => [c.nombre, c]));

  const aImportar = parsed.bloques.filter(b => !omitir.has(b.clave));
  const salida = parsed.bloques.map(b => {
    const cuenta = cuentaPorNombre.get(b.nombre_cuenta);
    const ya = new Set(clavesMovs(cuenta?.movimientos ?? []));
    const nuevos = clavesMovs(b.movimientos.map(m => ({ fecha: m.fecha, descripcion: m.descripcion, debe: m.ingreso, haber: m.egreso })))
      .filter(k => !ya.has(k)).length;
    const responsableId = buscarResponsable(b.persona_clave, usuarios);
    return {
      clave: b.clave, hoja: b.hoja, fila_inicio: b.fila_inicio, fila_fin: b.fila_fin,
      persona: b.persona, nombre_planilla: b.nombre_planilla, mes: b.mes, nombre_cuenta: b.nombre_cuenta,
      movimientos: b.movimientos.length, movimientos_nuevos: nuevos,
      ingresos: b.ingresos, egresos: b.egresos, saldo: b.saldo, desde: b.desde, hasta: b.hasta,
      totales_planilla: b.totales_planilla, diferencias: b.diferencias, duplicado_de: b.duplicado_de,
      responsable: usuarios.find(u => u.id === responsableId)?.nombre ?? null,
      cuenta_existente: !!cuenta,
      importar: !omitir.has(b.clave),
      detalle: b.movimientos,
    };
  });
  const resumen = {
    hojas_omitidas: parsed.hojas_omitidas,
    cajas: aImportar.length,
    cajas_nuevas: aImportar.filter(b => !cuentaPorNombre.has(b.nombre_cuenta)).length,
    movimientos: aImportar.reduce((a, b) => a + b.movimientos.length, 0),
    movimientos_nuevos: salida.filter(s => s.importar).reduce((a, s) => a + s.movimientos_nuevos, 0),
    ingresos: Math.round(aImportar.reduce((a, b) => a + b.ingresos, 0) * 100) / 100,
    egresos: Math.round(aImportar.reduce((a, b) => a + b.egresos, 0) * 100) / 100,
    con_diferencias: aImportar.filter(b => b.diferencias.length).length,
  };

  if (esPreview) { res.json({ preview: true, ...resumen, bloques: salida }); return; }

  const nombreArchivo = req.file.originalname ?? 'planilla de cajas chicas';
  await prisma.$transaction(async tx => {
    for (const b of aImportar) {
      const totales = b.totales_planilla;
      const notas = [
        `Importada de "${nombreArchivo}", hoja ${b.hoja}, filas ${b.fila_inicio} a ${b.fila_fin} (en la planilla: ${b.nombre_planilla || 'sin nombre'}).`,
        totales ? `Totales de la planilla: ingresos $${totales.ingresos ?? '—'}, egresos $${totales.egresos ?? '—'}, saldo $${totales.saldo ?? '—'}.` : null,
        ...b.diferencias,
      ].filter(Boolean).join('\n');

      let cuenta = await tx.cuentaBancaria.findFirst({ where: { ...withTenant(empresaId), deleted_at: null, nombre: b.nombre_cuenta } });
      if (!cuenta) {
        cuenta = await tx.cuentaBancaria.create({
          data: {
            ...withTenant(empresaId), nombre: b.nombre_cuenta, tipo: 'EFECTIVO', moneda: 'ARS', saldo_inicial: 0,
            // Histórica: la rendición ya se hizo (o es la planilla que se usó para rendir)
            estado: 'CERRADA',
            responsable_id: buscarResponsable(b.persona_clave, usuarios),
            fecha_apertura: fechaDia(b.desde), fecha_cierre: fechaDia(b.hasta),
            notas_rendicion: notas,
          },
        });
      }

      const previos = await tx.movimientoCaja.findMany({
        where: { cuenta_id: cuenta.id, deleted_at: null }, orderBy: { orden: 'asc' },
        select: { fecha: true, descripcion: true, debe: true, haber: true, orden: true },
      });
      const ya = new Set(clavesMovs(previos));
      let orden = previos.reduce((m, p) => Math.max(m, p.orden), 0);
      const nuevas = b.movimientos.map(m => ({ fecha: m.fecha, descripcion: m.descripcion, debe: m.ingreso, haber: m.egreso }));
      const claves = clavesMovs(nuevas);
      for (let i = 0; i < nuevas.length; i++) {
        if (ya.has(claves[i])) continue;
        const m = nuevas[i];
        await tx.movimientoCaja.create({
          data: {
            cuenta_id: cuenta.id, fecha: fechaDia(m.fecha), descripcion: m.descripcion,
            debe: m.debe, haber: m.haber, orden: ++orden, created_by: req.user!.id, updated_by: req.user!.id,
          },
        });
      }
      await recalcularSaldosCaja(cuenta.id, tx);
    }

    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId, accion: 'IMPORT', entidad: 'CuentaBancaria',
      descripcion: `Importó cajas chicas — ${resumen.cajas} cajas (${resumen.cajas_nuevas} nuevas), ${resumen.movimientos_nuevos} movimientos nuevos`,
      ip: req.ip, tx: tx as any,
    });
  }, { timeout: 120000 });

  res.json({ preview: false, ...resumen, bloques: salida.map(({ detalle: _d, ...s }) => s) });
}
