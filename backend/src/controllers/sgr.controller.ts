import type { Request, Response } from 'express';
import { z } from 'zod';
import { Moneda } from '@prisma/client';
import { prisma } from '../lib/prisma';

// SGR — seguimiento informativo de cupo y vinculación (confirmado por Mayra:
// no dispara movimientos ni afecta ningún cálculo, sólo alertas). Mismo
// criterio de acceso cross-empresa que PlanAFIP/PrestamoBancario — ver
// getAccesoEmpresas() en afipPrestamos.controller.ts.

interface AccesoEmpresas {
  esAdminGlobal: boolean;
  empresaIds:    number[] | undefined;
}

async function getAccesoEmpresas(req: Request, res: Response): Promise<{ ok: true; info: AccesoEmpresas } | { ok: false }> {
  const usuario = await prisma.usuario.findFirst({
    where:  { id: req.user!.id, deleted_at: null },
    select: { empresa_id: true, puede_ver_macro: true },
  });
  if (!usuario) { res.status(401).json({ error: 'Sesión inválida' }); return { ok: false }; }

  const esAdminGlobal = req.user!.rol === 'ADMIN' && usuario.empresa_id === null;
  if (esAdminGlobal) return { ok: true, info: { esAdminGlobal: true, empresaIds: undefined } };

  if (usuario.puede_ver_macro) {
    const accesos = await prisma.usuarioEmpresaAcceso.findMany({
      where:  { usuario_id: req.user!.id },
      select: { empresa_id: true },
    });
    return { ok: true, info: { esAdminGlobal: false, empresaIds: accesos.map(a => a.empresa_id) } };
  }

  return { ok: true, info: { esAdminGlobal: false, empresaIds: [req.empresaId!] } };
}

function scopeWhere(info: AccesoEmpresas): Record<string, unknown> {
  return info.empresaIds !== undefined ? { empresa_id: { in: info.empresaIds } } : {};
}

async function resolveEmpresaDestino(req: Request, res: Response, bodyEmpresaId: number | null | undefined): Promise<{ ok: true; empresaId: number } | { ok: false }> {
  if (bodyEmpresaId == null) return { ok: true, empresaId: req.empresaId! };

  const acceso = await getAccesoEmpresas(req, res);
  if (!acceso.ok) return { ok: false };
  if (acceso.info.empresaIds !== undefined && !acceso.info.empresaIds.includes(bodyEmpresaId)) {
    res.status(400).json({ error: 'No tenés acceso a esa empresa' });
    return { ok: false };
  }
  return { ok: true, empresaId: bodyEmpresaId };
}

function mapSgr(s: any) {
  return {
    ...s,
    cupo_total:      s.cupo_total      !== null ? Number(s.cupo_total)      : null,
    cupo_utilizado:  s.cupo_utilizado  !== null ? Number(s.cupo_utilizado)  : null,
    cupo_disponible: s.cupo_disponible !== null ? Number(s.cupo_disponible) : null,
  };
}

function calcularCupoDisponible(total: number | null, utilizado: number | null): number | null {
  if (total === null && utilizado === null) return null;
  return (total ?? 0) - (utilizado ?? 0);
}

const ESTADOS_VINCULACION = ['ACTIVO', 'SUSPENDIDO', 'VENCIDO'] as const;

const sgrCreateSchema = z.object({
  empresa_id:         z.number().int().positive().nullable().optional(),
  nombre:             z.string().min(1),
  estado_vinculacion: z.enum(ESTADOS_VINCULACION).default('ACTIVO'),
  fecha_vinculacion:  z.string().nullable().optional(),
  fecha_vencimiento:  z.string().nullable().optional(),
  cupo_total:         z.number().nonnegative().nullable().optional(),
  cupo_utilizado:     z.number().nonnegative().nullable().optional(),
  moneda:             z.enum(['ARS', 'USD', 'EUR']).default('ARS'),
  contacto_nombre:    z.string().nullable().optional(),
  contacto_tel:       z.string().nullable().optional(),
  notas:              z.string().nullable().optional(),
});

const sgrUpdateSchema = sgrCreateSchema.omit({ empresa_id: true }).partial();

function toDate(s: string | null | undefined): Date | null { return s ? new Date(s) : null; }

