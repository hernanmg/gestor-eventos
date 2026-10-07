import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Truck, CarFront, Route as RouteIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMovimientoDiario } from '@/hooks/useMovimientoDiario';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PrintButton, PrintHeader } from '@/components/ui/PrintSection';
import { EMPRESAS } from '@/lib/empresasConstants';
import { formatearPatente } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { MovimientoDiarioFila } from '@/types';

// Movimiento Diario (DOS57, Flor) — resumen de solo lectura de los viajes de
// un día, camiones y camionetas por separado. Los datos son los de la
// bitácora (planilla de Flor + bitácora de choferes de RRHH); la carga sigue
// siendo por importación.

const DIA_MS = 86_400_000;
const hoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const moverDia = (fecha: string, dias: number) => new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * DIA_MS).toISOString().slice(0, 10);
const ddmm = (fecha: string) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
const fechaLarga = (fecha: string) =>
  new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${fecha}T00:00:00Z`));
const hora = (ts: string | null) => (ts ? new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : null);

const DASH = <span className="text-muted-foreground">—</span>;

function Vehiculo({ f }: { f: MovimientoDiarioFila }) {
  if (!f.vehiculo && !f.patente) return <span className="italic text-muted-foreground">sin vehículo</span>;
  return (
    <span>
      {f.vehiculo && <span className="font-medium">{f.vehiculo}</span>}
      {f.patente && <span className={cn('font-mono text-xs', f.vehiculo ? 'ml-1.5 text-muted-foreground' : 'font-medium')}>{formatearPatente(f.patente)}</span>}
    </span>
  );
}

function Seccion({ titulo, icono, fecha, filas, onAbrir }: {
  titulo: string; icono: React.ReactNode; fecha: string; filas: MovimientoDiarioFila[]; onAbrir: (f: MovimientoDiarioFila) => void;
}) {
  return (
    <section className="rounded-lg border bg-white break-inside-avoid">
      <h2 className="flex items-center gap-2 border-b px-4 py-2.5 text-sm font-semibold uppercase tracking-wide">
        {icono} Resumen movimiento diario {titulo} <span className="text-muted-foreground font-normal">| {ddmm(fecha)}</span>
        <span className="ml-auto text-xs font-normal normal-case text-muted-foreground">{filas.length} viaje(s)</span>
      </h2>
      {filas.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">Sin movimientos registrados</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Vehículo</th>
              <th className="px-4 py-2 text-left font-medium">Chofer</th>
              <th className="px-4 py-2 text-left font-medium">Evento</th>
              <th className="px-4 py-2 text-left font-medium">Tramo</th>
              <th className="px-4 py-2 text-right font-medium">KM</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filas.map(f => (
              <tr key={f.id} onClick={() => onAbrir(f)} className="cursor-pointer hover:bg-muted/20">
                <td className="px-4 py-2.5"><Vehiculo f={f} /></td>
                <td className="px-4 py-2.5">{f.chofer ?? DASH}</td>
                <td className="px-4 py-2.5">{f.evento}</td>
                <td className="px-4 py-2.5">
                  {f.tramo ?? (f.carga ? null : DASH)}
                  {f.carga && <span className={cn('font-mono text-xs', f.tramo && 'ml-1.5 text-muted-foreground')}>{f.carga}</span>}
                  {f.origen === 'RRHH' && <span className="no-print ml-1.5 rounded bg-muted px-1 text-[10px] text-muted-foreground" title="Cargado en la bitácora de choferes (RRHH)">RRHH</span>}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{f.km_recorridos != null ? f.km_recorridos.toLocaleString('es-AR') : DASH}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function DetalleViaje({ f, fecha, onClose }: { f: MovimientoDiarioFila; fecha: string; onClose: () => void }) {
  const navigate = useNavigate();
  const fila = (label: string, valor: React.ReactNode) => (
    <div className="flex gap-3 py-1.5 text-sm border-b last:border-0">
      <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
      <span className="flex-1">{valor ?? DASH}</span>
    </div>
  );
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Viaje del {ddmm(fecha)}</DialogTitle>
          <DialogDescription>{f.origen === 'FLOTA' ? 'Planilla de viajes de Flota' : 'Bitácora de choferes (RRHH)'}</DialogDescription>
        </DialogHeader>
        <div>
          {fila('Vehículo', <Vehiculo f={f} />)}
          {fila('N° de carga', f.carga)}
          {fila('Chofer', f.chofer)}
          {fila('Evento', f.evento)}
          {fila('Tramo', f.tramo)}
          {fila('KM recorridos', f.km_recorridos != null ? f.km_recorridos.toLocaleString('es-AR') : null)}
          {(f.horario_salida || f.horario_llegada) && fila('Horario', `${hora(f.horario_salida) ?? '—'} → ${hora(f.horario_llegada) ?? '—'}`)}
          {fila('Observaciones', f.observaciones)}
        </div>
        {f.origen === 'FLOTA' && (
          <div className="mt-4 flex justify-end">
            <Button size="sm" variant="outline" onClick={() => navigate(`/bitacora-viajes?desde=${fecha}&hasta=${fecha}`)}>
              <RouteIcon size={14} className="mr-1.5" /> Ver en Bitácora
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function MovimientoDiarioPage() {
  const { user } = useAuth();
  const [fecha, setFecha] = useState(hoyLocal);
  const [abierto, setAbierto] = useState<MovimientoDiarioFila | null>(null);
  const { data, isLoading, isError } = useMovimientoDiario(fecha);

  const permitido = (user?.rol === 'ADMIN' || user?.rol === 'OPERADOR') && user?.empresaId === EMPRESAS.DOS57;
  if (!permitido) return <Navigate to="/" replace />;

  const camiones   = data?.camiones ?? [];
  const camionetas = data?.camionetas ?? [];
  const vacio = !!data && camiones.length + camionetas.length === 0;

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <PrintHeader titulo="Movimiento Diario" periodo={fechaLarga(fecha)} />

      <div className="no-print flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Truck size={22} /> Movimiento Diario</h1>
        <div className="flex items-center gap-1 ml-auto">
          <Button size="icon" variant="outline" onClick={() => setFecha(f => moverDia(f, -1))} title="Día anterior"><ChevronLeft size={16} /></Button>
          <input
            type="date" value={fecha}
            onChange={e => { if (e.target.value) setFecha(e.target.value); }}
            className="h-9 border rounded px-2 text-sm bg-white"
          />
          <Button size="icon" variant="outline" onClick={() => setFecha(f => moverDia(f, 1))} title="Día siguiente"><ChevronRight size={16} /></Button>
          {fecha !== hoyLocal() && <Button size="sm" variant="ghost" onClick={() => setFecha(hoyLocal())}>Hoy</Button>}
        </div>
        <PrintButton />
      </div>
      <p className="no-print -mt-3 text-sm text-muted-foreground first-letter:uppercase">
        {fechaLarga(fecha)}
        {data && <> · <span className="font-medium text-foreground">{camiones.length} camiones · {camionetas.length} camionetas</span></>}
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">No se pudo cargar el movimiento del día.</p>
      ) : vacio ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          <Truck size={32} className="mx-auto mb-2 opacity-30" />
          Sin movimientos registrados para esta fecha. Los viajes se cargan al importar la planilla de Flor.
        </div>
      ) : (
        <>
          <Seccion titulo="camiones" icono={<Truck size={16} />} fecha={fecha} filas={camiones} onAbrir={setAbierto} />
          <Seccion titulo="camionetas" icono={<CarFront size={16} />} fecha={fecha} filas={camionetas} onAbrir={setAbierto} />
        </>
      )}

      {abierto && <DetalleViaje f={abierto} fecha={fecha} onClose={() => setAbierto(null)} />}
    </div>
  );
}
