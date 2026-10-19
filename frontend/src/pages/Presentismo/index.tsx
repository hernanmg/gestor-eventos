import { useEffect, useState } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Download, FileSpreadsheet, Lock, Upload, UserCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  usePresentismoDia, usePresentismoLista, useResumenMes, useUpsertRegistroAsistencia,
  useMarcarTodosPresentes, useCerrarMesPresentismo, useAprobarTardanza, useRechazarTardanza,
  useExportarPresentismo, useFrancos, useUpdateSaldoInicialFrancos, useImportarPlanillaPresentismo,
} from '@/hooks/usePresentismo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EMPRESAS } from '@/lib/empresasConstants';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type {
  EstadoAsistencia, RegistroAsistencia, PresentismoHoyItem, SemaforoPresentismo, EmpleadoMiniPresentismo,
  ImportPlanillaPresentismoResultado,
} from '@/types';
import BaseTable from '@/components/ui/BaseTable';
import PageHeader from '@/components/ui/PageHeader';
import TabStrip from '@/components/ui/TabStrip';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const ESTADO_LABEL: Record<EstadoAsistencia, string> = {
  PRESENTE: 'Presente', DEMORA: 'Demora', TARDE: 'Llegada tarde', MEDIA_JORNADA: 'Media jornada', AUSENTE: 'Faltó',
  JUSTIFICADO: 'Justificado / médica', LIBRE: 'Libre / no convocado', VACACIONES: 'Vacaciones', LICENCIA: 'Licencia',
  FRANCO: 'Franco (por domingo)',
};

const ESTADO_INICIAL: Record<EstadoAsistencia, string> = {
  PRESENTE: 'P', DEMORA: 'D', TARDE: 'T', MEDIA_JORNADA: 'M', AUSENTE: 'A', JUSTIFICADO: 'J', LIBRE: 'L', VACACIONES: 'V', LICENCIA: 'Li', FRANCO: 'F',
};

const ESTADO_SELECT_CLASS: Record<EstadoAsistencia, string> = {
  PRESENTE:      'bg-green-100 text-green-800 border-green-300',
  DEMORA:        'bg-yellow-100 text-yellow-800 border-yellow-300',
  TARDE:         'bg-orange-100 text-orange-800 border-orange-300',
  MEDIA_JORNADA: 'bg-amber-100 text-amber-800 border-amber-300',
  AUSENTE:       'bg-red-100 text-red-800 border-red-300',
  JUSTIFICADO:   'bg-blue-100 text-blue-800 border-blue-300',
  LIBRE:         'bg-gray-100 text-gray-700 border-gray-300',
  VACACIONES:    'bg-sky-100 text-sky-800 border-sky-300',
  LICENCIA:      'bg-purple-100 text-purple-800 border-purple-300',
  FRANCO:        'bg-indigo-100 text-indigo-800 border-indigo-300',
};

const ESTADO_BADGE_CLASS: Record<EstadoAsistencia, string> = {
  PRESENTE:      'bg-green-200 text-green-900',
  DEMORA:        'bg-yellow-200 text-yellow-900',
  TARDE:         'bg-orange-200 text-orange-900',
  MEDIA_JORNADA: 'bg-amber-200 text-amber-900',
  AUSENTE:       'bg-red-200 text-red-900',
  JUSTIFICADO:   'bg-blue-200 text-blue-900',
  LIBRE:         'bg-gray-200 text-gray-800',
  VACACIONES:    'bg-sky-200 text-sky-900',
  LICENCIA:      'bg-purple-200 text-purple-900',
  FRANCO:        'bg-indigo-200 text-indigo-900',
};

const ROW_BG_CLASS: Record<string, string> = {
  AUSENTE: 'bg-red-50', TARDE: 'bg-orange-50', DEMORA: 'bg-yellow-50', SIN_CARGAR: 'bg-gray-50',
};

