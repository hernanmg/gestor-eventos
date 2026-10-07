import { EstadoSeguro } from '@prisma/client';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { prisma } from './prisma';
import { normalizarPatente } from './normalizarPatente';

// ── Datos de la pizarra física de DOS57 (transcripción de la foto — ver
// docs/dos57/lorena/pizarra_seguros.jpeg) ────────────────────────────────────
// `codigo` es nuestra clave de import, no viene de la pizarra: la pizarra
// numera los autoelevadores 1-4 sin patente, y dos acoplados comparten dominio
// con su camioneta/camión tractor (HLW156, WNO918) — Camion.codigo es único
// por empresa, así que se desambigua con un sufijo. `patente` sí guarda el
// dominio tal cual está en la pizarra (puede repetirse entre tractor y
// acoplado, eso es real).
export interface VehiculoPizarra {
  codigo:                string;
  patente:               string | null;
  descripcion:           string; // modelo/color, columna VEHÍCULO
  titular:               string;
  tipo_vehiculo:         'CAMIONETA' | 'CAMION' | 'TRAILER' | 'AUTOELEVADOR';
  vencimiento_tecnica:   string | null; // texto crudo de la columna ITU/RTO, ej. "RTO 27/9/2026"
  aseguradora:           string | null; // "X" en la pizarra = sin dato → null
  vencimiento_seguro:    string | null; // dd/mm/yy(yy), null si "X"
  capacidad_combustible: string | null;
}

