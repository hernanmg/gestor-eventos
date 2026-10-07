import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { parseFechaUTC } from './bitacoraViajes.controller';
import { RE_ALIAS_CARGA } from '../lib/bitacoraFlotaImporter';

// Movimiento Diario (DOS57, Flor) — resumen de solo lectura de todos los
// viajes de un día, camiones y camionetas por separado. Sale de BitacoraViaje
// con AMBOS orígenes (FLOTA = planillas de Flor, RRHH = bitácora de choferes):
// Flor quiere verlos todos, aunque un mismo viaje pueda figurar en las dos.
//
// alias_camion "C1".."C7" es el n° de carga del evento, no un vehículo (ver
// bitacoraFlotaImporter): se devuelve aparte como `carga`, nunca como nombre.

// Camion.tipo_vehiculo (pizarra) o Camion.tipo (alta manual) que van a la
// sección camionetas. Lo que no se puede resolver va a camiones por defecto.
const RE_CAMIONETA = /CAMIONETA|PICK ?UP|VAN|UTILITARIO/i;

export interface MovimientoDiarioFila {
  id:            number;
  vehiculo:      string | null;
  patente:       string | null;
  carga:         string | null; // "C1"… (n° de carga), si lo tiene
  chofer:        string | null;
  evento:        string;
  evento_id:     number | null;
  tramo:         string | null;
  km_recorridos: number | null;
  horario_salida:  Date | null;
  horario_llegada: Date | null;
  observaciones: string | null;
  origen:        'RRHH' | 'FLOTA';
}

// GET /api/movimiento-diario?fecha=YYYY-MM-DD (empresa = la activa de la sesión)
export async function movimientoDiario(req: Request, res: Response) {
  const raw = String(req.query.fecha ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) { res.status(400).json({ error: 'Fecha inválida (YYYY-MM-DD)' }); return; }
  const fecha = parseFechaUTC(raw);

  const viajes = await prisma.bitacoraViaje.findMany({
    where: { ...withTenant(req.empresaId!), deleted_at: null, fecha },
    include: {
      camion:   { select: { codigo: true, descripcion: true, patente: true, tipo: true, tipo_vehiculo: true } },
      empleado: { select: { nombre: true, apellido: true } },
      evento:   { select: { id: true, nombre: true } },
    },
    orderBy: [{ horario_salida: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
  });

  const camiones: MovimientoDiarioFila[] = [];
  const camionetas: MovimientoDiarioFila[] = [];

  for (const v of viajes) {
    const alias = v.alias_camion;
    const esCarga = !!alias && RE_ALIAS_CARGA.test(alias);
    const patente = v.camion?.patente ?? v.patente_camion;
    // Nombre: el del vehículo resuelto; si no, la patente cruda; si no, el
    // alias de la planilla cuando no es un n° de carga ("PLANCHA").
    const vehiculo = v.camion?.descripcion ?? v.camion?.codigo ?? (patente ? null : (!esCarga ? alias : null));

    const fila: MovimientoDiarioFila = {
      id:            v.id,
      vehiculo,
      patente,
      carga:         esCarga ? alias : null,
      chofer:        v.chofer_nombre ?? (v.empleado ? `${v.empleado.nombre} ${v.empleado.apellido}`.trim() : null),
      evento:        v.evento?.nombre ?? v.convocatoria ?? 'Sin evento',
      evento_id:     v.evento?.id ?? null,
      tramo:         v.recorrido,
      km_recorridos: v.km_recorridos,
      horario_salida:  v.horario_salida,
      horario_llegada: v.horario_llegada,
      observaciones: v.observaciones,
      origen:        v.origen,
    };
    const tipo = `${v.camion?.tipo_vehiculo ?? ''} ${v.camion?.tipo ?? ''}`;
    (RE_CAMIONETA.test(tipo) ? camionetas : camiones).push(fila);
  }

  res.json({ fecha: raw, camiones, camionetas });
}
