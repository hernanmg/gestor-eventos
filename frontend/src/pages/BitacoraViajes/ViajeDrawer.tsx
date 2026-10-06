import { useMemo, useState } from 'react';
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import MoneyInput from '@/components/ui/MoneyInput';
import { useGuardarViajeFlota, type ViajeFlotaPayload } from '@/hooks/useBitacoraFlota';
import { useVehiculosFlota } from '@/hooks/useFlota';
import { useEmpleados } from '@/hooks/useRRHH';
import { useEventos } from '@/hooks/useEvento';
import { getApiErrorMessage } from '@/lib/utils';
import { formatearPatente } from '@/lib/formatters';
import type { ViajeFlota } from '@/types';

const inputCls = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

type Form = {
  fecha: string; convocatoria: string; evento_id: string; recorrido: string;
  camion_id: string; patente_camion: string; alias_camion: string;
  empleado_id: string; chofer_nombre: string;
  km_iniciales: string; km_finales: string; km_recorridos: string;
  litros_cargados_ruta: string; litros_consumidos: string; km_por_litro: string; litros_iniciales_tanque: string;
  monto_combustible: string; monto_caja_entregada: string;
  horario_salida: string; horario_llegada: string; observaciones: string;
};

const str = (v: number | string | null | undefined) => (v === null || v === undefined ? '' : String(v));
const num = (s: string) => (s.trim() === '' ? null : Number(s));
const txt = (s: string) => (s.trim() === '' ? null : s.trim());

// horario_* son timestamps reales: <input type="datetime-local"> trabaja en hora local
function isoALocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const localAIso = (s: string) => (s ? new Date(s).toISOString() : null);

function formInicial(v: ViajeFlota | null): Form {
  return {
    fecha:                v?.fecha?.slice(0, 10) ?? '',
    convocatoria:         v?.convocatoria ?? '',
    evento_id:            str(v?.evento_id),
    recorrido:            v?.recorrido ?? '',
    camion_id:            str(v?.camion_id),
    patente_camion:       v?.camion_id ? '' : (v?.patente_camion ?? ''),
    alias_camion:         v?.alias_camion ?? '',
    empleado_id:          str(v?.empleado_id),
    chofer_nombre:        v?.chofer_nombre ?? '',
    km_iniciales:         str(v?.km_iniciales),
    km_finales:           str(v?.km_finales),
    km_recorridos:        str(v?.km_recorridos),
    litros_cargados_ruta: str(v?.litros_cargados_ruta),
    litros_consumidos:    str(v?.litros_consumidos),
    km_por_litro:         str(v?.km_por_litro),
    litros_iniciales_tanque: str(v?.litros_iniciales_tanque),
    monto_combustible:    str(v?.monto_combustible),
    monto_caja_entregada: str(v?.monto_caja_entregada),
    horario_salida:       isoALocal(v?.horario_salida ?? null),
    horario_llegada:      isoALocal(v?.horario_llegada ?? null),
    observaciones:        v?.observaciones ?? '',
  };
}

// Recalcula los derivados según qué campo cambió:
//   km iniciales/finales → km recorridos
//   km recorridos / L. consumidos → KM/L (salvo que el usuario lo haya pisado a mano)
// KM/L = km / litros CONSUMIDOS, mismo criterio que la columna "CANT. DE KM x L"
// de las planillas de Flor (993 km / 440,24 L = 2,25).
function derivar(prev: Form, patch: Partial<Form>, kmLManual: boolean): Form {
  const f = { ...prev, ...patch };
  if ('km_iniciales' in patch || 'km_finales' in patch) {
    const ini = num(f.km_iniciales);
    const fin = num(f.km_finales);
    if (ini !== null && fin !== null && fin >= ini) f.km_recorridos = String(fin - ini);
  }
  const tocaRendimiento = ['km_iniciales', 'km_finales', 'km_recorridos', 'litros_consumidos'].some(k => k in patch);
  if (!kmLManual && tocaRendimiento) {
    const km = num(f.km_recorridos);
    const litros = num(f.litros_consumidos);
    f.km_por_litro = km !== null && litros ? (km / litros).toFixed(2) : '';
  }
  return f;
}

