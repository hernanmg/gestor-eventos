import { useEffect, useState } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Download, Lock, Upload, UserCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useEmpleados } from '@/hooks/useRRHH';
import {
  usePresentismoDia, usePresentismoLista, useResumenMes, useUpsertRegistroAsistencia,
  useMarcarTodosPresentes, useCerrarMesPresentismo, useAprobarTardanza, useRechazarTardanza,
  useExportarPresentismo,
} from '@/hooks/usePresentismo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EMPRESAS } from '@/lib/empresasConstants';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { EstadoAsistencia, RegistroAsistencia, PresentismoHoyItem } from '@/types';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const ESTADO_LABEL: Record<EstadoAsistencia, string> = {
  PRESENTE: 'Presente', TARDE: 'Tarde', MEDIA_JORNADA: 'Media jornada', AUSENTE: 'Ausente',
  JUSTIFICADO: 'Justificado', LIBRE: 'Libre', VACACIONES: 'Vacaciones', LICENCIA: 'Licencia',
};

const ESTADO_INICIAL: Record<EstadoAsistencia, string> = {
  PRESENTE: 'P', TARDE: 'T', MEDIA_JORNADA: 'M', AUSENTE: 'A', JUSTIFICADO: 'J', LIBRE: 'L', VACACIONES: 'V', LICENCIA: 'Li',
};

const ESTADO_SELECT_CLASS: Record<EstadoAsistencia, string> = {
  PRESENTE:      'bg-green-100 text-green-800 border-green-300',
  TARDE:         'bg-yellow-100 text-yellow-800 border-yellow-300',
  MEDIA_JORNADA: 'bg-orange-100 text-orange-800 border-orange-300',
  AUSENTE:       'bg-red-100 text-red-800 border-red-300',
  JUSTIFICADO:   'bg-blue-100 text-blue-800 border-blue-300',
  LIBRE:         'bg-gray-100 text-gray-700 border-gray-300',
  VACACIONES:    'bg-sky-100 text-sky-800 border-sky-300',
  LICENCIA:      'bg-purple-100 text-purple-800 border-purple-300',
};

const ESTADO_BADGE_CLASS: Record<EstadoAsistencia, string> = {
  PRESENTE:      'bg-green-200 text-green-900',
  TARDE:         'bg-yellow-200 text-yellow-900',
  MEDIA_JORNADA: 'bg-orange-200 text-orange-900',
  AUSENTE:       'bg-red-200 text-red-900',
  JUSTIFICADO:   'bg-blue-200 text-blue-900',
  LIBRE:         'bg-gray-200 text-gray-800',
  VACACIONES:    'bg-sky-200 text-sky-900',
  LICENCIA:      'bg-purple-200 text-purple-900',
};

