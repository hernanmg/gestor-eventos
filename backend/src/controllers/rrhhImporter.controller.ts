import type { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import { CategoriaEmpleado } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { calcularHoras } from './rrhh.controller';

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeHeader(h: string): string {
  return h
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '');
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