const SEMAFORO_LABEL: Record<SemaforoPresentismo, string> = { EXCELENTE: 'Excelente', SEGUIMIENTO: 'Seguimiento', ATENCION: 'Atención' };
const SEMAFORO_CLASS: Record<SemaforoPresentismo, string> = {
  EXCELENTE:   'bg-green-100 text-green-800',
  SEGUIMIENTO: 'bg-yellow-100 text-yellow-800',
  ATENCION:    'bg-red-100 text-red-800',
};
const SEMAFORO_DOT: Record<SemaforoPresentismo, string> = { EXCELENTE: 'bg-green-500', SEGUIMIENTO: 'bg-yellow-400', ATENCION: 'bg-red-500' };

// Espejo de clasificarLlegada (backend/src/lib/presentismoCalculo.ts): hasta 6
// min es presente, de 7 a 15 demora, desde 16 llegada tarde.
const TOLERANCIA_PRESENTE_MIN = 6;
const LIMITE_DEMORA_MIN       = 15;

function minutos(hhmm: string): number | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function clasificarLlegada(citacion: string | null | undefined, ingreso: string): 'PRESENTE' | 'DEMORA' | 'TARDE' | null {
  if (!citacion || !ingreso) return null;
  const c = minutos(citacion);
  const i = minutos(ingreso);
  if (c === null || i === null) return null;
  const dif = Math.max(0, i - c);
  return dif <= TOLERANCIA_PRESENTE_MIN ? 'PRESENTE' : dif <= LIMITE_DEMORA_MIN ? 'DEMORA' : 'TARDE';
}

const SE_CLASIFICA = new Set<EstadoAsistencia>(['PRESENTE', 'DEMORA', 'TARDE']);

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

function nombreCorto(e: EmpleadoMiniPresentismo): string {
  return e.apodo ?? `${e.apellido}, ${e.nombre}`;
}

interface FormRegistro {
  estado:            EstadoAsistencia;
  hora_convocatoria: string;
  hora_ingreso:      string;
  hora_egreso:       string;
  motivo:            string;
}

function formDesdeRegistro(r: RegistroAsistencia | null): FormRegistro {
  return {
    estado:            r?.estado ?? 'PRESENTE',
    hora_convocatoria: r?.hora_convocatoria ?? '',
    hora_ingreso:      r?.hora_ingreso ?? '',
    hora_egreso:       r?.hora_egreso ?? '',
    motivo:            r?.motivo ?? '',
  };
}

// Al cargar la hora de llegada (o la citación) se reclasifica sola entre
// Presente / Demora / Llegada tarde — Lorena puede cambiarlo a mano después.
function conClasificacion(form: FormRegistro, citacionDefault: string | null | undefined): FormRegistro {
  if (!SE_CLASIFICA.has(form.estado)) return form;
  const estado = clasificarLlegada(form.hora_convocatoria || citacionDefault, form.hora_ingreso);
  return estado ? { ...form, estado } : form;
}

