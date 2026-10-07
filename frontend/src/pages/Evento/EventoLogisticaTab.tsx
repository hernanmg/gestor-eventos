import { Link } from 'react-router-dom';
import { Truck, Fuel, Route as RouteIcon } from 'lucide-react';
import { useLogisticaEvento } from '@/hooks/useBitacoraFlota';
import { formatDate, formatCurrency, formatLitros, formatearPatente } from '@/lib/formatters';
import { CombustibleEstadoBadge } from '@/components/ui/badge';
import BaseTable from '@/components/ui/BaseTable';
import type { ViajeFlota } from '@/types';
import EventoRemitosSection from './EventoRemitosSection';

// Tab Logística de la ficha de evento: viajes de la bitácora de Flota (planillas
// de Flor) y cargas de combustible de estación (Santi) vinculadas a este evento.
// Juntas sirven para detectar la misma carga registrada en los dos lados.
// En DOS57 abajo van los remitos del evento (EventoRemitosSection).

const thCls = 'px-3 py-2 text-left text-xs font-medium text-muted-foreground';
const tdNum = 'px-3 py-2.5 text-right tabular-nums';
const DASH  = <span className="text-muted-foreground">—</span>;

const fmtKm  = (n: number) => n.toLocaleString('es-AR');
const fmtDec = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
const celda  = (v: number | null, fmt: (n: number) => string) => (v != null ? fmt(v) : DASH);

function Tarjeta({ label, valor, detalle }: { label: string; valor: string; detalle?: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{valor}</p>
      {detalle && <p className="text-xs text-muted-foreground mt-0.5">{detalle}</p>}
    </div>
  );
}

function camionLabel(v: ViajeFlota) {
  const patente = v.camion?.patente ?? v.patente_camion;
  if (!patente && !v.alias_camion) return DASH;
  return (
    <span>
      {patente ? <span className="font-mono font-medium">{formatearPatente(patente)}</span> : <span className="italic text-muted-foreground">sin patente</span>}
      {v.alias_camion && <span className="ml-1 text-xs text-muted-foreground">({v.alias_camion})</span>}
    </span>
  );
}

function choferLabel(v: ViajeFlota) {
  if (v.empleado) return `${v.empleado.nombre} ${v.empleado.apellido}`;
  return v.chofer_nombre ?? DASH;
}

export default function EventoLogisticaTab({ eventoId, eventoNombre, conRemitos }: { eventoId: number; eventoNombre: string; conRemitos: boolean }) {
  const { data, isLoading, isError } = useLogisticaEvento(eventoId);

  return (
    <div className="p-6 space-y-6">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : isError || !data ? (
        <p className="text-sm text-destructive">No se pudo cargar la logística del evento.</p>
      ) : (
        <LogisticaViajesYCargas data={data} />
      )}
      {conRemitos && <EventoRemitosSection eventoId={eventoId} eventoNombre={eventoNombre} />}
    </div>
  );
}