export const PIZARRA_DOS57: VehiculoPizarra[] = [
  // ── Camionetas / pickups ──────────────────────────────────────────────────
  { codigo: 'AG337MY', patente: 'AG 337 MY', descripcion: 'Ranger Pollo',    titular: 'DOS57', tipo_vehiculo: 'CAMIONETA', vencimiento_tecnica: 'ITV 16/07/27',   aseguradora: 'Fed.Patronal',  vencimiento_seguro: '12/12/26', capacidad_combustible: '75 lts' },
  { codigo: 'AA183PK', patente: 'AA 183 PK', descripcion: 'Toyota',         titular: 'DOS57', tipo_vehiculo: 'CAMIONETA', vencimiento_tecnica: 'RTO 27/9/2026',  aseguradora: 'Experta',       vencimiento_seguro: '27/11/26', capacidad_combustible: '60/65 lts' },
  { codigo: 'HLW156',  patente: 'HLW 156',   descripcion: 'Ranger',         titular: 'DOS57', tipo_vehiculo: 'CAMIONETA', vencimiento_tecnica: null,             aseguradora: 'Experta',       vencimiento_seguro: '07/9/26',  capacidad_combustible: '60/65 lts' },
  { codigo: 'KJR926',  patente: 'KJR 926',   descripcion: 'Toyota Plateada',titular: 'DOS57', tipo_vehiculo: 'CAMIONETA', vencimiento_tecnica: 'RTO 25/9/2026', aseguradora: 'Experta',       vencimiento_seguro: '30/09/26', capacidad_combustible: '60/65 lts' },
  { codigo: 'LVX455',  patente: 'LVX 455',   descripcion: 'Toyota',         titular: 'DOS57', tipo_vehiculo: 'CAMIONETA', vencimiento_tecnica: 'RTO 23/7/2027', aseguradora: 'Experta',       vencimiento_seguro: '27/11/26', capacidad_combustible: '60/65 lts' },
  { codigo: 'AE919JA', patente: 'AE 919 JA', descripcion: 'Toyota Roja',    titular: 'DOS57', tipo_vehiculo: 'CAMIONETA', vencimiento_tecnica: 'RTO 19/05/28', aseguradora: 'Experta',       vencimiento_seguro: '27/11/26', capacidad_combustible: '60/65 lts' },
  { codigo: 'KEX251',  patente: 'KEX 251',   descripcion: 'Toyota',         titular: 'DOS57', tipo_vehiculo: 'CAMIONETA', vencimiento_tecnica: 'RTO 20/02/27', aseguradora: 'San Cristobal', vencimiento_seguro: '12/08/27', capacidad_combustible: '60/65 lts' },
  { codigo: 'PFG964',  patente: 'PFG 964',   descripcion: 'Ranger',         titular: 'DOS57', tipo_vehiculo: 'CAMIONETA', vencimiento_tecnica: 'RTO 22/07/2027', aseguradora: 'Experta',       vencimiento_seguro: '27/11/26', capacidad_combustible: '60/65 lts' },
  { codigo: 'AF728AT', patente: 'AF 728 AT', descripcion: 'Sprinter',       titular: 'DOS57', tipo_vehiculo: 'CAMIONETA', vencimiento_tecnica: 'ITV 16/11/2026', aseguradora: 'San Cristobal', vencimiento_seguro: '16/07/27', capacidad_combustible: '71/75 lts (100ltr/100km)' },

  // ── Trailers / acoplados ──────────────────────────────────────────────────
  { codigo: 'HLW156-ACOPLADO', patente: 'HLW 156', descripcion: 'Trailer',          titular: 'DOS57', tipo_vehiculo: 'TRAILER', vencimiento_tecnica: null, aseguradora: 'Rivadavia', vencimiento_seguro: '07/09/26', capacidad_combustible: null },
  { codigo: 'KJR926-ACOPLADO', patente: 'KJR 926', descripcion: 'Trailer',          titular: 'DOS57', tipo_vehiculo: 'TRAILER', vencimiento_tecnica: null, aseguradora: 'Rivadavia', vencimiento_seguro: '02/10/26', capacidad_combustible: null },
  { codigo: 'WNO918-ACOPLADO', patente: 'WNO 918', descripcion: 'Trailer Amarillo', titular: 'DOS57', tipo_vehiculo: 'TRAILER', vencimiento_tecnica: null, aseguradora: 'Rivadavia', vencimiento_seguro: '02/10/26', capacidad_combustible: null },

  // ── Camiones ──────────────────────────────────────────────────────────────
  { codigo: 'AG768OI', patente: 'AG 768 OI', descripcion: 'Mercedes Bco',  titular: 'DOS57', tipo_vehiculo: 'CAMION', vencimiento_tecnica: 'RTO 05/08/27', aseguradora: 'Allianz',       vencimiento_seguro: '31/07/27', capacidad_combustible: '315 lts + 35 UREA' },
  { codigo: 'AD737FN', patente: 'AD 737 FN', descripcion: 'Semi Negro',   titular: 'DOS57', tipo_vehiculo: 'CAMION', vencimiento_tecnica: 'RTO 31/08/27', aseguradora: 'Experta',       vencimiento_seguro: '27/11/26', capacidad_combustible: null },
  { codigo: 'FTL303',  patente: 'FTL 303',   descripcion: 'Volvo',        titular: 'DOS57', tipo_vehiculo: 'CAMION', vencimiento_tecnica: 'RTO 31/08/27', aseguradora: 'San Cristobal', vencimiento_seguro: '30/11/26', capacidad_combustible: null },
  { codigo: 'AA830GU', patente: 'AA 830 GU', descripcion: 'Semi Bco',     titular: 'DOS57', tipo_vehiculo: 'CAMION', vencimiento_tecnica: 'RTO 17/07/27', aseguradora: 'Experta',       vencimiento_seguro: '27/11/26', capacidad_combustible: '610 lts (2 tanques)' },
  { codigo: 'HKQ258',  patente: 'HKQ 258',   descripcion: 'Camion Negro', titular: 'DOS57', tipo_vehiculo: 'CAMION', vencimiento_tecnica: 'RTO 05/8/27',  aseguradora: 'Experta',       vencimiento_seguro: '27/11/26', capacidad_combustible: null },
  { codigo: 'IBO355',  patente: 'IBO 355',   descripcion: 'Semi Naranja', titular: 'DOS57', tipo_vehiculo: 'CAMION', vencimiento_tecnica: 'RTO 11/02/27', aseguradora: 'San Cristobal', vencimiento_seguro: '04/12/26', capacidad_combustible: '500 lts' },
  { codigo: 'AG958JV', patente: 'AG 958 JV', descripcion: 'Plancha',      titular: 'DOS57', tipo_vehiculo: 'CAMION', vencimiento_tecnica: 'RTO 04/08/27', aseguradora: 'San Cristobal', vencimiento_seguro: '01/12/26', capacidad_combustible: null },
  // Vencimiento de seguro "61/7/26" en la pizarra — fecha inexistente (día 61),
  // Lorena la marcó como dudosa. Se guarda el vehículo igual, pero no se crea
  // SeguroVehiculo por esta fila (ver importarSiniestros: el import reporta el
  // problema en `errores` para que se confirme con Lorena/el productor).
  { codigo: 'WNO918',  patente: 'WNO 918',   descripcion: 'Mercedes',     titular: 'DOS57', tipo_vehiculo: 'CAMION', vencimiento_tecnica: null, aseguradora: 'Federacion', vencimiento_seguro: '61/7/26', capacidad_combustible: '210 lts + 35 UREA' },

  // ── Autoelevadores (sin patente — equipo interno, numerado 1-4) ──────────────
  { codigo: 'AUTOELEV-1', patente: null, descripcion: 'Polo (ex Ranvl)', titular: 'DOS57', tipo_vehiculo: 'AUTOELEVADOR', vencimiento_tecnica: null, aseguradora: 'Sancor', vencimiento_seguro: '16/02/27', capacidad_combustible: null },
  { codigo: 'AUTOELEV-2', patente: null, descripcion: 'Polo',           titular: 'DOS57', tipo_vehiculo: 'AUTOELEVADOR', vencimiento_tecnica: null, aseguradora: null,     vencimiento_seguro: null,       capacidad_combustible: null },
  { codigo: 'AUTOELEV-3', patente: null, descripcion: 'Kempes',         titular: 'DOS57', tipo_vehiculo: 'AUTOELEVADOR', vencimiento_tecnica: null, aseguradora: null,     vencimiento_seguro: null,       capacidad_combustible: null },
  { codigo: 'AUTOELEV-4', patente: null, descripcion: '4x4',            titular: 'DOS57', tipo_vehiculo: 'AUTOELEVADOR', vencimiento_tecnica: null, aseguradora: null,     vencimiento_seguro: null,       capacidad_combustible: null },
];

