import * as XLSX from 'xlsx';
import type { TipoLineaPago, SeccionLineaPago } from '@prisma/client';
import { prisma } from './prisma';

// ── Importador de la planilla "PAGOS+CAJAS 2026 (SOLICITUD MATIAS)" (Andrea) ──
// Formato real (docs/dos57/andrea/_PAGOS+CAJAS 2026(SOLICITUD MATIAS).xlsx):
// una hoja por mes ("JULIO.26"), y en cada hoja varios bloques semanales:
//
//   RESUMEN DE PAGOS SEMANAL- DOS57 SRL | JUNIO-JULIO ( Sem.29 AL 05) 2026
//   DETALLE | IMPORTE | OBSERVACION
//   GRUPO FAUSTERAS -6/4-PAX-(...)  | 552000 | RESCOLDO
//   ...
//   TOTAL CAJA SEMANAL              | 3389000
//   POLLO ENTREGA PAGO Q. LOCKURA   | 3420000        ← cómo se cubre
//   SALDO A FAVOR CAJA              | -1050620       ← calculado, se omite
//
// Lo de arriba del TOTAL es lo que Matías aprueba (sección CAJA_SEMANAL). Lo
// de abajo es cómo se cubrió esa plata (entregas, transferencias, saldo
// anterior) con signos inconsistentes entre semanas ("MAYRA ENTREGO -10M" se
// suma, "PAGO Q.LOKURA 2,5M" se resta) — se guarda tal cual como COBERTURA,
// sin calcular saldo. Las filas de saldo/total calculadas se omiten.
// Primero vista previa (parsearResumenPagos), después importar con el mismo
// parseo. Reimportar no duplica: import_key = "<desde>_<hasta>".

function normalize(s: unknown): string {
  return String(s ?? '').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
}

function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return value;
  const s = String(value).trim();
  if (/^-?\s*\$?\s*-\s*$/.test(s) || s === '$ -') return 0; // "$ -" del formato contable = 0
  const negativo = /^-|\(.*\)/.test(s.replace(/\s/g, ''));
  const cleaned = s.replace(/[^\d.,]/g, '');
  if (!cleaned) return null;
  // Formato del Excel exportado: "1,420,000.00" (coma de miles, punto decimal)
  // o "1.420.000,00" (argentino). Se decide por el último separador.
  let n: number;
  const ultimoPunto = cleaned.lastIndexOf('.');
  const ultimaComa  = cleaned.lastIndexOf(',');
  if (ultimaComa > ultimoPunto) n = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  else n = parseFloat(cleaned.replace(/,/g, ''));
  if (isNaN(n)) return null;
  return negativo ? -n : n;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

function mesesEnTexto(s: string): number[] {
  const encontrados: { mes: number; pos: number }[] = [];
  MESES.forEach((m, i) => {
    const pos = s.indexOf(m);
    if (pos >= 0) encontrados.push({ mes: i + 1, pos });
  });
  return encontrados.sort((a, b) => a.pos - b.pos).map(e => e.mes);
}

// "JUNIO-JULIO ( Sem.29 AL 05) 2026", "MARZO-ABRIL (30-3 AL 05-04) 2026",
// "MAYO ( sem. 4 AL 10 ) 2026", "FEBRERO (23 AL 28-02) 2026".
export function parsearRotuloSemana(rotulo: string, nombreHoja: string): { desde: Date; hasta: Date } | null {
  const s = normalize(rotulo);
  const anioMatch = s.match(/(20\d{2})/g);
  const hojaAnio = normalize(nombreHoja).match(/\.(\d{2})$/);
  const anio = anioMatch ? Number(anioMatch[anioMatch.length - 1]) : hojaAnio ? 2000 + Number(hojaAnio[1]) : null;
  if (!anio) return null;

  const rango = s.match(/(\d{1,2})(?:\s*[-/]\s*(\d{1,2}))?\s*AL\s*(\d{1,2})(?:\s*[-/]\s*(\d{1,2}))?/);
  if (!rango) return null;
  const d1 = Number(rango[1]);
  const d2 = Number(rango[3]);
  let m1 = rango[2] ? Number(rango[2]) : null;
  let m2 = rango[4] ? Number(rango[4]) : null;

  const meses = mesesEnTexto(s);
  if (meses.length === 0) meses.push(...mesesEnTexto(normalize(nombreHoja)));
  if (meses.length === 0) return null;
  if (m1 == null) m1 = meses[0];
  if (m2 == null) m2 = meses.length > 1 ? meses[meses.length - 1] : (d2 < d1 ? (m1 % 12) + 1 : m1);
  // "JULIO (Sem. 29 AL 05)" sin el segundo mes en el rótulo: si el día final
  // es menor, la semana cruza de mes.
  if (m1 === m2 && d2 < d1) m2 = (m1 % 12) + 1;

  const anioDesde = m1 > m2 ? anio - 1 : anio; // semana dic → ene
  const desde = new Date(Date.UTC(anioDesde, m1 - 1, d1));
  const hasta = new Date(Date.UTC(anio, m2 - 1, d2));
  if (isNaN(desde.getTime()) || isNaN(hasta.getTime()) || hasta < desde) return null;
  if ((hasta.getTime() - desde.getTime()) / 86_400_000 > 13) return null; // no es una semana
  return { desde, hasta };
}

