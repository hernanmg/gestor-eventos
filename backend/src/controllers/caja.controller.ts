import type { Request, Response } from 'express';
import { z } from 'zod';
import { TipoCuenta, Moneda } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { recalcularSaldosCaja } from '../lib/recalcularSaldos';
import { registrarAuditoria } from '../lib/auditoria';

let _tabCache: Map<string, string> | null = null;
async function getTabMap(): Promise<Map<string, string>> {
  if (!_tabCache) {
    const tabs = await prisma.tabConfig.findMany();
    _tabCache = new Map(tabs.map(t => [`${t.tipo}-${t.numero}`, t.codigo]));
  }
  return _tabCache;
}

function mapCuenta(c: any) {
  return { ...c, saldo_inicial: Number(c.saldo_inicial) };
}

function mapMovCaja(m: any, tabMap?: Map<string, string>) {
  const raw = m.movimientos_origen?.[0] ?? null;
  const movOrigen = raw && tabMap ? {
    id:         raw.id,
    tipo:       raw.tipo,
    tab_numero: raw.tab_numero,
    tab_codigo: tabMap.get(`${raw.tipo}-${raw.tab_numero}`) ?? null,
    concepto:   raw.concepto,
  } : null;

  return {
    ...m,
    debe:              Number(m.debe),
    haber:             Number(m.haber),
    saldo_corriente:   Number(m.saldo_corriente),
    movimiento_origen: movOrigen,
    movimientos_origen: undefined,
  };
}

const createCuentaSchema = z.object({
  nombre:        z.string().min(1),
  tipo:          z.enum(['EFECTIVO', 'BANCO']),
  moneda:        z.enum(['ARS', 'USD']).default('ARS'),
  saldo_inicial: z.number().default(0),
});

const updateCuentaSchema = z.object({
  nombre:        z.string().min(1).optional(),
  tipo:          z.enum(['EFECTIVO', 'BANCO']).optional(),
  moneda:        z.enum(['ARS', 'USD']).optional(),
  saldo_inicial: z.number().optional(),
});

const createMovCajaSchema = z.object({
  fecha:       z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  debe:        z.number().min(0).default(0),
  haber:       z.number().min(0).default(0),
});

const updateMovCajaSchema = z.object({
  fecha:       z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  debe:        z.number().min(0).optional(),
  haber:       z.number().min(0).optional(),
});

// ── Cuentas ───────────────────────────────────────────────────────────────────

export async function listCuentas(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const cuentas  = await prisma.cuentaBancaria.findMany({
    where:   { evento_id: eventoId, deleted_at: null },
    orderBy: { id: 'asc' },
  });
  res.json(cuentas.map(mapCuenta));
}

export async function createCuenta(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const parsed   = createCuentaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const cuenta = await prisma.$transaction(async tx => {
    const c = await tx.cuentaBancaria.create({
      data: {
        evento_id:     eventoId,
        nombre:        parsed.data.nombre,
        tipo:          parsed.data.tipo as TipoCuenta,
        moneda:        parsed.data.moneda as Moneda,
        saldo_inicial: parsed.data.saldo_inicial,
      },
    });
    await registrarAuditoria({
      usuarioId:    req.user!.id,
      accion:       'CREATE',
      entidad:      'CuentaBancaria',
      entidadId:    c.id,
      eventoId,
      descripcion:  `Creó cuenta bancaria "${parsed.data.nombre}" en evento #${eventoId}`,
      datosDespues: parsed.data,
      ip:           req.ip,
      tx:           tx as any,
    });
    return c;
  });

  res.status(201).json(mapCuenta(cuenta));
}

