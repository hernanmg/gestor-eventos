import type { Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { prisma } from '../lib/prisma';
import { registrarAuditoria } from '../lib/auditoria';
import { withTenant } from '../lib/tenant';
import type { UbicacionStock, EstadoAsignacion, OrigenTransfer, Prisma } from '@prisma/client';

// ── Schemas ───────────────────────────────────────────────────────────────────

const productoCreateSchema = z.object({
  nombre:          z.string().min(1),
  descripcion:     z.string().nullable().optional(),
  categoria_id:    z.number().int().positive().nullable().optional(),
  codigo_interno:  z.string().nullable().optional(),
  codigo_externo:  z.string().nullable().optional(),
  nombre_tecnico:  z.string().nullable().optional(),
  nombre_interno:  z.string().nullable().optional(),
  valor_unitario:  z.number().nonnegative().nullable().optional(),
  es_critico:      z.boolean().optional(),
  catalogo_origen: z.string().nullable().optional(),
  stock_total:     z.number().int().min(0),
  stock_minimo:    z.number().int().min(0).default(0),
  unidad:          z.string().default('unidad'),
  notas:           z.string().nullable().optional(),
});

const categoriaSchema = z.object({
  nombre:      z.string().min(1),
  descripcion: z.string().nullable().optional(),
  color:       z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
});

const productoUpdateSchema = productoCreateSchema.partial();

const asignarSchema = z.object({
  producto_id:   z.number().int().positive(),
  cantidad:      z.number().int().positive(),
  fecha_salida:  z.string(),
  fecha_retorno: z.string().nullable().optional(),
  notas:         z.string().nullable().optional(),
  camion_id:     z.number().int().positive().nullable().optional(),
  cuna_id:       z.number().int().positive().nullable().optional(),
});

const updateAsignacionSchema = z.object({
  cantidad:      z.number().int().positive().optional(),
  fecha_salida:  z.string().optional(),
  fecha_retorno: z.string().nullable().optional(),
  notas:         z.string().nullable().optional(),
  camion_id:     z.number().int().positive().nullable().optional(),
  cuna_id:       z.number().int().positive().nullable().optional(),
});

const transferenciaSchema = z.object({
  asignacion_origen_id: z.number().int().positive(),
  evento_destino_id:    z.number().int().positive(),
  cantidad:             z.number().int().positive(),
  fecha_transferencia:  z.string(),
  notas:                z.string().nullable().optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDate(s: string): Date { return new Date(s); }

async function calcDisponibilidad(
  productoId: number,
  fechaDesde: Date,
  fechaHasta: Date,
  empresaId: number,
  excludeAsignacionId?: number,
) {
  const producto = await prisma.producto.findFirst({
    where: { id: productoId, deleted_at: null, ...withTenant(empresaId) },
    select: { id: true, nombre: true, stock_total: true, stock_minimo: true, unidad: true },
  });
  if (!producto) return null;

  const solapadas = await prisma.asignacionStock.findMany({
    where: {
      producto_id: productoId,
      estado:      'ACTIVA',
      deleted_at:  null,
      fecha_salida: { lte: fechaHasta },
      OR: [
        { fecha_retorno: null },
        { fecha_retorno: { gte: fechaDesde } },
      ],
      ...(excludeAsignacionId ? { id: { not: excludeAsignacionId } } : {}),
    },
    include: { evento: { select: { id: true, nombre: true } } },
  });

  const cantidad_comprometida = solapadas.reduce((a, s) => a + s.cantidad, 0);
  const disponible = producto.stock_total - cantidad_comprometida;

  return {
    producto_id: producto.id,
    nombre:      producto.nombre,
    stock_total: producto.stock_total,
    stock_minimo: producto.stock_minimo,
    cantidad_comprometida,
    disponible,
    asignaciones_solapadas: solapadas.map(s => ({
      asignacion_id: s.id,
      evento_id:     s.evento_id,
      evento_nombre: s.evento.nombre,
      cantidad:      s.cantidad,
      fecha_salida:  s.fecha_salida,
      fecha_retorno: s.fecha_retorno,
      estado:        s.estado,
    })),
    en_quiebre: disponible < 0,
  };
}

async function calcSugerencias(
  productoId: number,
  eventoDestinoId: number,
  fechaDesde: Date,
  _fechaHasta: Date,
  empresaId: number,
) {
  // Find active assignments of this product in other events
  const candidatas = await prisma.asignacionStock.findMany({
    where: {
      producto_id: productoId,
      estado:      'ACTIVA',
      deleted_at:  null,
      evento_id:   { not: eventoDestinoId },
      producto:    withTenant(empresaId),
    },
    include: {
      evento: { select: { id: true, nombre: true, fecha_fin: true } },
    },
  });

  const fechaDesdePlus2 = new Date(fechaDesde);
  fechaDesdePlus2.setDate(fechaDesdePlus2.getDate() + 2);

  const sugerencias = candidatas
    .map(c => {
      const fechaFinOrigen = c.evento.fecha_fin;
      let diasDeMargen = 0;
      let riesgo: 'BAJO' | 'MEDIO' | 'ALTO' = 'BAJO';

      if (fechaFinOrigen) {
        const diffMs = fechaDesde.getTime() - fechaFinOrigen.getTime();
        diasDeMargen = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diasDeMargen < 0) {
          riesgo = 'ALTO'; // solapamiento — requiere transferencia anticipada
        } else if (diasDeMargen <= 1) {
          riesgo = 'MEDIO';
        } else {
          riesgo = 'BAJO';
        }
      } else {
        // Sin fecha fin definida — solo si el evento origen termina antes
        riesgo = 'MEDIO';
      }

      return {
        asignacion_id:         c.id,
        evento_origen_id:      c.evento_id,
        evento_origen_nombre:  c.evento.nombre,
        fecha_fin_evento_origen: fechaFinOrigen,
        cantidad_disponible:   c.cantidad,
        dias_de_margen:        diasDeMargen,
        riesgo,
      };
    })
    .sort((a, b) => a.dias_de_margen - b.dias_de_margen);

  return sugerencias;
}

// ── Productos ─────────────────────────────────────────────────────────────────

const PRODUCTO_SELECT = {
  id: true, empresa_id: true, nombre: true, descripcion: true, categoria_id: true,
  categoria: true, stock_total: true, stock_minimo: true, unidad: true, notas: true,
  activo: true, created_at: true, updated_at: true, created_by: true, updated_by: true,
  codigo_interno: true, codigo_externo: true, nombre_tecnico: true, nombre_interno: true,
  foto_mime: true, foto_nombre: true, valor_unitario: true, es_critico: true, catalogo_origen: true,
} satisfies Prisma.ProductoSelect;

function mapProducto<T extends { foto_mime: string | null }>(p: T) {
  return { ...p, tiene_foto: !!p.foto_mime };
}

export async function listProductos(req: Request, res: Response) {
  const search       = typeof req.query.search          === 'string' ? req.query.search          : undefined;
  const categoriaRaw = typeof req.query.categoria        === 'string' ? req.query.categoria        : undefined;
  const catalogoRaw  = typeof req.query.catalogo_origen  === 'string' ? req.query.catalogo_origen  : undefined;

  const where: Prisma.ProductoWhereInput = { deleted_at: null, activo: true, ...withTenant(req.empresaId!) };
  if (search) {
    where.OR = [
      { nombre:         { contains: search, mode: 'insensitive' } },
      { codigo_interno: { contains: search, mode: 'insensitive' } },
      { codigo_externo: { contains: search, mode: 'insensitive' } },
      { nombre_tecnico: { contains: search, mode: 'insensitive' } },
      { nombre_interno: { contains: search, mode: 'insensitive' } },
      { categoria: { is: { nombre: { contains: search, mode: 'insensitive' } } } },
    ];
  }
  if (categoriaRaw) {
    const catId = Number(categoriaRaw);
    if (!isNaN(catId)) {
      where.categoria_id = catId;
    } else {
      // backward compat: filter by name
      where.categoria = { is: { nombre: { contains: categoriaRaw, mode: 'insensitive' } } };
    }
  }
  if (catalogoRaw) {
    where.catalogo_origen = catalogoRaw;
  }

  const productos = await prisma.producto.findMany({
    where,
    orderBy: { nombre: 'asc' },
    select:  PRODUCTO_SELECT,
  });

  const now = new Date();
  const results = await Promise.all(
    productos.map(async p => {
      const disp = await calcDisponibilidad(p.id, now, now, req.empresaId!);
      return {
        ...mapProducto(p),
        comprometido_hoy: disp?.cantidad_comprometida ?? 0,
        disponible_hoy:   disp?.disponible ?? p.stock_total,
      };
    }),
  );

  res.json(results);
}

export async function getProducto(req: Request, res: Response) {
  const id = Number(req.params.id);
  const producto = await prisma.producto.findFirst({
    where:  { id, deleted_at: null, ...withTenant(req.empresaId!) },
    select: {
      ...PRODUCTO_SELECT,
      asignaciones: {
        where:   { deleted_at: null },
        include: {
          evento:        { select: { id: true, nombre: true, fecha_inicio: true, fecha_fin: true } },
          evento_origen: { select: { id: true, nombre: true } },
          camion:        { select: { id: true, codigo: true, descripcion: true } },
          cuna:          { select: { id: true, codigo: true, descripcion: true } },
        },
        orderBy: { fecha_salida: 'desc' },
      },
      movimientos: {
        orderBy: { fecha: 'desc' },
        take:    100,
      },
      cunas: { include: { cuna: { select: { id: true, codigo: true, descripcion: true } } } },
    },
  });
  if (!producto) { res.status(404).json({ error: 'Producto no encontrado' }); return; }

  const now  = new Date();
  const disp = await calcDisponibilidad(id, now, now, req.empresaId!);

  res.json({ ...mapProducto(producto), disponibilidad_hoy: disp });
}

// ── Foto de producto ──────────────────────────────────────────────────────────

export const uploadFoto = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se aceptan imágenes JPEG, PNG o WEBP'));
  },
});