// dd/mm/yy o dd/mm/yyyy — devuelve null si el día/mes no son válidos (ej. la
// fecha dudosa "61/7/26" de la pizarra, día 61 inexistente).
function parseFechaPizarra(s: string | null): Date | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  let anio  = Number(m[3]);
  if (anio < 100) anio += 2000;
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCMonth() !== mes - 1) return null; // ej. 31/04 → se corrige solo a mayo, se rechaza
  return fecha;
}

const MS_DIA = 86_400_000;

function computeEstadoSeguro(fechaVencimiento: Date): EstadoSeguro {
  const hoy = new Date();
  if (fechaVencimiento < hoy) return EstadoSeguro.VENCIDO;
  if (fechaVencimiento.getTime() < hoy.getTime() + 30 * MS_DIA) return EstadoSeguro.POR_VENCER;
  return EstadoSeguro.VIGENTE;
}

export interface ImportPizarraResultado {
  vehiculos_creados:    string[];
  vehiculos_actualizados: string[];
  seguros_creados:      string[];
  seguros_omitidos:     number; // ya existía uno con la misma aseguradora/vencimiento
  errores:              string[];
}

export async function importarPizarraFlota(
  empresaId: number,
  usuarioId: number,
  vehiculos: VehiculoPizarra[], // filas de la planilla subida (parsePlanillaPizarra)
): Promise<ImportPizarraResultado> {
  const resultado: ImportPizarraResultado = {
    vehiculos_creados: [], vehiculos_actualizados: [], seguros_creados: [], seguros_omitidos: 0, errores: [],
  };

  // Se trae una sola vez y se matchea en memoria — Postgres no tiene acá una
  // función "normalizar" indexable sin extensión, y con ~60 vehículos por
  // empresa esto es más simple y sigue siendo instantáneo.
  const existentes = await prisma.camion.findMany({ where: { empresa_id: empresaId, deleted_at: null } });

  for (const v of vehiculos) {
    const notaTecnica = v.vencimiento_tecnica; // ya viene con su propia etiqueta ("RTO 27/9/2026", "ITV 16/07/27")
    const patenteNorm = normalizarPatente(v.patente);

    // Los trailers/acoplados comparten dominio con su tractor a propósito
    // (ver PIZARRA_DOS57) — para ellos el match es sólo por `codigo`.
    // Para el resto: primero `codigo` exacto y, si no, patente normalizada
    // (evita duplicar un vehículo creado con otro formato, ej. "HLW 156" por
    // el importador de combustible) — pero NUNCA contra un acoplado: comparte
    // la patente del tractor y antes se lo pisaba con los datos del tractor.
    const esAcoplado = (c: { codigo: string; tipo_vehiculo: string | null }) =>
      c.tipo_vehiculo === 'TRAILER' || /-ACOPLADO$/i.test(c.codigo);
    const existente = v.tipo_vehiculo === 'TRAILER' || !patenteNorm
      ? existentes.find(c => c.codigo === v.codigo) ?? null
      : existentes.find(c => c.codigo === v.codigo && !esAcoplado(c))
        ?? existentes.find(c => !esAcoplado(c) && normalizarPatente(c.patente) === patenteNorm)
        ?? null;

    if (existente) {
      // La planilla de Lorena es la fuente de verdad: lo que trae con dato
      // pisa lo existente; las celdas vacías no borran nada. `notas` sólo se
      // pisa si estaba vacía o era la nota técnica anterior ("RTO …", "ITV …")
      // — así no se pierde una nota cargada a mano desde Flota.
      const notaEsTecnica = !existente.notas || /^(RTO|ITV|ITU|VTV)\b/i.test(existente.notas.trim());
      await prisma.camion.update({
        where: { id: existente.id },
        data: {
          descripcion:            v.descripcion || existente.descripcion,
          patente:                existente.patente ?? patenteNorm,
          tipo:                   v.tipo_vehiculo ?? existente.tipo,
          titular:                v.titular || existente.titular,
          tipo_vehiculo:          v.tipo_vehiculo ?? existente.tipo_vehiculo,
          capacidad_combustible:  v.capacidad_combustible ?? existente.capacidad_combustible,
          notas:                  notaTecnica && notaEsTecnica ? notaTecnica : existente.notas,
        },
      });
      resultado.vehiculos_actualizados.push(existente.codigo);
      await importarSeguroVehiculo(existente.id, v, empresaId, usuarioId, resultado);
      continue;
    }

    const nuevo = await prisma.camion.create({
      data: {
        empresa_id:             empresaId,
        codigo:                 (patenteNorm && v.tipo_vehiculo !== 'TRAILER') ? patenteNorm : v.codigo,
        patente:                patenteNorm,
        descripcion:            v.descripcion,
        tipo:                   v.tipo_vehiculo,
        tipo_vehiculo:          v.tipo_vehiculo,
        titular:                v.titular,
        capacidad_combustible:  v.capacidad_combustible,
        notas:                  notaTecnica,
        en_servicio:            true,
      },
    });
    resultado.vehiculos_creados.push(nuevo.codigo);
    await importarSeguroVehiculo(nuevo.id, v, empresaId, usuarioId, resultado);
  }

  return resultado;
}