export async function updateCuenta(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = updateCuentaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const existing = await prisma.cuentaBancaria.findFirst({ where: { id, deleted_at: null } });
  if (!existing) { res.status(404).json({ error: 'Cuenta no encontrada' }); return; }

  const { nombre, tipo, moneda, saldo_inicial } = parsed.data;

  const updated = await prisma.$transaction(async tx => {
    const c = await tx.cuentaBancaria.update({
      where: { id },
      data: {
        ...(nombre        !== undefined && { nombre }),
        ...(tipo          !== undefined && { tipo: tipo as TipoCuenta }),
        ...(moneda        !== undefined && { moneda: moneda as Moneda }),
        ...(saldo_inicial !== undefined && { saldo_inicial }),
      },
    });
    if (saldo_inicial !== undefined) {
      await recalcularSaldosCaja(id, tx);
    }
    await registrarAuditoria({
      usuarioId:    req.user!.id,
      accion:       'UPDATE',
      entidad:      'CuentaBancaria',
      entidadId:    id,
      eventoId:     existing.evento_id,
      descripcion:  `Actualizó cuenta bancaria "${existing.nombre}"`,
      datosAntes:   { nombre: existing.nombre, tipo: existing.tipo, moneda: existing.moneda, saldo_inicial: Number(existing.saldo_inicial) },
      datosDespues: parsed.data,
      ip:           req.ip,
      tx:           tx as any,
    });
    return c;
  });

  res.json(mapCuenta(updated));
}

export async function deleteCuenta(req: Request, res: Response) {
  const id       = Number(req.params.id);
  const existing = await prisma.cuentaBancaria.findFirst({ where: { id, deleted_at: null } });
  if (!existing) { res.status(404).json({ error: 'Cuenta no encontrada' }); return; }

  await prisma.$transaction(async tx => {
    await tx.cuentaBancaria.update({ where: { id }, data: { deleted_at: new Date() } });
    await registrarAuditoria({
      usuarioId:  req.user!.id,
      accion:     'DELETE',
      entidad:    'CuentaBancaria',
      entidadId:  id,
      eventoId:   existing.evento_id,
      descripcion: `Eliminó cuenta bancaria "${existing.nombre}"`,
      datosAntes:  { nombre: existing.nombre, tipo: existing.tipo, moneda: existing.moneda },
      ip:          req.ip,
      tx:          tx as any,
    });
  });

  res.json({ message: 'Cuenta eliminada correctamente' });
}

// ── Movimientos de Caja ───────────────────────────────────────────────────────

export async function listMovimientosCaja(req: Request, res: Response) {
  const cuentaId = Number(req.params.id);
  const [movs, tabMap] = await Promise.all([
    prisma.movimientoCaja.findMany({
      where:   { cuenta_id: cuentaId, deleted_at: null },
      orderBy: { orden: 'asc' },
      include: {
        movimientos_origen: {
          where:  { deleted_at: null },
          select: { id: true, tipo: true, tab_numero: true, concepto: true },
          take:   1,
        },
      },
    }),
    getTabMap(),
  ]);
  res.json(movs.map(m => mapMovCaja(m, tabMap)));
}

export async function createMovimientoCaja(req: Request, res: Response) {
  const cuentaId = Number(req.params.id);
  const parsed   = createMovCajaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const cuenta = await prisma.cuentaBancaria.findFirst({ where: { id: cuentaId, deleted_at: null } });
  if (!cuenta) { res.status(404).json({ error: 'Cuenta no encontrada' }); return; }

  const movId = await prisma.$transaction(async tx => {
    const last = await tx.movimientoCaja.findFirst({
      where:   { cuenta_id: cuentaId, deleted_at: null },
      orderBy: { orden: 'desc' },
      select:  { orden: true },
    });
    const mov = await tx.movimientoCaja.create({
      data: {
        cuenta_id:   cuentaId,
        fecha:       parsed.data.fecha ? new Date(parsed.data.fecha) : null,
        descripcion: parsed.data.descripcion ?? null,
        debe:        parsed.data.debe,
        haber:       parsed.data.haber,
        orden:       (last?.orden ?? 0) + 1,
        created_by:  req.user!.id,
        updated_by:  req.user!.id,
      },
    });
    await recalcularSaldosCaja(cuentaId, tx);
    await registrarAuditoria({
      usuarioId:    req.user!.id,
      accion:       'CREATE',
      entidad:      'MovimientoCaja',
      entidadId:    mov.id,
      eventoId:     cuenta.evento_id,
      descripcion:  `Creó movimiento de caja en cuenta "${cuenta.nombre}"`,
      datosDespues: { debe: parsed.data.debe, haber: parsed.data.haber, descripcion: parsed.data.descripcion },
      ip:           req.ip,
      tx:           tx as any,
    });
    return mov.id;
  });

  const updated = await prisma.movimientoCaja.findUnique({ where: { id: movId } });
  res.status(201).json(mapMovCaja(updated));
}

