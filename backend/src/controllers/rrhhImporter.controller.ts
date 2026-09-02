import type { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import { CategoriaEmpleado, TipoRecorrido, EstadoJornada } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { calcularHoras } from './rrhh.controller';
import {
  round2, calcularDiaSemana, calcularHorasTrabajadas, resolverValorPorVuelta, ESTADOS_BLOQUEAN_EDICION,
} from './bitacoraViajes.controller';

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeHeader(h: string): string {
  return h
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '');
}

// Como normalizeHeader, pero también colapsa espacios/saltos de línea
// internos — las planillas reales de sueldos tienen headers con "\r\n"
// adentro (ej. "Hrs \r\ntrabajadas").
function normalizeLoose(h: unknown): string {
  return normalizeHeader(String(h ?? '')).replace(/\s+/g, ' ');
}

// Las planillas de sueldos DOS57 escriben las horas como TEXTO en formato
// español "9:00 a. m." / "6:02 p. m." (no como fracción numérica de Excel,
// a diferencia de otras plantillas de este mismo sistema) — se parsea aparte
// de excelDateToJs/formatearHoraExcel. Devuelve "HH:MM" (24hs) o null si el
// valor no matchea ese formato (ej. es una palabra como "VACACIONES").
function parseHoraAmPm(raw: any): string | null {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?$/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toLowerCase() === 'p') h += 12;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

function getCell(row: Record<string, any>, aliases: string[]): any {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const match = keys.find(k => normalizeHeader(k) === alias);
    if (match !== undefined && row[match] !== undefined && row[match] !== '') return row[match];
  }
  return undefined;
}

function excelDateToJs(value: any): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H ?? 0, parsed.M ?? 0, parsed.S ?? 0);
  }
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
}

function combineFechaHora(fecha: Date, horaRaw: any): Date | null {
  if (horaRaw == null || horaRaw === '') return null;
  // Excel guarda horas "puras" como fracción de día (número) o como Date con fecha base 1899-12-30
  if (typeof horaRaw === 'number') {
    const totalMinutos = Math.round(horaRaw * 24 * 60);
    const h = Math.floor(totalMinutos / 60);
    const m = totalMinutos % 60;
    return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), h, m);
  }
  if (horaRaw instanceof Date) {
    return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), horaRaw.getHours(), horaRaw.getMinutes());
  }
  const match = String(horaRaw).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), Number(match[1]), Number(match[2]));
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/rrhh/importar/empleados
// Mapeo esperado (encabezados case-insensitive, sin acentos): nombre, apellido,
// dni, cuit, cbu, alias, banco, email, telefono — mismo layout que
// Proveedores-datos.xlsx. Enviar ?dry_run=true para previsualizar sin guardar.
// ═══════════════════════════════════════════════════════════════════════════

