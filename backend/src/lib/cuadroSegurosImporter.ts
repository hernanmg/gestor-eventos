import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { normalizarPatente } from './normalizarPatente';
import { claveAseguradora } from './aseguradoras';

// ── Importador del cuadro de seguros de la flota (Mayra) ─────────────────────
// Planillas reales: docs/dos57/mayra/PLANILLAS VARIAS DE CONTROL/
//   "SEGUROS PARQUE AUTOMOTOR DOS57 - 2025.xlsx" y "Cuadro Seguros Flota Dos57.xlsx".
// Dos tipos de hoja, reconocidos por los encabezados (no por el nombre):
//   CUADRO — MARCA/MODELO · TIPO DE VEHÍCULO · DOMINIO · AÑO · COMPAÑÍA
//            ASEGURADORA · TIPO DE COBERTURA · TIPO DE SEGURO (Individual/Flota)
//            · SUMA ASEGURADA · CUOTA m/AAAA · FORMA DE PAGO. Termina en "REFERENCIAS".
//   PAGOS  — MARCA/MODELO · DOMINIO · COMPAÑÍA · FORMA DE PAGO + DATOS ·
//            CUOTA 01/24 … CUOTA 12/24 (una columna por mes).
// El cuadro no trae número de póliza ni vigencia: los vencimientos siguen
// viniendo de la pizarra de Lorena. Por eso el cuadro completa la póliza que
// ya está cargada (misma aseguradora) y no crea pólizas nuevas; lo que ya
// tiene otro valor en el sistema no se pisa, se informa.
// Los dominios de los trailers vienen como "101" + dominio del tractor
// ("101HLW156") — en el sistema son el vehículo "HLW156-ACOPLADO".

export type AccionVehiculo = 'ACTUALIZA' | 'SIN_CAMBIOS' | 'SIN_VEHICULO' | 'SIN_POLIZA' | 'ASEGURADORA_DISTINTA';

export interface FilaCuadroResultado {
  hoja:        string;
  fila:        number;
  dominio:     string;
  vehiculo:    string | null; // código en el sistema
  aseguradora: string;
  accion:      AccionVehiculo;
  cambios:     string[];
  avisos:      string[];
}

export interface ResultadoCuadroSeguros {
  aplicado: boolean;
  hojas:    { nombre: string; tipo: 'CUADRO' | 'PAGOS' | 'IGNORADA' }[];
  vehiculos: FilaCuadroResultado[];
  cuotas: {
    nuevas: number; actualizadas: number; sin_cambios: number;
    vinculadas_a_poliza: number; sin_vehiculo: string[];
  };
  errores: string[];
}

function texto(c: ExcelJS.Cell): string {
  const v = c.value as any;
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('result' in v) return v.result == null ? '' : String(v.result);
    if ('richText' in v) return v.richText.map((r: any) => r.text).join('');
    if ('text' in v) return String(v.text);
  }
  return String(v).trim();
}

function numero(c: ExcelJS.Cell): number | null {
  const v = c.value as any;
  const raw = v && typeof v === 'object' && 'result' in v ? v.result : v;
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return isFinite(raw) ? raw : null;
  const s = String(raw).replace(/\$/g, '').replace(/\s/g, '');
  // "1.493.310,14" o "1493310.14"
  const norm = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  const n = Number(norm);
  return isFinite(n) ? n : null;
}

function normHeader(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}

interface Encabezado {
  fila: number;
  col: Record<string, number>; // header normalizado → número de columna
  cuotas: { col: number; periodo: Date }[];
}

function buscarEncabezado(ws: ExcelJS.Worksheet): Encabezado | null {
  for (let r = 1; r <= Math.min(12, ws.rowCount); r++) {
    const row = ws.getRow(r);
    const col: Record<string, number> = {};
    const cuotas: Encabezado['cuotas'] = [];
    row.eachCell({ includeEmpty: false }, (c, n) => {
      const h = normHeader(texto(c));
      if (!h) return;
      if (!(h in col)) col[h] = n;
      const m = h.match(/^CUOTA (\d{1,2})\/(\d{2}|\d{4})$/);
      if (m) {
        const anio = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
        cuotas.push({ col: n, periodo: new Date(Date.UTC(anio, Number(m[1]) - 1, 1)) });
      }
    });
    if ('DOMINIO' in col) return { fila: r, col, cuotas };
  }
  return null;
}