export async function updateMovimientoCaja(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = updateMovCajaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const existing = await prisma.movimientoCaja.findFirst({
    where:   { id, deleted_at: null },
    include: { cuenta: { select: { evento_id: true, nombre: true } } },
  });
  if (!existing) { res.status(404).json({ error: 'Movimiento de caja no encontrado' }); return; }

  const movId = await prisma.$transaction(async tx => {
    await tx.movimientoCaja.update({
      where: { id },
      data: {
        ...(parsed.data.fecha       !== undefined && { fecha: parsed.data.fecha ? new Date(parsed.data.fecha) : null }),
        ...(parsed.data.descripcion !== undefined && { descripcion: parsed.data.descripcion }),
        ...(parsed.data.debe        !== undefined && { debe: parsed.data.debe }),
        ...(parsed.data.haber       !== undefined && { haber: parsed.data.haber }),
        updated_by: req.user!.id,
      },
    });
    await recalcularSaldosCaja(existing.cuenta_id, tx);
    await registrarAuditoria({
      usuarioId:    req.user!.id,
      accion:       'UPDATE',
      entidad:      'MovimientoCaja',
      entidadId:    id,
      eventoId:     (existing as any).cuenta.evento_id,
      descripcion:  `Actualizó movimiento de caja #${id}`,
      datosAntes:   { debe: Number(existing.debe), haber: Number(existing.haber), descripcion: existing.descripcion },
      datosDespues: parsed.data,
      ip:           req.ip,
      tx:           tx as any,
    });
    return id;
  });

  const updated = await prisma.movimientoCaja.findUnique({ where: { id: movId } });
  res.json(mapMovCaja(updated));
}

export async function deleteMovimientoCaja(req: Request, res: Response) {
  const id       = Number(req.params.id);
  const existing = await prisma.movimientoCaja.findFirst({
    where:   { id, deleted_at: null },
    include: { cuenta: { select: { evento_id: true } } },
  });
  if (!existing) { res.status(404).json({ error: 'Movimiento de caja no encontrado' }); return; }

  await prisma.$transaction(async tx => {
    await tx.movimientoCaja.update({
      where: { id },
      data:  { deleted_at: new Date(), updated_by: req.user!.id },
    });
    await recalcularSaldosCaja(existing.cuenta_id, tx);
    await registrarAuditoria({
      usuarioId:  req.user!.id,
      accion:     'DELETE',
      entidad:    'MovimientoCaja',
      entidadId:  id,
      eventoId:   (existing as any).cuenta.evento_id,
      descripcion: `Eliminó movimiento de caja #${id}`,
      datosAntes:  { debe: Number(existing.debe), haber: Number(existing.haber), descripcion: existing.descripcion },
      ip:          req.ip,
      tx:          tx as any,
    });
  });

  res.json({ message: 'Movimiento de caja eliminado correctamente' });
}

// ── Transferencia ─────────────────────────────────────────────────────────────

const transferenciaSchema = z.object({
  cuenta_origen_id:  z.number().int().positive(),
  cuenta_destino_id: z.number().int().positive(),
  importe:           z.number().positive(),
  moneda:            z.enum(['ARS', 'USD']),
  fecha:             z.string().nullable().optional(),
  descripcion:       z.string().nullable().optional(),
});