export async function listSGR(req: Request, res: Response) {
  const acceso = await getAccesoEmpresas(req, res);
  if (!acceso.ok) return;

  const sgrs = await prisma.sGR.findMany({
    where:   { deleted_at: null, ...scopeWhere(acceso.info) },
    include: { empresa: { select: { id: true, nombre: true, nombre_corto: true } } },
    orderBy: { nombre: 'asc' },
  });
  res.json(sgrs.map(mapSgr));
}

export async function createSGR(req: Request, res: Response) {
  const parsed = sgrCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const destino = await resolveEmpresaDestino(req, res, d.empresa_id);
  if (!destino.ok) return;

  const cupo_disponible = calcularCupoDisponible(d.cupo_total ?? null, d.cupo_utilizado ?? null);

  const sgr = await prisma.sGR.create({
    data: {
      empresa_id:         destino.empresaId,
      nombre:             d.nombre,
      estado_vinculacion: d.estado_vinculacion,
      fecha_vinculacion:  toDate(d.fecha_vinculacion),
      fecha_vencimiento:  toDate(d.fecha_vencimiento),
      cupo_total:         d.cupo_total     ?? null,
      cupo_utilizado:     d.cupo_utilizado ?? null,
      cupo_disponible,
      moneda:             d.moneda as Moneda,
      contacto_nombre:    d.contacto_nombre ?? null,
      contacto_tel:       d.contacto_tel    ?? null,
      notas:              d.notas           ?? null,
    },
  });
  res.status(201).json(mapSgr(sgr));
}

export async function updateSGR(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = sgrUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const acceso = await getAccesoEmpresas(req, res);
  if (!acceso.ok) return;

  const existing = await prisma.sGR.findFirst({ where: { id, deleted_at: null, ...scopeWhere(acceso.info) } });
  if (!existing) { res.status(404).json({ error: 'SGR no encontrada' }); return; }

  const cupoTotalFinal     = d.cupo_total     !== undefined ? d.cupo_total     : (existing.cupo_total     !== null ? Number(existing.cupo_total)     : null);
  const cupoUtilizadoFinal = d.cupo_utilizado !== undefined ? d.cupo_utilizado : (existing.cupo_utilizado !== null ? Number(existing.cupo_utilizado) : null);
  const recomputarCupo     = d.cupo_total !== undefined || d.cupo_utilizado !== undefined;

  const sgr = await prisma.sGR.update({
    where: { id },
    data: {
      ...(d.nombre             !== undefined && { nombre: d.nombre }),
      ...(d.estado_vinculacion !== undefined && { estado_vinculacion: d.estado_vinculacion }),
      ...(d.fecha_vinculacion  !== undefined && { fecha_vinculacion: toDate(d.fecha_vinculacion) }),
      ...(d.fecha_vencimiento  !== undefined && { fecha_vencimiento: toDate(d.fecha_vencimiento) }),
      ...(d.cupo_total         !== undefined && { cupo_total: d.cupo_total }),
      ...(d.cupo_utilizado     !== undefined && { cupo_utilizado: d.cupo_utilizado }),
      ...(recomputarCupo       && { cupo_disponible: calcularCupoDisponible(cupoTotalFinal, cupoUtilizadoFinal) }),
      ...(d.moneda             !== undefined && { moneda: d.moneda as Moneda }),
      ...(d.contacto_nombre    !== undefined && { contacto_nombre: d.contacto_nombre }),
      ...(d.contacto_tel       !== undefined && { contacto_tel: d.contacto_tel }),
      ...(d.notas              !== undefined && { notas: d.notas }),
    },
  });
  res.json(mapSgr(sgr));
}

export async function deleteSGR(req: Request, res: Response) {
  const id = Number(req.params.id);
  const acceso = await getAccesoEmpresas(req, res);
  if (!acceso.ok) return;

  const existing = await prisma.sGR.findFirst({ where: { id, deleted_at: null, ...scopeWhere(acceso.info) } });
  if (!existing) { res.status(404).json({ error: 'SGR no encontrada' }); return; }

  await prisma.sGR.update({ where: { id }, data: { deleted_at: new Date() } });
  res.json({ message: 'SGR eliminada correctamente' });
}
