import * as XLSX from 'xlsx';
import { EstadoSiniestroVehiculo } from '@prisma/client';
import { prisma } from './prisma';
import { normalizarPatente } from './normalizarPatente';

// Importador de docs/dos57/lorena/2026_Informe siniestros vehiculos.xlsx
// (Lorena, DOS57). Hoja única "Hoja1": fila 1 = título, fila 2 = headers,
// desde fila 3 los datos. Columnas A-L — ver mapeo en importarPlanillaSiniestrosVehiculo.

function normalize(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[,.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function excelDateToJs(value: any): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  const m = String(value).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let anio = Number(m[3]);
    if (anio < 100) anio += 2000;
    return new Date(Date.UTC(anio, Number(m[2]) - 1, Number(m[1])));
  }
  return null;
}

function cell(row: any[], idx: number): string {
  return String(row[idx] ?? '').trim();
}

// Placeholders que la planilla usa como "sin dato" ("x", "X", "-").
function orNull(s: string): string | null {
  const t = s.trim();
  if (!t || /^[x\-–]$/i.test(t)) return null;
  return t;
}

// "Olivetto Andrea" (apellido nombre), "Santiago Bibiloni" (nombre apellido),
// "Vessoni,Furia" (apellido + apodo). Match si el apellido está en el texto y
// además algún token del nombre (≥3 letras) o el apodo. Mismo criterio
// conservador que siniestrosImporter.ts: sin fallback a sólo-apellido.
export function matchEmpleadoPorNombre(
  texto: string,
  empleados: { id: number; nombre: string; apellido: string; apodo: string | null; estado?: string }[],
): { id: number } | null {
  const norm = normalize(texto);
  if (!norm) return null;
  const tokens = new Set(norm.split(' '));
  const contiene = (frase: string) => {
    const f = normalize(frase);
    return !!f && f.split(' ').every(t => tokens.has(t));
  };
  const candidatos = empleados.filter(e => {
    if (!contiene(e.apellido)) return false;
    const nombreTokens = normalize(e.nombre).split(' ').filter(t => t.length >= 3);
    if (nombreTokens.some(t => tokens.has(t))) return true;
    return !!e.apodo && contiene(e.apodo);
  });
  if (candidatos.length === 0) return null;
  // Duplicados en la DB (ej. un mismo empleado cargado dos veces): priorizar ACTIVO.
  return candidatos.find(c => c.estado === 'ACTIVO') ?? candidatos[0];
}

// Patente argentina vieja (ABC 123) o Mercosur (AB 123 CD), con o sin espacios.
const PATENTE_RE = /\b([A-Z]{3}\s?\d{3}|[A-Z]{2}\s?\d{3}\s?[A-Z]{2})\b/i;

// Col J "Datos del Tercero": formato libre "Nombre/ Vehículo Patente/ Seguro".
// Casos reales: "Sin tercero" → todo null; 3 partes → nombre/vehículo/seguro;
// 2 partes con patente ("Dos57/AG 768 OI") → nombre/vehículo; 2 partes sin
// patente ("Fiat Siena/San Cristobal") → vehículo/seguro.
export function parsearTercero(raw: string): { tercero_nombre: string | null; tercero_vehiculo: string | null; tercero_seguro: string | null } {
  const vacio = { tercero_nombre: null, tercero_vehiculo: null, tercero_seguro: null };
  const t = raw.trim();
  if (!t || /^sin tercero$/i.test(t)) return vacio;

  const partes = t.split('/').map(p => p.trim()).filter(Boolean);
  if (partes.length >= 3) {
    return { tercero_nombre: partes[0], tercero_vehiculo: partes[1], tercero_seguro: partes.slice(2).join(' / ') };
  }
  if (partes.length === 2) {
    const idxPatente = partes.findIndex(p => PATENTE_RE.test(p));
    if (idxPatente === 1) return { tercero_nombre: partes[0], tercero_vehiculo: partes[1], tercero_seguro: null };
    if (idxPatente === 0) return { tercero_nombre: null, tercero_vehiculo: partes[0], tercero_seguro: partes[1] };
    return { tercero_nombre: null, tercero_vehiculo: partes[0], tercero_seguro: partes[1] };
  }
  return PATENTE_RE.test(t)
    ? { ...vacio, tercero_vehiculo: t }
    : { ...vacio, tercero_nombre: t };
}

// Col K "Estado de resolución". Un texto que no es un estado reconocido (caso
// real: "Reposicion de cerradura") queda ABIERTO y se preserva en observaciones.
export function mapearEstado(raw: string): { estado: EstadoSiniestroVehiculo; textoNoReconocido: string | null } {
  const n = normalize(raw);
  if (!n) return { estado: EstadoSiniestroVehiculo.ABIERTO, textoNoReconocido: null };
  if (n === 'resuelto')   return { estado: EstadoSiniestroVehiculo.RESUELTO, textoNoReconocido: null };
  if (n === 'en proceso') return { estado: EstadoSiniestroVehiculo.EN_PROCESO, textoNoReconocido: null };
  if (n === 's/n' || n === 'sn' || n === 'sin novedad') return { estado: EstadoSiniestroVehiculo.SIN_NOVEDAD, textoNoReconocido: null };
  if (n === 'abierto')    return { estado: EstadoSiniestroVehiculo.ABIERTO, textoNoReconocido: null };
  return { estado: EstadoSiniestroVehiculo.ABIERTO, textoNoReconocido: raw.trim() };
}