function Campo({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><label className={labelCls}>{label}</label>{children}</div>;
}

export default function ViajeDrawer({ viaje, convocatorias, onClose }: {
  viaje:         ViajeFlota | null; // null = alta
  convocatorias: string[]; // textos libres ya usados en la bitácora
  onClose:       () => void;
}) {
  const guardar = useGuardarViajeFlota();
  const { data: eventos = [] } = useEventos();
  const { data: vehiculos = [] } = useVehiculosFlota();
  const { data: empleados = [] } = useEmpleados();
  const [form, setForm] = useState<Form>(() => formInicial(viaje));
  const [kmLManual, setKmLManual] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<Form>) => setForm(f => derivar(f, patch, kmLManual));
  const on = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set({ [k]: e.target.value });

  // Choferes primero, después el resto
  const empleadosOrdenados = useMemo(
    () => [...empleados].sort((a, b) =>
      Number(b.categoria === 'CHOFER') - Number(a.categoria === 'CHOFER') || `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, 'es')),
    [empleados],
  );
  const vehiculosOrdenados = useMemo(() => [...vehiculos].sort((a, b) => a.codigo.localeCompare(b.codigo, 'es')), [vehiculos]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const data: ViajeFlotaPayload = {
      fecha:                form.fecha || null,
      convocatoria:         txt(form.convocatoria),
      evento_id:            form.evento_id ? Number(form.evento_id) : null,
      recorrido:            form.recorrido.trim(),
      camion_id:            form.camion_id ? Number(form.camion_id) : null,
      patente_camion:       form.camion_id ? undefined : txt(form.patente_camion),
      alias_camion:         txt(form.alias_camion),
      empleado_id:          form.empleado_id ? Number(form.empleado_id) : null,
      chofer_nombre:        txt(form.chofer_nombre),
      km_iniciales:         num(form.km_iniciales),
      km_finales:           num(form.km_finales),
      km_recorridos:        num(form.km_recorridos),
      litros_cargados_ruta: num(form.litros_cargados_ruta),
      litros_consumidos:    num(form.litros_consumidos),
      km_por_litro:         num(form.km_por_litro),
      litros_iniciales_tanque: num(form.litros_iniciales_tanque),
      monto_combustible:    num(form.monto_combustible),
      monto_caja_entregada: num(form.monto_caja_entregada),
      horario_salida:       localAIso(form.horario_salida),
      horario_llegada:      localAIso(form.horario_llegada),
      observaciones:        txt(form.observaciones),
    };
    try {
      await guardar.mutateAsync({ id: viaje?.id, data });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Drawer open onOpenChange={o => !o && onClose()}>
      <DrawerContent className="max-w-xl">
        <DrawerTitle className="text-lg font-semibold pr-6">{viaje ? 'Editar viaje' : 'Agregar viaje'}</DrawerTitle>
        <DrawerDescription className="text-xs text-muted-foreground mb-4">
          Viaje de camión de la bitácora de Flota (no cuenta para el viático de sueldos).
        </DrawerDescription>

        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="grid grid-cols-2 gap-3">
            <Campo label="Fecha"><input type="date" value={form.fecha} onChange={on('fecha')} className={inputCls} /></Campo>
            <Campo label="Evento del sistema (opcional)">
              <select
                value={form.evento_id}
                // Elegir un evento real completa el texto con su nombre (editable)
                onChange={e => {
                  const ev = eventos.find(x => String(x.id) === e.target.value);
                  set({ evento_id: e.target.value, ...(ev && { convocatoria: ev.nombre }) });
                }}
                className={inputCls}
              >
                <option value="">— Sin vincular —</option>
                {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nombre}</option>)}
              </select>
            </Campo>
            <Campo label="Evento (texto de la planilla)" className="col-span-2">
              <input list="bitacora-eventos" value={form.convocatoria} onChange={on('convocatoria')} className={inputCls} />
              <datalist id="bitacora-eventos">{convocatorias.map(e => <option key={e} value={e} />)}</datalist>
            </Campo>
            <Campo label="Tramo *" className="col-span-2">
              <input value={form.recorrido} onChange={on('recorrido')} required placeholder="COR - TUCUMAN" className={inputCls} />
            </Campo>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <Campo label="Camión" className="col-span-2">
              <select value={form.camion_id} onChange={on('camion_id')} className={inputCls}>
                <option value="">— Sin vehículo de Flota —</option>
                {vehiculosOrdenados.map(c => (
                  <option key={c.id} value={c.id}>{formatearPatente(c.patente ?? c.codigo)}{c.descripcion ? ` — ${c.descripcion}` : ''}</option>
                ))}
              </select>
            </Campo>
            {!form.camion_id && (
              <Campo label="Patente (si no está en Flota)">
                <input value={form.patente_camion} onChange={on('patente_camion')} className={inputCls} />
              </Campo>
            )}
            <Campo label="N° de carga (C1, C2…)">
              <input value={form.alias_camion} onChange={on('alias_camion')} className={inputCls} />
            </Campo>
            <Campo label="Chofer">
              <select value={form.empleado_id} onChange={on('empleado_id')} className={inputCls}>
                <option value="">— No vinculado —</option>
                {empleadosOrdenados.map(e => <option key={e.id} value={e.id}>{e.apellido}, {e.nombre}</option>)}
              </select>
            </Campo>
            <Campo label="Nombre en planilla">
              <input value={form.chofer_nombre} onChange={on('chofer_nombre')} placeholder="TATI" className={inputCls} />
            </Campo>
          </section>

          <section className="grid grid-cols-3 gap-3">
            <Campo label="KM iniciales"><input type="number" min={0} value={form.km_iniciales} onChange={on('km_iniciales')} className={inputCls} /></Campo>
            <Campo label="KM finales"><input type="number" min={0} value={form.km_finales} onChange={on('km_finales')} className={inputCls} /></Campo>
            <Campo label="KM recorridos"><input type="number" min={0} value={form.km_recorridos} onChange={on('km_recorridos')} className={inputCls} /></Campo>
            <Campo label="L. cargados en ruta"><input type="number" min={0} step="0.01" value={form.litros_cargados_ruta} onChange={on('litros_cargados_ruta')} className={inputCls} /></Campo>
            <Campo label="L. consumidos"><input type="number" min={0} step="0.01" value={form.litros_consumidos} onChange={on('litros_consumidos')} className={inputCls} /></Campo>
            <Campo label={kmLManual ? 'KM/L (manual)' : 'KM/L (auto)'}>
              <input
                type="number" min={0} step="0.01" value={form.km_por_litro}
                onChange={e => { setKmLManual(e.target.value !== ''); setForm(f => ({ ...f, km_por_litro: e.target.value })); }}
                className={inputCls}
                title="Se calcula como km recorridos / L. consumidos; si lo escribís a mano deja de recalcularse"
              />
            </Campo>
          </section>

          <section className="grid grid-cols-3 gap-3">
            <Campo label="L. en tanque al inicio">
              <input
                type="number" min={0} step="0.01" value={form.litros_iniciales_tanque} onChange={on('litros_iniciales_tanque')} className={inputCls}
                title="Saldo de tanque al arrancar la gira (fila COMB.INICIAL de la hoja del camión)"
              />
            </Campo>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <Campo label="$ Combustible"><MoneyInput value={form.monto_combustible} onChange={v => set({ monto_combustible: v })} className={inputCls} /></Campo>
            <Campo label="$ Caja entregada"><MoneyInput value={form.monto_caja_entregada} onChange={v => set({ monto_caja_entregada: v })} className={inputCls} /></Campo>
            <Campo label="Horario salida"><input type="datetime-local" value={form.horario_salida} onChange={on('horario_salida')} className={inputCls} /></Campo>
            <Campo label="Horario llegada"><input type="datetime-local" value={form.horario_llegada} onChange={on('horario_llegada')} className={inputCls} /></Campo>
            <Campo label="Observaciones" className="col-span-2">
              <textarea rows={3} value={form.observaciones} onChange={on('observaciones')} className={inputCls} />
            </Campo>
          </section>

          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={guardar.isPending}>{guardar.isPending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