export async function importarEmpleados(req: Request, res: Response) {
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo .xlsx' }); return; }
  const dryRun = req.query.dry_run === 'true';

  let rows: Record<string, any>[];
  try {
    const wb    = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
  } catch (err: any) {
    res.status(400).json({ error: 'Error al procesar el archivo', detail: err.message }); return;
  }

  const existentes = await prisma.empleado.findMany({
    where:  { deleted_at: null, ...withTenant(req.empresaId!) },
    select: { dni: true },
  });
  const dnisExistentes = new Set(existentes.map(e => e.dni));

  const filas: any[] = [];
  rows.forEach((row, idx) => {
    const nombre   = getCell(row, ['nombre']);
    const apellido = getCell(row, ['apellido']);
    const dni      = getCell(row, ['dni', 'documento']);
    const dniStr   = dni ? String(dni).trim() : '';

    const errores: string[] = [];
    if (!nombre)   errores.push('Falta nombre');
    if (!apellido) errores.push('Falta apellido');
    if (!dniStr)   errores.push('Falta DNI');
    const duplicado = !!dniStr && dnisExistentes.has(dniStr);
    if (duplicado) errores.push('Ya existe un empleado con ese DNI');

    filas.push({
      fila_excel: idx + 2,
      nombre:     nombre   ? String(nombre).trim()   : null,
      apellido:   apellido ? String(apellido).trim() : null,
      dni:        dniStr || null,
      cuit:       getCell(row, ['cuit'])     ? String(getCell(row, ['cuit'])).trim()     : null,
      email:      getCell(row, ['email', 'mail'])       ?? null,
      telefono:   getCell(row, ['telefono', 'tel'])      ?? null,
      cbu:        getCell(row, ['cbu'])      ? String(getCell(row, ['cbu'])).trim()      : null,
      alias:      getCell(row, ['alias'])    ?? null,
      banco:      getCell(row, ['banco'])    ?? null,
      importable: errores.length === 0,
      errores,
    });
  });

  const importables = filas.filter(f => f.importable);

  if (dryRun) {
    res.json({
      preview:     true,
      total_filas: filas.length,
      importables: importables.length,
      omitidas:    filas.length - importables.length,
      filas,
    });
    return;
  }

  let creados = 0;
  for (const f of importables) {
    await prisma.empleado.create({
      data: {
        ...withTenant(req.empresaId!),
        nombre:     f.nombre,
        apellido:   f.apellido,
        dni:        f.dni,
        cuit:       f.cuit,
        email:      f.email,
        telefono:   f.telefono,
        cbu:        f.cbu,
        alias:      f.alias,
        banco:      f.banco,
        categoria:  CategoriaEmpleado.OTRO,
        created_by: req.user!.id,
      },
    });
    creados++;
    dnisExistentes.add(f.dni);
  }

  res.json({
    preview:  false,
    creados,
    omitidos: filas.length - creados,
    filas,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/rrhh/importar/jornadas
// Un empleado por hoja (nombre de la hoja se matchea contra apellido/nombre de
// empleados existentes), filas = jornadas. Columnas esperadas: fecha, hora
// ingreso, hora egreso, descripcion — mismo layout que Horas-y-vales.xlsx.
// Enviar ?dry_run=true para previsualizar sin guardar.
// ═══════════════════════════════════════════════════════════════════════════

export async function importarJornadas(req: Request, res: Response) {
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo .xlsx' }); return; }
  const dryRun = req.query.dry_run === 'true';

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(req.file.buffer, { type: 'buffer' });
  } catch (err: any) {
    res.status(400).json({ error: 'Error al procesar el archivo', detail: err.message }); return;
  }

  const empleados = await prisma.empleado.findMany({
    where:  { deleted_at: null, ...withTenant(req.empresaId!) },
    select: { id: true, nombre: true, apellido: true },
  });

  function matchEmpleado(sheetName: string) {
    const norm = normalizeHeader(sheetName);
    return empleados.find(e => norm.includes(normalizeHeader(e.apellido)) && norm.includes(normalizeHeader(e.nombre)))
        ?? empleados.find(e => norm.includes(normalizeHeader(e.apellido)));
  }

  const hojasResultado: any[] = [];
  const aCrear: { empleado_id: number; fecha: Date; hora_ingreso: Date | null; hora_egreso: Date | null; descripcion: string | null }[] = [];

  for (const sheetName of wb.SheetNames) {
    const empleado = matchEmpleado(sheetName);
    const sheet    = wb.Sheets[sheetName];
    const rows     = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: null });
    const filas: any[] = [];

    rows.forEach((row, idx) => {
      const fechaRaw = getCell(row, ['fecha']);
      const fecha    = excelDateToJs(fechaRaw);
      const errores: string[] = [];
      if (!empleado) errores.push('No se encontró un empleado cuyo nombre coincida con esta hoja');
      if (!fecha)    errores.push('Falta fecha o formato inválido');

      const horaIngresoRaw = getCell(row, ['hora ingreso', 'ingreso']);
      const horaEgresoRaw  = getCell(row, ['hora egreso', 'egreso']);
      const horaIngreso    = fecha ? combineFechaHora(fecha, horaIngresoRaw) : null;
      const horaEgreso     = fecha ? combineFechaHora(fecha, horaEgresoRaw)  : null;
      const descripcion    = getCell(row, ['descripcion', 'detalle', 'evento']) ?? null;

      filas.push({
        fila_excel:  idx + 2,
        empleado_id: empleado?.id ?? null,
        fecha:       fecha ? fecha.toISOString().slice(0, 10) : null,
        hora_ingreso: horaIngreso ? horaIngreso.toISOString() : null,
        hora_egreso:  horaEgreso  ? horaEgreso.toISOString()  : null,
        descripcion,
        importable:  errores.length === 0,
        errores,
      });

      if (errores.length === 0 && empleado && fecha) {
        aCrear.push({ empleado_id: empleado.id, fecha, hora_ingreso: horaIngreso, hora_egreso: horaEgreso, descripcion });
      }
    });

    hojasResultado.push({
      hoja:            sheetName,
      empleado_id:     empleado?.id ?? null,
      empleado_nombre: empleado ? `${empleado.apellido}, ${empleado.nombre}` : null,
      filas,
    });
  }

  if (dryRun) {
    res.json({ preview: true, hojas: hojasResultado, total_importables: aCrear.length });
    return;
  }

  let creados  = 0;
  let omitidos = 0;
  for (const item of aCrear) {
    const { horas_normales, horas_extras } = calcularHoras(item.hora_ingreso, item.hora_egreso);
    try {
      await prisma.jornada.create({
        data: {
          empleado_id: item.empleado_id,
          ...withTenant(req.empresaId!),
          fecha:        item.fecha,
          hora_ingreso: item.hora_ingreso,
          hora_egreso:  item.hora_egreso,
          horas_normales,
          horas_extras,
          descripcion:  item.descripcion,
          created_by:   req.user!.id,
        },
      });
      creados++;
    } catch (err: any) {
      if (err?.code === 'P2002') { omitidos++; continue; } // jornada ya existente para ese empleado+fecha
      throw err;
    }
  }

  res.json({ preview: false, creados, omitidos, hojas: hojasResultado });
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/rrhh/bitacora-viajes/importar?empleado_id=&mes=&anio=
// Layout real (hoja "VIAJES LUIS" o similar — se busca por nombre de hoja que
// contenga "VIAJES"): fila 1 nombre, fila 2 mes, fila 3 headers (ITEM | DIA |
// FECHA | EVENTO | RECORRIDO (3 subcols) | EJIDO (3 subcols) | VUELTAS |
// OBSERVACION), fila 4 sub-headers (INICIO/DESTINO/FINAL bajo RECORRIDO,
// PROVINCIAL/NACIONAL/NACIONAL+1000 bajo EJIDO), datos desde fila 5. Se
// detectan las columnas dinámicamente por texto de header (no por índice
// fijo) para tolerar variaciones menores entre plantillas. Un solo empleado
// por archivo (se elige antes de subir). Upsert por
// [empleado_id, fecha, tipo_recorrido]. Enviar ?dry_run=true para
// previsualizar sin guardar.
// ═══════════════════════════════════════════════════════════════════════════

interface ColumnasViajes {
  headerRow: number;
  fecha: number; evento: number; observacion: number;
  inicio: number; destino: number; final: number;
  provincial: number; nacional: number; nacional1000: number;
}

function detectarHojaViajes(wb: XLSX.WorkBook): string | null {
  return wb.SheetNames.find(n => normalizeLoose(n).includes('viajes')) ?? null;
}

function detectarColumnasViajes(rows: any[][]): ColumnasViajes | null {
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = (rows[r] ?? []).map(normalizeLoose);
    if (row[0] !== 'item') continue;
    const sub = (rows[r + 1] ?? []).map(normalizeLoose);

    const fecha       = row.findIndex(c => c === 'fecha');
    const evento       = row.findIndex(c => c === 'evento');
    const observacion  = row.findIndex(c => c.startsWith('observacion'));
    const inicio       = sub.findIndex(c => c === 'inicio');
    const destino      = sub.findIndex(c => c === 'destino');
    const final        = sub.findIndex(c => c === 'final');
    const nacional1000 = sub.findIndex(c => c.includes('nacional') && c.includes('1000'));
    const provincial    = sub.findIndex(c => c === 'provincial');
    const nacional      = sub.findIndex((c, i) => c.includes('nacional') && i !== nacional1000);

    if ([fecha, inicio, destino, final, provincial, nacional, nacional1000].some(i => i === -1)) return null;
    return { headerRow: r, fecha, evento, observacion, inicio, destino, final, provincial, nacional, nacional1000 };
  }
  return null;
}