function colQueEmpieza(enc: Encabezado, prefijo: string): number | undefined {
  const k = Object.keys(enc.col).find(h => h.startsWith(prefijo));
  return k ? enc.col[k] : undefined;
}

type CamionLite = { id: number; codigo: string; patente: string | null; tipo_vehiculo: string | null; descripcion: string | null };
type SeguroLite = {
  id: number; camion_id: number; aseguradora: string; fecha_inicio: Date; fecha_vencimiento: Date;
  tipo_cobertura: string | null; suma_asegurada: Prisma.Decimal | null; modalidad: string | null;
  forma_pago: string | null; cuota_mensual: Prisma.Decimal | null;
};

const esAcoplado = (c: CamionLite) => c.tipo_vehiculo === 'TRAILER' || /-ACOPLADO$/i.test(c.codigo);

function resolverVehiculo(dominioRaw: string, aseguradora: string, camiones: CamionLite[], seguros: SeguroLite[]): CamionLite | null {
  const d = normalizarPatente(dominioRaw) ?? '';
  if (!d) return null;
  // Trailer: "101" + dominio del tractor
  const trailer = d.match(/^101([A-Z]{2,3}\d{3}[A-Z]{0,2})$/);
  if (trailer) {
    const base = trailer[1];
    return camiones.find(c => c.codigo.toUpperCase() === `${base}-ACOPLADO`)
      ?? camiones.find(c => esAcoplado(c) && normalizarPatente(c.patente) === base)
      ?? null;
  }
  // Autoelevador sin dominio: sólo si hay uno solo con esa aseguradora
  if (d.startsWith('AUTOELEV')) {
    const k = claveAseguradora(aseguradora);
    const cands = camiones.filter(c => (c.tipo_vehiculo ?? '').toUpperCase().includes('AUTOELEV')
      && seguros.some(s => s.camion_id === c.id && claveAseguradora(s.aseguradora) === k));
    return cands.length === 1 ? cands[0] : null;
  }
  return camiones.find(c => !esAcoplado(c) && c.codigo.toUpperCase() === d)
    ?? camiones.find(c => !esAcoplado(c) && normalizarPatente(c.patente) === d)
    ?? null;
}