export async function transferencia(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const parsed   = transferenciaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }

  const { cuenta_origen_id, cuenta_destino_id, importe, moneda, fecha, descripcion } = parsed.data;

  if (cuenta_origen_id === cuenta_destino_id) {
    res.status(400).json({ error: 'La cuenta origen y destino no pueden ser la misma' }); return;
  }

  const [cuentaOrigen, cuentaDestino] = await Promise.all([
    prisma.cuentaBancaria.findFirst({ where: { id: cuenta_origen_id,  evento_id: eventoId, deleted_at: null } }),
    prisma.cuentaBancaria.findFirst({ where: { id: cuenta_destino_id, evento_id: eventoId, deleted_at: null } }),
  ]);

  if (!cuentaOrigen)  { res.status(400).json({ error: 'Cuenta origen no encontrada en este evento' }); return; }
  if (!cuentaDestino) { res.status(400).json({ error: 'Cuenta destino no encontrada en este evento' }); return; }
  if (cuentaOrigen.moneda !== cuentaDestino.moneda) {
    res.status(400).json({ error: 'Las cuentas deben tener la misma moneda' }); return;
  }
  if (cuentaOrigen.moneda !== moneda) {
    res.status(400).json({ error: 'La moneda no coincide con la de las cuentas' }); return;
  }

  const fechaDate = fecha ? new Date(fecha) : new Date();
  const descOrigen  = `Transferencia a: ${cuentaDestino.nombre}${descripcion ? ` — ${descripcion}` : ''}`;
  const descDestino = `Transferencia desde: ${cuentaOrigen.nombre}${descripcion ? ` — ${descripcion}` : ''}`;

  const [movOrigen, movDestino] = await prisma.$transaction(async tx => {
    const [lastOrig, lastDest] = await Promise.all([
      tx.movimientoCaja.findFirst({ where: { cuenta_id: cuenta_origen_id,  deleted_at: null }, orderBy: { orden: 'desc' }, select: { orden: true } }),
      tx.movimientoCaja.findFirst({ where: { cuenta_id: cuenta_destino_id, deleted_at: null }, orderBy: { orden: 'desc' }, select: { orden: true } }),
    ]);

    const orig = await tx.movimientoCaja.create({
      data: {
        cuenta_id:   cuenta_origen_id,
        haber:       importe,
        debe:        0,
        descripcion: descOrigen,
        fecha:       fechaDate,
        orden:       (lastOrig?.orden ?? 0) + 1,
        created_by:  req.user!.id,
        updated_by:  req.user!.id,
      },
    });

    const dest = await tx.movimientoCaja.create({
      data: {
        cuenta_id:            cuenta_destino_id,
        debe:                 importe,
        haber:                0,
        descripcion:          descDestino,
        fecha:                fechaDate,
        orden:                (lastDest?.orden ?? 0) + 1,
        transferencia_par_id: orig.id,
        created_by:           req.user!.id,
        updated_by:           req.user!.id,
      },
    });

    await tx.movimientoCaja.update({ where: { id: orig.id }, data: { transferencia_par_id: dest.id } });
    await recalcularSaldosCaja(cuenta_origen_id,  tx);
    await recalcularSaldosCaja(cuenta_destino_id, tx);

    await registrarAuditoria({
      usuarioId:    req.user!.id,
      accion:       'CREATE',
      entidad:      'Transferencia',
      eventoId,
      descripcion:  `Transferencia ${moneda} ${importe} de "${cuentaOrigen.nombre}" a "${cuentaDestino.nombre}"`,
      datosDespues: { importe, moneda, cuenta_origen: cuentaOrigen.nombre, cuenta_destino: cuentaDestino.nombre },
      ip:           req.ip,
      tx:           tx as any,
    });

    return [
      await tx.movimientoCaja.findUnique({ where: { id: orig.id } }),
      await tx.movimientoCaja.findUnique({ where: { id: dest.id } }),
    ];
  });

  res.status(201).json({
    movimiento_origen:  mapMovCaja(movOrigen),
    movimiento_destino: mapMovCaja(movDestino),
  });
}

// ── Conciliar ─────────────────────────────────────────────────────────────────

const conciliarSchema = z.object({
  movimiento_id: z.number().int().positive(),
});