export async function importarBitacoraViajes(req: Request, res: Response) {
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo .xlsx' }); return; }
  const dryRun = req.query.dry_run === 'true';
  const empleadoIdParam = req.query.empleado_id ? Number(req.query.empleado_id) : null;
  const mesParam  = req.query.mes  ? Number(req.query.mes)  : null;
  const anioParam = req.query.anio ? Number(req.query.anio) : null;
  if (!empleadoIdParam) { res.status(400).json({ error: 'Se requiere elegir un empleado (empleado_id)' }); return; }

  const empleado = await prisma.empleado.findFirst({
    where:  { id: empleadoIdParam, deleted_at: null, ...withTenant(req.empresaId!) },
    select: { id: true, nombre: true, apellido: true },
  });
  if (!empleado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  const acuerdo = await prisma.acuerdoSueldo.findFirst({ where: { empleado_id: empleado.id, activo: true, deleted_at: null } });

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(req.file.buffer, { type: 'buffer' });
  } catch (err: any) {
    res.status(400).json({ error: 'Error al procesar el archivo', detail: err.message }); return;
  }

  const nombreHoja = detectarHojaViajes(wb);
  if (!nombreHoja) { res.status(400).json({ error: 'No se encontró una hoja de viajes (se busca una hoja cuyo nombre contenga "VIAJES")' }); return; }

  const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[nombreHoja], { header: 1, defval: null, raw: true });
  const cols = detectarColumnasViajes(rows);
  if (!cols) { res.status(400).json({ error: `La hoja "${nombreHoja}" no tiene el formato esperado (headers ITEM/FECHA/RECORRIDO/EJIDO)` }); return; }

  const errores: { fila: number; motivo: string }[] = [];
  const aProcesar: {
    fila: number; fecha: Date; convocatoria: string | null; recorrido: string | null;
    tipo_recorrido: TipoRecorrido; cantidad_vueltas: number; observaciones: string | null;
  }[] = [];
  let sinRecorrido = 0;

  for (let r = cols.headerRow + 2; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const filaExcel = r + 1;
    const fechaLocal = excelDateToJs(row[cols.fecha]);
    if (!fechaLocal) break; // fin de la tabla (fila en blanco o TOTAL)
    const fecha = new Date(Date.UTC(fechaLocal.getFullYear(), fechaLocal.getMonth(), fechaLocal.getDate()));

    if (mesParam && anioParam && (fecha.getUTCMonth() + 1 !== mesParam || fecha.getUTCFullYear() !== anioParam)) {
      errores.push({ fila: filaExcel, motivo: 'Fecha fuera del período seleccionado' });
      continue;
    }

    const candidatos: { tipo: TipoRecorrido; vueltas: number }[] = [];
    const provincialVal = row[cols.provincial];
    const nacionalVal   = row[cols.nacional];
    const nacional1000Val = row[cols.nacional1000];
    if (typeof provincialVal === 'number' && provincialVal > 0)   candidatos.push({ tipo: TipoRecorrido.PROVINCIAL,    vueltas: provincialVal });
    if (typeof nacionalVal === 'number' && nacionalVal > 0)       candidatos.push({ tipo: TipoRecorrido.NACIONAL,      vueltas: nacionalVal });
    if (typeof nacional1000Val === 'number' && nacional1000Val > 0) candidatos.push({ tipo: TipoRecorrido.NACIONAL_1000, vueltas: nacional1000Val });

    if (candidatos.length === 0) { sinRecorrido++; continue; } // día sin viaje — no es un error
    if (candidatos.length > 1) {
      errores.push({ fila: filaExcel, motivo: `Más de un tipo de recorrido cargado en la misma fila — se usó ${candidatos[0].tipo}` });
    }
    const { tipo, vueltas } = candidatos[0];

    const evento = cols.evento !== -1 ? row[cols.evento] : null;
    const partesRecorrido = [row[cols.inicio], row[cols.destino], row[cols.final]].filter(v => v != null && v !== '').map(String);
    const observacion = cols.observacion !== -1 ? row[cols.observacion] : null;

    aProcesar.push({
      fila:             filaExcel,
      fecha,
      convocatoria:      evento ? String(evento).trim() : null,
      recorrido:         partesRecorrido.length > 0 ? partesRecorrido.join(' → ') : null,
      tipo_recorrido:    tipo,
      cantidad_vueltas:  Math.round(vueltas),
      observaciones:     observacion ? String(observacion).trim() : null,
    });
  }

  const resumenPreview = () => {
    const totales = { provincial: 0, nacional: 0, nacional_1000: 0 };
    let viaticoEstimado = 0;
    for (const item of aProcesar) {
      const key = item.tipo_recorrido === TipoRecorrido.PROVINCIAL ? 'provincial' : item.tipo_recorrido === TipoRecorrido.NACIONAL ? 'nacional' : 'nacional_1000';
      totales[key] += item.cantidad_vueltas;
      const valorPorVuelta = resolverValorPorVuelta(acuerdo, item.tipo_recorrido);
      if (valorPorVuelta !== null) viaticoEstimado += valorPorVuelta * item.cantidad_vueltas;
    }
    return {
      provincial: totales.provincial, nacional: totales.nacional, nacional_1000: totales.nacional_1000,
      total_vueltas: totales.provincial + totales.nacional + totales.nacional_1000,
      viatico_estimado: round2(viaticoEstimado),
    };
  };

  if (dryRun) {
    res.json({
      preview:         true,
      empleado_id:     empleado.id,
      empleado_nombre: `${empleado.apellido}, ${empleado.nombre}`,
      creados:         aProcesar.length, // estimado — al confirmar se separa en creados/actualizados reales
      actualizados:    0,
      omitidos:        sinRecorrido + errores.length,
      sin_recorrido:   sinRecorrido,
      errores,
      resumen:         resumenPreview(),
    });
    return;
  }

  let creados = 0;
  let actualizados = 0;
  for (const item of aProcesar) {
    const existing = await prisma.bitacoraViaje.findFirst({
      where:   { empleado_id: empleado.id, fecha: item.fecha, tipo_recorrido: item.tipo_recorrido, deleted_at: null },
      include: { liquidacion_admin: { select: { estado: true } } },
    });
    if (existing?.liquidacion_admin && ESTADOS_BLOQUEAN_EDICION.includes(existing.liquidacion_admin.estado)) {
      errores.push({ fila: item.fila, motivo: 'Ya está incluido en una liquidación aprobada — no se actualizó' });
      continue;
    }

    const valorPorVuelta   = resolverValorPorVuelta(acuerdo, item.tipo_recorrido);
    const viaticoCalculado = valorPorVuelta !== null ? round2(valorPorVuelta * item.cantidad_vueltas) : null;

    if (existing) {
      await prisma.bitacoraViaje.update({
        where: { id: existing.id },
        data: {
          convocatoria:      item.convocatoria,
          recorrido:         item.recorrido,
          cantidad_vueltas:  item.cantidad_vueltas,
          valor_por_vuelta:  valorPorVuelta,
          viatico_calculado: viaticoCalculado,
          observaciones:     item.observaciones,
        },
      });
      actualizados++;
    } else {
      await prisma.bitacoraViaje.create({
        data: {
          empleado_id:       empleado.id,
          ...withTenant(req.empresaId!),
          fecha:             item.fecha,
          convocatoria:      item.convocatoria,
          dia_semana:        calcularDiaSemana(item.fecha),
          ejido:             null,
          recorrido:         item.recorrido,
          tipo_recorrido:    item.tipo_recorrido,
          cantidad_vueltas:  item.cantidad_vueltas,
          valor_por_vuelta:  valorPorVuelta,
          viatico_calculado: viaticoCalculado,
          observaciones:     item.observaciones,
          created_by:        req.user!.id,
        },
      });
      creados++;
    }
  }

  res.json({
    preview: false,
    empleado_id:     empleado.id,
    empleado_nombre: `${empleado.apellido}, ${empleado.nombre}`,
    creados, actualizados,
    omitidos:      sinRecorrido + errores.length,
    sin_recorrido: sinRecorrido,
    errores,
    resumen: resumenPreview(),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/rrhh/jornadas/importar-historial?empleado_id=&mes=&anio=
// Historial de convocatorias — se parsea la hoja del Excel de sueldos cuyo
// nombre matchea el apellido/nombre del empleado (mismo criterio que
// importarJornadas). Se busca dinámicamente la fila de headers que contenga
// "Convocatoria" (su posición varía por empleado — ver planilla real). La
// columna "Convocatoria" está sobrecargada en el Excel real: para días
// trabajados contiene la HORA de convocatoria en texto ("9:00 a. m."), y para
// días especiales contiene una palabra de estado libre (VACACIONES, LIBRE,
// CARPETA, HOME OFFICE, ...) — no un nombre de evento como en la hoja de
// viajes. Se detecta cuál es parseando como hora; si no matchea, se guarda el
// texto tal cual en Jornada.convocatoria (cubre cualquier palabra de estado,
// no sólo LIBRE/VACACIONES). horas_normales = el valor ya calculado por el
// Excel (columna "Hrs trabajadas") — informativo, no se recalcula. Todas las
// filas con fecha válida generan una Jornada (upsert por [empleado_id,
// fecha]) en estado APROBADA. Enviar ?dry_run=true para previsualizar.
// ═══════════════════════════════════════════════════════════════════════════

interface ColumnasHistorial {
  headerRow: number;
  convocatoria: number; fecha: number; inicio: number; fin: number; horas: number;
}

function detectarColumnasHistorial(rows: any[][]): ColumnasHistorial | null {
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const row = (rows[r] ?? []).map(normalizeLoose);
    if (!row.includes('convocatoria')) continue;
    const convocatoria = row.findIndex(c => c === 'convocatoria');
    const fecha        = row.findIndex(c => c === 'fecha');
    const inicio        = row.findIndex(c => c === 'inicio de actividades');
    const fin            = row.findIndex(c => c === 'fin de actividades');
    const horas          = row.findIndex(c => c === 'hrs trabajadas');
    if ([fecha, inicio, fin, horas].some(i => i === -1)) continue;
    return { headerRow: r, convocatoria, fecha, inicio, fin, horas };
  }
  return null;
}

export async function importarHistorialConvocatorias(req: Request, res: Response) {
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo .xlsx' }); return; }
  const dryRun = req.query.dry_run === 'true';
  const empleadoIdParam = req.query.empleado_id ? Number(req.query.empleado_id) : null;
  const mesParam  = req.query.mes  ? Number(req.query.mes)  : null;
  const anioParam = req.query.anio ? Number(req.query.anio) : null;
  if (!empleadoIdParam) { res.status(400).json({ error: 'Se requiere elegir un empleado (empleado_id)' }); return; }

  const empleado = await prisma.empleado.findFirst({
    where:  { id: empleadoIdParam, deleted_at: null, ...withTenant(req.empresaId!) },
    select: { id: true, nombre: true, apellido: true },
  });
  if (!empleado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(req.file.buffer, { type: 'buffer' });
  } catch (err: any) {
    res.status(400).json({ error: 'Error al procesar el archivo', detail: err.message }); return;
  }

  // Match exacto primero (nombre/apellido normalizado === nombre de hoja) — un
  // match por "includes" suelto puede confundir, ej. "LUIS" matchea tanto la
  // hoja "LUIS" como "VIAJES LUIS" (que es la hoja de viajes, no la de
  // historial). Sólo se recurre a "includes" si no hay match exacto, y ahí sí
  // se excluye cualquier hoja que contenga "viajes".
  const apellidoNorm = normalizeLoose(empleado.apellido);
  const nombreNorm    = normalizeLoose(empleado.nombre);
  const nombreHoja =
    wb.SheetNames.find(n => { const norm = normalizeLoose(n); return norm === apellidoNorm || norm === nombreNorm; }) ??
    wb.SheetNames.find(n => {
      const norm = normalizeLoose(n);
      return !norm.includes('viajes') && (norm.includes(apellidoNorm) || norm.includes(nombreNorm));
    });
  if (!nombreHoja) { res.status(400).json({ error: `No se encontró una hoja que coincida con ${empleado.apellido}, ${empleado.nombre}` }); return; }

  const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[nombreHoja], { header: 1, defval: null, raw: true });
  const cols = detectarColumnasHistorial(rows);
  if (!cols) { res.status(400).json({ error: `La hoja "${nombreHoja}" no tiene el formato esperado (headers Convocatoria/Fecha/Inicio de Actividades/Fin de Actividades/Hrs trabajadas)` }); return; }

  const errores: { fila: number; motivo: string }[] = [];
  const aProcesar: {
    fila: number; fecha: Date; fechaLocal: Date; convocatoria: string | null;
    horaConvocatoria: string | null; horaIngreso: string | null; horaEgreso: string | null; horas: number;
  }[] = [];

  for (let r = cols.headerRow + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const filaExcel = r + 1;
    const fechaLocal = excelDateToJs(row[cols.fecha]);
    if (!fechaLocal) break; // fin de la tabla

    if (mesParam && anioParam && (fechaLocal.getMonth() + 1 !== mesParam || fechaLocal.getFullYear() !== anioParam)) {
      errores.push({ fila: filaExcel, motivo: 'Fecha fuera del período seleccionado' });
      continue;
    }

    const colARaw = row[cols.convocatoria];
    const horaConvocatoria = parseHoraAmPm(colARaw);
    const convocatoria = horaConvocatoria ? null : (colARaw != null && colARaw !== '' ? String(colARaw).trim() : null);
    const horaIngreso = parseHoraAmPm(row[cols.inicio]);
    const horaEgreso  = parseHoraAmPm(row[cols.fin]);
    const horasRaw = row[cols.horas];
    const horas = typeof horasRaw === 'number' ? horasRaw : (horasRaw ? Number(horasRaw) || 0 : 0);

    aProcesar.push({
      fila: filaExcel,
      fecha: new Date(Date.UTC(fechaLocal.getFullYear(), fechaLocal.getMonth(), fechaLocal.getDate())),
      fechaLocal,
      convocatoria,
      horaConvocatoria,
      horaIngreso,
      horaEgreso,
      horas,
    });
  }

  if (dryRun) {
    res.json({
      preview:         true,
      empleado_id:     empleado.id,
      empleado_nombre: `${empleado.apellido}, ${empleado.nombre}`,
      hoja:            nombreHoja,
      total_filas:     aProcesar.length,
      omitidos:        errores.length,
      errores,
      filas: aProcesar.map(f => ({
        fila_excel: f.fila, fecha: f.fecha.toISOString().slice(0, 10),
        convocatoria: f.convocatoria, hora_convocatoria: f.horaConvocatoria,
        hora_ingreso: f.horaIngreso, hora_egreso: f.horaEgreso, horas: f.horas,
      })),
    });
    return;
  }

  let creados = 0;
  let actualizados = 0;
  for (const item of aProcesar) {
    const horaConvocatoriaDate = combineFechaHora(item.fechaLocal, item.horaConvocatoria);
    const horaIngresoDate      = combineFechaHora(item.fechaLocal, item.horaIngreso);
    const horaEgresoDate       = combineFechaHora(item.fechaLocal, item.horaEgreso);

    const existing = await prisma.jornada.findFirst({ where: { empleado_id: empleado.id, fecha: item.fecha, deleted_at: null } });
    if (existing && existing.estado !== EstadoJornada.APROBADA) {
      // No se pisa una jornada pendiente/rechazada cargada manualmente por
      // otra vía — se deja para revisión manual en vez de sobreescribirla.
      errores.push({ fila: item.fila, motivo: `Ya existe una jornada en estado ${existing.estado} para esta fecha — no se sobreescribió` });
      continue;
    }

    const data = {
      hora_convocatoria: horaConvocatoriaDate,
      hora_ingreso:       horaIngresoDate,
      hora_egreso:        horaEgresoDate,
      horas_normales:     item.horas,
      horas_extras:       0,
      convocatoria:       item.convocatoria,
      estado:             EstadoJornada.APROBADA,
    };

    if (existing) {
      await prisma.jornada.update({ where: { id: existing.id }, data });
      actualizados++;
    } else {
      await prisma.jornada.create({
        data: {
          empleado_id: empleado.id,
          ...withTenant(req.empresaId!),
          fecha: item.fecha,
          ...data,
          created_by: req.user!.id,
          aprobado_por: req.user!.id,
          aprobado_at: new Date(),
        },
      });
      creados++;
    }
  }

  res.json({
    preview: false,
    empleado_id:     empleado.id,
    empleado_nombre: `${empleado.apellido}, ${empleado.nombre}`,
    hoja: nombreHoja,
    creados, actualizados,
    omitidos: errores.length,
    errores,
  });
}
