import { useEffect, useState } from 'react';
import { Plus, FileText, Pencil, Upload, Trash2, Download, Landmark } from 'lucide-react';
import {
  usePlanesAFIP, usePlanAFIP, useCreatePlanAFIP, useUpdatePlanAFIP, usePagarCuotaAFIP,
  useSubirDocumentoPlanAFIP, useEliminarDocumentoPlanAFIP, documentoPlanAfipUrl,
  type PlanAfipFiltros, type PlanAfipPayload,
} from '@/hooks/useAfipPrestamos';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { PlanAfipEstadoBadge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { getApiErrorMessage } from '@/lib/utils';
import { formatDate, formatCurrency } from '@/lib/formatters';
import type { PlanAFIP, CuotaPlanAFIP } from '@/types';

const inputCls  = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls  = 'block text-xs font-medium text-muted-foreground mb-0.5';
const selectCls = 'border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';

// Espejo de addMesesUTC() en backend/src/controllers/afipPrestamos.controller.ts —
// sólo para el preview de cronograma antes de crear el plan.
function addMesesUTC(fechaISO: string, meses: number): string {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const primerDiaDestino = new Date(Date.UTC(y, m - 1 + meses, 1));
  const diasEnMesDestino = new Date(Date.UTC(primerDiaDestino.getUTCFullYear(), primerDiaDestino.getUTCMonth() + 1, 0)).getUTCDate();
  const diaClamp = Math.min(d, diasEnMesDestino);
  return new Date(Date.UTC(primerDiaDestino.getUTCFullYear(), primerDiaDestino.getUTCMonth(), diaClamp)).toISOString();
}

function CardResumen({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold mt-0.5">{value}</p>
    </div>
  );
}

// ── Dialog: crear / editar plan ───────────────────────────────────────────────

interface PlanFormData {
  descripcion:          string;
  numero_plan:          string;
  titular_nombre:       string;
  titular_cuit:         string;
  fecha_inicio:         string;
  capital_original:     string;
  cantidad_cuotas:      string;
  valor_cuota_aprox:    string;
  interes_financiero:   string;
  interes_resarcitorio: string;
  notas:                string;
  estado:               string;
  empresa_id:           string;
}

const EMPTY_PLAN: PlanFormData = {
  descripcion: '', numero_plan: '', titular_nombre: '', titular_cuit: '', fecha_inicio: '',
  capital_original: '', cantidad_cuotas: '', valor_cuota_aprox: '', interes_financiero: '',
  interes_resarcitorio: '', notas: '', estado: 'ACTIVO', empresa_id: '',
};

function PlanAfipDialog({ open, plan, onClose }: { open: boolean; plan: PlanAFIP | null; onClose: () => void }) {
  const isEdit = !!plan;
  const { user } = useAuth();
  // Sólo al crear: admin global (Matías) o usuarios con puede_ver_macro (ej.
  // Mayra) pueden elegir a qué empresa se carga el crédito/plan sin tener que
  // desloguearse y cambiar de sesión — ver FIX 1 del módulo AFIP/Créditos.
  const puedeElegirEmpresa = !isEdit && !!user && (user.puedeCambiarEmpresa || user.puedeVerMacro);
  const [form, setForm] = useState<PlanFormData>(EMPTY_PLAN);
  const [error, setError] = useState<string | null>(null);
  const createPlan = useCreatePlanAFIP();
  const updatePlan = useUpdatePlanAFIP(plan?.id ?? -1);

  useEffect(() => {
    setForm(plan ? {
      descripcion: plan.descripcion, numero_plan: plan.numero_plan ?? '',
      titular_nombre: plan.titular_nombre ?? '', titular_cuit: plan.titular_cuit ?? '',
      fecha_inicio: plan.fecha_inicio.slice(0, 10), capital_original: String(plan.capital_original),
      cantidad_cuotas: String(plan.cantidad_cuotas), valor_cuota_aprox: plan.valor_cuota_aprox != null ? String(plan.valor_cuota_aprox) : '',
      interes_financiero: plan.interes_financiero != null ? String(plan.interes_financiero) : '',
      interes_resarcitorio: plan.interes_resarcitorio != null ? String(plan.interes_resarcitorio) : '',
      notas: plan.notas ?? '', estado: plan.estado, empresa_id: '',
    } : { ...EMPTY_PLAN, empresa_id: user?.empresaId != null ? String(user.empresaId) : '' });
    setError(null);
  }, [plan, open, user?.empresaId]);

  const cantidad = Number(form.cantidad_cuotas) || 0;
  const preview  = !isEdit && form.fecha_inicio && form.valor_cuota_aprox && cantidad > 0
    ? Array.from({ length: Math.min(cantidad, 60) }, (_, i) => ({
        numero: i + 1,
        fecha:  addMesesUTC(form.fecha_inicio, i),
      }))
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload: PlanAfipPayload = {
      ...(puedeElegirEmpresa && form.empresa_id ? { empresa_id: Number(form.empresa_id) } : {}),
      descripcion:          form.descripcion,
      numero_plan:          form.numero_plan || null,
      fecha_inicio:         form.fecha_inicio,
      capital_original:     Number(form.capital_original),
      cantidad_cuotas:      Number(form.cantidad_cuotas),
      valor_cuota_aprox:    form.valor_cuota_aprox ? Number(form.valor_cuota_aprox) : null,
      interes_financiero:   form.interes_financiero ? Number(form.interes_financiero) : null,
      interes_resarcitorio: form.interes_resarcitorio ? Number(form.interes_resarcitorio) : null,
      titular_nombre:       form.titular_nombre || null,
      titular_cuit:         form.titular_cuit || null,
      notas:                form.notas || null,
    };

    try {
      if (isEdit) await updatePlan.mutateAsync({ ...payload, estado: form.estado });
      else        await createPlan.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const pending = createPlan.isPending || updatePlan.isPending;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{isEdit ? 'Editar plan AFIP' : 'Nuevo plan AFIP'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1 max-h-[75vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            {puedeElegirEmpresa && (
              <div className="col-span-2">
                <label className={labelCls}>Empresa</label>
                <select value={form.empresa_id} onChange={e => setForm(p => ({ ...p, empresa_id: e.target.value }))} className={selectCls + ' w-full'}>
                  {(user?.empresasDisponibles ?? []).map(e => (
                    <option key={e.id} value={e.id}>{e.nombre_corto ?? e.nombre}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="col-span-2">
              <label className={labelCls}>Descripción *</label>
              <input value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} className={inputCls} placeholder="Moratoria 2024, SIRADIG…" required />
            </div>
            <div>
              <label className={labelCls}>N° de plan (AFIP)</label>
              <input value={form.numero_plan} onChange={e => setForm(p => ({ ...p, numero_plan: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fecha de inicio *</label>
              <input type="date" value={form.fecha_inicio} onChange={e => setForm(p => ({ ...p, fecha_inicio: e.target.value }))} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Titular</label>
              <input value={form.titular_nombre} onChange={e => setForm(p => ({ ...p, titular_nombre: e.target.value }))} className={inputCls} placeholder="DOS57 SRL, socio…" />
            </div>
            <div>
              <label className={labelCls}>CUIT titular</label>
              <input value={form.titular_cuit} onChange={e => setForm(p => ({ ...p, titular_cuit: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Capital original *</label>
              <input type="number" step="0.01" value={form.capital_original} onChange={e => setForm(p => ({ ...p, capital_original: e.target.value }))} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Cantidad de cuotas *</label>
              <input type="number" min={1} value={form.cantidad_cuotas} onChange={e => setForm(p => ({ ...p, cantidad_cuotas: e.target.value }))} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Valor cuota aproximado</label>
              <input type="number" step="0.01" value={form.valor_cuota_aprox} onChange={e => setForm(p => ({ ...p, valor_cuota_aprox: e.target.value }))} className={inputCls} placeholder="Genera el cronograma" disabled={isEdit} />
            </div>
            <div>
              <label className={labelCls}>Interés financiero (% anual)</label>
              <input type="number" step="0.01" value={form.interes_financiero} onChange={e => setForm(p => ({ ...p, interes_financiero: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Interés resarcitorio (%)</label>
              <input type="number" step="0.01" value={form.interes_resarcitorio} onChange={e => setForm(p => ({ ...p, interes_resarcitorio: e.target.value }))} className={inputCls} />
            </div>
            {isEdit && (
              <div>
                <label className={labelCls}>Estado</label>
                <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))} className={selectCls + ' w-full'}>
                  <option value="ACTIVO">Activo</option>
                  <option value="FINALIZADO">Finalizado</option>
                  <option value="CADUCADO">Caducado</option>
                  <option value="CANCELADO">Cancelado</option>
                </select>
              </div>
            )}
            <div className="col-span-2">
              <label className={labelCls}>Notas</label>
              <textarea value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} className={inputCls} />
            </div>
          </div>

          {preview.length > 0 && (
            <div className="border rounded-md p-2 bg-muted/20">
              <p className="text-xs font-medium mb-1.5">Preview del cronograma ({preview.length} cuota{preview.length !== 1 ? 's' : ''})</p>
              <div className="max-h-32 overflow-y-auto space-y-0.5">
                {preview.map(c => (
                  <div key={c.numero} className="flex justify-between text-xs text-muted-foreground">
                    <span>Cuota {c.numero}</span>
                    <span>{formatDate(c.fecha)}</span>
                    <span>{formatCurrency(Number(form.valor_cuota_aprox))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Dialog: registrar pago de cuota ───────────────────────────────────────────

function PagarCuotaDialog({ cuota, onClose }: { cuota: CuotaPlanAFIP | null; onClose: () => void }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const pagar = usePagarCuotaAFIP();

  useEffect(() => { setFecha(new Date().toISOString().slice(0, 10)); setError(null); }, [cuota]);

  const handleConfirm = async () => {
    if (!cuota) return;
    try {
      await pagar.mutateAsync({ id: cuota.id, fecha_pago_real: fecha });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open={cuota != null} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Registrar pago — cuota {cuota?.numero_cuota}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Fecha de pago</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="button" size="sm" onClick={handleConfirm} disabled={pagar.isPending}>
              {pagar.isPending ? 'Guardando…' : 'Confirmar pago'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Drawer de detalle ─────────────────────────────────────────────────────────

function DetallePlanAfip({ id, onClose, onEditar }: { id: number | null; onClose: () => void; onEditar: (p: PlanAFIP) => void }) {
  const { data: plan, isLoading } = usePlanAFIP(id);
  const [cuotaAPagar, setCuotaAPagar] = useState<CuotaPlanAFIP | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [nombreDoc, setNombreDoc] = useState('');
  const [descDoc, setDescDoc] = useState('');
  const subirDoc = useSubirDocumentoPlanAFIP(id ?? -1);
  const eliminarDoc = useEliminarDocumentoPlanAFIP(id ?? -1);

  const handleUpload = async () => {
    if (!archivo) return;
    await subirDoc.mutateAsync({ archivo, nombre: nombreDoc || undefined, descripcion: descDoc || undefined });
    setArchivo(null); setNombreDoc(''); setDescDoc('');
  };

  return (
    <>
      <Dialog open={id != null} onOpenChange={o => !o && onClose()}>
        <DialogContent className="sm:max-w-3xl">
          {isLoading || !plan ? (
            <p className="text-sm text-muted-foreground p-4">Cargando…</p>
          ) : (
            <div className="space-y-5">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between gap-2 pr-6">
                  <span>{plan.descripcion}</span>
                  <div className="flex items-center gap-2">
                    <PlanAfipEstadoBadge estado={plan.estado} />
                    <Button size="sm" variant="outline" onClick={() => onEditar(plan)}><Pencil size={13} className="mr-1" />Editar</Button>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <section className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <p><span className="text-muted-foreground">Titular:</span> {plan.titular_nombre ?? '—'} {plan.titular_cuit ? `(${plan.titular_cuit})` : ''}</p>
                <p><span className="text-muted-foreground">N° de plan:</span> {plan.numero_plan ?? '—'}</p>
                <p><span className="text-muted-foreground">Fecha inicio:</span> {formatDate(plan.fecha_inicio)}</p>
                <p><span className="text-muted-foreground">Capital original:</span> {formatCurrency(plan.capital_original)}</p>
                <p><span className="text-muted-foreground">Total pagado:</span> {formatCurrency(plan.total_pagado)}</p>
                <p><span className="text-muted-foreground">Saldo pendiente:</span> {formatCurrency(plan.saldo_pendiente)}</p>
                {plan.notas && <p className="col-span-2"><span className="text-muted-foreground">Notas:</span> {plan.notas}</p>}
              </section>

              <section>
                <h3 className="text-sm font-semibold mb-1.5">Cuotas ({plan.cuotas_pagadas}/{plan.cuotas?.length ?? plan.cantidad_cuotas})</h3>
                {!plan.cuotas || plan.cuotas.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Este plan no tiene un cronograma de cuotas cargado.</p>
                ) : (
                  <div className="border rounded-md overflow-x-auto max-h-72 overflow-y-auto">
                    <table className="w-full text-xs min-w-[560px]">
                      <thead className="border-b bg-muted/30 sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">N°</th>
                          <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Fecha débito</th>
                          <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Capital</th>
                          <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Interés</th>
                          <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Total</th>
                          <th className="px-2 py-1.5 text-center font-medium text-muted-foreground">Pagada</th>
                          <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Fecha pago</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {plan.cuotas.map(c => (
                          <tr key={c.id} className={c.pagada ? '' : new Date(c.fecha_debito) < new Date() ? 'bg-red-50' : ''}>
                            <td className="px-2 py-1.5">{c.numero_cuota}</td>
                            <td className="px-2 py-1.5">{formatDate(c.fecha_debito)}</td>
                            <td className="px-2 py-1.5 text-right">{c.capital != null ? formatCurrency(c.capital) : '—'}</td>
                            <td className="px-2 py-1.5 text-right">{c.interes != null ? formatCurrency(c.interes) : '—'}</td>
                            <td className="px-2 py-1.5 text-right font-medium">{formatCurrency(c.total_cuota)}</td>
                            <td className="px-2 py-1.5 text-center">
                              <input type="checkbox" checked={c.pagada} disabled={c.pagada} onChange={() => setCuotaAPagar(c)} />
                            </td>
                            <td className="px-2 py-1.5">{c.fecha_pago_real ? formatDate(c.fecha_pago_real) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section>
                <h3 className="text-sm font-semibold mb-1.5">Documentos</h3>
                <div className="space-y-1 mb-2">
                  {(plan.documentos ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin documentos adjuntos.</p>
                  ) : plan.documentos!.map(d => (
                    <div key={d.id} className="flex items-center justify-between text-xs border rounded px-2 py-1.5">
                      <span className="flex items-center gap-1.5"><FileText size={13} className="text-muted-foreground" /> {d.nombre} {d.descripcion ? `— ${d.descripcion}` : ''}</span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(documentoPlanAfipUrl(plan.id, d.id), '_blank')} title="Descargar"><Download size={13} /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => eliminarDoc.mutate(d.id)} title="Eliminar"><Trash2 size={13} /></Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input value={nombreDoc} onChange={e => setNombreDoc(e.target.value)} placeholder="Nombre (opcional)" className={inputCls + ' w-40'} />
                  <input value={descDoc} onChange={e => setDescDoc(e.target.value)} placeholder="Descripción (opcional)" className={inputCls + ' w-48'} />
                  <input type="file" accept="application/pdf,image/*" onChange={e => setArchivo(e.target.files?.[0] ?? null)} className="text-xs" />
                  <Button size="sm" variant="outline" disabled={!archivo || subirDoc.isPending} onClick={handleUpload}>
                    <Upload size={13} className="mr-1" /> Subir documento
                  </Button>
                </div>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <PagarCuotaDialog cuota={cuotaAPagar} onClose={() => setCuotaAPagar(null)} />
    </>
  );
}

// ── Tab principal ─────────────────────────────────────────────────────────────

export default function PlanesAfipTab() {
  const { user } = useAuth();
  const mostrarEmpresa = !!user && (user.puedeCambiarEmpresa || user.puedeVerMacro);
  const [filtros, setFiltros] = useState<PlanAfipFiltros>({});
  const { data: planes = [], isLoading } = usePlanesAFIP(filtros);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PlanAFIP | null>(null);
  const [detalleId, setDetalleId] = useState<number | null>(null);

  const activos = planes.filter(p => p.estado === 'ACTIVO');
  const hoy = new Date();
  const en30dias = new Date(hoy.getTime() + 30 * 86_400_000);
  const cuotasEsteMes = activos.flatMap(p => (p.proxima_cuota && new Date(p.proxima_cuota.fecha_debito) <= en30dias) ? [p.proxima_cuota] : []);
  const montoEsteMes = cuotasEsteMes.reduce((s, c) => s + Number(c.total_cuota), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <CardResumen label="Planes activos" value={String(activos.length)} />
        <CardResumen label="Cuotas próx. 30 días" value={String(cuotasEsteMes.length)} />
        <CardResumen label="Monto a pagar (30 días)" value={formatCurrency(montoEsteMes)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <select value={filtros.estado ?? ''} onChange={e => setFiltros(f => ({ ...f, estado: e.target.value || undefined }))} className={selectCls}>
          <option value="">Todos los estados</option>
          <option value="ACTIVO">Activo</option>
          <option value="FINALIZADO">Finalizado</option>
          <option value="CADUCADO">Caducado</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus size={14} className="mr-1.5" /> Nuevo plan AFIP
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : planes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Landmark size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay planes de AFIP cargados.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Descripción</th>
                {mostrarEmpresa && <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Empresa</th>}
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Titular</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Cuotas</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Próxima cuota</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Monto cuota</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Saldo pendiente</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {planes.map(p => (
                <tr key={p.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => setDetalleId(p.id)}>
                  <td className="px-3 py-2.5 font-medium">{p.descripcion}</td>
                  {mostrarEmpresa && (
                    <td className="px-3 py-2.5"><Badge variant="muted">{p.empresa?.nombre_corto ?? p.empresa?.nombre ?? '—'}</Badge></td>
                  )}
                  <td className="px-3 py-2.5 text-muted-foreground">{p.titular_nombre ?? '—'}</td>
                  <td className="px-3 py-2.5">{p.cuotas_pagadas}/{p.cuotas_pagadas + p.cuotas_pendientes}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{p.proxima_cuota ? formatDate(p.proxima_cuota.fecha_debito) : '—'}</td>
                  <td className="px-3 py-2.5 text-right">{p.proxima_cuota ? formatCurrency(p.proxima_cuota.total_cuota) : '—'}</td>
                  <td className="px-3 py-2.5 text-right">{formatCurrency(p.saldo_pendiente)}</td>
                  <td className="px-3 py-2.5"><PlanAfipEstadoBadge estado={p.estado} /></td>
                  <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setDialogOpen(true); }} title="Editar"><Pencil size={14} /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PlanAfipDialog open={dialogOpen} plan={editing} onClose={() => { setDialogOpen(false); setEditing(null); }} />
      <DetallePlanAfip id={detalleId} onClose={() => setDetalleId(null)} onEditar={p => { setEditing(p); setDialogOpen(true); }} />
    </div>
  );
}