export interface ImportSiniestrosVehiculoResultado {
  filas_procesadas: number;
  creados:          number;
  actualizados:     number;
  omitidos:         number;
  sin_empleado:     string[];
  sin_vehiculo:     string[];
  estados_no_reconocidos: string[];
  errores:          string[];
}

export async function importarPlanillaSiniestrosVehiculo(
  workbook: XLSX.WorkBook,
  empresaId: number,
  usuarioId: number,
): Promise<ImportSiniestrosVehiculoResultado> {
  const ws = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false, raw: true });

  const [empleados, camiones] = await Promise.all([
    prisma.empleado.findMany({
      where:  { deleted_at: null, empresa_id: empresaId },
      select: { id: true, nombre: true, apellido: true, apodo: true, estado: true },
    }),
    prisma.camion.findMany({
      where:  { deleted_at: null, empresa_id: empresaId, patente: { not: null } },
      select: { id: true, codigo: true, patente: true },
    }),
  ]);

  const resultado: ImportSiniestrosVehiculoResultado = {
    filas_procesadas: 0, creados: 0, actualizados: 0, omitidos: 0,
    sin_empleado: [], sin_vehiculo: [], estados_no_reconocidos: [], errores: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const filaExcel = i + 1;
    // Sólo filas de datos: col A con fecha válida (salta título y headers).
    const fechaOcurrencia = excelDateToJs(row[0]);
    if (!fechaOcurrencia) continue;

    resultado.filas_procesadas++;
    try {
      const numeroSiniestro = cell(row, 1) || null;
      const nombreEmpleado  = orNull(cell(row, 2));
      const patenteRaw      = orNull(cell(row, 3));
      const { estado, textoNoReconocido } = mapearEstado(cell(row, 10));
      const observacionesExcel = orNull(cell(row, 11));

      if (!numeroSiniestro) {
        resultado.errores.push(`Fila ${filaExcel}: sin N° de siniestro, se omite (es la clave de actualización)`);
        resultado.omitidos++;
        continue;
      }

      const empleado = nombreEmpleado ? matchEmpleadoPorNombre(nombreEmpleado, empleados) : null;
      if (nombreEmpleado && !empleado) resultado.sin_empleado.push(nombreEmpleado);

      // KJR926 / HLW156 tienen además un registro "-ACOPLADO" con la misma
      // patente — el siniestro es del vehículo tractor, no del acoplado.
      const patenteNorm = normalizarPatente(patenteRaw);
      const matches = patenteNorm ? camiones.filter(c => c.patente === patenteNorm) : [];
      const camion  = matches.find(c => !/acoplado/i.test(c.codigo)) ?? matches[0] ?? null;
      if (patenteRaw && !camion) resultado.sin_vehiculo.push(patenteRaw);

      if (textoNoReconocido) resultado.estados_no_reconocidos.push(`${numeroSiniestro}: "${textoNoReconocido}"`);
      const observaciones = [
        textoNoReconocido ? `Estado en planilla: ${textoNoReconocido}` : null,
        observacionesExcel,
      ].filter(Boolean).join(' — ') || null;

      const data = {
        empresa_id:             empresaId,
        camion_id:              camion?.id ?? null,
        patente_texto:          camion ? null : patenteRaw,
        empleado_id:            empleado?.id ?? null,
        empleado_nombre_manual: empleado ? null : nombreEmpleado,
        aseguradora:            orNull(cell(row, 4)),
        numero_siniestro:       numeroSiniestro,
        fecha_denuncia:         excelDateToJs(row[8]),
        fecha_ocurrencia:       fechaOcurrencia,
        lugar:                  orNull(cell(row, 5)),
        descripcion:            orNull(cell(row, 6)),
        danios:                 orNull(cell(row, 7)),
        ...parsearTercero(cell(row, 9)),
        estado,
        observaciones,
      };

      const existente = await prisma.siniestroVehiculo.findUnique({
        where:  { empresa_id_numero_siniestro: { empresa_id: empresaId, numero_siniestro: numeroSiniestro } },
        select: { id: true },
      });
      if (existente) {
        await prisma.siniestroVehiculo.update({ where: { id: existente.id }, data: { ...data, deleted_at: null } });
        resultado.actualizados++;
      } else {
        await prisma.siniestroVehiculo.create({ data: { ...data, created_by: usuarioId } });
        resultado.creados++;
      }
    } catch (err: any) {
      resultado.errores.push(`Fila ${filaExcel}: ${err.message}`);
      resultado.omitidos++;
    }
  }

  return resultado;
}