function SemaforoBadge({ semaforo }: { semaforo: SemaforoPresentismo }) {
  return <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap', SEMAFORO_CLASS[semaforo])}>{SEMAFORO_LABEL[semaforo]}</span>;
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
// IMPORTAR PLANILLA MENSUAL
// ═══════════════════════════════════════════════════════════════════════════

function ImportarPlanillaDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const importar = useImportarPlanillaPresentismo();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPlanillaPresentismoResultado | null>(null);
  const [aplicado, setAplicado] = useState<ImportPlanillaPresentismoResultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setFile(null); setPreview(null); setAplicado(null); setError(null); } }, [open]);

  const correr = async (esPreview: boolean) => {
    if (!file) return;
    setError(null);
    try {
      const r = await importar.mutateAsync({ file, preview: esPreview });
      if (esPreview) setPreview(r); else setAplicado(r);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const r = aplicado ?? preview;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader><DialogTitle>Importar planilla de presentismo</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          {!r && (
            <>
              <p className="text-xs text-muted-foreground">
                La planilla mensual con una hoja por persona (MES / NOMBRE arriba y la tabla CONVOCATORIA · FECHA · HORARIO · SI · DEMORA ·
                LLEGADA TARDE · NO CONVOCADO · FALTO · MÉDICA · VACACIONES · FRANCO POR DOMINGO · OBSERVACIÓN). Manda tu marca de cada día;
                si un día no tiene marca pero sí horario, se clasifica contra la citación. Primero vas a ver una vista previa.
              </p>
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={e => { setFile(e.target.files?.[0] ?? null); setError(null); }}
                className="block w-full text-sm file:mr-3 file:rounded file:border file:border-input file:bg-white file:px-3 file:py-1 file:text-sm hover:file:bg-muted/50"
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
                <Button size="sm" onClick={() => correr(true)} disabled={!file || importar.isPending}>
                  {importar.isPending ? 'Leyendo…' : 'Ver vista previa'}
                </Button>
              </div>
            </>
          )}
          {r && (
            <div className="space-y-3">
              <p>
                {aplicado ? 'Importado: ' : 'Vista previa: '}
                <span className="font-medium text-green-700">{r.creados} días nuevos</span> ·{' '}
                <span className="font-medium">{r.actualizados} cambian</span> ·{' '}
                <span className="text-muted-foreground">{r.sin_cambios} sin cambios</span>
              </p>
              <div className="max-h-72 overflow-y-auto border rounded">
                <BaseTable className="w-full text-xs">
                  <thead className="bg-muted/30 border-b">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Hoja</th>
                      <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Nombre en la planilla</th>
                      <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Empleado</th>
                      <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Días</th>
                      <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {r.hojas.map(h => (
                      <tr key={h.hoja} className={cn(!h.empleado && h.dias > 0 && 'bg-amber-50')}>
                        <td className="px-2 py-1 font-mono">{h.hoja}</td>
                        <td className="px-2 py-1">{h.nombre}</td>
                        <td className="px-2 py-1">{h.empleado?.label ?? <span className="text-amber-700">No está en el sistema</span>}</td>
                        <td className="px-2 py-1 text-right">{h.dias}</td>
                        <td className="px-2 py-1 text-muted-foreground">
                          {Object.entries(h.por_estado).map(([e, n]) => `${ESTADO_INICIAL[e as EstadoAsistencia]} ${n}`).join(' · ')}
                          {h.por_horario > 0 && <span className="ml-1 text-amber-700">({h.por_horario} sin marca, por horario)</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </BaseTable>
              </div>
              {r.advertencias.length > 0 && (
                <div className="text-amber-700 bg-amber-50 rounded p-2">
                  <p className="font-medium text-xs mb-1">Avisos:</p>
                  <ul className="list-disc pl-4 text-xs space-y-0.5">{r.advertencias.map((a, i) => <li key={i}>{a}</li>)}</ul>
                </div>
              )}
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex justify-end gap-2">
                {aplicado ? (
                  <Button size="sm" onClick={onClose}>Cerrar</Button>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setPreview(null)}>Elegir otro archivo</Button>
                    <Button size="sm" onClick={() => correr(false)} disabled={importar.isPending || (r.creados + r.actualizados === 0)}>
                      {importar.isPending ? 'Importando…' : `Importar ${r.creados + r.actualizados} días`}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VISTA DIARIA
// ═══════════════════════════════════════════════════════════════════════════

function FilaDiaria({ item, fecha, esMatias }: { item: PresentismoHoyItem; fecha: string; esMatias: boolean }) {
  const upsertMut = useUpsertRegistroAsistencia();
  const [form, setForm] = useState<FormRegistro>(() => formDesdeRegistro(item.registro));
  const citacionDefault = item.empleado.hora_convocatoria_default;

  useEffect(() => { setForm(formDesdeRegistro(item.registro)); }, [item.registro?.id, item.registro?.updated_at]);

  const guardar = (siguiente: FormRegistro) => {
    upsertMut.mutate({
      empleado_id: item.empleado.id, fecha,
      estado: siguiente.estado,
      hora_convocatoria: siguiente.hora_convocatoria || null,
      hora_ingreso: siguiente.hora_ingreso || null,
      hora_egreso:  siguiente.hora_egreso  || null,
      motivo:       siguiente.motivo       || null,
    });
  };

  // Debounce de 500ms para inputs de texto/hora — el select de estado guarda al toque.
  useEffect(() => {
    if (!item.registro && form.estado === 'PRESENTE' && !form.hora_ingreso && !form.hora_egreso && !form.motivo && !form.hora_convocatoria) return;
    const r = item.registro;
    const same = r
      ? r.estado === form.estado && (r.hora_ingreso ?? '') === form.hora_ingreso && (r.hora_egreso ?? '') === form.hora_egreso
        && (r.motivo ?? '') === form.motivo && (r.hora_convocatoria ?? '') === form.hora_convocatoria
      : false;
    if (same) return;
    const t = setTimeout(() => guardar(form), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.hora_ingreso, form.hora_egreso, form.motivo, form.hora_convocatoria]);

  const sinCargar = !item.registro;
  const rowBg = sinCargar ? ROW_BG_CLASS.SIN_CARGAR : ROW_BG_CLASS[form.estado] ?? '';
  const minTarde = item.registro?.minutos_tardanza;

  return (
    <tr className={cn('border-b border-border/60', rowBg)}>
      <td className="px-3 py-2 font-medium" data-label="Empleado">{nombreCorto(item.empleado)}</td>
      <td className="px-3 py-2" data-label="Citación">
        <input type="time" value={form.hora_convocatoria} title={citacionDefault ? `Si queda vacío se usa la habitual (${citacionDefault})` : undefined}
          onChange={e => setForm(p => conClasificacion({ ...p, hora_convocatoria: e.target.value }, citacionDefault))}
          className="border border-input rounded px-1.5 py-1 text-xs w-24" />
        {!form.hora_convocatoria && citacionDefault && <span className="block text-[10px] text-muted-foreground">habitual {citacionDefault}</span>}
      </td>
      <td className="px-3 py-2" data-label="Llegó">
        <input type="time" value={form.hora_ingreso}
          onChange={e => setForm(p => conClasificacion({ ...p, hora_ingreso: e.target.value }, citacionDefault))}
          className="border border-input rounded px-1.5 py-1 text-xs w-24" />
      </td>
      <td className="px-3 py-2" data-label="Estado">
        <select
          value={sinCargar ? '' : form.estado}
          onChange={e => { const next = { ...form, estado: e.target.value as EstadoAsistencia }; setForm(next); guardar(next); }}
          className={cn('rounded border px-2 py-1 text-xs font-medium', sinCargar ? 'bg-white text-muted-foreground border-input' : ESTADO_SELECT_CLASS[form.estado])}
        >
          {sinCargar && <option value="">Sin cargar</option>}
          {Object.entries(ESTADO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {minTarde != null && minTarde > 0 && <span className="block text-[10px] text-muted-foreground">{minTarde} min</span>}
      </td>
      <td className="px-3 py-2" data-label="Salió">
        <input type="time" value={form.hora_egreso} onChange={e => setForm(p => ({ ...p, hora_egreso: e.target.value }))}
          className="border border-input rounded px-1.5 py-1 text-xs w-24" />
      </td>
      <td className="px-3 py-2 text-right text-xs text-muted-foreground" data-label="Hs">{item.registro?.horas_trabajadas ?? '-'}</td>
      <td className="px-3 py-2" data-label="Observación">
        <input value={form.motivo} onChange={e => setForm(p => ({ ...p, motivo: e.target.value }))}
          placeholder="Observación" className="border border-input rounded px-1.5 py-1 text-xs w-full" />
      </td>
      <td className="px-3 py-2" data-label="Tardanza">
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

function VistaDiaria({ fecha, setFecha, esMatias, onImportar }: {
  fecha: string; setFecha: (f: string) => void; esMatias: boolean; onImportar: () => void;
}) {
  const { data, isLoading } = usePresentismoDia(fecha);
  const marcarTodosMut = useMarcarTodosPresentes();

  const items = data?.items ?? [];
  const cuenta = (e: EstadoAsistencia) => items.filter(i => i.registro?.estado === e).length;
  const sinCargar = items.filter(i => !i.registro).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setFecha(sumarDias(fecha, -1))}>←</Button>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="border border-input rounded px-2 py-1.5 text-sm" />
          <Button size="sm" variant="outline" onClick={() => setFecha(hoyISO())}>Hoy</Button>
          <Button size="sm" variant="outline" onClick={() => setFecha(sumarDias(fecha, 1))}>→</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-green-700 font-medium">{cuenta('PRESENTE')} presentes</span>
          <span className="text-yellow-700 font-medium">{cuenta('DEMORA')} demoras</span>
          <span className="text-orange-700 font-medium">{cuenta('TARDE')} tarde</span>
          <span className="text-red-700 font-medium">{cuenta('AUSENTE')} faltas</span>
          <span className="text-muted-foreground font-medium">{sinCargar} sin cargar</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <Button size="sm" disabled={marcarTodosMut.isPending} onClick={() => marcarTodosMut.mutate(fecha)}>
          <UserCheck size={14} className="mr-1.5" /> Marcar todos presentes
        </Button>
        <Button size="sm" variant="outline" onClick={onImportar}>
          <FileSpreadsheet size={14} className="mr-1.5" /> Importar planilla del mes
        </Button>
        <Button size="sm" variant="outline" disabled title="Próximamente — reloj ET-F7">
          <Upload size={14} className="mr-1.5" /> Importar desde reloj
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="overflow-x-auto">
          <BaseTable className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Empleado</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Citación</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Llegó</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Salió</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Hs</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Observación</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Tardanza</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-sm text-muted-foreground">No hay empleados activos en DOS57.</td></tr>
              ) : items.map(item => <FilaDiaria key={item.empleado.id} item={item} fecha={fecha} esMatias={esMatias} />)}
            </tbody>
          </BaseTable>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VISTA MENSUAL
// ═══════════════════════════════════════════════════════════════════════════

function CeldaMensual({ empleado, fechaISO, registro, esMatias }: {
  empleado: EmpleadoMiniPresentismo; fechaISO: string; registro: RegistroAsistencia | null; esMatias: boolean;
}) {
  const [open, setOpen] = useState(false);
  const upsertMut = useUpsertRegistroAsistencia();
  const [form, setForm] = useState<FormRegistro>(() => formDesdeRegistro(registro));

  useEffect(() => { setForm(formDesdeRegistro(registro)); }, [registro?.id, registro?.updated_at, open]);

  const guardar = () => {
    upsertMut.mutate({
      empleado_id: empleado.id, fecha: fechaISO, estado: form.estado,
      hora_convocatoria: form.hora_convocatoria || null,
      hora_ingreso: form.hora_ingreso || null, hora_egreso: form.hora_egreso || null, motivo: form.motivo || null,
    }, { onSuccess: () => setOpen(false) });
  };

  const tardanzaAnillo = registro?.estado === 'TARDE'
    ? registro.tardanza_aprobada === true ? 'ring-2 ring-green-500' : registro.tardanza_aprobada === false ? 'ring-2 ring-red-500' : 'ring-2 ring-orange-400'
    : '';

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          title={registro ? `${ESTADO_LABEL[registro.estado]}${registro.motivo ? ` — ${registro.motivo}` : ''}` : undefined}
          className={cn(
            'w-7 h-7 rounded text-[10px] font-semibold flex items-center justify-center hover:opacity-80 transition-opacity',
            registro ? ESTADO_BADGE_CLASS[registro.estado] : 'bg-gray-50 text-gray-300',
            tardanzaAnillo,
          )}>
          {registro ? ESTADO_INICIAL[registro.estado] : '—'}
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="center" sideOffset={6} className="z-50 w-72 rounded-md border border-border bg-white shadow-lg p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{nombreCorto(empleado)} — {fechaISO}</p>
          <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value as EstadoAsistencia }))}
            className={cn('w-full rounded border px-2 py-1 text-xs font-medium', ESTADO_SELECT_CLASS[form.estado])}>
            {Object.entries(ESTADO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <div className="grid grid-cols-3 gap-1.5 text-[10px] text-muted-foreground">
            <label>Citación
              <input type="time" value={form.hora_convocatoria}
                onChange={e => setForm(p => conClasificacion({ ...p, hora_convocatoria: e.target.value }, empleado.hora_convocatoria_default))}
                className="border border-input rounded px-1 py-1 text-xs w-full text-foreground" />
            </label>
            <label>Llegó
              <input type="time" value={form.hora_ingreso}
                onChange={e => setForm(p => conClasificacion({ ...p, hora_ingreso: e.target.value }, empleado.hora_convocatoria_default))}
                className="border border-input rounded px-1 py-1 text-xs w-full text-foreground" />
            </label>
            <label>Salió
              <input type="time" value={form.hora_egreso} onChange={e => setForm(p => ({ ...p, hora_egreso: e.target.value }))}
                className="border border-input rounded px-1 py-1 text-xs w-full text-foreground" />
            </label>
          </div>
          <input value={form.motivo} onChange={e => setForm(p => ({ ...p, motivo: e.target.value }))} placeholder="Observación" className="border border-input rounded px-1.5 py-1 text-xs w-full" />
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

function VistaMensual({ mes, anio, setMes, setAnio, esMatias }: {
  mes: number; anio: number; setMes: (m: number) => void; setAnio: (a: number) => void; esMatias: boolean;
}) {
  const { data: registros = [], isLoading } = usePresentismoLista({ mes, anio });
  const { data: resumen, isLoading: cargandoResumen } = useResumenMes(mes, anio);
  const cerrarMut = useCerrarMesPresentismo();
  const { exportar, isExporting } = useExportarPresentismo();

  const totalDias = diasEnMes(anio, mes);
  const dias = Array.from({ length: totalDias }, (_, i) => i + 1);

  const registroPorClave = new Map(registros.map(r => [`${r.empleado_id}-${r.fecha.slice(0, 10)}`, r]));
  // Los empleados salen del resumen del mes (endpoint de presentismo) y no de
  // /rrhh/empleados, que es sólo ADMIN — Lorena es OPERADOR.
  const filas = resumen?.items ?? [];
  const semaforos = { EXCELENTE: 0, SEGUIMIENTO: 0, ATENCION: 0 } as Record<SemaforoPresentismo, number>;
  for (const f of filas) semaforos[f.semaforo]++;

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
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => exportar(mes, anio)} disabled={isExporting}>
            <Download size={14} className="mr-1.5" /> {isExporting ? 'Exportando…' : 'Exportar Excel'}
          </Button>
          <Button size="sm" variant="outline" onClick={handleCerrarMes} disabled={cerrarMut.isPending}>
            <Lock size={14} className="mr-1.5" /> {cerrarMut.isPending ? 'Cerrando…' : 'Cerrar mes'}
          </Button>
        </div>
      </div>

      {filas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
          <span className="text-muted-foreground">Semáforo del mes:</span>
          {(['EXCELENTE', 'SEGUIMIENTO', 'ATENCION'] as const).map(s => (
            <span key={s} className={cn('px-2 py-0.5 rounded-full font-medium', SEMAFORO_CLASS[s])}>{SEMAFORO_LABEL[s]} {semaforos[s]}</span>
          ))}
          <span className="text-muted-foreground" title="Referencias de la planilla de Lorena">
            · Seguimiento: 3-4 demoras, 2-3 llegadas tarde o 1 falta · Atención: 5+ demoras, 4+ tarde o 2+ faltas
          </span>
        </div>
      )}

      {isLoading || cargandoResumen ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="overflow-x-auto">
          <BaseTable className="text-sm border-collapse">
            <thead className="bg-gray-50 border-b border-border sticky top-0">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground sticky left-0 bg-gray-50 z-10 min-w-[160px]">Empleado</th>
                {dias.map(d => (
                  <th key={d} className={cn('w-7 py-2 text-center text-[10px] font-medium text-muted-foreground', esFinde(anio, mes, d) && 'bg-gray-200')}>{d}</th>
                ))}
                <th className="px-2 py-2 text-center text-xs font-medium text-muted-foreground" title="Presentes">Pres.</th>
                <th className="px-2 py-2 text-center text-xs font-medium text-muted-foreground" title="Demoras (hasta 15 min)">Dem.</th>
                <th className="px-2 py-2 text-center text-xs font-medium text-muted-foreground" title="Llegadas tarde (más de 15 min)">Tarde</th>
                <th className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">Faltas</th>
                <th className="px-2 py-2 text-center text-xs font-medium text-muted-foreground" title="Saldo de francos al cierre del mes">Francos</th>
                <th className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">Semáforo</th>
                <th className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">Presentismo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filas.map(r => (
                <tr key={r.empleado.id}>
                  <td className="px-2 py-1 font-medium sticky left-0 bg-white z-10">
                    <span className="inline-flex items-center gap-1.5" title={`Semáforo: ${SEMAFORO_LABEL[r.semaforo]}`}>
                      <span className={cn('inline-block w-2 h-2 rounded-full shrink-0', SEMAFORO_DOT[r.semaforo])} />
                      {nombreCorto(r.empleado)}
                    </span>
                  </td>
                  {dias.map(d => {
                    const fechaISO = `${anio}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    return (
                      <td key={d} className={cn('p-0.5 text-center', esFinde(anio, mes, d) && 'bg-gray-100')}>
                        <CeldaMensual empleado={r.empleado} fechaISO={fechaISO} registro={registroPorClave.get(`${r.empleado.id}-${fechaISO}`) ?? null} esMatias={esMatias} />
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-center text-xs">{r.dias_presente}</td>
                  <td className="px-2 py-1 text-center text-xs">{r.dias_demora}</td>
                  <td className="px-2 py-1 text-center text-xs">{r.dias_tarde}</td>
                  <td className="px-2 py-1 text-center text-xs">{r.dias_ausente}</td>
                  <td className="px-2 py-1 text-center text-xs" title={`${r.francos_ganados} ganados y ${r.dias_franco} tomados en el mes`}>{r.saldo_francos ?? '-'}</td>
                  <td className="px-2 py-1 text-center"><SemaforoBadge semaforo={r.semaforo} /></td>
                  <td className="px-2 py-1 text-center">
                    {r.cobra_presentismo ? <Badge variant="success">✓</Badge> : <Badge variant="destructive" title={r.motivo_sin_presentismo ?? undefined}>✗</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-border">
              <tr>
                <td className="px-2 py-1.5 font-semibold sticky left-0 bg-gray-50 z-10">Vinieron</td>
                {dias.map(d => {
                  const fechaISO = `${anio}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                  const delDia = registros.filter(r => r.fecha.slice(0, 10) === fechaISO);
                  const vinieron = delDia.filter(r => ['PRESENTE', 'DEMORA', 'TARDE', 'MEDIA_JORNADA'].includes(r.estado)).length;
                  return <td key={d} className="text-center text-[10px] text-muted-foreground">{vinieron || ''}</td>;
                })}
                <td colSpan={7} />
              </tr>
            </tfoot>
          </BaseTable>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FRANCOS
// ═══════════════════════════════════════════════════════════════════════════

function SaldoInicialInput({ empleadoId, valor }: { empleadoId: number; valor: number }) {
  const mut = useUpdateSaldoInicialFrancos();
  const [v, setV] = useState(String(valor));
  useEffect(() => { setV(String(valor)); }, [valor]);
  const guardar = () => {
    const n = Number(v);
    if (!Number.isInteger(n) || n === valor) { setV(String(valor)); return; }
    mut.mutate({ empleadoId, francos_saldo_inicial: n }, { onError: err => { alert(getApiErrorMessage(err)); setV(String(valor)); } });
  };
  return (
    <input type="number" step={1} value={v} onChange={e => setV(e.target.value)} onBlur={guardar}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className="border border-input rounded px-1.5 py-1 text-xs w-16 text-right" />
  );
}

function VistaFrancos() {
  const { data = [], isLoading } = useFrancos();
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground max-w-3xl">
        Cada domingo trabajado suma un franco; cada día marcado como "Franco (por domingo)" lo descuenta. El saldo inicial es lo
        que cada uno traía de antes de cargar en el sistema (lo podés corregir acá). Este resumen es el que le pasás a Mati para
        saber qué días le corresponden a cada uno.
      </p>
      {isLoading ? <p className="text-sm text-muted-foreground">Cargando...</p> : (
        <div className="overflow-x-auto">
          <BaseTable className="w-full text-sm max-w-3xl">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Empleado</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Saldo inicial</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Domingos trabajados</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Francos tomados</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Le corresponden</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map(f => (
                <tr key={f.empleado.id}>
                  <td className="px-3 py-1.5 font-medium" data-label="Empleado">{nombreCorto(f.empleado)}</td>
                  <td className="px-3 py-1.5 text-right" data-label="Saldo inicial"><SaldoInicialInput empleadoId={f.empleado.id} valor={f.inicial} /></td>
                  <td className="px-3 py-1.5 text-right" data-label="Domingos trabajados">{f.ganados}</td>
                  <td className="px-3 py-1.5 text-right" data-label="Francos tomados">{f.tomados}</td>
                  <td className={cn('px-3 py-1.5 text-right font-semibold', f.saldo > 0 ? 'text-indigo-700' : f.saldo < 0 ? 'text-destructive' : 'text-muted-foreground')} data-label="Le corresponden">
                    {f.saldo}
                  </td>
                </tr>
              ))}
            </tbody>
          </BaseTable>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PÁGINA
// ═══════════════════════════════════════════════════════════════════════════

type VistaPresentismo = 'diaria' | 'mensual' | 'francos';

export default function PresentismoPage() {
  const { user, switchEmpresa, isSwitchingEmpresa } = useAuth();
  const esMatias = !!user?.puedeCambiarEmpresa; // admin global — ver Sidebar/App.tsx
  // El nav de Matías es cross-empresa (ver Sidebar.tsx), pero los datos de acá
  // son tenant-scoped a la empresa activa de su sesión — si no tiene DOS57
  // seleccionada, esto se ve vacío. Se lo avisamos con un atajo directo.
  const necesitaCambiarADos57 = esMatias && user?.empresaId !== EMPRESAS.DOS57;

  const [vista, setVista] = useState<VistaPresentismo>('diaria');
  const [fecha, setFecha] = useState(hoyISO());
  const hoy = new Date();
  const [mes, setMes]   = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [importarOpen, setImportarOpen] = useState(false);

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Control de Presentismo" className="mb-4" />
      {necesitaCambiarADos57 && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span>Presentismo es de DOS57 — tu empresa activa es {user?.empresa?.nombre_corto ?? user?.empresa?.nombre ?? 'otra'}.</span>
          <Button size="sm" variant="outline" disabled={isSwitchingEmpresa} onClick={() => switchEmpresa(EMPRESAS.DOS57)}>
            {isSwitchingEmpresa ? 'Cambiando…' : 'Cambiar a DOS57'}
          </Button>
        </div>
      )}
      <TabStrip<VistaPresentismo>
        value={vista}
        onChange={setVista}
        className="mb-4"
        items={[
          { key: 'diaria',  label: 'Día' },
          { key: 'mensual', label: 'Mes' },
          { key: 'francos', label: 'Francos' },
        ]}
      />
      {vista === 'diaria'  && <VistaDiaria fecha={fecha} setFecha={setFecha} esMatias={esMatias} onImportar={() => setImportarOpen(true)} />}
      {vista === 'mensual' && <VistaMensual mes={mes} anio={anio} setMes={setMes} setAnio={setAnio} esMatias={esMatias} />}
      {vista === 'francos' && <VistaFrancos />}
      <ImportarPlanillaDialog open={importarOpen} onClose={() => setImportarOpen(false)} />
    </div>
  );
}