async function importarSeguroVehiculo(
  camionId: number,
  v: VehiculoPizarra,
  empresaId: number,
  usuarioId: number,
  resultado: ImportPizarraResultado,
): Promise<void> {
  if (!v.aseguradora || !v.vencimiento_seguro) return;

  const fechaVencimiento = parseFechaPizarra(v.vencimiento_seguro);
  if (!fechaVencimiento) {
    resultado.errores.push(`${v.codigo}: vencimiento de seguro inválido en la pizarra ("${v.vencimiento_seguro}") — se omitió el seguro, confirmar con Lorena`);
    return;
  }

  const yaExiste = await prisma.seguroVehiculo.findFirst({
    where: { camion_id: camionId, empresa_id: empresaId, aseguradora: v.aseguradora, fecha_vencimiento: fechaVencimiento, deleted_at: null },
  });
  if (yaExiste) { resultado.seguros_omitidos++; return; }

  // La pizarra sólo registra el vencimiento, no el inicio de vigencia — se
  // asume una póliza anual (estándar del rubro) y se aproxima un año atrás;
  // se puede corregir a mano desde Flota una vez que Lorena confirme la
  // fecha real con el productor de seguros.
  const fechaInicioAprox = new Date(Date.UTC(fechaVencimiento.getUTCFullYear() - 1, fechaVencimiento.getUTCMonth(), fechaVencimiento.getUTCDate()));

  await prisma.seguroVehiculo.create({
    data: {
      camion_id:         camionId,
      empresa_id:        empresaId,
      aseguradora:       v.aseguradora,
      fecha_inicio:      fechaInicioAprox,
      fecha_vencimiento: fechaVencimiento,
      estado:            computeEstadoSeguro(fechaVencimiento),
      notas:             'Importado desde la planilla de flota (pizarra) de DOS57',
      created_by:        usuarioId,
    },
  });
  resultado.seguros_creados.push(`${v.codigo} (${v.aseguradora})`);
}

