import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { registrarAuditoria } from '../lib/auditoria';
import { estadoCambiosFlota, mapCambio, ROTACION_CADA_KM } from '../lib/cambiosVehiculo';
import { procesarCambiosVehiculo } from '../lib/cambiosVehiculoImporter';

// Neumáticos y baterías por vehículo (Flota → Neumáticos y baterías).

const hoyUTC = () => { const h = new Date(); return new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth(), h.getUTCDate())); };
const fechaCal = (s: string | null | undefined) => (s ? new Date(`${s.slice(0, 10)}T00:00:00.000Z`) : null);

// GET /api/flota/cambios
export async function listCambios(req: Request, res: Response) {
  res.json({ vehiculos: await estadoCambiosFlota(req.empresaId!, hoyUTC()), rotacion_cada_km: ROTACION_CADA_KM });
}

const fechaStr = z.string().regex(/^\d{4}-\d{2}-\d{2}/).nullable().optional();
const cambioSchema = z.object({
  camion_id:     z.number().int().positive(),
  tipo:          z.enum(['NEUMATICOS', 'ROTACION', 'BATERIA']),
  fecha:         fechaStr,
  km:            z.number().int().nonnegative().nullable().optional(),
  detalle:       z.string().max(300).nullable().optional(),
  proximo_km:    z.number().int().positive().nullable().optional(),
  proxima_fecha: fechaStr,
  importe:       z.number().nonnegative().nullable().optional(),
  proveedor:     z.string().max(120).nullable().optional(),
  notas:         z.string().max(500).nullable().optional(),
});

async function validar(d: Partial<z.infer<typeof cambioSchema>>, empresaId: number) {
  if (d.camion_id != null) {
    const c = await prisma.camion.findFirst({ where: { id: d.camion_id, empresa_id: empresaId, deleted_at: null } });
    if (!c) return { error: 'Vehículo no encontrado' };
    return { camion: c };
  }
  return {};
}

function datos(d: Partial<z.infer<typeof cambioSchema>>) {
  const out: Record<string, unknown> = {};
  for (const k of ['tipo', 'km', 'detalle', 'proximo_km', 'importe', 'proveedor', 'notas'] as const) if (d[k] !== undefined) out[k] = d[k] === '' ? null : d[k];
  if (d.fecha !== undefined) out.fecha = fechaCal(d.fecha);
  if (d.proxima_fecha !== undefined) out.proxima_fecha = fechaCal(d.proxima_fecha);
  return out;
}

// POST /api/flota/cambios
export async function createCambio(req: Request, res: Response) {
  const parsed = cambioSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const d = parsed.data;
  if (!d.fecha && d.km == null) { res.status(400).json({ error: 'Poné la fecha o el km' }); return; }
  const v = await validar(d, req.empresaId!);
  if (v.error) { res.status(400).json({ error: v.error }); return; }
  // Rotación sin próxima anotada: la de siempre (km + 10.000)
  const proximo = d.tipo === 'ROTACION' && d.proximo_km == null && d.km != null ? d.km + ROTACION_CADA_KM : undefined;
  const nuevo = await prisma.$transaction(async tx => {
    const c = await tx.cambioVehiculo.create({ data: { empresa_id: req.empresaId!, camion_id: d.camion_id, ...(datos(d) as any), ...(proximo != null ? { proximo_km: proximo } : {}), created_by: req.user!.id } });
    // El km del cambio también actualiza el del vehículo si es mayor
    if (d.km != null && (v.camion!.km_actual == null || d.km > v.camion!.km_actual)) await tx.camion.update({ where: { id: d.camion_id }, data: { km_actual: d.km } });
    await registrarAuditoria({ usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'CambioVehiculo', entidadId: c.id, descripcion: `Registró ${d.tipo.toLowerCase()} en ${v.camion!.codigo}`, ip: req.ip, tx: tx as any });
    return c;
  });
  res.status(201).json(mapCambio(nuevo));
}

// PUT /api/flota/cambios/:id
export async function updateCambio(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.cambioVehiculo.findFirst({ where: { id, empresa_id: req.empresaId!, deleted_at: null } });
  if (!existing) { res.status(404).json({ error: 'Registro no encontrado' }); return; }
  const parsed = cambioSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const d = parsed.data;
  const v = await validar(d, req.empresaId!);
  if (v.error) { res.status(400).json({ error: v.error }); return; }
  const fecha = d.fecha !== undefined ? d.fecha : existing.fecha;
  const km = d.km !== undefined ? d.km : existing.km;
  if (!fecha && km == null) { res.status(400).json({ error: 'Poné la fecha o el km' }); return; }
  const upd = await prisma.cambioVehiculo.update({ where: { id }, data: { ...(datos(d) as any), ...(d.camion_id ? { camion_id: d.camion_id } : {}) } });
  await registrarAuditoria({ usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'CambioVehiculo', entidadId: id, descripcion: `Editó ${upd.tipo.toLowerCase()} #${id}`, ip: req.ip, tx: prisma as any });
  res.json(mapCambio(upd));
}

// DELETE /api/flota/cambios/:id
export async function deleteCambio(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.cambioVehiculo.findFirst({ where: { id, empresa_id: req.empresaId!, deleted_at: null } });
  if (!existing) { res.status(404).json({ error: 'Registro no encontrado' }); return; }
  await prisma.cambioVehiculo.update({ where: { id }, data: { deleted_at: new Date() } });
  await registrarAuditoria({ usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'CambioVehiculo', entidadId: id, descripcion: `Eliminó ${existing.tipo.toLowerCase()} #${id}`, ip: req.ip, tx: prisma as any });
  res.json({ ok: true });
}

// POST /api/flota/cambios/importar?aplicar=1
export async function importarCambios(req: Request, res: Response) {
  if (!req.file) { res.status(400).json({ error: 'Falta el archivo' }); return; }
  try {
    const r = await procesarCambiosVehiculo(req.file.buffer, req.empresaId!, req.user!.id, req.query.aplicar === '1' || req.query.aplicar === 'true');
    res.json(r);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'No se pudo leer la planilla' });
  }
}
