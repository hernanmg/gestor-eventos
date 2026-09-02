import { useEffect, useRef, useState } from 'react';
import { Plus, Upload, Pencil, Trash2, FileSpreadsheet, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useEmpleados } from '@/hooks/useRRHH';
import {
  useBitacoraViajes, useAcuerdoEmpleado, useCreateBitacoraViaje, useUpdateBitacoraViaje, useDeleteBitacoraViaje,
  useImportarBitacoraViajes, type BitacoraFiltros, type BitacoraPayload, type ResultadoImportarViajes,
} from '@/hooks/useSueldosAdmin';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TipoRecorridoBadge, TIPO_RECORRIDO_LABEL } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { BitacoraViaje, TipoRecorrido } from '@/types';

const inputCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function diaSemanaDesdeFecha(fechaStr: string): string {
  if (!fechaStr) return '';
  const [y, m, d] = fechaStr.split('-').map(Number);
  if (!y || !m || !d) return '';
  return DIAS_SEMANA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

const EMPTY_FORM = {
  empleado_id: '', fecha: '', convocatoria: '', hora_inicio: '', hora_fin: '',
  ejido: '', recorrido: '', tipo_recorrido: 'PROVINCIAL' as TipoRecorrido, cantidad_vueltas: '1', observaciones: '',
};

// ── Dialog: Nuevo / Editar registro ───────────────────────────────────────────

function RegistroDialog({ open, onClose, registro, empleadoIdFiltrado, empleados }: {
  open: boolean; onClose: () => void; registro?: BitacoraViaje | null;
  empleadoIdFiltrado: number | null; empleados: { id: number; nombre: string; apellido: string }[];
}) {
  const isEdit = !!registro;
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const createMut = useCreateBitacoraViaje();
  const updateMut = useUpdateBitacoraViaje();

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (registro) {
      setForm({
        empleado_id:      String(registro.empleado_id),
        fecha:            registro.fecha.slice(0, 10),
        convocatoria:     registro.convocatoria ?? '',
        hora_inicio:      registro.hora_inicio ?? '',
        hora_fin:         registro.hora_fin ?? '',
        ejido:            registro.ejido ?? '',
        recorrido:        registro.recorrido ?? '',
        tipo_recorrido:   registro.tipo_recorrido,
        cantidad_vueltas: String(registro.cantidad_vueltas),
        observaciones:    registro.observaciones ?? '',
      });
    } else {
      setForm({ ...EMPTY_FORM, empleado_id: empleadoIdFiltrado ? String(empleadoIdFiltrado) : '' });
    }
  }, [open, registro, empleadoIdFiltrado]);

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const empleadoIdNum = form.empleado_id ? Number(form.empleado_id) : null;
  const { data: acuerdo } = useAcuerdoEmpleado(empleadoIdNum);

  const valorPorVuelta =
    form.tipo_recorrido === 'PROVINCIAL'    ? acuerdo?.viatico_provincial ?? null :
    form.tipo_recorrido === 'NACIONAL'      ? acuerdo?.viatico_nacional ?? null :
    /* NACIONAL_1000 */                        acuerdo?.viatico_nacional_1000 ?? null;
  const cantidadVueltasNum = parseInt(form.cantidad_vueltas, 10) || 0;
  const viaticoPreview = valorPorVuelta !== null ? valorPorVuelta * cantidadVueltasNum : null;

  const valido = !!form.empleado_id && !!form.fecha && !!form.tipo_recorrido && cantidadVueltasNum > 0;
  const isPending = createMut.isPending || updateMut.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload: BitacoraPayload = {
      empleado_id:      Number(form.empleado_id),
      fecha:            form.fecha,
      convocatoria:     form.convocatoria || null,
      hora_inicio:      form.hora_inicio || null,
      hora_fin:         form.hora_fin || null,
      ejido:            form.ejido || null,
      recorrido:        form.recorrido || null,
      tipo_recorrido:   form.tipo_recorrido,
      cantidad_vueltas: cantidadVueltasNum,
      observaciones:    form.observaciones || null,
    };
    try {
      if (isEdit) await updateMut.mutateAsync({ id: registro!.id, data: payload });
      else        await createMut.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err) ?? 'Error al guardar el registro');
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? 'Editar' : 'Nuevo'} registro de viaje</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          {!empleadoIdFiltrado && (
            <div>
              <label className={labelCls}>Empleado *</label>
              <select value={form.empleado_id} onChange={e => set('empleado_id', e.target.value)} className={inputCls} required>
                <option value="">Seleccionar...</option>
                {empleados.map(e => <option key={e.id} value={e.id}>{e.apellido}, {e.nombre}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha *</label>
              <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Día</label>
              <p className="text-sm py-1.5 text-muted-foreground">{diaSemanaDesdeFecha(form.fecha) || '—'}</p>
            </div>
          </div>
          <div>
            <label className={labelCls}>Convocatoria</label>
            <input value={form.convocatoria} onChange={e => set('convocatoria', e.target.value)} placeholder="Nombre del evento/trabajo" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Hora inicio</label>
              <input type="time" value={form.hora_inicio} onChange={e => set('hora_inicio', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Hora fin</label>
              <input type="time" value={form.hora_fin} onChange={e => set('hora_fin', e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Ejido</label>
              <input value={form.ejido} onChange={e => set('ejido', e.target.value)} placeholder="Córdoba, Buenos Aires..." className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Recorrido</label>
              <input value={form.recorrido} onChange={e => set('recorrido', e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tipo de recorrido *</label>
              <select value={form.tipo_recorrido} onChange={e => set('tipo_recorrido', e.target.value)} className={inputCls}>
                {(Object.entries(TIPO_RECORRIDO_LABEL) as [TipoRecorrido, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Cantidad de vueltas *</label>
              <input type="number" min="1" value={form.cantidad_vueltas} onChange={e => set('cantidad_vueltas', e.target.value)} className={inputCls} required />
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Viático calculado</span>
              <span className="font-semibold">
                {viaticoPreview !== null ? formatCurrency(viaticoPreview) : '—'}
              </span>
            </div>
            {form.empleado_id && valorPorVuelta === null && (
              <p className="text-xs text-destructive mt-1">
                El acuerdo de este empleado no tiene cargado el valor de viático {TIPO_RECORRIDO_LABEL[form.tipo_recorrido].toLowerCase()}.
              </p>
            )}
          </div>

          <div>
            <label className={labelCls}>Observaciones</label>
            <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} rows={2} className={cn(inputCls, 'resize-none')} />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={!valido || isPending}>{isPending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear registro'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Dialog: confirmar eliminación ─────────────────────────────────────────────

function ConfirmarEliminarDialog({ registro, onClose }: { registro: BitacoraViaje | null; onClose: () => void }) {
  const deleteMut = useDeleteBitacoraViaje();
  const [error, setError] = useState<string | null>(null);

  if (!registro) return null;

  const handleConfirm = async () => {
    setError(null);
    try {
      await deleteMut.mutateAsync(registro.id);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err) ?? 'No se pudo eliminar el registro');
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Eliminar registro</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-1">
          <p className="text-sm">¿Eliminar el viaje del {formatDate(registro.fecha)}?</p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="button" variant="destructive" size="sm" disabled={deleteMut.isPending} onClick={handleConfirm}>
              {deleteMut.isPending ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Dialog: Importar desde Excel ──────────────────────────────────────────────

function ResumenAnalisis({ resultado, acuerdo }: {
  resultado: ResultadoImportarViajes;
  acuerdo?: { viatico_provincial: number | null; viatico_nacional: number | null; viatico_nacional_1000: number | null } | null;
}) {
  const { resumen } = resultado;
  const tipos: { key: 'provincial' | 'nacional' | 'nacional_1000'; label: string; valor: number | null }[] = [
    { key: 'provincial',    label: 'Provincial',       valor: acuerdo?.viatico_provincial    ?? null },
    { key: 'nacional',      label: 'Nacional',         valor: acuerdo?.viatico_nacional      ?? null },
    { key: 'nacional_1000', label: 'Nacional +1000km', valor: acuerdo?.viatico_nacional_1000 ?? null },
  ];

  return (
    <div className="rounded-lg border border-border p-3 space-y-1.5 text-sm">
      <p className="font-medium flex items-center gap-1.5"><CheckCircle2 size={14} className="text-green-600" /> Resultado del análisis</p>
      <p className="text-muted-foreground">{resumen.total_vueltas} registro{resumen.total_vueltas !== 1 ? 's' : ''} con recorrido{resultado.sin_recorrido > 0 ? ` (${resultado.sin_recorrido} día(s) sin viaje, no es un error)` : ''}</p>
      <ul className="pl-4 space-y-0.5 text-xs text-muted-foreground">
        {tipos.map(t => {
          const vueltas = resumen[t.key];
          return (
            <li key={t.key}>
              · {t.label}: {vueltas} vuelta{vueltas !== 1 ? 's' : ''}{t.valor !== null && vueltas > 0 ? ` × ${formatCurrency(t.valor)}` : ''}
            </li>
          );
        })}
      </ul>
      <p className="font-semibold pt-1 border-t border-border">Total viático estimado: {formatCurrency(resumen.viatico_estimado)}</p>
      {resultado.errores.length > 0 && (
        <div className="pt-1.5 border-t border-border">
          <p className="text-xs font-medium text-destructive mb-1">{resultado.errores.length} error(es)</p>
          <ul className="text-xs text-destructive space-y-0.5 max-h-32 overflow-y-auto">
            {resultado.errores.map((e, i) => <li key={i}>Fila {e.fila}: {e.motivo}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function ImportarDialog({ open, onClose, empleados, empleadoIdFiltrado }: {
  open: boolean; onClose: () => void; empleados: { id: number; nombre: string; apellido: string }[];
  empleadoIdFiltrado: number | null;
}) {
  const importarMut = useImportarBitacoraViajes();
  const inputRef = useRef<HTMLInputElement>(null);
  const hoy = new Date();
  const [empleadoId, setEmpleadoId] = useState('');
  const [mes, setMes]   = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [file, setFile] = useState<File | null>(null);
  const [analisis, setAnalisis]   = useState<ResultadoImportarViajes | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportarViajes | null>(null);
  const [error, setError] = useState<string | null>(null);

  const empleadoIdNum = empleadoId ? Number(empleadoId) : null;
  const { data: acuerdo } = useAcuerdoEmpleado(empleadoIdNum);

  useEffect(() => {
    if (open) {
      setEmpleadoId(empleadoIdFiltrado ? String(empleadoIdFiltrado) : '');
      setMes(hoy.getMonth() + 1); setAnio(hoy.getFullYear());
      setFile(null); setAnalisis(null); setResultado(null); setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, empleadoIdFiltrado]);

  const handleFile = async (f: File) => {
    if (!empleadoId) { setError('Elegí primero el empleado'); return; }
    if (!f.name.toLowerCase().endsWith('.xlsx')) { setError('Solo se aceptan archivos .xlsx'); return; }
    setFile(f); setError(null); setResultado(null);
    try {
      const data = await importarMut.mutateAsync({ file: f, empleadoId: Number(empleadoId), mes, anio, dryRun: true });
      setAnalisis(data);
    } catch (err) {
      setError(getApiErrorMessage(err) ?? 'Error al procesar el archivo');
    }
  };

  const confirmar = async () => {
    if (!file) return;
    setError(null);
    try {
      const data = await importarMut.mutateAsync({ file, empleadoId: Number(empleadoId), mes, anio, dryRun: false });
      setResultado(data);
      setAnalisis(null);
    } catch (err) {
      setError(getApiErrorMessage(err) ?? 'Error al importar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Importar bitácora desde Excel</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-1">
          {resultado ? (
            <div className="rounded-lg border border-border p-6 text-center space-y-2">
              <CheckCircle2 size={32} className="text-green-600 mx-auto" />
              <p className="text-sm font-medium">{resultado.creados} creado(s), {resultado.actualizados} actualizado(s)</p>
              {resultado.omitidos > 0 && <p className="text-xs text-destructive">{resultado.omitidos} fila(s) con error</p>}
              <Button size="sm" variant="outline" onClick={onClose}>Cerrar</Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className={labelCls}>Empleado *</label>
                  <select value={empleadoId} onChange={e => { setEmpleadoId(e.target.value); setFile(null); setAnalisis(null); }} className={inputCls} disabled={!!empleadoIdFiltrado}>
                    <option value="">Seleccionar...</option>
                    {empleados.map(e => <option key={e.id} value={e.id}>{e.apellido}, {e.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Mes</label>
                  <select value={mes} onChange={e => { setMes(Number(e.target.value)); setFile(null); setAnalisis(null); }} className={inputCls}>
                    {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Año</label>
                  <input type="number" value={anio} onChange={e => { setAnio(Number(e.target.value)); setFile(null); setAnalisis(null); }} className={inputCls} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Se busca automáticamente la hoja de viajes (cuyo nombre contenga "VIAJES") dentro del Excel de sueldos del período — un solo empleado por archivo.
              </p>
              {!analisis && (
                <div
                  onClick={() => empleadoId && inputRef.current?.click()}
                  className={cn(
                    'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors',
                    empleadoId ? 'border-border hover:border-primary/50 hover:bg-gray-50' : 'border-border opacity-50 cursor-not-allowed',
                  )}
                >
                  <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                  {importarMut.isPending ? (
                    <><FileSpreadsheet size={28} className="text-primary animate-pulse" /><p className="text-sm text-muted-foreground">Analizando archivo…</p></>
                  ) : (
                    <><Upload size={28} className="text-muted-foreground" /><p className="text-sm font-medium">Hacé clic para subir un .xlsx</p></>
                  )}
                </div>
              )}
              {error && <p className="flex items-center gap-1.5 text-sm text-destructive"><AlertTriangle size={14} />{error}</p>}
              {analisis && (
                <div className="space-y-3">
                  <ResumenAnalisis resultado={analisis} acuerdo={acuerdo} />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setAnalisis(null); setFile(null); }}>Cancelar</Button>
                    <Button size="sm" onClick={confirmar} disabled={importarMut.isPending || analisis.resumen.total_vueltas === 0}>
                      {importarMut.isPending ? 'Importando…' : 'Confirmar importación'}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Tab ────────────────────────────────────────────────────────────────────────

export default function BitacoraTab({ empleadoIdInicial }: { empleadoIdInicial?: number | null }) {
  const hoy = new Date();
  const [filtros, setFiltros] = useState<BitacoraFiltros>({ mes: hoy.getMonth() + 1, anio: hoy.getFullYear() });
  useEffect(() => { if (empleadoIdInicial != null) setFiltros(p => ({ ...p, empleado_id: empleadoIdInicial })); }, [empleadoIdInicial]);

  const { data: registros = [], isLoading } = useBitacoraViajes(filtros);
  const { data: empleados = [] } = useEmpleados();

  const [dialogOpen, setDialogOpen]   = useState(false);
  const [editando, setEditando]       = useState<BitacoraViaje | null>(null);
  const [eliminando, setEliminando]   = useState<BitacoraViaje | null>(null);
  const [importarOpen, setImportarOpen] = useState(false);

  const totales = registros.reduce((acc, r) => {
    acc.horas += r.horas_trabajadas ?? 0;
    acc.viatico += r.viatico_calculado ?? 0;
    if (r.tipo_recorrido === 'PROVINCIAL')    acc.provincial += r.cantidad_vueltas;
    if (r.tipo_recorrido === 'NACIONAL')      acc.nacional += r.cantidad_vueltas;
    if (r.tipo_recorrido === 'NACIONAL_1000') acc.nacional_1000 += r.cantidad_vueltas;
    return acc;
  }, { horas: 0, viatico: 0, provincial: 0, nacional: 0, nacional_1000: 0 });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 justify-between mb-4">
        <div className="flex flex-wrap gap-2">
          <select value={filtros.empleado_id ?? ''} onChange={e => setFiltros(p => ({ ...p, empleado_id: e.target.value ? Number(e.target.value) : undefined }))} className={inputCls}>
            <option value="">Todos los empleados</option>
            {empleados.map(emp => <option key={emp.id} value={emp.id}>{emp.apellido}, {emp.nombre}</option>)}
          </select>
          <select value={filtros.mes ?? ''} onChange={e => setFiltros(p => ({ ...p, mes: e.target.value ? Number(e.target.value) : undefined }))} className={inputCls}>
            <option value="">Todos los meses</option>
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={filtros.anio ?? ''} onChange={e => setFiltros(p => ({ ...p, anio: e.target.value ? Number(e.target.value) : undefined }))} className={inputCls}>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setImportarOpen(true)}>
            <Upload size={14} className="mr-1.5" /> Importar desde Excel
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)}><Plus size={14} className="mr-1.5" /> Nuevo registro</Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Convocatoria</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Día</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Inicio</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Fin</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Hs</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Ejido</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Recorrido</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Tipo</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Vueltas</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Viático</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Obs.</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {registros.length === 0 ? (
                <tr><td colSpan={13} className="px-3 py-6 text-center text-sm text-muted-foreground">No hay registros de bitácora.</td></tr>
              ) : registros.map(r => (
                <tr key={r.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2.5">{r.convocatoria ?? '-'}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.dia_semana ?? '-'}</td>
                  <td className="px-3 py-2.5">{formatDate(r.fecha)}</td>
                  <td className="px-3 py-2.5 text-xs">{r.hora_inicio ?? '-'}</td>
                  <td className="px-3 py-2.5 text-xs">{r.hora_fin ?? '-'}</td>
                  <td className="px-3 py-2.5 text-right">{r.horas_trabajadas ?? '-'}</td>
                  <td className="px-3 py-2.5">{r.ejido ?? '-'}</td>
                  <td className="px-3 py-2.5 max-w-[160px] truncate" title={r.recorrido ?? undefined}>{r.recorrido ?? '-'}</td>
                  <td className="px-3 py-2.5"><TipoRecorridoBadge tipo={r.tipo_recorrido} /></td>
                  <td className="px-3 py-2.5 text-right">{r.cantidad_vueltas}</td>
                  <td className="px-3 py-2.5 text-right font-medium">{r.viatico_calculado !== null ? formatCurrency(r.viatico_calculado) : '-'}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[140px] truncate" title={r.observaciones ?? undefined}>{r.observaciones ?? '-'}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Editar" onClick={() => setEditando(r)}><Pencil size={14} /></Button>
                      <Button variant="ghost" size="icon" title="Eliminar" onClick={() => setEliminando(r)} className="text-destructive hover:text-destructive"><Trash2 size={14} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {registros.length > 0 && (
              <tfoot className="bg-gray-50 border-t-2 border-border">
                <tr>
                  <td colSpan={5} className="px-3 py-2 text-sm font-semibold">TOTALES</td>
                  <td className="px-3 py-2 text-right font-semibold">{Math.round(totales.horas * 100) / 100}</td>
                  <td colSpan={2} />
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    Prov. {totales.provincial} · Nac. {totales.nacional} · Nac+1000 {totales.nacional_1000}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">{totales.provincial + totales.nacional + totales.nacional_1000}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatCurrency(totales.viatico)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      <RegistroDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        empleadoIdFiltrado={filtros.empleado_id ?? null}
        empleados={empleados}
      />
      <RegistroDialog
        open={!!editando}
        onClose={() => setEditando(null)}
        registro={editando}
        empleadoIdFiltrado={null}
        empleados={empleados}
      />
      <ConfirmarEliminarDialog registro={eliminando} onClose={() => setEliminando(null)} />
      <ImportarDialog open={importarOpen} onClose={() => setImportarOpen(false)} empleados={empleados} empleadoIdFiltrado={filtros.empleado_id ?? null} />
    </div>
  );
}