// ── Planilla Excel de la pizarra (Lorena la descarga, la mantiene y la reimporta) ──
// La plantilla sale precargada con PIZARRA_DOS57 (la transcripción de la foto).
// Una fila = un vehículo. CÓDIGO sólo hace falta para lo que no tiene dominio
// propio (autoelevadores) o lo comparte con su tractor (acoplados); si está
// vacío se usa el dominio.

const COLUMNAS_PIZARRA = [
  { key: 'codigo',                header: 'CÓDIGO',                width: 18 },
  { key: 'patente',               header: 'DOMINIO',               width: 13 },
  { key: 'descripcion',           header: 'VEHÍCULO',              width: 22 },
  { key: 'tipo_vehiculo',         header: 'TIPO',                  width: 15 },
  { key: 'titular',               header: 'TITULAR',               width: 12 },
  { key: 'vencimiento_tecnica',   header: 'ITU / RTO',             width: 18 },
  { key: 'aseguradora',           header: 'ASEGURADORA',           width: 16 },
  { key: 'vencimiento_seguro',    header: 'VENC. SEGURO',          width: 14 },
  { key: 'capacidad_combustible', header: 'CAPACIDAD COMBUSTIBLE', width: 26 },
] as const;

const TIPOS_VEHICULO = ['CAMIONETA', 'CAMION', 'TRAILER', 'AUTOELEVADOR'] as const;