function LogisticaViajesYCargas({ data }: { data: NonNullable<ReturnType<typeof useLogisticaEvento>['data']> }) {
  const { viajes, cargas, resumen: r } = data;

  return (
    <>
      <div className="space-y-2">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Tarjeta label="Total KM" valor={fmtKm(r.total_km)} />
          <Tarjeta label="Total L. viajes" valor={`${formatLitros(r.total_litros_viajes)} L`} detalle={`${formatLitros(r.total_litros_consumidos)} L consumidos`} />
          <Tarjeta label="Total L. cargas estación" valor={`${formatLitros(r.total_litros_cargas)} L`} />
          <Tarjeta
            label="Total $ combustible"
            valor={formatCurrency(r.total_combustible)}
            detalle={`Viajes ${formatCurrency(r.total_combustible_viajes)} + cargas ${formatCurrency(r.total_combustible_cargas)}`}
          />
          <Tarjeta label="Total $ caja choferes" valor={formatCurrency(r.total_caja)} />
        </div>
        {r.litros_iniciales_declarados != null && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm">
            <p>
              Litros iniciales declarados por chofer: <span className="font-semibold tabular-nums">{formatLitros(r.litros_iniciales_declarados)} L</span>
              {r.litros_iniciales_detalle.length > 1 && (
                <span className="text-muted-foreground">
                  {' '}({r.litros_iniciales_detalle.map(d => `${d.chofer ?? (d.patente ? formatearPatente(d.patente) : 's/d')}: ${formatLitros(d.litros)} L`).join(' · ')})
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Saldo de tanque al arrancar la gira según la planilla. Comparalo con las cargas de estación: una diferencia grande puede ser una carga no registrada o una planilla desactualizada.
            </p>
          </div>
        )}
      </div>

      {/* ── Viajes ── */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <RouteIcon size={15} /> Viajes <span className="font-normal text-muted-foreground">({viajes.length})</span>
        </h3>
        {viajes.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            <Truck size={32} className="mx-auto mb-2 opacity-30" />
            No hay viajes de la bitácora vinculados a este evento.{' '}
            <Link to="/bitacora-viajes" className="underline">Ir a la bitácora</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <BaseTable className="w-full text-sm min-w-[1000px]">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className={thCls}>Fecha</th>
                  <th className={thCls}>Camión</th>
                  <th className={thCls}>Chofer</th>
                  <th className={thCls}>Tramo</th>
                  <th className={`${thCls} text-right`}>KM rec.</th>
                  <th className={`${thCls} text-right`}>L. cargados</th>
                  <th className={`${thCls} text-right`}>L. consumidos</th>
                  <th className={`${thCls} text-right`}>$ Combustible</th>
                  <th className={`${thCls} text-right`}>$ Caja</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {viajes.map(v => (
                  <tr key={v.id} className="hover:bg-muted/20">
                    <td className="px-3 py-2.5 whitespace-nowrap">{v.fecha ? formatDate(v.fecha) : <span className="italic text-muted-foreground">sin fecha</span>}</td>
                    <td className="px-3 py-2.5">{camionLabel(v)}</td>
                    <td className="px-3 py-2.5">{choferLabel(v)}</td>
                    <td className="px-3 py-2.5">{v.recorrido ?? DASH}</td>
                    <td className={tdNum}>{celda(v.km_recorridos, fmtKm)}</td>
                    <td className={tdNum}>{celda(v.litros_cargados_ruta, fmtDec)}</td>
                    <td className={tdNum}>{celda(v.litros_consumidos, fmtDec)}</td>
                    <td className={tdNum}>{celda(v.monto_combustible, formatCurrency)}</td>
                    <td className={tdNum}>{celda(v.monto_caja_entregada, formatCurrency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 font-semibold">
                <tr>
                  <td className="px-3 py-2.5" colSpan={4}>Totales</td>
                  <td className={tdNum}>{fmtKm(r.total_km)}</td>
                  <td className={tdNum}>{fmtDec(r.total_litros_viajes)}</td>
                  <td className={tdNum}>{fmtDec(r.total_litros_consumidos)}</td>
                  <td className={tdNum}>{formatCurrency(r.total_combustible_viajes)}</td>
                  <td className={tdNum}>{formatCurrency(r.total_caja)}</td>
                </tr>
              </tfoot>
            </BaseTable>
          </div>
        )}
      </section>

      {/* ── Combustible ── */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Fuel size={15} /> Combustible (cargas en estación) <span className="font-normal text-muted-foreground">({cargas.length})</span>
        </h3>
        {cargas.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            <Fuel size={32} className="mx-auto mb-2 opacity-30" />
            No hay cargas de combustible vinculadas a este evento.{' '}
            <Link to="/combustible" className="underline">Ir a Combustible</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <BaseTable className="w-full text-sm min-w-[700px]">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className={thCls}>Fecha</th>
                  <th className={thCls}>Camión</th>
                  <th className={`${thCls} text-right`}>Litros</th>
                  <th className={`${thCls} text-right`}>Monto</th>
                  <th className={thCls}>Estación</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {cargas.map(c => (
                  <tr key={c.id} className="hover:bg-muted/20">
                    <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(c.fecha)}</td>
                    <td className="px-3 py-2.5 font-mono font-medium">{c.camion ? formatearPatente(c.camion.patente ?? c.camion.codigo) : DASH}</td>
                    <td className={tdNum}>{formatLitros(c.litros)} L</td>
                    <td className={tdNum}>{formatCurrency(c.monto_total)}</td>
                    <td className="px-3 py-2.5">
                      {c.estacion_nombre || c.estacion_ciudad
                        ? [c.estacion_nombre, c.estacion_ciudad].filter(Boolean).join(' — ')
                        : DASH}
                      {c.estado !== 'AUTORIZADA' && <span className="ml-2"><CombustibleEstadoBadge estado={c.estado} /></span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 font-semibold">
                <tr>
                  <td className="px-3 py-2.5" colSpan={2}>Totales</td>
                  <td className={tdNum}>{formatLitros(r.total_litros_cargas)} L</td>
                  <td className={tdNum}>{formatCurrency(r.total_combustible_cargas)}</td>
                  <td />
                </tr>
              </tfoot>
            </BaseTable>
          </div>
        )}
      </section>
    </>
  );
}
