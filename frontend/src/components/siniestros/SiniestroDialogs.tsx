import { useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import {
  useSiniestro, useCreateSiniestro, useUpdateSiniestro, useCerrarSiniestro,
  useAddGastoSiniestro, useDeleteGastoSiniestro, useSubirDocumentoSiniestro, documentoSiniestroUrl,
  type SiniestroPayload,
} from '@/hooks/useSiniestros';
import { useEmpleados } from '@/hooks/useRRHH';
import { useEventos } from '@/hooks/useEvento';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { SiniestroEstadoBadge } from '@/components/ui/badge';
import MoneyInput from '@/components/ui/MoneyInput';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { EstadoSiniestro, TipoSiniestro } from '@/types';
import BaseTable from '@/components/ui/BaseTable';

const inputCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

export const TIPO_SINIESTRO_LABEL: Record<TipoSiniestro, string> = {
  ACCIDENTE_TRABAJO:    'Accidente de trabajo',
  ENFERMEDAD_LABORAL:   'Enfermedad laboral',
  ACCIDENTE_IN_ITINERE: 'Accidente in itinere',
  OTRO:                 'Otro',
};

export const ESTADOS_SINIESTRO: EstadoSiniestro[] = ['ABIERTO', 'EN_TRAMITE', 'CERRADO', 'RECHAZADO'];

// ── Nuevo siniestro (alta manual) ────────────────────────────────────────────

export function NuevoSiniestroDialog({ onClose }: { onClose: () => void }) {
  const createMut = useCreateSiniestro();
  const { data: empleados = [] } = useEmpleados();
  const { data: eventos = [] } = useEventos();

  const [form, setForm] = useState<SiniestroPayload>({
    empleado_id: 0, tipo: 'ACCIDENTE_TRABAJO', fecha_ocurrencia: '', descripcion: '',
    lugar: '', evento_id: null, art_nombre: '', art_numero_siniestro: '', fecha_denuncia_art: '',
  });
  const [error, setError] = useState<string | null>(null);

  const empleadoOptions: ComboboxOption[] = empleados.map(e => ({ value: String(e.id), label: `${e.apellido}, ${e.nombre}` }));
  const eventoOptions: ComboboxOption[] = eventos.map(ev => ({ value: String(ev.id), label: ev.nombre }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.empleado_id) { setError('Seleccioná un empleado'); return; }
    if (!form.fecha_ocurrencia) { setError('La fecha de ocurrencia es obligatoria'); return; }
    if (!form.descripcion.trim()) { setError('La descripción es obligatoria'); return; }
    try {
      await createMut.mutateAsync({
        ...form,
        lugar:                form.lugar || null,
        art_nombre:           form.art_nombre || null,
        art_numero_siniestro: form.art_numero_siniestro || null,
        fecha_denuncia_art:   form.fecha_denuncia_art || null,
      });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Nuevo siniestro</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div>
            <label className={labelCls}>Empleado *</label>
            <Combobox options={empleadoOptions} value={form.empleado_id ? String(form.empleado_id) : null}
              onChange={v => setForm(p => ({ ...p, empleado_id: Number(v) }))} placeholder="Buscar empleado…" className="w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tipo *</label>
              <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as TipoSiniestro }))} className={inputCls}>
                {Object.entries(TIPO_SINIESTRO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Fecha de ocurrencia *</label>
              <input type="date" value={form.fecha_ocurrencia} onChange={e => setForm(p => ({ ...p, fecha_ocurrencia: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Descripción *</label>
            <textarea value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} className={cn(inputCls, 'min-h-16')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Lugar</label>
              <input value={form.lugar ?? ''} onChange={e => setForm(p => ({ ...p, lugar: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Evento (opcional)</label>
              <Combobox options={eventoOptions} value={form.evento_id ? String(form.evento_id) : null}
                onChange={v => setForm(p => ({ ...p, evento_id: v ? Number(v) : null }))} placeholder="Sin evento" className="w-full" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>ART</label>
              <input value={form.art_nombre ?? ''} onChange={e => setForm(p => ({ ...p, art_nombre: e.target.value }))} className={inputCls} placeholder="SANCOR..." />
            </div>
            <div>
              <label className={labelCls}>N° siniestro ART</label>
              <input value={form.art_numero_siniestro ?? ''} onChange={e => setForm(p => ({ ...p, art_numero_siniestro: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fecha denuncia ART</label>
              <input type="date" value={form.fecha_denuncia_art ?? ''} onChange={e => setForm(p => ({ ...p, fecha_denuncia_art: e.target.value }))} className={inputCls} />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={createMut.isPending}>{createMut.isPending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Drawer de detalle ──────────────────────────────────────────────────────────

function AgregarGastoForm({ siniestroId, onDone }: { siniestroId: number; onDone: () => void }) {
  const addMut = useAddGastoSiniestro(siniestroId);
  const [fecha, setFecha] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState('');
  const [cubiertoArt, setCubiertoArt] = useState(false);
  const [montoCubierto, setMontoCubierto] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const montoNum = parseFloat(monto) || 0;
    if (!fecha || !descripcion.trim() || montoNum <= 0) { setError('Completá fecha, descripción y monto'); return; }
    const cubierto = cubiertoArt ? (parseFloat(montoCubierto) || 0) : 0;
    try {
      await addMut.mutateAsync({
        fecha, descripcion: descripcion.trim(), monto: montoNum, cubierto_art: cubiertoArt,
        monto_cubierto: cubiertoArt ? cubierto : 0,
        monto_empresa:  montoNum - (cubiertoArt ? cubierto : 0),
      });
      setFecha(''); setDescripcion(''); setMonto(''); setCubiertoArt(false); setMontoCubierto('');
      onDone();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-12 gap-1.5 items-end bg-muted/20 rounded p-2">
      <div className="col-span-2"><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} /></div>
      <div className="col-span-4"><input placeholder="Descripción" value={descripcion} onChange={e => setDescripcion(e.target.value)} className={inputCls} /></div>
      <div className="col-span-2"><MoneyInput value={monto} onChange={setMonto} className={inputCls} placeholder="Monto" /></div>
      <div className="col-span-1 flex items-center justify-center h-full pb-1.5">
        <input type="checkbox" checked={cubiertoArt} onChange={e => setCubiertoArt(e.target.checked)} title="Cubierto por ART" />
      </div>
      <div className="col-span-2">{cubiertoArt && <MoneyInput value={montoCubierto} onChange={setMontoCubierto} className={inputCls} placeholder="Cubierto ART" />}</div>
      <div className="col-span-1"><Button type="submit" size="sm" className="h-7 text-xs w-full" disabled={addMut.isPending}>+</Button></div>
      {error && <p className="col-span-12 text-xs text-destructive">{error}</p>}
    </form>
  );
}

export function SiniestroDrawer({ id, canEdit, onClose }: { id: number; canEdit: boolean; onClose: () => void }) {
  const { data: siniestro } = useSiniestro(id);
  const updateMut  = useUpdateSiniestro(id);
  const cerrarMut  = useCerrarSiniestro();
  const deleteGastoMut = useDeleteGastoSiniestro(id);
  const subirDocMut = useSubirDocumentoSiniestro(id);
  const [docFile, setDocFile] = useState<File | null>(null);

  if (!siniestro) return null;

  const nombreEmpleado = siniestro.empleado
    ? `${siniestro.empleado.apellido}, ${siniestro.empleado.nombre}`
    : (siniestro.empleado_nombre_manual ?? 'Sin empleado asociado');

  const handleSubirDoc = async () => {
    if (!docFile) return;
    await subirDocMut.mutateAsync({ file: docFile });
    setDocFile(null);
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {nombreEmpleado}
            <SiniestroEstadoBadge estado={siniestro.estado} />
          </DialogTitle>
        </DialogHeader>

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Datos del siniestro</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm bg-muted/20 rounded p-3">
            <p><span className="text-muted-foreground">Tipo:</span> {TIPO_SINIESTRO_LABEL[siniestro.tipo]}</p>
            <p><span className="text-muted-foreground">Fecha:</span> {formatDate(siniestro.fecha_ocurrencia)}</p>
            <p className="col-span-2"><span className="text-muted-foreground">Descripción:</span> {siniestro.descripcion}</p>
            <p><span className="text-muted-foreground">Lugar:</span> {siniestro.lugar ?? '—'}</p>
            <p><span className="text-muted-foreground">Evento:</span> {siniestro.evento?.nombre ?? '—'}</p>
            <p><span className="text-muted-foreground">ART:</span> {siniestro.art_nombre ?? '—'}</p>
            <p><span className="text-muted-foreground">N° siniestro ART:</span> {siniestro.art_numero_siniestro ?? '—'}</p>
            <p><span className="text-muted-foreground">Denuncia ART:</span> {siniestro.fecha_denuncia_art ? formatDate(siniestro.fecha_denuncia_art) : '—'}</p>
            <p><span className="text-muted-foreground">Condición laboral:</span> {siniestro.condicion_laboral ?? '—'}</p>
            <p><span className="text-muted-foreground">Diagnóstico:</span> {siniestro.diagnostico ?? '—'}</p>
            <p><span className="text-muted-foreground">Zona afectada:</span> {siniestro.zona_afectada ?? '—'}</p>
            <p><span className="text-muted-foreground">Zona de riesgo:</span> {siniestro.zona_riesgo ?? '—'}</p>
            <p className="col-span-2"><span className="text-muted-foreground">Plan de acción / centro médico:</span> {siniestro.plan_accion ?? '—'}</p>
            <p><span className="text-muted-foreground">Días de baja:</span> {siniestro.dias_baja ?? '—'}</p>
            <p><span className="text-muted-foreground">Alta médica:</span> {siniestro.fecha_alta_medica ? formatDate(siniestro.fecha_alta_medica) : '—'}</p>
          </div>
          {canEdit && siniestro.estado !== 'CERRADO' && (
            <div className="flex items-center gap-2 mt-2">
              <label className="text-xs text-muted-foreground">Estado:</label>
              <select
                value={siniestro.estado}
                onChange={e => updateMut.mutate({ estado: e.target.value as EstadoSiniestro })}
                className={cn(inputCls, 'w-auto')}
              >
                {ESTADOS_SINIESTRO.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <Button size="sm" variant="outline" onClick={() => cerrarMut.mutate(id)} disabled={cerrarMut.isPending}>Cerrar siniestro</Button>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 mt-2">Gastos asociados</p>
          <div className="overflow-x-auto">
            <BaseTable className="w-full text-xs">
              <thead className="bg-muted/30 border-b">
                <tr>
                  <th className="px-2 py-1.5 text-left">Fecha</th>
                  <th className="px-2 py-1.5 text-left">Descripción</th>
                  <th className="px-2 py-1.5 text-right">Monto total</th>
                  <th className="px-2 py-1.5 text-center">Cubierto ART</th>
                  <th className="px-2 py-1.5 text-right">Monto ART</th>
                  <th className="px-2 py-1.5 text-right">A cargo empresa</th>
                  {canEdit && <th className="w-8" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                {(siniestro.gastos ?? []).map(g => (
                  <tr key={g.id}>
                    <td className="px-2 py-1.5">{formatDate(g.fecha)}</td>
                    <td className="px-2 py-1.5">{g.descripcion}</td>
                    <td className="px-2 py-1.5 text-right">{formatCurrency(g.monto)}</td>
                    <td className="px-2 py-1.5 text-center">{g.cubierto_art ? 'Sí' : 'No'}</td>
                    <td className="px-2 py-1.5 text-right">{g.monto_cubierto ? formatCurrency(g.monto_cubierto) : '—'}</td>
                    <td className="px-2 py-1.5 text-right">{g.monto_empresa ? formatCurrency(g.monto_empresa) : '—'}</td>
                    {canEdit && (
                      <td className="px-1 py-1.5 text-center">
                        <button onClick={() => deleteGastoMut.mutate(g.id)} className="text-destructive hover:bg-destructive/10 rounded p-0.5"><Trash2 size={12} /></button>
                      </td>
                    )}
                  </tr>
                ))}
                {(siniestro.gastos ?? []).length === 0 && (
                  <tr><td colSpan={7} className="px-2 py-3 text-center text-muted-foreground">Sin gastos cargados.</td></tr>
                )}
              </tbody>
              <tfoot className="border-t bg-muted/10">
                <tr className="font-semibold">
                  <td colSpan={2} className="px-2 py-1.5">Total</td>
                  <td className="px-2 py-1.5 text-right">{formatCurrency(siniestro.total_gastos)}</td>
                  <td />
                  <td className="px-2 py-1.5 text-right">{formatCurrency(siniestro.total_cubierto_art)}</td>
                  <td className="px-2 py-1.5 text-right">{formatCurrency(siniestro.total_a_cargo_empresa)}</td>
                  {canEdit && <td />}
                </tr>
              </tfoot>
            </BaseTable>
          </div>
          {canEdit && <div className="mt-2"><AgregarGastoForm siniestroId={id} onDone={() => {}} /></div>}
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 mt-2">Documentos</p>
          <div className="space-y-1">
            {(siniestro.documentos ?? []).map(d => (
              <div key={d.id} className="flex items-center justify-between text-sm bg-muted/20 rounded px-2 py-1.5">
                <span>{d.nombre}</span>
                <a href={documentoSiniestroUrl(id, d.id)} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-xs"><Download size={12} /> Descargar</a>
              </div>
            ))}
            {(siniestro.documentos ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sin documentos.</p>}
          </div>
          {canEdit && (
            <div className="flex items-center gap-2 mt-2">
              <input type="file" accept="application/pdf,image/*" onChange={e => setDocFile(e.target.files?.[0] ?? null)}
                className="flex-1 text-xs text-muted-foreground file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-accent file:text-xs" />
              <Button size="sm" variant="outline" onClick={handleSubirDoc} disabled={!docFile || subirDocMut.isPending}>Subir documento</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