export async function generarPlantillaPizarra(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('PIZARRA FLOTA', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = COLUMNAS_PIZARRA.map(c => ({ key: c.key, header: c.header, width: c.width }));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
  head.alignment = { vertical: 'middle' };

  for (const v of PIZARRA_DOS57) {
    ws.addRow({ ...v, patente: v.patente ?? '' });
  }
  // Fechas como texto (dd/mm/aaaa, igual que la pizarra) para que Excel no las reinterprete
  ws.getColumn('vencimiento_seguro').numFmt = '@';
  const ultima = Math.max(ws.rowCount, 2) + 200;
  for (let r = 2; r <= ultima; r++) {
    ws.getCell(`D${r}`).dataValidation = {
      type: 'list', allowBlank: true, formulae: [`"${TIPOS_VEHICULO.join(',')}"`],
      showErrorMessage: true, errorTitle: 'Tipo inválido', error: `Usá uno de: ${TIPOS_VEHICULO.join(', ')}`,
    };
  }

  const ins = wb.addWorksheet('INSTRUCCIONES');
  ins.getColumn(1).width = 110;
  [
    'Planilla de flota DOS57 (pizarra). Una fila por vehículo. Al reimportarla:',
    '• Se busca el vehículo por DOMINIO (o por CÓDIGO si es acoplado o no tiene dominio). Si no existe, se crea.',
    '• Las celdas con dato actualizan el vehículo; las celdas vacías NO borran lo que ya está cargado.',
    '• Seguro: ASEGURADORA + VENC. SEGURO (dd/mm/aaaa). Un vencimiento nuevo carga una póliza nueva; la anterior queda en el historial.',
    '• TIPO: CAMIONETA, CAMION, TRAILER o AUTOELEVADOR.',
    '• CÓDIGO: sólo necesario para autoelevadores (sin dominio) y acoplados (comparten dominio con su tractor, ej. HLW156-ACOPLADO).',
    '• "X" o vacío en ASEGURADORA / VENC. SEGURO = sin dato.',
    '• No borrar filas de vehículos dados de baja: la baja se hace desde Flota.',
  ].forEach((t, i) => { const c = ins.getCell(`A${i + 1}`); c.value = t; if (i === 0) c.font = { bold: true }; });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export interface ParseoPizarra { vehiculos: VehiculoPizarra[]; errores: string[] }

const normHeaderPizarra = (s: unknown) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const textoCelda = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s && s.toUpperCase() !== 'X' ? s : null;
};

// VENC. SEGURO: texto "12/12/26" (lo normal, la columna es texto) o fecha real
// de Excel si alguien la tipeó en una celda con formato fecha.
function vencimientoCelda(v: unknown): string | null {
  if (v instanceof Date) return `${v.getUTCDate()}/${v.getUTCMonth() + 1}/${v.getUTCFullYear()}`;
  if (typeof v === 'number' && v > 20000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * MS_DIA);
    return `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;
  }
  return textoCelda(v);
}

export function parsePlanillaPizarra(buffer: Buffer): ParseoPizarra {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const errores: string[] = [];
  const vehiculos: VehiculoPizarra[] = [];

  // Primera hoja que tenga un encabezado con DOMINIO y VEHÍCULO
  for (const nombre of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nombre], { header: 1, defval: null, raw: true, blankrows: false });
    const iHead = rows.findIndex(r => {
      const h = (r ?? []).map(normHeaderPizarra);
      return h.includes('DOMINIO') && h.includes('VEHICULO');
    });
    if (iHead < 0) continue;

    const h = rows[iHead].map(normHeaderPizarra);
    const col = (...nombres: string[]) => h.findIndex(x => nombres.includes(x));
    const c = {
      codigo:      col('CODIGO'),
      patente:     col('DOMINIO', 'PATENTE'),
      descripcion: col('VEHICULO'),
      tipo:        col('TIPO', 'TIPODEVEHICULO'),
      titular:     col('TITULAR'),
      tecnica:     col('ITURTO', 'ITU', 'RTO', 'ITV', 'VTV'),
      aseguradora: col('ASEGURADORA', 'SEGURO', 'COMPANIAASEGURADORA'),
      venc:        col('VENCSEGURO', 'VENCIMIENTOSEGURO', 'VENCIMIENTO'),
      capacidad:   col('CAPACIDADCOMBUSTIBLE', 'CAPACIDAD', 'COMBUSTIBLE'),
    };
    const codigosVistos = new Set<string>();

    rows.slice(iHead + 1).forEach((r, i) => {
      const fila = iHead + i + 2; // n° de fila de Excel
      const get = (k: keyof typeof c) => (c[k] >= 0 ? r[c[k]] : null);
      const patenteRaw  = textoCelda(get('patente'));
      const descripcion = textoCelda(get('descripcion'));
      const codigoRaw   = textoCelda(get('codigo'));
      if (!patenteRaw && !descripcion && !codigoRaw) return; // fila vacía

      const tipoRaw = normHeaderPizarra(get('tipo'));
      const tipo = tipoRaw === 'ACOPLADO' || tipoRaw === 'SEMI' ? 'TRAILER'
        : (TIPOS_VEHICULO as readonly string[]).includes(tipoRaw) ? tipoRaw as VehiculoPizarra['tipo_vehiculo'] : null;
      if (!tipo) { errores.push(`Fila ${fila}: TIPO "${get('tipo') ?? ''}" inválido (usar ${TIPOS_VEHICULO.join(', ')}) — fila omitida`); return; }

      const patente = patenteRaw ? normalizarPatente(patenteRaw) : null;
      const codigo = codigoRaw?.toUpperCase() ?? (patente ? (tipo === 'TRAILER' ? `${patente}-ACOPLADO` : patente) : null);
      if (!codigo) { errores.push(`Fila ${fila}: sin DOMINIO ni CÓDIGO — fila omitida`); return; }
      if (codigosVistos.has(codigo)) { errores.push(`Fila ${fila}: el vehículo ${codigo} está repetido en la planilla — fila omitida`); return; }
      codigosVistos.add(codigo);

      vehiculos.push({
        codigo,
        patente:               patenteRaw,
        descripcion:           descripcion ?? '',
        titular:               textoCelda(get('titular')) ?? '',
        tipo_vehiculo:         tipo,
        vencimiento_tecnica:   textoCelda(get('tecnica')),
        aseguradora:           textoCelda(get('aseguradora')),
        vencimiento_seguro:    vencimientoCelda(get('venc')),
        capacidad_combustible: textoCelda(get('capacidad')),
      });
    });
    return { vehiculos, errores };
  }

  return { vehiculos, errores: ['No se encontró un encabezado con las columnas DOMINIO y VEHÍCULO — descargá la plantilla y usá ese formato.'] };
}