export function inferirTipoLinea(detalle: string): TipoLineaPago {
  const s = normalize(detalle);
  if (/VIATICO/.test(s)) return 'VIATICO';
  if (/^(GRUPO|EQUIPO|EQUPO)/.test(s)) return 'JORNALEROS';
  if (/ADELANTO|QUINCENA/.test(s)) return 'ADELANTO';
  if (/REPOSICION|^REP\.|^REPOS|CAJA RESERVA/.test(s)) return 'REPOSICION_CAJA';
  if (/CAJA/.test(s)) return 'CAJA_CHICA';
  if (/^PAGO|REPARACION|LAVADERO|ELECTRICISTA|OBRA/.test(s)) return 'PROVEEDOR';
  return 'OTRO';
}

const esInicioBloque = (a: string) => /^RESUMEN DE PAGOS/.test(a);
const esEncabezado   = (a: string) => a === 'DETALLE';
const esTotalCaja    = (a: string) => /^TOTAL CAJA/.test(a);
// Filas de abajo del total que son cálculos de la planilla, no datos
const esFilaCalculada = (a: string) =>
  /^SALDO( CAJA)?( SEMANAL)?$/.test(a) || /^SALDO A FAVOR/.test(a) || /^DIFERENCIA/.test(a)
  || /^TOTAL/.test(a) || /^CAJA TOTAL/.test(a);

export interface LineaPreview {
  seccion:     SeccionLineaPago;
  tipo:        TipoLineaPago;
  detalle:     string;
  importe:     number;
  observacion: string | null;
}

export interface BloquePreview {
  hoja:          string;
  titulo:        string;
  semana_desde:  string; // YYYY-MM-DD
  semana_hasta:  string;
  import_key:    string;
  lineas:        LineaPreview[];
  total_caja:    number;
  total_planilla: number | null;
  advertencias:  string[];
  existe:        'NUEVO' | 'REIMPORTA' | 'EN_USO'; // EN_USO: ya se trabaja en el sistema, no se pisa
}