const fmtMoneda = (n: number) => `$ ${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

export async function procesarCuadroSeguros(
  buffer: Buffer, empresaId: number, usuarioId: number, aplicar: boolean,
): Promise<ResultadoCuadroSeguros> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);

  const resultado: ResultadoCuadroSeguros = {
    aplicado: aplicar, hojas: [], vehiculos: [],
    cuotas: { nuevas: 0, actualizadas: 0, sin_cambios: 0, vinculadas_a_poliza: 0, sin_vehiculo: [] },
    errores: [],
  };

  const camiones: CamionLite[] = await prisma.camion.findMany({
    where:  { empresa_id: empresaId, deleted_at: null },
    select: { id: true, codigo: true, patente: true, tipo_vehiculo: true, descripcion: true },
  });
  const seguros: SeguroLite[] = await prisma.seguroVehiculo.findMany({
    where:  { empresa_id: empresaId, deleted_at: null, estado: { not: 'CANCELADO' } },
    orderBy: { fecha_vencimiento: 'desc' },
    select: {
      id: true, camion_id: true, aseguradora: true, fecha_inicio: true, fecha_vencimiento: true,
      tipo_cobertura: true, suma_asegurada: true, modalidad: true, forma_pago: true, cuota_mensual: true,
    },
  });
  // Ya completado en esta corrida (las dos planillas repiten los vehículos)
  const completados = new Map<number, Partial<SeguroLite>>();

  for (const ws of wb.worksheets) {
    const enc = buscarEncabezado(ws);
    const esCuadro = !!enc && Object.keys(enc.col).some(h => h.startsWith('SUMA ASEGURADA'));
    const esPagos  = !!enc && !esCuadro && enc.cuotas.length > 0;
    resultado.hojas.push({ nombre: ws.name, tipo: esCuadro ? 'CUADRO' : esPagos ? 'PAGOS' : 'IGNORADA' });
    if (!enc || (!esCuadro && !esPagos)) continue;

    const cDominio  = enc.col['DOMINIO'];
    const cAseg     = colQueEmpieza(enc, 'COMPANIA') ?? colQueEmpieza(enc, 'ASEGURADORA');
    const cFormaPago = colQueEmpieza(enc, 'FORMA DE PAGO');
    if (!cAseg) { resultado.errores.push(`Hoja "${ws.name}": no encontré la columna de la compañía aseguradora`); continue; }

    for (let r = enc.fila + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const primera = normHeader(texto(row.getCell(1)));
      if (primera.startsWith('REFERENCIAS')) break;
      const dominio = texto(row.getCell(cDominio));
      const aseguradora = texto(row.getCell(cAseg));
      if (!dominio || !aseguradora) continue;
      // Títulos y encabezados de un segundo bloque en la misma hoja ("PAGOS
      // MENSUALES - … FAMILIA POLLO", fila "DOMINIO"): no son dominios.
      const domNorm = normalizarPatente(dominio) ?? '';
      if (!domNorm.startsWith('AUTOELEV') && (!/\d/.test(domNorm) || domNorm.length > 12)) continue;
      const formaPago = cFormaPago ? texto(row.getCell(cFormaPago)) || null : null;

      const camion = resolverVehiculo(dominio, aseguradora, camiones, seguros);

      // ── Hoja PAGOS: cuotas mes a mes ──
      if (esPagos) {
        if (!camion) { resultado.cuotas.sin_vehiculo.push(`${dominio} (${ws.name})`); continue; }
        for (const q of enc.cuotas) {
          const importe = numero(row.getCell(q.col));
          if (importe == null || importe <= 0) continue;
          const k = claveAseguradora(aseguradora);
          const poliza = seguros.find(s => s.camion_id === camion.id && claveAseguradora(s.aseguradora) === k
            && s.fecha_inicio <= q.periodo && q.periodo <= s.fecha_vencimiento);
          if (poliza) resultado.cuotas.vinculadas_a_poliza++;
          const existente = await prisma.cuotaSeguroVehiculo.findUnique({
            where: { camion_id_periodo_aseguradora: { camion_id: camion.id, periodo: q.periodo, aseguradora } },
          });
          if (existente && !existente.deleted_at && Number(existente.importe) === importe
            && (existente.forma_pago ?? null) === formaPago && (existente.seguro_id ?? null) === (poliza?.id ?? null)) {
            resultado.cuotas.sin_cambios++; continue;
          }
          if (existente) resultado.cuotas.actualizadas++; else resultado.cuotas.nuevas++;
          if (aplicar) {
            await prisma.cuotaSeguroVehiculo.upsert({
              where:  { camion_id_periodo_aseguradora: { camion_id: camion.id, periodo: q.periodo, aseguradora } },
              create: { empresa_id: empresaId, camion_id: camion.id, seguro_id: poliza?.id ?? null, periodo: q.periodo, aseguradora, forma_pago: formaPago, importe, created_by: usuarioId },
              update: { seguro_id: poliza?.id ?? null, forma_pago: formaPago, importe, deleted_at: null },
            });
          }
        }
        continue;
      }

      // ── Hoja CUADRO: datos de la póliza ──
      const fila: FilaCuadroResultado = {
        hoja: ws.name, fila: r, dominio, vehiculo: camion?.codigo ?? null, aseguradora,
        accion: 'SIN_CAMBIOS', cambios: [], avisos: [],
      };
      resultado.vehiculos.push(fila);
      if (!camion) { fila.accion = 'SIN_VEHICULO'; continue; }

      const delVehiculo = seguros.filter(s => s.camion_id === camion.id);
      const k = claveAseguradora(aseguradora);
      const poliza = delVehiculo.find(s => claveAseguradora(s.aseguradora) === k);
      if (!poliza) {
        if (delVehiculo.length) {
          fila.accion = 'ASEGURADORA_DISTINTA';
          fila.avisos.push(`En el sistema figura ${delVehiculo[0].aseguradora} (vence ${delVehiculo[0].fecha_vencimiento.toISOString().slice(0, 10)}); el cuadro dice ${aseguradora}. No se tocó.`);
        } else {
          fila.accion = 'SIN_POLIZA';
          fila.avisos.push('El vehículo no tiene póliza cargada: cargala con su vencimiento (pizarra o Flota → Seguros) y volvé a importar.');
        }
        continue;
      }

      const cobertura = colQueEmpieza(enc, 'TIPO DE COBERTURA') ? texto(row.getCell(colQueEmpieza(enc, 'TIPO DE COBERTURA')!)) : '';
      const modalidad = colQueEmpieza(enc, 'TIPO DE SEGURO') ? texto(row.getCell(colQueEmpieza(enc, 'TIPO DE SEGURO')!)) : '';
      const suma      = numero(row.getCell(colQueEmpieza(enc, 'SUMA ASEGURADA')!));
      const cCuota    = colQueEmpieza(enc, 'CUOTA');
      const cuota     = cCuota ? numero(row.getCell(cCuota)) : null;

      const actual = { ...poliza, ...completados.get(poliza.id) };
      const data: Prisma.SeguroVehiculoUpdateInput = {};
      const completar = (campo: string, nuevo: string | number | null, previo: string | number | null, etiqueta: string, fmt: (v: any) => string = String) => {
        if (nuevo == null || nuevo === '') return;
        if (typeof nuevo === 'string' && /pendiente/i.test(nuevo)) return; // "Pendiente Descontar" no es una cobertura
        if (previo == null || previo === '') {
          (data as any)[campo] = nuevo;
          fila.cambios.push(`${etiqueta}: ${fmt(nuevo)}`);
        } else if (String(previo).trim().toLowerCase() !== String(nuevo).trim().toLowerCase() && !(typeof nuevo === 'number' && Number(previo) === nuevo)) {
          fila.avisos.push(`${etiqueta}: en el sistema "${fmt(previo)}", en el cuadro "${fmt(nuevo)}" — no se pisó`);
        }
      };
      completar('tipo_cobertura', cobertura || null, actual.tipo_cobertura ?? null, 'Cobertura');
      completar('modalidad',      modalidad || null, actual.modalidad ?? null, 'Tipo de seguro');
      completar('forma_pago',     formaPago,         actual.forma_pago ?? null, 'Forma de pago');
      completar('suma_asegurada', suma,  actual.suma_asegurada != null ? Number(actual.suma_asegurada) : null, 'Suma asegurada', v => fmtMoneda(Number(v)));
      completar('cuota_mensual',  cuota, actual.cuota_mensual != null ? Number(actual.cuota_mensual) : null, 'Cuota', v => fmtMoneda(Number(v)));

      if (fila.cambios.length) {
        fila.accion = 'ACTUALIZA';
        completados.set(poliza.id, {
          ...completados.get(poliza.id),
          ...(data.tipo_cobertura !== undefined && { tipo_cobertura: data.tipo_cobertura as string }),
          ...(data.modalidad !== undefined && { modalidad: data.modalidad as string }),
          ...(data.forma_pago !== undefined && { forma_pago: data.forma_pago as string }),
          ...(data.suma_asegurada !== undefined && { suma_asegurada: new Prisma.Decimal(data.suma_asegurada as number) }),
          ...(data.cuota_mensual !== undefined && { cuota_mensual: new Prisma.Decimal(data.cuota_mensual as number) }),
        });
        if (aplicar) await prisma.seguroVehiculo.update({ where: { id: poliza.id }, data });
      }
    }
  }

  if (!resultado.hojas.some(h => h.tipo !== 'IGNORADA')) {
    resultado.errores.push('No reconocí ninguna hoja del cuadro de seguros (se busca la columna DOMINIO y SUMA ASEGURADA o CUOTA mm/aa)');
  }
  return resultado;
}
