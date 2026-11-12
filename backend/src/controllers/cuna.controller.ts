import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { registrarAuditoria } from '../lib/auditoria';
import { withTenant } from '../lib/tenant';

const cunaSchema = z.object({
  codigo:      z.string().min(1),
  descripcion: z.string().nullable().optional(),
  activo:      z.boolean().optional(),
});

const cunaProductoSchema = z.object({
  producto_id: z.number().int().positive(),
  cantidad:    z.number().int().positive(),
});

export async function listCunas(req: Request, res: Response) {
  const cunas = await prisma.cuna.findMany({
    where:   { deleted_at: null, ...withTenant(req.empresaId!) },
    include: { productos: { include: { producto: { select: { id: true, nombre: true, unidad: true } } } } },
    orderBy: { codigo: 'asc' },
  });

  res.json(cunas.map(c => ({
    ...c,
    productos_distintos: c.productos.length,
    total_unidades:      c.productos.reduce((a, p) => a + p.cantidad, 0),
  })));
}

export async function getCuna(req: Request, res: Response) {
  const id = Number(req.params.id);
  const cuna = await prisma.cuna.findFirst({
    where:   { id, deleted_at: null, ...withTenant(req.empresaId!) },
    include: {
      productos: {
        include: {
          producto: {
            select: {
              id: true, nombre: true, unidad: true, codigo_interno: true, codigo_externo: true,
              nombre_tecnico: true, nombre_interno: true, es_critico: true,
            },
          },
        },
      },
    },
  });
  if (!cuna) { res.status(404).json({ error: 'Cuna no encontrada' }); return; }
  res.json(cuna);
}

export async function createCuna(req: Request, res: Response) {
  const parsed = cunaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const { codigo, descripcion } = parsed.data;

  const dupe = await prisma.cuna.findFirst({ where: { codigo, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (dupe) { res.status(400).json({ error: 'Ya existe una cuna con ese código' }); return; }

  const cuna = await prisma.cuna.create({
    data: { ...withTenant(req.empresaId!), codigo, descripcion: descripcion ?? null },
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'Cuna', entidadId: cuna.id,
    descripcion: `Creó cuna "${codigo}"`, datosDespues: { codigo }, ip: req.ip, tx: prisma,
  });

  res.status(201).json(cuna);
}

export async function updateCuna(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = cunaSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }

  const existing = await prisma.cuna.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Cuna no encontrada' }); return; }

  const { codigo, descripcion, activo } = parsed.data;

  if (codigo && codigo !== existing.codigo) {
    const dupe = await prisma.cuna.findFirst({ where: { codigo, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (dupe) { res.status(400).json({ error: 'Ya existe una cuna con ese código' }); return; }
  }

  const cuna = await prisma.cuna.update({
    where: { id },
    data: {
      ...(codigo      !== undefined && { codigo }),
      ...(descripcion !== undefined && { descripcion }),
      ...(activo      !== undefined && { activo }),
    },
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'Cuna', entidadId: id,
    descripcion: `Actualizó cuna "${existing.codigo}"`, datosAntes: { codigo: existing.codigo }, datosDespues: parsed.data,
    ip: req.ip, tx: prisma,
  });

  res.json(cuna);
}

export async function deleteCuna(req: Request, res: Response) {
  const id = Number(req.params.id);

  const existing = await prisma.cuna.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Cuna no encontrada' }); return; }

  const activas = await prisma.asignacionStock.count({ where: { cuna_id: id, estado: 'ACTIVA', deleted_at: null } });
  if (activas > 0) { res.status(400).json({ error: 'No se puede eliminar una cuna con asignaciones activas' }); return; }

  await prisma.cuna.update({ where: { id }, data: { deleted_at: new Date(), activo: false } });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'Cuna', entidadId: id,
    descripcion: `Eliminó cuna "${existing.codigo}"`, datosAntes: { codigo: existing.codigo }, ip: req.ip, tx: prisma,
  });

  res.json({ message: 'Cuna eliminada correctamente' });
}

// ── Contenido estandarizado (CunaProducto) ────────────────────────────────────

export async function addProductoCuna(req: Request, res: Response) {
  const cunaId = Number(req.params.id);
  const parsed = cunaProductoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const { producto_id, cantidad } = parsed.data;

  const cuna = await prisma.cuna.findFirst({ where: { id: cunaId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!cuna) { res.status(404).json({ error: 'Cuna no encontrada' }); return; }

  const producto = await prisma.producto.findFirst({ where: { id: producto_id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!producto) { res.status(404).json({ error: 'Producto no encontrado' }); return; }

  const existing = await prisma.cunaProducto.findUnique({ where: { cuna_id_producto_id: { cuna_id: cunaId, producto_id } } });

  const cunaProducto = existing
    ? await prisma.cunaProducto.update({ where: { id: existing.id }, data: { cantidad } })
    : await prisma.cunaProducto.create({ data: { cuna_id: cunaId, producto_id, cantidad } });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: existing ? 'UPDATE' : 'CREATE', entidad: 'CunaProducto', entidadId: cunaProducto.id,
    descripcion: `${existing ? 'Actualizó' : 'Agregó'} "${producto.nombre}" × ${cantidad} en cuna "${cuna.codigo}"`,
    ip: req.ip, tx: prisma,
  });

  res.status(201).json(cunaProducto);
}

export async function removeProductoCuna(req: Request, res: Response) {
  const cunaId     = Number(req.params.id);
  const productoId = Number(req.params.productoId);

  const cuna = await prisma.cuna.findFirst({ where: { id: cunaId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!cuna) { res.status(404).json({ error: 'Cuna no encontrada' }); return; }

  const existing = await prisma.cunaProducto.findUnique({ where: { cuna_id_producto_id: { cuna_id: cunaId, producto_id: productoId } } });
  if (!existing) { res.status(404).json({ error: 'Este producto no está en la cuna' }); return; }

  await prisma.cunaProducto.delete({ where: { id: existing.id } });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'CunaProducto', entidadId: existing.id,
    descripcion: `Quitó producto #${productoId} de cuna "${cuna.codigo}"`, ip: req.ip, tx: prisma,
  });

  res.json({ message: 'Producto quitado de la cuna correctamente' });
}