export interface PreviewResumenPagos {
  bloques:      BloquePreview[];
  advertencias: string[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function parsearResumenPagos(workbook: XLSX.WorkBook, empresaId: number): Promise<PreviewResumenPagos> {
  const bloques: BloquePreview[] = [];
  const advertencias: string[] = [];
  const vistos = new Map<string, BloquePreview>();

  for (const hoja of workbook.SheetNames) {
    const rows: unknown[][] = XLSX.utils.sheet_to_json(workbook.Sheets[hoja], { header: 1, defval: '', blankrows: false });
    let actual: BloquePreview | null = null;
    let seccion: 'ESPERA' | SeccionLineaPago = 'ESPERA';

    const cerrar = () => {
      if (!actual) return;
      actual.total_caja = round2(actual.lineas.filter(l => l.seccion === 'CAJA_SEMANAL').reduce((a, l) => a + l.importe, 0));
      if (actual.total_planilla != null && Math.abs(actual.total_planilla - actual.total_caja) > 1) {
        actual.advertencias.push(`El total de la planilla (${actual.total_planilla.toLocaleString('es-AR')}) no coincide con la suma de las líneas (${actual.total_caja.toLocaleString('es-AR')}).`);
      }
      const previo = vistos.get(actual.import_key);
      if (previo) {
        const igual = previo.total_caja === actual.total_caja && previo.lineas.length === actual.lineas.length;
        advertencias.push(`La semana "${actual.titulo}" está repetida (hojas ${previo.hoja} y ${hoja})${igual ? ' con los mismos datos: se toma una sola vez' : ': se toma la primera'}.`);
      } else {
        vistos.set(actual.import_key, actual);
        bloques.push(actual);
      }
      actual = null;
    };

    for (const row of rows) {
      const a = normalize(row[0]);
      const bRaw = row[1];
      const c = String(row[2] ?? '').trim();

      if (esInicioBloque(a)) {
        cerrar();
        const titulo = String(bRaw ?? '').trim().replace(/\s+/g, ' ');
        const semana = parsearRotuloSemana(titulo, hoja);
        if (!semana) {
          advertencias.push(`Hoja ${hoja}: no se pudo leer la semana de "${titulo}"; el bloque se omite.`);
          seccion = 'ESPERA';
          continue;
        }
        actual = {
          hoja, titulo,
          semana_desde: iso(semana.desde), semana_hasta: iso(semana.hasta),
          import_key: `${iso(semana.desde)}_${iso(semana.hasta)}`,
          lineas: [], total_caja: 0, total_planilla: null, advertencias: [], existe: 'NUEVO',
        };
        seccion = 'ESPERA';
        continue;
      }
      if (!actual) continue;
      if (esEncabezado(a)) { seccion = 'CAJA_SEMANAL'; continue; }
      if (seccion === 'ESPERA') continue;

      const importe = toNumber(bRaw);
      // Fila de total sin rótulo (FEBRERO.26, primer bloque): sólo el importe
      if (!a && importe != null && seccion === 'CAJA_SEMANAL') {
        actual.total_planilla = round2(importe);
        seccion = 'COBERTURA';
        continue;
      }
      if (!a) continue;

      if (esTotalCaja(a)) {
        actual.total_planilla = importe != null ? round2(importe) : null;
        seccion = 'COBERTURA';
        continue;
      }
      if (seccion === 'COBERTURA' && esFilaCalculada(a)) continue;

      const detalle = String(row[0]).trim().replace(/\s+/g, ' ');
      actual.lineas.push({
        seccion,
        tipo: seccion === 'CAJA_SEMANAL' ? inferirTipoLinea(detalle) : 'OTRO',
        detalle,
        importe: round2(importe ?? 0),
        observacion: c || null,
      });
    }
    cerrar();
  }

  // ¿Ya existe en el sistema?
  const existentes = await prisma.resumenPagoSemanal.findMany({
    where: { empresa_id: empresaId, import_key: { in: bloques.map(b => b.import_key) } },
    select: { import_key: true, estado: true, deleted_at: true },
  });
  const porKey = new Map(existentes.map(e => [e.import_key, e]));
  for (const b of bloques) {
    const e = porKey.get(b.import_key);
    if (!e) continue;
    b.existe = e.estado === 'HISTORICO' || e.deleted_at ? 'REIMPORTA' : 'EN_USO';
  }

  // Hojas más nuevas primero en la planilla → ordenar por semana
  bloques.sort((x, y) => x.semana_desde.localeCompare(y.semana_desde));
  return { bloques, advertencias };
}

export interface ResultadoImportResumenPagos {
  creados:      number;
  actualizados: number;
  omitidos:     number;
  lineas:       number;
  advertencias: string[];
}

export async function importarResumenPagos(workbook: XLSX.WorkBook, empresaId: number, usuarioId: number): Promise<ResultadoImportResumenPagos> {
  const preview = await parsearResumenPagos(workbook, empresaId);
  const res: ResultadoImportResumenPagos = { creados: 0, actualizados: 0, omitidos: 0, lineas: 0, advertencias: [...preview.advertencias] };

  for (const b of preview.bloques) {
    if (b.existe === 'EN_USO') {
      res.omitidos += 1;
      res.advertencias.push(`"${b.titulo}" ya se está trabajando en el sistema: no se pisa.`);
      continue;
    }
    await prisma.$transaction(async tx => {
      const existente = await tx.resumenPagoSemanal.findFirst({
        where: { empresa_id: empresaId, import_key: b.import_key }, select: { id: true },
      });
      const data = {
        semana_desde: new Date(`${b.semana_desde}T00:00:00Z`),
        semana_hasta: new Date(`${b.semana_hasta}T00:00:00Z`),
        titulo: b.titulo,
        estado: 'HISTORICO' as const,
        deleted_at: null,
        updated_by: usuarioId,
      };
      let resumenId: number;
      if (existente) {
        await tx.resumenPagoSemanal.update({ where: { id: existente.id }, data });
        await tx.lineaResumenPago.updateMany({ where: { resumen_id: existente.id, deleted_at: null }, data: { deleted_at: new Date(), updated_by: usuarioId } });
        resumenId = existente.id;
        res.actualizados += 1;
      } else {
        const creado = await tx.resumenPagoSemanal.create({
          data: { ...data, empresa_id: empresaId, import_key: b.import_key, created_by: usuarioId },
        });
        resumenId = creado.id;
        res.creados += 1;
      }
      await tx.lineaResumenPago.createMany({
        data: b.lineas.map((l, i) => ({
          resumen_id: resumenId, orden: i + 1,
          seccion: l.seccion, tipo: l.tipo, detalle: l.detalle, importe: l.importe, observacion: l.observacion,
          created_by: usuarioId, updated_by: usuarioId,
        })),
      });
      res.lineas += b.lineas.length;
    });
  }
  return res;
}