export async function conciliar(req: Request, res: Response) {
  const movCajaId = Number(req.params.id);
  const parsed    = conciliarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'movimiento_id es requerido' }); return;
  }

  const movCaja = await prisma.movimientoCaja.findFirst({ where: { id: movCajaId, deleted_at: null } });
  if (!movCaja) { res.status(404).json({ error: 'Movimiento de caja no encontrado' }); return; }

  const movimiento = await prisma.movimiento.findFirst({ where: { id: parsed.data.movimiento_id, deleted_at: null } });
  if (!movimiento) { res.status(404).json({ error: 'Movimiento no encontrado' }); return; }

  const cuenta = await prisma.cuentaBancaria.findUnique({ where: { id: movCaja.cuenta_id } });
  if (!cuenta || cuenta.evento_id !== movimiento.evento_id) {
    res.status(400).json({ error: 'El movimiento de caja y el movimiento no pertenecen al mismo evento' }); return;
  }

  if (movimiento.movimiento_caja_id !== null) {
    res.status(400).json({ error: 'Este movimiento ya está conciliado' }); return;
  }

  const yaVinculado = await prisma.movimiento.findFirst({
    where: { movimiento_caja_id: movCajaId, deleted_at: null },
  });
  if (yaVinculado) {
    res.status(400).json({ error: 'Este movimiento de caja ya está vinculado a otro movimiento' }); return;
  }

  const updatedMov = await prisma.$transaction(async tx => {
    return tx.movimiento.update({
      where: { id: parsed.data.movimiento_id },
      data:  { movimiento_caja_id: movCajaId, updated_by: req.user!.id },
    });
  });

  const [updatedCaja, tabs] = await Promise.all([
    prisma.movimientoCaja.findUnique({ where: { id: movCajaId } }),
    getTabMap(),
  ]);

  res.json({
    movimiento_caja: mapMovCaja({ ...updatedCaja, movimientos_origen: [updatedMov] }, tabs),
    movimiento: { ...updatedMov, debe: Number(updatedMov.debe), haber: Number(updatedMov.haber), saldo: Number(updatedMov.saldo) },
  });
}

// ── Posición Consolidada ──────────────────────────────────────────────────────

export async function posicionConsolidada(req: Request, res: Response) {
  const eventoId = Number(req.params.id);

  const cuentas = await prisma.cuentaBancaria.findMany({
    where:   { evento_id: eventoId, deleted_at: null },
    orderBy: { id: 'asc' },
    include: {
      movimientos: {
        where:   { deleted_at: null },
        orderBy: { orden: 'asc' },
        select:  { debe: true, haber: true, saldo_corriente: true, transferencia_par_id: true },
      },
    },
  });

  const monedas = [...new Set(cuentas.map(c => c.moneda as string))];

  const por_moneda = monedas.map(moneda => {
    const cuentasMoneda = cuentas.filter(c => c.moneda === moneda);

    const cuentasDetalle = cuentasMoneda.map(c => {
      const movs       = c.movimientos;
      const last       = movs[movs.length - 1];
      const saldo_actual = last ? Number(last.saldo_corriente) : Number(c.saldo_inicial);
      const total_debe  = movs.reduce((a, m) => a + Number(m.debe),  0);
      const total_haber = movs.reduce((a, m) => a + Number(m.haber), 0);
      return {
        cuenta_id:             c.id,
        nombre:                c.nombre,
        tipo:                  c.tipo,
        saldo_inicial:         Number(c.saldo_inicial),
        saldo_actual:          parseFloat(saldo_actual.toFixed(2)),
        total_debe:            parseFloat(total_debe.toFixed(2)),
        total_haber:           parseFloat(total_haber.toFixed(2)),
        cantidad_movimientos:  movs.length,
      };
    });

    const saldo_total = parseFloat(cuentasDetalle.reduce((a, c) => a + c.saldo_actual, 0).toFixed(2));
    const total_transferencias = parseFloat(
      cuentasMoneda
        .flatMap(c => c.movimientos)
        .filter(m => m.transferencia_par_id !== null && Number(m.haber) > 0)
        .reduce((a, m) => a + Number(m.haber), 0)
        .toFixed(2),
    );

    return { moneda, cuentas: cuentasDetalle, saldo_total, total_transferencias };
  });

  res.json({ evento_id: eventoId, por_moneda });
}
