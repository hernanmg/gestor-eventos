import * as XLSX from 'xlsx';
import { TipoSiniestro, EstadoSiniestro } from '@prisma/client';
import { prisma } from './prisma';

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalize(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/\s+/g, ' ');
}

function excelDateToJs(value: any): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let anio = Number(m[3]);
    if (anio < 100) anio += 2000;
    return new Date(Date.UTC(anio, Number(m[1]) - 1, Number(m[2])));
  }
  return null;
}

function cell(row: any[], idx: number): string {
  return String(row[idx] ?? '').trim();
}

export interface ImportSiniestrosResultado {
  filas_procesadas: number;
  creados:          number;
  actualizados:     number;
  omitidos:         number;
  sin_empleado:     string[]; // nombres de la planilla sin match en Empleado
  errores:          string[];
}

// Empleado.nombre/apellido vienen separados en la DB, pero la planilla de
// Lorena trae "Apellido Nombre" en una sola celda (col D). A diferencia de
// rrhhImporter.controller.ts (que cae a sólo-apellido si no hay match
// completo), acá NO se usa ese fallback: un siniestro es un dato sensible
// (ART, legal) y vincularlo al empleado equivocado por compartir apellido es
// peor que dejarlo sin empleado — verificado con la planilla real, donde
// "Rodriguez Leonel" (jornalero, no cargado en RRHH) se pisaba con "Rodriguez
// Manuel" (el único Rodriguez fijo en la DB) si se permitía ese fallback.
function matchEmpleado(
  nombreCompleto: string,
  empleados: { id: number; nombre: string; apellido: string }[],
): { id: number } | null {
  const norm = normalize(nombreCompleto);
  if (!norm) return null;
  return empleados.find(e => norm.includes(normalize(e.apellido)) && norm.includes(normalize(e.nombre))) ?? null;
}

// La hoja "Hoja1" del informe de Lorena: fila 0 = título, fila 1 = headers,
// desde fila 2 los datos. Columnas A-M (índices 0-12) — ver relevamiento.
export async function importarPlanillaSiniestros(
  workbook: XLSX.WorkBook,
  empresaId: number,
  usuarioId: number,
): Promise<ImportSiniestrosResultado> {
  const sheetName = workbook.SheetNames[0];
  const ws        = workbook.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });

  const empleados = await prisma.empleado.findMany({
    where:  { deleted_at: null, empresa_id: empresaId },
    select: { id: true, nombre: true, apellido: true },
  });

  const resultado: ImportSiniestrosResultado = {
    filas_procesadas: 0, creados: 0, actualizados: 0, omitidos: 0, sin_empleado: [], errores: [],
  };

  for (const row of rows) {
    const item = cell(row, 0);
    if (!item || !/^\d+$/.test(item)) continue; // título / header / filas en blanco

    resultado.filas_procesadas++;

    try {
      const fechaOcurrencia = excelDateToJs(row[1]);
      const numeroSiniestro = cell(row, 2);
      const nombreEmpleado  = cell(row, 3);
      const artNombre       = cell(row, 4);
      const condicionLaboral = cell(row, 5);
      const tipoIncidente   = cell(row, 6);
      const diagnostico     = cell(row, 7);
      const zonaAfectada    = cell(row, 8);
      const lugarAccidente  = cell(row, 9);
      const zonaRiesgo      = cell(row, 10);
      const planAccion      = cell(row, 11);
      const fechaAltaMedica = excelDateToJs(row[12]);

      if (!numeroSiniestro) { resultado.errores.push(`Fila ${item}: sin N° de siniestro, se omite`); resultado.omitidos++; continue; }
      if (!fechaOcurrencia)  { resultado.errores.push(`Fila ${item}: fecha de siniestro inválida, se omite`); resultado.omitidos++; continue; }

      const empleado = matchEmpleado(nombreEmpleado, empleados);
      if (!empleado) resultado.sin_empleado.push(nombreEmpleado);

      const data = {
        empresa_id:  empresaId,
        empleado_id: empleado?.id ?? null,
        empleado_nombre_manual: empleado ? null : nombreEmpleado,
        tipo:             TipoSiniestro.ACCIDENTE_TRABAJO,
        fecha_ocurrencia: fechaOcurrencia,
        descripcion:      tipoIncidente || '(sin descripción en la planilla)',
        lugar:            lugarAccidente || null,
        art_nombre:           artNombre || null,
        art_numero_siniestro: numeroSiniestro,
        diagnostico:       diagnostico || null,
        zona_afectada:     zonaAfectada || null,
        condicion_laboral: condicionLaboral || null,
        zona_riesgo:       zonaRiesgo || null,
        plan_accion:       planAccion || null,
        fecha_alta_medica: fechaAltaMedica,
        estado: fechaAltaMedica ? EstadoSiniestro.CERRADO : EstadoSiniestro.ABIERTO,
        created_by: usuarioId,
      };

      const existente = await prisma.siniestroEmpleado.findFirst({
        where: { empresa_id: empresaId, art_numero_siniestro: numeroSiniestro, deleted_at: null },
        select: { id: true },
      });

      if (existente) {
        await prisma.siniestroEmpleado.update({ where: { id: existente.id }, data });
        resultado.actualizados++;
      } else {
        await prisma.siniestroEmpleado.create({ data });
        resultado.creados++;
      }
    } catch (err: any) {
      resultado.errores.push(`Fila ${item}: ${err.message}`);
      resultado.omitidos++;
    }
  }

  return resultado;
}