export async function importarFoto(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!req.file) { res.status(400).json({ error: 'Se requiere una imagen' }); return; }

  const existing = await prisma.producto.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Producto no encontrado' }); return; }

  await prisma.producto.update({
    where: { id },
    data: {
      foto_data:   req.file.buffer,
      foto_nombre: req.file.originalname,
      foto_mime:   req.file.mimetype,
      updated_by:  req.user!.id,
    },
  });

  res.json({ message: 'Foto actualizada correctamente' });
}

export async function getFoto(req: Request, res: Response) {
  const id = Number(req.params.id);
  const producto = await prisma.producto.findFirst({
    where:  { id, deleted_at: null, ...withTenant(req.empresaId!) },
    select: { foto_data: true, foto_mime: true, foto_nombre: true },
  });
  if (!producto)          { res.status(404).json({ error: 'Producto no encontrado' }); return; }
  if (!producto.foto_data) { res.status(404).json({ error: 'Este producto no tiene foto' }); return; }

  res.setHeader('Content-Type', producto.foto_mime ?? 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${producto.foto_nombre ?? 'foto'}"`);
  res.send(Buffer.from(producto.foto_data));
}

export async function createProducto(req: Request, res: Response) {
  const parsed = productoCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const {
    nombre, descripcion, categoria_id, codigo_interno, codigo_externo, nombre_tecnico, nombre_interno,
    valor_unitario, es_critico, catalogo_origen, stock_total, stock_minimo, unidad, notas,
  } = parsed.data;

  if (categoria_id) {
    const cat = await prisma.categoriaStock.findFirst({ where: { id: categoria_id, activo: true, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!cat) { res.status(400).json({ error: 'Categoría no encontrada o inactiva' }); return; }
  }

  if (codigo_interno) {
    const dupe = await prisma.producto.findFirst({ where: { codigo_interno, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (dupe) { res.status(400).json({ error: 'Ya existe un producto con ese código interno' }); return; }
  }
  if (codigo_externo) {
    const dupe = await prisma.producto.findFirst({ where: { codigo_externo, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (dupe) { res.status(400).json({ error: 'Ya existe un producto con ese código externo' }); return; }
  }

  const producto = await prisma.$transaction(async tx => {
    const p = await tx.producto.create({
      data: {
        ...withTenant(req.empresaId!),
        nombre, descripcion: descripcion ?? null, categoria_id: categoria_id ?? null,
        codigo_interno: codigo_interno ?? null, codigo_externo: codigo_externo ?? null,
        nombre_tecnico: nombre_tecnico ?? null, nombre_interno: nombre_interno ?? null,
        valor_unitario: valor_unitario ?? null, es_critico: es_critico ?? false,
        catalogo_origen: catalogo_origen ?? null,
        stock_total, stock_minimo, unidad: unidad ?? 'unidad',
        notas: notas ?? null, created_by: req.user!.id, updated_by: req.user!.id,
      },
    });
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'Producto', entidadId: p.id,
      descripcion: `Creó producto "${nombre}"`, datosDespues: { nombre, stock_total, stock_minimo },
      ip: req.ip, tx: tx as any,
    });
    return p;
  });

  res.status(201).json(mapProducto(producto));
}

export async function updateProducto(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = productoUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }

  const existing = await prisma.producto.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Producto no encontrado' }); return; }

  const {
    nombre, descripcion, categoria_id, codigo_interno, codigo_externo, nombre_tecnico, nombre_interno,
    valor_unitario, es_critico, catalogo_origen, stock_total, stock_minimo, unidad, notas,
  } = parsed.data;

  if (categoria_id !== undefined && categoria_id !== null) {
    const cat = await prisma.categoriaStock.findFirst({ where: { id: categoria_id, activo: true, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!cat) { res.status(400).json({ error: 'Categoría no encontrada o inactiva' }); return; }
  }

  if (codigo_interno && codigo_interno !== existing.codigo_interno) {
    const dupe = await prisma.producto.findFirst({ where: { codigo_interno, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (dupe) { res.status(400).json({ error: 'Ya existe un producto con ese código interno' }); return; }
  }
  if (codigo_externo && codigo_externo !== existing.codigo_externo) {
    const dupe = await prisma.producto.findFirst({ where: { codigo_externo, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (dupe) { res.status(400).json({ error: 'Ya existe un producto con ese código externo' }); return; }
  }

  const data: Prisma.ProductoUpdateInput = {
    ...(nombre          !== undefined && { nombre }),
    ...(descripcion     !== undefined && { descripcion }),
    ...(categoria_id    !== undefined && { categoria: categoria_id ? { connect: { id: categoria_id } } : { disconnect: true } }),
    ...(codigo_interno  !== undefined && { codigo_interno }),
    ...(codigo_externo  !== undefined && { codigo_externo }),
    ...(nombre_tecnico  !== undefined && { nombre_tecnico }),
    ...(nombre_interno  !== undefined && { nombre_interno }),
    ...(valor_unitario  !== undefined && { valor_unitario }),
    ...(es_critico      !== undefined && { es_critico }),
    ...(catalogo_origen !== undefined && { catalogo_origen }),
    ...(stock_total     !== undefined && { stock_total }),
    ...(stock_minimo    !== undefined && { stock_minimo }),
    ...(unidad          !== undefined && { unidad }),
    ...(notas           !== undefined && { notas }),
    updated_by: req.user!.id,
  };

  const producto = await prisma.$transaction(async tx => {
    const p = await tx.producto.update({ where: { id }, data });
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'Producto', entidadId: id,
      descripcion: `Actualizó producto "${existing.nombre}"`,
      datosAntes: { nombre: existing.nombre, stock_total: existing.stock_total },
      datosDespues: parsed.data, ip: req.ip, tx: tx as any,
    });
    return p;
  });

  res.json(mapProducto(producto));
}

export async function deleteProducto(req: Request, res: Response) {
  const id = Number(req.params.id);

  const existing = await prisma.producto.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Producto no encontrado' }); return; }

  const cunaProductos = await prisma.cunaProducto.findMany({
    where:   { producto_id: id },
    include: { cuna: { select: { id: true, codigo: true } } },
  });
  if (cunaProductos.length > 0) {
    const cunas = cunaProductos.map(cp => cp.cuna.codigo).join(', ');
    res.status(400).json({
      error: `No se puede eliminar este producto porque forma parte de ${cunaProductos.length} cuna(s): ${cunas}. Removelo de las cunas antes de eliminarlo.`,
    }); return;
  }

  const activas = await prisma.asignacionStock.count({
    where: { producto_id: id, estado: 'ACTIVA', deleted_at: null },
  });
  if (activas > 0) {
    res.status(400).json({ error: `No se puede eliminar este producto porque tiene ${activas} asignación(es) activa(s).` }); return;
  }

  await prisma.$transaction(async tx => {
    await tx.producto.update({
      where: { id },
      data:  { deleted_at: new Date(), activo: false, updated_by: req.user!.id },
    });
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'Producto', entidadId: id,
      descripcion: `Eliminó producto "${existing.nombre}"`,
      datosAntes: { nombre: existing.nombre, stock_total: existing.stock_total },
      ip: req.ip, tx: tx as any,
    });
  });

  res.json({ message: 'Producto eliminado correctamente' });
}

// ── Disponibilidad ────────────────────────────────────────────────────────────

export async function getDisponibilidad(req: Request, res: Response) {
  const productoId = Number(req.query.producto_id);
  const desdeStr   = typeof req.query.fecha_desde === 'string' ? req.query.fecha_desde : undefined;
  const hastaStr   = typeof req.query.fecha_hasta === 'string' ? req.query.fecha_hasta : undefined;

  if (!productoId || !desdeStr || !hastaStr) {
    res.status(400).json({ error: 'Se requieren producto_id, fecha_desde, fecha_hasta' }); return;
  }

  const disp = await calcDisponibilidad(productoId, toDate(desdeStr), toDate(hastaStr), req.empresaId!);
  if (!disp) { res.status(404).json({ error: 'Producto no encontrado' }); return; }

  res.json(disp);
}

// ── Alertas ───────────────────────────────────────────────────────────────────

export async function getAlertas(req: Request, res: Response) {
  const productos = await prisma.producto.findMany({
    where: { deleted_at: null, activo: true, ...withTenant(req.empresaId!) },
    select: { id: true, nombre: true, categoria: true, stock_total: true, stock_minimo: true },
  });

  const now    = new Date();
  const limite = new Date(); limite.setDate(limite.getDate() + 30);
  const alertas: object[] = [];

  for (const p of productos) {
    // A) Quiebre actual
    const hoyDisp = await calcDisponibilidad(p.id, now, now, req.empresaId!);
    if (!hoyDisp) continue;

    const disponible_actual = hoyDisp.disponible;

    if (disponible_actual < p.stock_minimo) {
      // Verificar si hay sugerencias disponibles
      const sug = await calcSugerencias(p.id, -1, now, now, req.empresaId!);
      alertas.push({
        tipo:              'QUIEBRE_ACTUAL',
        producto_id:       p.id,
        producto_nombre:   p.nombre,
        categoria:         p.categoria,
        stock_total:       p.stock_total,
        stock_minimo:      p.stock_minimo,
        disponible_actual,
        eventos_comprometidos: hoyDisp.asignaciones_solapadas.map(a => ({
          evento_id:     a.evento_id,
          evento_nombre: a.evento_nombre,
          cantidad:      a.cantidad,
          fecha_salida:  a.fecha_salida,
          fecha_retorno: a.fecha_retorno,
        })),
        sugerencias_disponibles: sug.length > 0,
      });
      continue; // skip proyectado check if already in current quiebre
    }

    // B) Quiebre proyectado — check at each future asignacion start date
    const futuras = await prisma.asignacionStock.findMany({
      where: {
        producto_id:  p.id,
        estado:       'ACTIVA',
        deleted_at:   null,
        fecha_salida: { gte: now, lte: limite },
      },
      orderBy: { fecha_salida: 'asc' },
    });

    // Check availability at each future start date
    let quiebreFutura: Date | null = null;
    for (const f of futuras) {
      const fd = f.fecha_salida;
      const dispFutura = await calcDisponibilidad(p.id, fd, fd, req.empresaId!);
      if (dispFutura && dispFutura.disponible < p.stock_minimo) {
        quiebreFutura = fd;
        break;
      }
    }

    if (quiebreFutura) {
      const dispFuturaFull = await calcDisponibilidad(p.id, quiebreFutura, quiebreFutura, req.empresaId!);
      const sug = await calcSugerencias(p.id, -1, quiebreFutura, quiebreFutura, req.empresaId!);
      alertas.push({
        tipo:                    'QUIEBRE_PROYECTADO',
        producto_id:             p.id,
        producto_nombre:         p.nombre,
        categoria:               p.categoria,
        stock_total:             p.stock_total,
        stock_minimo:            p.stock_minimo,
        disponible_actual,
        fecha_quiebre_proyectado: quiebreFutura,
        eventos_comprometidos:   dispFuturaFull?.asignaciones_solapadas.map(a => ({
          evento_id:     a.evento_id,
          evento_nombre: a.evento_nombre,
          cantidad:      a.cantidad,
          fecha_salida:  a.fecha_salida,
          fecha_retorno: a.fecha_retorno,
        })) ?? [],
        sugerencias_disponibles: sug.length > 0,
      });
    }
  }

  res.json({ alertas });
}

// ── Stock por evento ──────────────────────────────────────────────────────────

export async function getEventoStock(req: Request, res: Response) {
  const eventoId = Number(req.params.id);

  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const asignaciones = await prisma.asignacionStock.findMany({
    where:   { evento_id: eventoId, deleted_at: null },
    include: {
      producto:       { select: { id: true, nombre: true, codigo_interno: true, codigo_externo: true, categoria: true, unidad: true } },
      evento_origen:  { select: { id: true, nombre: true } },
      camion:         { select: { id: true, codigo: true, descripcion: true } },
      cuna:           { select: { id: true, codigo: true, descripcion: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  // Prestado a otros eventos (this event is the origen)
  const prestadas = await prisma.asignacionStock.findMany({
    where:   { evento_origen_id: eventoId, deleted_at: null, estado: 'ACTIVA' },
    include: {
      producto: { select: { id: true, nombre: true } },
      evento:   { select: { id: true, nombre: true } },
    },
  });

  res.json({ asignaciones, prestadas });
}

export async function asignarProducto(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const parsed   = asignarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }

  const { producto_id, cantidad, fecha_salida, fecha_retorno, notas, camion_id, cuna_id } = parsed.data;

  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const producto = await prisma.producto.findFirst({ where: { id: producto_id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!producto) { res.status(404).json({ error: 'Producto no encontrado' }); return; }

  if (camion_id) {
    const camion = await prisma.camion.findFirst({ where: { id: camion_id, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!camion) { res.status(400).json({ error: 'Camión no encontrado' }); return; }
  }
  if (cuna_id) {
    const cuna = await prisma.cuna.findFirst({ where: { id: cuna_id, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!cuna) { res.status(400).json({ error: 'Cuna no encontrada' }); return; }
  }

  const fechaSalidaDate  = toDate(fecha_salida);
  const fechaRetornoDate = fecha_retorno ? toDate(fecha_retorno) : null;

  const disp = await calcDisponibilidad(
    producto_id,
    fechaSalidaDate,
    fechaRetornoDate ?? fechaSalidaDate,
    req.empresaId!,
  );
  if (!disp) { res.status(404).json({ error: 'Producto no encontrado' }); return; }

  const result = await prisma.$transaction(async tx => {
    const asignacion = await tx.asignacionStock.create({
      data: {
        producto_id,
        evento_id:    eventoId,
        cantidad,
        fecha_salida:  fechaSalidaDate,
        fecha_retorno: fechaRetornoDate,
        ubicacion:     'EN_EVENTO' as UbicacionStock,
        estado:        'ACTIVA' as EstadoAsignacion,
        origen:        'DEPOSITO' as OrigenTransfer,
        notas:         notas ?? null,
        camion_id:     camion_id ?? null,
        cuna_id:       cuna_id ?? null,
        created_by:    req.user!.id,
        updated_by:    req.user!.id,
      },
    });

    await tx.movimientoStock.create({
      data: {
        producto_id,
        asignacion_id:    asignacion.id,
        tipo:             'SALIDA_DEPOSITO',
        cantidad:         -cantidad,
        evento_destino_id: eventoId,
        fecha:            fechaSalidaDate,
        descripcion:      `Asignación a evento "${evento.nombre}"`,
        created_by:       req.user!.id,
      },
    });

    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'AsignacionStock', entidadId: asignacion.id,
      eventoId, descripcion: `Asignó ${cantidad} u. de "${producto.nombre}" al evento "${evento.nombre}"`,
      datosDespues: { producto_id, cantidad, fecha_salida, fecha_retorno },
      ip: req.ip, tx: tx as any,
    });

    return asignacion;
  });

  let advertencia: object | undefined;
  if (disp.disponible < cantidad) {
    const sugerencias = await calcSugerencias(
      producto_id, eventoId, fechaSalidaDate, fechaRetornoDate ?? fechaSalidaDate, req.empresaId!,
    );
    advertencia = {
      tipo:        'QUIEBRE',
      faltante:    cantidad - disp.disponible,
      sugerencias,
    };
  }

  res.status(201).json({ asignacion: result, advertencia });
}

// ── Asignaciones CRUD ─────────────────────────────────────────────────────────

export async function updateAsignacion(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = updateAsignacionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }

  const existing = await prisma.asignacionStock.findFirst({ where: { id, deleted_at: null, evento: withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Asignación no encontrada' }); return; }
  if (existing.estado !== 'ACTIVA') {
    res.status(400).json({ error: 'Solo se pueden editar asignaciones ACTIVAS' }); return;
  }

  const { cantidad, fecha_salida, fecha_retorno, notas, camion_id, cuna_id } = parsed.data;

  if (camion_id) {
    const camion = await prisma.camion.findFirst({ where: { id: camion_id, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!camion) { res.status(400).json({ error: 'Camión no encontrado' }); return; }
  }
  if (cuna_id) {
    const cuna = await prisma.cuna.findFirst({ where: { id: cuna_id, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!cuna) { res.status(400).json({ error: 'Cuna no encontrada' }); return; }
  }

  const asignacion = await prisma.$transaction(async tx => {
    const a = await tx.asignacionStock.update({
      where: { id },
      data: {
        ...(cantidad      !== undefined && { cantidad }),
        ...(fecha_salida  !== undefined && { fecha_salida: toDate(fecha_salida) }),
        ...(fecha_retorno !== undefined && { fecha_retorno: fecha_retorno ? toDate(fecha_retorno) : null }),
        ...(notas         !== undefined && { notas }),
        ...(camion_id     !== undefined && { camion_id }),
        ...(cuna_id       !== undefined && { cuna_id }),
        updated_by: req.user!.id,
      },
    });
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'AsignacionStock', entidadId: id,
      eventoId: existing.evento_id,
      descripcion: `Actualizó asignación #${id}`,
      datosAntes:   { cantidad: existing.cantidad, fecha_salida: existing.fecha_salida },
      datosDespues: parsed.data, ip: req.ip, tx: tx as any,
    });
    return a;
  });

  res.json(asignacion);
}

export async function cancelarAsignacion(req: Request, res: Response) {
  const id = Number(req.params.id);

  const existing = await prisma.asignacionStock.findFirst({
    where:   { id, deleted_at: null, evento: withTenant(req.empresaId!) },
    include: { producto: { select: { nombre: true } } },
  });
  if (!existing) { res.status(404).json({ error: 'Asignación no encontrada' }); return; }
  if (existing.estado !== 'ACTIVA') {
    res.status(400).json({ error: 'Solo se pueden cancelar asignaciones ACTIVAS' }); return;
  }

  await prisma.$transaction(async tx => {
    await tx.asignacionStock.update({
      where: { id },
      data:  { estado: 'CANCELADA', deleted_at: new Date(), updated_by: req.user!.id },
    });

    await tx.movimientoStock.create({
      data: {
        producto_id:      existing.producto_id,
        asignacion_id:    id,
        tipo:             'RETORNO_DEPOSITO',
        cantidad:         existing.cantidad, // positivo = retorno al depósito
        evento_origen_id: existing.evento_id,
        fecha:            new Date(),
        descripcion:      `Cancelación de asignación #${id}`,
        created_by:       req.user!.id,
      },
    });

    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'AsignacionStock', entidadId: id,
      eventoId: existing.evento_id,
      descripcion: `Canceló asignación de "${existing.producto.nombre}" (${existing.cantidad} u.)`,
      datosAntes: { estado: 'ACTIVA', cantidad: existing.cantidad },
      ip: req.ip, tx: tx as any,
    });
  });

  res.json({ message: 'Asignación cancelada correctamente' });
}

// ── Transferencia ─────────────────────────────────────────────────────────────

export async function transferencia(req: Request, res: Response) {
  const parsed = transferenciaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }

  const { asignacion_origen_id, evento_destino_id, cantidad, fecha_transferencia, notas } = parsed.data;

  const origen = await prisma.asignacionStock.findFirst({
    where:   { id: asignacion_origen_id, deleted_at: null, evento: withTenant(req.empresaId!) },
    include: { producto: true, evento: { select: { id: true, nombre: true } } },
  });
  if (!origen)           { res.status(400).json({ error: 'Asignación origen no encontrada' }); return; }
  if (origen.estado !== 'ACTIVA') {
    res.status(400).json({ error: 'La asignación origen no está ACTIVA' }); return;
  }
  if (origen.evento_id === evento_destino_id) {
    res.status(400).json({ error: 'El evento destino debe ser distinto al origen' }); return;
  }
  if (cantidad > origen.cantidad) {
    res.status(400).json({ error: `Cantidad a transferir (${cantidad}) supera la asignación origen (${origen.cantidad})` }); return;
  }

  const eventoDestino = await prisma.evento.findFirst({ where: { id: evento_destino_id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!eventoDestino) { res.status(400).json({ error: 'Evento destino no encontrado' }); return; }

  const fechaTransDate = toDate(fecha_transferencia);

  const nuevaAsignacion = await prisma.$transaction(async tx => {
    // Update origin
    if (cantidad === origen.cantidad) {
      await tx.asignacionStock.update({
        where: { id: asignacion_origen_id },
        data:  { estado: 'TRANSFERIDA', updated_by: req.user!.id },
      });
    } else {
      await tx.asignacionStock.update({
        where: { id: asignacion_origen_id },
        data:  { cantidad: origen.cantidad - cantidad, updated_by: req.user!.id },
      });
    }

    // Create new assignment for destination
    const nueva = await tx.asignacionStock.create({
      data: {
        producto_id:      origen.producto_id,
        evento_id:        evento_destino_id,
        cantidad,
        fecha_salida:     fechaTransDate,
        fecha_retorno:    null,
        ubicacion:        'EN_EVENTO' as UbicacionStock,
        estado:           'ACTIVA' as EstadoAsignacion,
        origen:           'EVENTO' as OrigenTransfer,
        evento_origen_id: origen.evento_id,
        notas:            notas ?? null,
        created_by:       req.user!.id,
        updated_by:       req.user!.id,
      },
    });

    await tx.movimientoStock.create({
      data: {
        producto_id:       origen.producto_id,
        asignacion_id:     nueva.id,
        tipo:              'TRANSFERENCIA_ENTRE_EVENTOS',
        cantidad:          0, // neutro desde depósito — de evento a evento
        evento_origen_id:  origen.evento_id,
        evento_destino_id: evento_destino_id,
        fecha:             fechaTransDate,
        descripcion:       `Transferencia de "${origen.evento.nombre}" a "${eventoDestino.nombre}"`,
        created_by:        req.user!.id,
      },
    });

    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'TransferenciaStock',
      entidadId: nueva.id, eventoId: evento_destino_id,
      descripcion: `Transfirió ${cantidad} u. de "${origen.producto.nombre}" de "${origen.evento.nombre}" a "${eventoDestino.nombre}"`,
      datosDespues: { asignacion_origen_id, evento_destino_id, cantidad },
      ip: req.ip, tx: tx as any,
    });

    return nueva;
  });

  res.status(201).json(nuevaAsignacion);
}

// ── Sugerencias ───────────────────────────────────────────────────────────────

export async function getSugerencias(req: Request, res: Response) {
  const eventoId   = req.query.evento_id   ? Number(req.query.evento_id)   : -1;
  const productoId = req.query.producto_id ? Number(req.query.producto_id) : undefined;
  const desdeStr   = typeof req.query.fecha_desde === 'string' ? req.query.fecha_desde : undefined;
  const hastaStr   = typeof req.query.fecha_hasta === 'string' ? req.query.fecha_hasta : undefined;

  if (!productoId || !desdeStr || !hastaStr) {
    res.status(400).json({ error: 'Se requieren producto_id, fecha_desde, fecha_hasta' }); return;
  }

  const sugerencias = await calcSugerencias(
    productoId, eventoId, toDate(desdeStr), toDate(hastaStr), req.empresaId!,
  );

  res.json({ sugerencias });
}

// ── Categorías de Stock ───────────────────────────────────────────────────────

export async function listCategorias(req: Request, res: Response) {
  const categorias = await prisma.categoriaStock.findMany({
    where:   { deleted_at: null, ...withTenant(req.empresaId!) },
    orderBy: { nombre: 'asc' },
    include: { _count: { select: { productos: { where: { deleted_at: null, activo: true } } } } },
  });

  res.json(categorias.map(c => ({
    ...c,
    productos_count: c._count.productos,
    _count: undefined,
  })));
}

export async function createCategoria(req: Request, res: Response) {
  const parsed = categoriaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const { nombre, descripcion, color } = parsed.data;

  const dupe = await prisma.categoriaStock.findFirst({ where: { nombre, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (dupe) { res.status(400).json({ error: 'Ya existe una categoría con ese nombre' }); return; }

  const categoria = await prisma.categoriaStock.create({
    data: {
      ...withTenant(req.empresaId!),
      nombre, descripcion: descripcion ?? null, color: color ?? null,
      created_by: req.user!.id,
    },
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'CategoriaStock', entidadId: categoria.id,
    descripcion: `Creó categoría de stock "${nombre}"`, datosDespues: { nombre, color }, ip: req.ip,
    tx: prisma,
  });

  res.status(201).json(categoria);
}

export async function updateCategoria(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = categoriaSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }

  const existing = await prisma.categoriaStock.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Categoría no encontrada' }); return; }

  const { nombre, descripcion, color } = parsed.data;

  if (nombre && nombre !== existing.nombre) {
    const dupe = await prisma.categoriaStock.findFirst({ where: { nombre, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (dupe) { res.status(400).json({ error: 'Ya existe una categoría con ese nombre' }); return; }
  }

  const activo = (req.body as { activo?: boolean }).activo;

  const categoria = await prisma.categoriaStock.update({
    where: { id },
    data: {
      ...(nombre      !== undefined && { nombre }),
      ...(descripcion !== undefined && { descripcion }),
      ...(color       !== undefined && { color }),
      ...(activo      !== undefined && { activo }),
    },
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'CategoriaStock', entidadId: id,
    descripcion: `Actualizó categoría "${existing.nombre}"`,
    datosAntes: { nombre: existing.nombre, color: existing.color, activo: existing.activo },
    datosDespues: parsed.data, ip: req.ip, tx: prisma,
  });

  res.json(categoria);
}

export async function deleteCategoria(req: Request, res: Response) {
  const id = Number(req.params.id);

  const existing = await prisma.categoriaStock.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Categoría no encontrada' }); return; }

  const productosActivos = await prisma.producto.count({
    where: { categoria_id: id, deleted_at: null, activo: true, ...withTenant(req.empresaId!) },
  });
  if (productosActivos > 0) {
    res.status(400).json({
      error: `No se puede eliminar: hay ${productosActivos} producto${productosActivos > 1 ? 's' : ''} activo${productosActivos > 1 ? 's' : ''} en esta categoría`,
    }); return;
  }

  await prisma.categoriaStock.update({
    where: { id },
    data:  { deleted_at: new Date(), activo: false },
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'CategoriaStock', entidadId: id,
    descripcion: `Eliminó categoría de stock "${existing.nombre}"`,
    datosAntes: { nombre: existing.nombre }, ip: req.ip, tx: prisma,
  });

  res.json({ message: 'Categoría eliminada correctamente' });
}

// ── Firmas digitales ─────────────────────────────────────────────────────────
// Irreversibles — no hay endpoint para "desfirmar".

const ASIGNACION_FIRMA_INCLUDE = {
  producto: { select: { id: true, nombre: true, codigo_interno: true, unidad: true } },
  evento:   { select: { id: true, nombre: true } },
  camion:   { select: { id: true, codigo: true, descripcion: true } },
  cuna:     { select: { id: true, codigo: true, descripcion: true } },
} satisfies Prisma.AsignacionStockInclude;

// GET /api/stock/asignaciones/pendientes-firma?paso=salida|llegada|retorno
// Alimenta la vista mobile de firmas — lista tenant-wide (no hay campo de
// responsable en AsignacionStock) de lo que está pendiente en cada paso.
export async function getPendientesFirma(req: Request, res: Response) {
  const paso = typeof req.query.paso === 'string' ? req.query.paso : undefined;
  if (!paso || !['salida', 'llegada', 'retorno'].includes(paso)) {
    res.status(400).json({ error: 'Se requiere paso=salida|llegada|retorno' }); return;
  }

  const where: Prisma.AsignacionStockWhereInput = {
    estado: 'ACTIVA', deleted_at: null, evento: withTenant(req.empresaId!),
    ...(paso === 'salida'  && { firmado_salida: false }),
    ...(paso === 'llegada' && { firmado_salida: true, firmado_llegada: false }),
    ...(paso === 'retorno' && { firmado_llegada: true, firmado_retorno: false }),
  };

  const asignaciones = await prisma.asignacionStock.findMany({
    where,
    include: ASIGNACION_FIRMA_INCLUDE,
    orderBy: { fecha_salida: 'asc' },
  });

  res.json({ asignaciones });
}

export async function firmarSalida(req: Request, res: Response) {
  const id = Number(req.params.id);

  const existing = await prisma.asignacionStock.findFirst({
    where:   { id, deleted_at: null, evento: withTenant(req.empresaId!) },
    include: ASIGNACION_FIRMA_INCLUDE,
  });
  if (!existing) { res.status(404).json({ error: 'Asignación no encontrada' }); return; }
  if (existing.firmado_salida) { res.status(400).json({ error: 'Ya se firmó la salida de esta asignación' }); return; }

  const asignacion = await prisma.$transaction(async tx => {
    const a = await tx.asignacionStock.update({
      where: { id },
      data: {
        firmado_salida:     true,
        firmado_salida_at:  new Date(),
        firmado_salida_por: req.user!.id,
        ubicacion:          'EN_TRANSITO' as UbicacionStock,
        updated_by:         req.user!.id,
      },
    });
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'FIRMA_SALIDA', entidad: 'AsignacionStock', entidadId: id,
      eventoId: existing.evento_id,
      descripcion: `Firma de salida — ${existing.producto.nombre} × ${existing.cantidad}${existing.camion ? ` en ${existing.camion.codigo}` : ''}`,
      ip: req.ip, tx: tx as any,
    });
    return a;
  });

  res.json(asignacion);
}

const firmarLlegadaSchema = z.object({
  cantidad_excedente: z.number().int().min(0).optional(),
});

export async function firmarLlegada(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = firmarLlegadaSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }

  const existing = await prisma.asignacionStock.findFirst({
    where:   { id, deleted_at: null, evento: withTenant(req.empresaId!) },
    include: ASIGNACION_FIRMA_INCLUDE,
  });
  if (!existing) { res.status(404).json({ error: 'Asignación no encontrada' }); return; }
  if (!existing.firmado_salida) { res.status(400).json({ error: 'Primero debe firmarse la salida' }); return; }
  if (existing.firmado_llegada) { res.status(400).json({ error: 'Ya se firmó la llegada de esta asignación' }); return; }

  const cantidadExcedente = parsed.data.cantidad_excedente ?? 0;

  const asignacion = await prisma.$transaction(async tx => {
    const a = await tx.asignacionStock.update({
      where: { id },
      data: {
        firmado_llegada:     true,
        firmado_llegada_at:  new Date(),
        firmado_llegada_por: req.user!.id,
        ubicacion:           (cantidadExcedente > 0 ? 'EXCEDENTE' : 'EN_EVENTO') as UbicacionStock,
        cantidad_excedente:  cantidadExcedente,
        updated_by:          req.user!.id,
      },
    });
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'FIRMA_LLEGADA', entidad: 'AsignacionStock', entidadId: id,
      eventoId: existing.evento_id,
      descripcion: `Firma de llegada — ${existing.producto.nombre} × ${existing.cantidad} a "${existing.evento.nombre}"`
        + (cantidadExcedente > 0 ? ` (excedente: ${cantidadExcedente})` : ''),
      ip: req.ip, tx: tx as any,
    });
    return a;
  });

  res.json(asignacion);
}

export async function firmarRetorno(req: Request, res: Response) {
  const id = Number(req.params.id);

  const existing = await prisma.asignacionStock.findFirst({
    where:   { id, deleted_at: null, evento: withTenant(req.empresaId!) },
    include: ASIGNACION_FIRMA_INCLUDE,
  });
  if (!existing) { res.status(404).json({ error: 'Asignación no encontrada' }); return; }
  if (!existing.firmado_llegada) { res.status(400).json({ error: 'Primero debe firmarse la llegada' }); return; }
  if (existing.firmado_retorno) { res.status(400).json({ error: 'Ya se firmó el retorno de esta asignación' }); return; }

  const asignacion = await prisma.$transaction(async tx => {
    const a = await tx.asignacionStock.update({
      where: { id },
      data: {
        firmado_retorno:     true,
        firmado_retorno_at:  new Date(),
        firmado_retorno_por: req.user!.id,
        ubicacion:           'EN_TRANSITO' as UbicacionStock,
        updated_by:          req.user!.id,
      },
    });
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'FIRMA_RETORNO', entidad: 'AsignacionStock', entidadId: id,
      eventoId: existing.evento_id,
      descripcion: `Firma de retorno — ${existing.producto.nombre} × ${existing.cantidad}${existing.camion ? ` en ${existing.camion.codigo}` : ''}`,
      ip: req.ip, tx: tx as any,
    });
    return a;
  });

  res.json(asignacion);
}

// ── Importador catálogo Layher ────────────────────────────────────────────────

export const uploadCatalogo = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.xlsx')) cb(null, true);
    else cb(new Error('Solo se aceptan archivos .xlsx'));
  },
});

export async function importarCatalogo(req: Request, res: Response) {
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo .xlsx' }); return; }

  const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) { res.status(400).json({ error: 'El archivo no contiene hojas' }); return; }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  let creados = 0;
  let actualizados = 0;
  const errores: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const codigo        = String(row['CÓDIGO'] ?? row['CODIGO'] ?? '').trim();
    const nombreTecnico = String(row['NOMBRE_TÉCNICO'] ?? row['NOMBRE_TECNICO'] ?? '').trim();
    const descripcion   = row['DESCRIPCIÓN'] ?? row['DESCRIPCION'] ?? null;
    const unidad         = row['UNIDAD'] ? String(row['UNIDAD']).trim() : 'unidad';
    const categoriaNombre = row['CATEGORÍA'] ?? row['CATEGORIA'] ?? null;

    if (!codigo || !nombreTecnico) {
      errores.push(`Fila ${i + 2}: falta CÓDIGO o NOMBRE_TÉCNICO`);
      continue;
    }

    let categoria_id: number | null = null;
    if (categoriaNombre) {
      const cat = await prisma.categoriaStock.findFirst({
        where: { nombre: String(categoriaNombre), deleted_at: null, ...withTenant(req.empresaId!) },
      });
      categoria_id = cat?.id ?? null;
    }

    const existing = await prisma.producto.findFirst({
      where: { codigo_externo: codigo, deleted_at: null, ...withTenant(req.empresaId!) },
    });

    if (existing) {
      await prisma.producto.update({
        where: { id: existing.id },
        data: {
          nombre_tecnico: nombreTecnico,
          descripcion:    descripcion ? String(descripcion) : existing.descripcion,
          updated_by:     req.user!.id,
        },
      });
      actualizados++;
    } else {
      await prisma.producto.create({
        data: {
          ...withTenant(req.empresaId!),
          nombre:          nombreTecnico,
          nombre_tecnico:  nombreTecnico,
          descripcion:     descripcion ? String(descripcion) : null,
          codigo_externo:  codigo,
          catalogo_origen: 'Layher',
          categoria_id,
          unidad,
          stock_total:  0,
          stock_minimo: 0,
          created_by:   req.user!.id,
          updated_by:   req.user!.id,
        },
      });
      creados++;
    }
  }

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'IMPORT', entidad: 'Producto',
    descripcion: `Importó catálogo Layher — ${creados} creados, ${actualizados} actualizados, ${errores.length} errores`,
    ip: req.ip, tx: prisma,
  });

  res.json({ creados, actualizados, errores });
}
