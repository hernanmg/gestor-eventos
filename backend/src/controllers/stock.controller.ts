import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { registrarAuditoria } from '../lib/auditoria';
import type { UbicacionStock, EstadoAsignacion, OrigenTransfer, Prisma } from '@prisma/client';

// ── Schemas ───────────────────────────────────────────────────────────────────

const productoCreateSchema = z.object({
  nombre:       z.string().min(1),
  descripcion:  z.string().nullable().optional(),
  categoria_id: z.number().int().positive().nullable().optional(),
  codigo:       z.string().nullable().optional(),
  stock_total:  z.number().int().min(0),
  stock_minimo: z.number().int().min(0).default(0),
  unidad:       z.string().default('unidad'),
  notas:        z.string().nullable().optional(),
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
});

const updateAsignacionSchema = z.object({
  cantidad:      z.number().int().positive().optional(),
  fecha_salida:  z.string().optional(),
  fecha_retorno: z.string().nullable().optional(),
  notas:         z.string().nullable().optional(),
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
  excludeAsignacionId?: number,
) {
  const producto = await prisma.producto.findFirst({
    where: { id: productoId, deleted_at: null },
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
) {
  // Find active assignments of this product in other events
  const candidatas = await prisma.asignacionStock.findMany({
    where: {
      producto_id: productoId,
      estado:      'ACTIVA',
      deleted_at:  null,
      evento_id:   { not: eventoDestinoId },
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

export async function listProductos(req: Request, res: Response) {
  const search       = typeof req.query.search    === 'string' ? req.query.search    : undefined;
  const categoriaRaw = typeof req.query.categoria === 'string' ? req.query.categoria : undefined;

  const where: Prisma.ProductoWhereInput = { deleted_at: null, activo: true };
  if (search) {
    where.OR = [
      { nombre:    { contains: search, mode: 'insensitive' } },
      { codigo:    { contains: search, mode: 'insensitive' } },
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

  const productos = await prisma.producto.findMany({
    where,
    orderBy: { nombre: 'asc' },
    include: { categoria: true },
  });

  const now = new Date();
  const results = await Promise.all(
    productos.map(async p => {
      const disp = await calcDisponibilidad(p.id, now, now);
      return {
        ...p,
        stock_total:           p.stock_total,
        comprometido_hoy:      disp?.cantidad_comprometida ?? 0,
        disponible_hoy:        disp?.disponible ?? p.stock_total,
      };
    }),
  );

  res.json(results);
}

export async function getProducto(req: Request, res: Response) {
  const id = Number(req.params.id);
  const producto = await prisma.producto.findFirst({
    where:   { id, deleted_at: null },
    include: {
      categoria: true,
      asignaciones: {
        where:   { deleted_at: null },
        include: { evento: { select: { id: true, nombre: true, fecha_inicio: true, fecha_fin: true } } },
        orderBy: { fecha_salida: 'desc' },
      },
      movimientos: {
        orderBy: { fecha: 'desc' },
        take:    100,
      },
    },
  });
  if (!producto) { res.status(404).json({ error: 'Producto no encontrado' }); return; }

  const now  = new Date();
  const disp = await calcDisponibilidad(id, now, now);

  res.json({ ...producto, disponibilidad_hoy: disp });
}

export async function createProducto(req: Request, res: Response) {
  const parsed = productoCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const { nombre, descripcion, categoria_id, codigo, stock_total, stock_minimo, unidad, notas } = parsed.data;

  if (categoria_id) {
    const cat = await prisma.categoriaStock.findFirst({ where: { id: categoria_id, activo: true, deleted_at: null } });
    if (!cat) { res.status(400).json({ error: 'Categoría no encontrada o inactiva' }); return; }
  }

  if (codigo) {
    const dupe = await prisma.producto.findFirst({ where: { codigo, deleted_at: null } });
    if (dupe) { res.status(400).json({ error: 'Ya existe un producto con ese código' }); return; }
  }

  const producto = await prisma.$transaction(async tx => {
    const p = await tx.producto.create({
      data: {
        nombre, descripcion: descripcion ?? null, categoria_id: categoria_id ?? null,
        codigo: codigo ?? null, stock_total, stock_minimo, unidad: unidad ?? 'unidad',
        notas: notas ?? null, created_by: req.user!.id, updated_by: req.user!.id,
      },
    });
    await registrarAuditoria({
      usuarioId: req.user!.id, accion: 'CREATE', entidad: 'Producto', entidadId: p.id,
      descripcion: `Creó producto "${nombre}"`, datosDespues: { nombre, stock_total, stock_minimo },
      ip: req.ip, tx: tx as any,
    });
    return p;
  });

  res.status(201).json(producto);
}

export async function updateProducto(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = productoUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }

  const existing = await prisma.producto.findFirst({ where: { id, deleted_at: null } });
  if (!existing) { res.status(404).json({ error: 'Producto no encontrado' }); return; }

  const { nombre, descripcion, categoria_id, codigo, stock_total, stock_minimo, unidad, notas } = parsed.data;

  if (categoria_id !== undefined && categoria_id !== null) {
    const cat = await prisma.categoriaStock.findFirst({ where: { id: categoria_id, activo: true, deleted_at: null } });
    if (!cat) { res.status(400).json({ error: 'Categoría no encontrada o inactiva' }); return; }
  }

  if (codigo && codigo !== existing.codigo) {
    const dupe = await prisma.producto.findFirst({ where: { codigo, deleted_at: null } });
    if (dupe) { res.status(400).json({ error: 'Ya existe un producto con ese código' }); return; }
  }

  const data: Prisma.ProductoUpdateInput = {
    ...(nombre        !== undefined && { nombre }),
    ...(descripcion   !== undefined && { descripcion }),
    ...(categoria_id  !== undefined && { categoria: categoria_id ? { connect: { id: categoria_id } } : { disconnect: true } }),
    ...(codigo        !== undefined && { codigo }),
    ...(stock_total   !== undefined && { stock_total }),
    ...(stock_minimo  !== undefined && { stock_minimo }),
    ...(unidad        !== undefined && { unidad }),
    ...(notas         !== undefined && { notas }),
    updated_by: req.user!.id,
  };

  const producto = await prisma.$transaction(async tx => {
    const p = await tx.producto.update({ where: { id }, data });
    await registrarAuditoria({
      usuarioId: req.user!.id, accion: 'UPDATE', entidad: 'Producto', entidadId: id,
      descripcion: `Actualizó producto "${existing.nombre}"`,
      datosAntes: { nombre: existing.nombre, stock_total: existing.stock_total },
      datosDespues: parsed.data, ip: req.ip, tx: tx as any,
    });
    return p;
  });

  res.json(producto);
}

export async function deleteProducto(req: Request, res: Response) {
  const id = Number(req.params.id);

  const existing = await prisma.producto.findFirst({ where: { id, deleted_at: null } });
  if (!existing) { res.status(404).json({ error: 'Producto no encontrado' }); return; }

  const activas = await prisma.asignacionStock.count({
    where: { producto_id: id, estado: 'ACTIVA', deleted_at: null },
  });
  if (activas > 0) {
    res.status(400).json({ error: 'No se puede eliminar un producto con asignaciones activas' }); return;
  }

  await prisma.$transaction(async tx => {
    await tx.producto.update({
      where: { id },
      data:  { deleted_at: new Date(), activo: false, updated_by: req.user!.id },
    });
    await registrarAuditoria({
      usuarioId: req.user!.id, accion: 'DELETE', entidad: 'Producto', entidadId: id,
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

  const disp = await calcDisponibilidad(productoId, toDate(desdeStr), toDate(hastaStr));
  if (!disp) { res.status(404).json({ error: 'Producto no encontrado' }); return; }

  res.json(disp);
}

// ── Alertas ───────────────────────────────────────────────────────────────────

export async function getAlertas(_req: Request, res: Response) {
  const productos = await prisma.producto.findMany({
    where: { deleted_at: null, activo: true },
    select: { id: true, nombre: true, categoria: true, stock_total: true, stock_minimo: true },
  });

  const now    = new Date();
  const limite = new Date(); limite.setDate(limite.getDate() + 30);
  const alertas: object[] = [];

  for (const p of productos) {
    // A) Quiebre actual
    const hoyDisp = await calcDisponibilidad(p.id, now, now);
    if (!hoyDisp) continue;

    const disponible_actual = hoyDisp.disponible;

    if (disponible_actual < p.stock_minimo) {
      // Verificar si hay sugerencias disponibles
      const sug = await calcSugerencias(p.id, -1, now, now);
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
      const dispFutura = await calcDisponibilidad(p.id, fd, fd);
      if (dispFutura && dispFutura.disponible < p.stock_minimo) {
        quiebreFutura = fd;
        break;
      }
    }

    if (quiebreFutura) {
      const dispFuturaFull = await calcDisponibilidad(p.id, quiebreFutura, quiebreFutura);
      const sug = await calcSugerencias(p.id, -1, quiebreFutura, quiebreFutura);
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

  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const asignaciones = await prisma.asignacionStock.findMany({
    where:   { evento_id: eventoId, deleted_at: null },
    include: {
      producto:       { select: { id: true, nombre: true, codigo: true, categoria: true, unidad: true } },
      evento_origen:  { select: { id: true, nombre: true } },
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

  const { producto_id, cantidad, fecha_salida, fecha_retorno, notas } = parsed.data;

  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const producto = await prisma.producto.findFirst({ where: { id: producto_id, deleted_at: null } });
  if (!producto) { res.status(404).json({ error: 'Producto no encontrado' }); return; }

  const fechaSalidaDate  = toDate(fecha_salida);
  const fechaRetornoDate = fecha_retorno ? toDate(fecha_retorno) : null;

  const disp = await calcDisponibilidad(
    producto_id,
    fechaSalidaDate,
    fechaRetornoDate ?? fechaSalidaDate,
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
      usuarioId: req.user!.id, accion: 'CREATE', entidad: 'AsignacionStock', entidadId: asignacion.id,
      eventoId, descripcion: `Asignó ${cantidad} u. de "${producto.nombre}" al evento "${evento.nombre}"`,
      datosDespues: { producto_id, cantidad, fecha_salida, fecha_retorno },
      ip: req.ip, tx: tx as any,
    });

    return asignacion;
  });

  let advertencia: object | undefined;
  if (disp.disponible < cantidad) {
    const sugerencias = await calcSugerencias(
      producto_id, eventoId, fechaSalidaDate, fechaRetornoDate ?? fechaSalidaDate,
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

  const existing = await prisma.asignacionStock.findFirst({ where: { id, deleted_at: null } });
  if (!existing) { res.status(404).json({ error: 'Asignación no encontrada' }); return; }
  if (existing.estado !== 'ACTIVA') {
    res.status(400).json({ error: 'Solo se pueden editar asignaciones ACTIVAS' }); return;
  }

  const { cantidad, fecha_salida, fecha_retorno, notas } = parsed.data;

  const asignacion = await prisma.$transaction(async tx => {
    const a = await tx.asignacionStock.update({
      where: { id },
      data: {
        ...(cantidad      !== undefined && { cantidad }),
        ...(fecha_salida  !== undefined && { fecha_salida: toDate(fecha_salida) }),
        ...(fecha_retorno !== undefined && { fecha_retorno: fecha_retorno ? toDate(fecha_retorno) : null }),
        ...(notas         !== undefined && { notas }),
        updated_by: req.user!.id,
      },
    });
    await registrarAuditoria({
      usuarioId: req.user!.id, accion: 'UPDATE', entidad: 'AsignacionStock', entidadId: id,
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
    where:   { id, deleted_at: null },
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
      usuarioId: req.user!.id, accion: 'DELETE', entidad: 'AsignacionStock', entidadId: id,
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
    where:   { id: asignacion_origen_id, deleted_at: null },
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

  const eventoDestino = await prisma.evento.findFirst({ where: { id: evento_destino_id, deleted_at: null } });
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
      usuarioId: req.user!.id, accion: 'CREATE', entidad: 'TransferenciaStock',
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
    productoId, eventoId, toDate(desdeStr), toDate(hastaStr),
  );

  res.json({ sugerencias });
}

// ── Categorías de Stock ───────────────────────────────────────────────────────

export async function listCategorias(_req: Request, res: Response) {
  const categorias = await prisma.categoriaStock.findMany({
    where:   { deleted_at: null },
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

  const dupe = await prisma.categoriaStock.findFirst({ where: { nombre, deleted_at: null } });
  if (dupe) { res.status(400).json({ error: 'Ya existe una categoría con ese nombre' }); return; }

  const categoria = await prisma.categoriaStock.create({
    data: {
      nombre, descripcion: descripcion ?? null, color: color ?? null,
      created_by: req.user!.id,
    },
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, accion: 'CREATE', entidad: 'CategoriaStock', entidadId: categoria.id,
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

  const existing = await prisma.categoriaStock.findFirst({ where: { id, deleted_at: null } });
  if (!existing) { res.status(404).json({ error: 'Categoría no encontrada' }); return; }

  const { nombre, descripcion, color } = parsed.data;

  if (nombre && nombre !== existing.nombre) {
    const dupe = await prisma.categoriaStock.findFirst({ where: { nombre, deleted_at: null } });
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
    usuarioId: req.user!.id, accion: 'UPDATE', entidad: 'CategoriaStock', entidadId: id,
    descripcion: `Actualizó categoría "${existing.nombre}"`,
    datosAntes: { nombre: existing.nombre, color: existing.color, activo: existing.activo },
    datosDespues: parsed.data, ip: req.ip, tx: prisma,
  });

  res.json(categoria);
}

export async function deleteCategoria(req: Request, res: Response) {
  const id = Number(req.params.id);

  const existing = await prisma.categoriaStock.findFirst({ where: { id, deleted_at: null } });
  if (!existing) { res.status(404).json({ error: 'Categoría no encontrada' }); return; }

  const productosActivos = await prisma.producto.count({
    where: { categoria_id: id, deleted_at: null, activo: true },
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
    usuarioId: req.user!.id, accion: 'DELETE', entidad: 'CategoriaStock', entidadId: id,
    descripcion: `Eliminó categoría de stock "${existing.nombre}"`,
    datosAntes: { nombre: existing.nombre }, ip: req.ip, tx: prisma,
  });

  res.json({ message: 'Categoría eliminada correctamente' });
}