const ROW_BG_CLASS: Record<string, string> = {
  AUSENTE: 'bg-red-50', TARDE: 'bg-yellow-50', SIN_CARGAR: 'bg-gray-50',
};

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function sumarDias(fechaISO: string, delta: number): string {
  const d = new Date(fechaISO + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function diasEnMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

function esFinde(anio: number, mes: number, dia: number): boolean {
  const dow = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
  return dow === 0 || dow === 6;
}

interface FormRegistro {
  estado:       EstadoAsistencia;
  hora_ingreso: string;
  hora_egreso:  string;
  motivo:       string;
}

function formDesdeRegistro(r: RegistroAsistencia | null): FormRegistro {
  return {
    estado:       r?.estado ?? 'PRESENTE',
    hora_ingreso: r?.hora_ingreso ?? '',
    hora_egreso:  r?.hora_egreso ?? '',
    motivo:       r?.motivo ?? '',
  };
}

// ── Badge de tardanza (pendiente/aprobada/rechazada) ─────────────────────────

function TardanzaBadge({ registro }: { registro: RegistroAsistencia }) {
  if (!registro.tardanza_requiere_aprobacion) return null;
  if (registro.tardanza_aprobada === true)  return <Badge variant="success" className="text-[10px]">Tardanza aprobada</Badge>;
  if (registro.tardanza_aprobada === false) return <Badge variant="destructive" className="text-[10px]">Tardanza rechazada</Badge>;
  return <Badge variant="warning" className="text-[10px]">⏳ Pendiente Matías</Badge>;
}

function TardanzaAcciones({ registro, esMatias, onDone }: { registro: RegistroAsistencia; esMatias: boolean; onDone: () => void }) {
  const aprobarMut  = useAprobarTardanza();
  const rechazarMut = useRechazarTardanza();
  if (!esMatias || !registro.tardanza_requiere_aprobacion || registro.tardanza_aprobada !== null) return null;

  return (
    <div className="flex gap-1">
      <Button size="sm" variant="outline" className="h-6 text-[11px] px-1.5" disabled={aprobarMut.isPending}
        onClick={() => aprobarMut.mutate({ id: registro.id }, { onSuccess: onDone })}>
        Aprobar
      </Button>
      <Button size="sm" variant="outline" className="h-6 text-[11px] px-1.5 text-destructive hover:text-destructive" disabled={rechazarMut.isPending}
        onClick={() => rechazarMut.mutate({ id: registro.id }, { onSuccess: onDone })}>
        Rechazar
      </Button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VISTA DIARIA
// ═══════════════════════════════════════════════════════════════════════════

function FilaDiaria({ item, fecha, esMatias }: { item: PresentismoHoyItem; fecha: string; esMatias: boolean }) {
  const upsertMut = useUpsertRegistroAsistencia();
  const [form, setForm] = useState<FormRegistro>(() => formDesdeRegistro(item.registro));

  useEffect(() => { setForm(formDesdeRegistro(item.registro)); }, [item.registro?.id, item.registro?.updated_at]);

  const guardar = (siguiente: FormRegistro) => {
    upsertMut.mutate({
      empleado_id: item.empleado.id, fecha,
      estado: siguiente.estado,
      hora_ingreso: siguiente.hora_ingreso || null,
      hora_egreso:  siguiente.hora_egreso  || null,
      motivo:       siguiente.motivo       || null,
    });
  };

  // Debounce de 500ms para inputs de texto/hora — el select de estado guarda al toque.
  useEffect(() => {
    if (!item.registro && form.estado === 'PRESENTE' && !form.hora_ingreso && !form.hora_egreso && !form.motivo) return;
    const same = item.registro
      ? item.registro.estado === form.estado && (item.registro.hora_ingreso ?? '') === form.hora_ingreso
        && (item.registro.hora_egreso ?? '') === form.hora_egreso && (item.registro.motivo ?? '') === form.motivo
      : false;
    if (same) return;
    const t = setTimeout(() => guardar(form), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.hora_ingreso, form.hora_egreso, form.motivo]);

  const sinCargar = !item.registro;
  const rowBg = sinCargar ? ROW_BG_CLASS.SIN_CARGAR : ROW_BG_CLASS[form.estado] ?? '';

  return (
    <tr className={cn('border-b border-border/60', rowBg)}>
      <td className="px-3 py-2 font-medium">{item.empleado.apodo ?? `${item.empleado.apellido}, ${item.empleado.nombre}`}</td>
      <td className="px-3 py-2">
        <select
          value={sinCargar ? '' : form.estado}
          onChange={e => { const next = { ...form, estado: e.target.value as EstadoAsistencia }; setForm(next); guardar(next); }}
          className={cn('rounded border px-2 py-1 text-xs font-medium', sinCargar ? 'bg-white text-muted-foreground border-input' : ESTADO_SELECT_CLASS[form.estado])}
        >
          {sinCargar && <option value="">Sin cargar</option>}
          {Object.entries(ESTADO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </td>
      <td className="px-3 py-2">
        <input type="time" value={form.hora_ingreso} onChange={e => setForm(p => ({ ...p, hora_ingreso: e.target.value }))}
          className="border border-input rounded px-1.5 py-1 text-xs w-24" />
      </td>
      <td className="px-3 py-2">
        <input type="time" value={form.hora_egreso} onChange={e => setForm(p => ({ ...p, hora_egreso: e.target.value }))}
          className="border border-input rounded px-1.5 py-1 text-xs w-24" />
      </td>
      <td className="px-3 py-2 text-right text-xs text-muted-foreground">{item.registro?.horas_trabajadas ?? '-'}</td>
      <td className="px-3 py-2">
        <input value={form.motivo} onChange={e => setForm(p => ({ ...p, motivo: e.target.value }))}
          placeholder="Motivo / observación" className="border border-input rounded px-1.5 py-1 text-xs w-full" />
      </td>
      <td className="px-3 py-2">
        {item.registro && (
          <div className="flex flex-col items-start gap-1">
            <TardanzaBadge registro={item.registro} />
            <TardanzaAcciones registro={item.registro} esMatias={esMatias} onDone={() => {}} />
          </div>
        )}
      </td>
    </tr>
  );
}

function VistaDiaria({ fecha, setFecha, onVerMensual, esMatias }: {
  fecha: string; setFecha: (f: string) => void; onVerMensual: () => void; esMatias: boolean;
}) {
  const { data, isLoading } = usePresentismoDia(fecha);
  const marcarTodosMut = useMarcarTodosPresentes();

  const items = data?.items ?? [];
  const presentes  = items.filter(i => i.registro?.estado === 'PRESENTE').length;
  const ausentes   = items.filter(i => i.registro?.estado === 'AUSENTE').length;
  const sinCargar  = items.filter(i => !i.registro).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setFecha(sumarDias(fecha, -1))}>←</Button>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="border border-input rounded px-2 py-1.5 text-sm" />
          <Button size="sm" variant="outline" onClick={() => setFecha(hoyISO())}>Hoy</Button>
          <Button size="sm" variant="outline" onClick={() => setFecha(sumarDias(fecha, 1))}>→</Button>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-green-700 font-medium">{presentes} presentes</span>
          <span className="text-red-700 font-medium">{ausentes} ausentes</span>
          <span className="text-muted-foreground font-medium">{sinCargar} sin cargar</span>
        </div>
        <Button size="sm" variant="outline" onClick={onVerMensual}>Vista mensual →</Button>
      </div>

      <div className="flex gap-2 mb-3">
        <Button
          size="sm"
          disabled={marcarTodosMut.isPending}
          onClick={() => marcarTodosMut.mutate(fecha)}
        >
          <UserCheck size={14} className="mr-1.5" /> Marcar todos presentes
        </Button>
        <Button size="sm" variant="outline" disabled title="Próximamente — reloj ET-F7">
          <Upload size={14} className="mr-1.5" /> Importar desde reloj
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Empleado</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Ingreso</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Egreso</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Hs</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Motivo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Tardanza</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">No hay empleados activos en DOS57.</td></tr>
              ) : items.map(item => <FilaDiaria key={item.empleado.id} item={item} fecha={fecha} esMatias={esMatias} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VISTA MENSUAL
// ═══════════════════════════════════════════════════════════════════════════

function CeldaMensual({ empleadoId, fechaISO, registro, esMatias }: {
  empleadoId: number; fechaISO: string; registro: RegistroAsistencia | null; esMatias: boolean;
}) {
  const [open, setOpen] = useState(false);
  const upsertMut = useUpsertRegistroAsistencia();
  const [form, setForm] = useState<FormRegistro>(() => formDesdeRegistro(registro));

  useEffect(() => { setForm(formDesdeRegistro(registro)); }, [registro?.id, registro?.updated_at, open]);

  const guardar = () => {
    upsertMut.mutate({
      empleado_id: empleadoId, fecha: fechaISO, estado: form.estado,
      hora_ingreso: form.hora_ingreso || null, hora_egreso: form.hora_egreso || null, motivo: form.motivo || null,
    }, { onSuccess: () => setOpen(false) });
  };

  const tardanzaAnillo = registro?.estado === 'TARDE'
    ? registro.tardanza_aprobada === true ? 'ring-2 ring-green-500' : registro.tardanza_aprobada === false ? 'ring-2 ring-red-500' : 'ring-2 ring-orange-400'
    : '';

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button className={cn(
          'w-7 h-7 rounded text-[10px] font-semibold flex items-center justify-center hover:opacity-80 transition-opacity',
          registro ? ESTADO_BADGE_CLASS[registro.estado] : 'bg-gray-50 text-gray-300',
          tardanzaAnillo,
        )}>
          {registro ? ESTADO_INICIAL[registro.estado] : '—'}
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="center" sideOffset={6} className="z-50 w-64 rounded-md border border-border bg-white shadow-lg p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{fechaISO}</p>
          <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value as EstadoAsistencia }))}
            className={cn('w-full rounded border px-2 py-1 text-xs font-medium', ESTADO_SELECT_CLASS[form.estado])}>
            {Object.entries(ESTADO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <div className="flex gap-1.5">
            <input type="time" value={form.hora_ingreso} onChange={e => setForm(p => ({ ...p, hora_ingreso: e.target.value }))} className="border border-input rounded px-1.5 py-1 text-xs flex-1" />
            <input type="time" value={form.hora_egreso}  onChange={e => setForm(p => ({ ...p, hora_egreso: e.target.value }))}  className="border border-input rounded px-1.5 py-1 text-xs flex-1" />
          </div>
          <input value={form.motivo} onChange={e => setForm(p => ({ ...p, motivo: e.target.value }))} placeholder="Motivo" className="border border-input rounded px-1.5 py-1 text-xs w-full" />
          {registro && <TardanzaBadge registro={registro} />}
          {registro && <TardanzaAcciones registro={registro} esMatias={esMatias} onDone={() => setOpen(false)} />}
          <div className="flex justify-end gap-1.5 pt-1">
            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setOpen(false)}>Cerrar</Button>
            <Button size="sm" className="h-6 text-xs" disabled={upsertMut.isPending} onClick={guardar}>Guardar</Button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function VistaMensual({ mes, anio, setMes, setAnio, onVerDiaria, esMatias }: {
  mes: number; anio: number; setMes: (m: number) => void; setAnio: (a: number) => void; onVerDiaria: () => void; esMatias: boolean;
}) {
  const { data: empleados = [] } = useEmpleados({ estado: 'ACTIVO' });
  const { data: registros = [], isLoading } = usePresentismoLista({ mes, anio });
  const { data: resumen } = useResumenMes(mes, anio);
  const cerrarMut = useCerrarMesPresentismo();
  const { exportar, isExporting } = useExportarPresentismo();

  const totalDias = diasEnMes(anio, mes);
  const dias = Array.from({ length: totalDias }, (_, i) => i + 1);

  const registroPorClave = new Map(registros.map(r => [`${r.empleado_id}-${r.fecha.slice(0, 10)}`, r]));
  const resumenPorEmpleado = new Map((resumen?.items ?? []).map(i => [i.empleado.id, i]));

  const empleadosOrdenados = [...empleados].sort((a, b) => a.apellido.localeCompare(b.apellido));

  const handleCerrarMes = () => {
    if (!window.confirm(`¿Cerrar el presentismo de ${MESES[mes - 1]} ${anio}? Esto genera el resumen que usa Sueldos Admin para el premio presentismo.`)) return;
    cerrarMut.mutate({ mes, anio }, {
      onError: err => alert(getApiErrorMessage(err) ?? 'Error al cerrar el mes'),
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <select value={mes} onChange={e => setMes(Number(e.target.value))} className="border border-input rounded px-2 py-1.5 text-sm">
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={anio} onChange={e => setAnio(Number(e.target.value))} className="border border-input rounded px-2 py-1.5 text-sm">
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {resumen?.periodo_cerrado && <Badge variant="success"><Lock size={10} className="mr-1" /> Cerrado</Badge>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportar(mes, anio)} disabled={isExporting}>
            <Download size={14} className="mr-1.5" /> {isExporting ? 'Exportando…' : 'Exportar Excel'}
          </Button>
          <Button size="sm" variant="outline" onClick={handleCerrarMes} disabled={cerrarMut.isPending}>
            <Lock size={14} className="mr-1.5" /> {cerrarMut.isPending ? 'Cerrando…' : 'Cerrar mes'}
          </Button>
          <Button size="sm" variant="outline" onClick={onVerDiaria}>Vista diaria →</Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="text-sm border-collapse">
            <thead className="bg-gray-50 border-b border-border sticky top-0">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground sticky left-0 bg-gray-50 z-10 min-w-[160px]">Empleado</th>
                {dias.map(d => (
                  <th key={d} className={cn('w-7 py-2 text-center text-[10px] font-medium text-muted-foreground', esFinde(anio, mes, d) && 'bg-gray-200')}>{d}</th>
                ))}
                <th className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">Pres.</th>
                <th className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">Aus.</th>
                <th className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">Tarde</th>
                <th className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">Total hs</th>
                <th className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">Presentismo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {empleadosOrdenados.map(empleado => {
                const r = resumenPorEmpleado.get(empleado.id);
                return (
                  <tr key={empleado.id}>
                    <td className="px-2 py-1 font-medium sticky left-0 bg-white z-10">{empleado.apodo ?? `${empleado.apellido}, ${empleado.nombre}`}</td>
                    {dias.map(d => {
                      const fechaISO = `${anio}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                      return (
                        <td key={d} className={cn('p-0.5 text-center', esFinde(anio, mes, d) && 'bg-gray-100')}>
                          <CeldaMensual empleadoId={empleado.id} fechaISO={fechaISO} registro={registroPorClave.get(`${empleado.id}-${fechaISO}`) ?? null} esMatias={esMatias} />
                        </td>
                      );
                    })}
                    <td className="px-2 py-1 text-center text-xs">{r?.dias_presente ?? '-'}</td>
                    <td className="px-2 py-1 text-center text-xs">{r?.dias_ausente ?? '-'}</td>
                    <td className="px-2 py-1 text-center text-xs">{r?.dias_tarde ?? '-'}</td>
                    <td className="px-2 py-1 text-center text-xs">{r?.total_horas ?? '-'}</td>
                    <td className="px-2 py-1 text-center">
                      {r ? (r.cobra_presentismo ? <Badge variant="success">✓</Badge> : <Badge variant="destructive" title={r.motivo_sin_presentismo ?? undefined}>✗</Badge>) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-border">
              <tr>
                <td className="px-2 py-1.5 font-semibold sticky left-0 bg-gray-50 z-10">Por día</td>
                {dias.map(d => {
                  const fechaISO = `${anio}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                  const delDia = registros.filter(r => r.fecha.slice(0, 10) === fechaISO);
                  const vinieron = delDia.filter(r => r.estado === 'PRESENTE' || r.estado === 'TARDE' || r.estado === 'MEDIA_JORNADA').length;
                  return <td key={d} className="text-center text-[10px] text-muted-foreground">{vinieron || ''}</td>;
                })}
                <td colSpan={5} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PÁGINA
// ═══════════════════════════════════════════════════════════════════════════

export default function PresentismoPage() {
  const { user, switchEmpresa, isSwitchingEmpresa } = useAuth();
  const esMatias = !!user?.puedeCambiarEmpresa; // admin global — ver Sidebar/App.tsx
  // El nav de Matías es cross-empresa (ver Sidebar.tsx), pero los datos de acá
  // son tenant-scoped a la empresa activa de su sesión — si no tiene DOS57
  // seleccionada, esto se ve vacío. Se lo avisamos con un atajo directo.
  const necesitaCambiarADos57 = esMatias && user?.empresaId !== EMPRESAS.DOS57;

  const [vista, setVista] = useState<'diaria' | 'mensual'>('diaria');
  const [fecha, setFecha] = useState(hoyISO());
  const hoy = new Date();
  const [mes, setMes]   = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-xl font-semibold mb-4">Control de Presentismo</h1>
      {necesitaCambiarADos57 && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span>Presentismo es de DOS57 — tu empresa activa es {user?.empresa?.nombre_corto ?? user?.empresa?.nombre ?? 'otra'}.</span>
          <Button size="sm" variant="outline" disabled={isSwitchingEmpresa} onClick={() => switchEmpresa(EMPRESAS.DOS57)}>
            {isSwitchingEmpresa ? 'Cambiando…' : 'Cambiar a DOS57'}
          </Button>
        </div>
      )}
      {vista === 'diaria' ? (
        <VistaDiaria fecha={fecha} setFecha={setFecha} onVerMensual={() => setVista('mensual')} esMatias={esMatias} />
      ) : (
        <VistaMensual mes={mes} anio={anio} setMes={setMes} setAnio={setAnio} onVerDiaria={() => setVista('diaria')} esMatias={esMatias} />
      )}
    </div>
  );
}
