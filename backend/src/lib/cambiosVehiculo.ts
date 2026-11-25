import type { CambioVehiculo, TipoCambioVehiculo } from '@prisma/client';
import { prisma } from './prisma';

// Neumáticos y baterías por vehículo (Logística 8). El estado de cada vehículo
// sale del último cambio de cada tipo; la próxima rotación es la que se anotó
// o, si no, el km de la última + ROTACION_CADA_KM (el intervalo que usa la
// planilla de Santi en todas las filas).

export const ROTACION_CADA_KM = 10_000;
export const AVISO_ROTACION_KM = 1_000;   // aviso cuando faltan menos de 1.000 km
export const AVISO_BATERIA_DIAS = 30;

const MS_DIA = 86_400_000;

export function proximaRotacionKm(c: Pick<CambioVehiculo, 'km' | 'proximo_km'>): number | null {
  return c.proximo_km ?? (c.km != null ? c.km + ROTACION_CADA_KM : null);
}

// Más reciente primero: por fecha y, entre los que no la tienen, por km.
function masReciente(a: CambioVehiculo, b: CambioVehiculo) {
  const fa = a.fecha?.getTime() ?? -Infinity, fb = b.fecha?.getTime() ?? -Infinity;
  if (fa !== fb) return fb - fa;
  return (b.km ?? -1) - (a.km ?? -1) || b.id - a.id;
}

export function mapCambio(c: CambioVehiculo) {
  return { ...c, importe: c.importe != null ? Number(c.importe) : null };
}

export async function estadoCambiosFlota(empresaId: number, hoy: Date) {
  const [camiones, cambios] = await Promise.all([
    prisma.camion.findMany({
      where:   { empresa_id: empresaId, deleted_at: null, en_servicio: true },
      select:  { id: true, codigo: true, descripcion: true, patente: true, tipo_vehiculo: true, km_actual: true },
      orderBy: { codigo: 'asc' },
    }),
    prisma.cambioVehiculo.findMany({ where: { empresa_id: empresaId, deleted_at: null } }),
  ]);
  const porCamion = new Map<number, CambioVehiculo[]>();
  for (const c of cambios) (porCamion.get(c.camion_id) ?? porCamion.set(c.camion_id, []).get(c.camion_id)!).push(c);

  return camiones.map(v => {
    const lista = (porCamion.get(v.id) ?? []).sort(masReciente);
    const ultimo = (t: TipoCambioVehiculo) => lista.find(c => c.tipo === t) ?? null;
    const neumaticos = ultimo('NEUMATICOS');
    // La rotación se mide en km: vale la del km más alto (cubiertas nuevas con km también reinician la cuenta)
    const conKm = lista.filter(c => (c.tipo === 'ROTACION' || c.tipo === 'NEUMATICOS') && (c.km != null || c.proximo_km != null))
      .sort((a, b) => ((b.km ?? (b.proximo_km! - ROTACION_CADA_KM)) - (a.km ?? (a.proximo_km! - ROTACION_CADA_KM))));
    const baseRotacion = conKm[0] ?? null;
    const proximaKm = baseRotacion ? proximaRotacionKm(baseRotacion) : null;
    const faltanKm = proximaKm != null && v.km_actual != null ? proximaKm - v.km_actual : null;
    const bateria = ultimo('BATERIA');
    const diasBateria = bateria?.proxima_fecha ? Math.round((bateria.proxima_fecha.getTime() - hoy.getTime()) / MS_DIA) : null;
    const mesesBateria = bateria?.fecha ? Math.floor((hoy.getTime() - bateria.fecha.getTime()) / (30.44 * MS_DIA)) : null;
    return {
      camion: { id: v.id, codigo: v.codigo, descripcion: v.descripcion, patente: v.patente, tipo_vehiculo: v.tipo_vehiculo },
      km_actual: v.km_actual,
      neumaticos: neumaticos ? mapCambio(neumaticos) : null,
      rotacion: baseRotacion ? { ...mapCambio(baseRotacion), proxima_km: proximaKm, faltan_km: faltanKm } : null,
      bateria: bateria ? { ...mapCambio(bateria), dias_para_cambio: diasBateria, meses: mesesBateria } : null,
      alerta_rotacion: faltanKm == null ? null : faltanKm <= 0 ? 'VENCIDA' as const : faltanKm <= AVISO_ROTACION_KM ? 'PROXIMA' as const : null,
      alerta_bateria: diasBateria == null ? null : diasBateria <= 0 ? 'VENCIDA' as const : diasBateria <= AVISO_BATERIA_DIAS ? 'PROXIMA' as const : null,
      historial: lista.map(mapCambio),
    };
  });
}

export type EstadoCambiosVehiculo = Awaited<ReturnType<typeof estadoCambiosFlota>>[number];

/** Avisos para la campanita y las alertas de Flota. */
export async function alertasCambios(empresaId: number, hoy: Date) {
  const estado = await estadoCambiosFlota(empresaId, hoy);
  const out: { id: string; tipo: 'ROTACION_NEUMATICOS' | 'CAMBIO_BATERIA'; camion_id: number; titulo: string; descripcion: string; urgencia: 'critical' | 'warning'; fecha: Date }[] = [];
  for (const e of estado) {
    if (e.alerta_rotacion && e.rotacion) {
      out.push({
        id: `rotacion-${e.camion.id}`, tipo: 'ROTACION_NEUMATICOS', camion_id: e.camion.id,
        titulo: `Rotar las cubiertas de ${e.camion.codigo}`,
        descripcion: e.alerta_rotacion === 'VENCIDA'
          ? `Tocaba a los ${e.rotacion.proxima_km!.toLocaleString('es-AR')} km y va por ${e.km_actual!.toLocaleString('es-AR')}`
          : `Faltan ${e.rotacion.faltan_km!.toLocaleString('es-AR')} km (a los ${e.rotacion.proxima_km!.toLocaleString('es-AR')})`,
        urgencia: e.alerta_rotacion === 'VENCIDA' ? 'critical' : 'warning',
        fecha: hoy,
      });
    }
    if (e.alerta_bateria && e.bateria?.proxima_fecha) {
      out.push({
        id: `bateria-${e.camion.id}`, tipo: 'CAMBIO_BATERIA', camion_id: e.camion.id,
        titulo: `Batería de ${e.camion.codigo}`,
        descripcion: `${e.alerta_bateria === 'VENCIDA' ? 'Tocaba cambiarla' : 'Toca cambiarla'} el ${e.bateria.proxima_fecha.toISOString().slice(8, 10)}/${e.bateria.proxima_fecha.toISOString().slice(5, 7)}/${e.bateria.proxima_fecha.toISOString().slice(0, 4)}${e.bateria.detalle ? ` (${e.bateria.detalle})` : ''}`,
        urgencia: e.alerta_bateria === 'VENCIDA' ? 'critical' : 'warning',
        fecha: e.bateria.proxima_fecha,
      });
    }
  }
  return out;
}
