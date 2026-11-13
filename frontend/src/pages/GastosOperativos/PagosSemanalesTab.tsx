import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Download, MessageSquare, Pencil, Plus, Send, Sparkles, Trash2, Undo2, Upload, X } from 'lucide-react';
import {
  useResumenesPagos, useResumenPagos, useSugerenciasPagos, useCreateResumenPagos, useUpdateResumenPagos,
  useEnviarResumenPagos, useAprobarPendientes, useDeleteResumenPagos, useAddLineasPago, useUpdateLineaPago,
  useDeleteLineaPago, useRevisarLineaPago, usePreviewImportPagos, useImportarPagos,
} from '@/hooks/useResumenPagos';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MoneyInput from '@/components/ui/MoneyInput';
import BaseTable from '@/components/ui/BaseTable';
import { formatCurrency, formatDate, formatFechaLocal } from '@/lib/formatters';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type {
  EstadoLineaPago, EstadoResumenPagos, LineaResumenPago, PreviewResumenPagos, ResumenPagoSemanalDetalle,
  SeccionLineaPago, TipoLineaPago,
} from '@/types';

// Resumen semanal de pagos — reemplaza la planilla "PAGOS+CAJAS (SOLICITUD
// MATIAS)" de Andrea. Ella arma la semana y la envía; Matías revisa cada línea
// (tilde, o un comentario con el cambio que pide). Si Andrea corrige una línea
// ya revisada, vuelve a quedar pendiente para que la vuelva a mirar.

const inputCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';
const th = 'px-3 py-2 text-left text-xs font-medium text-muted-foreground';
const td = 'px-3 py-2.5 text-sm align-top';

const TIPO_LABEL: Record<TipoLineaPago, string> = {
  JORNALEROS:      'Jornaleros',
  ADELANTO:        'Adelanto',
  VIATICO:         'Viático',
  CAJA_CHICA:      'Caja chica',
  REPOSICION_CAJA: 'Reposición de caja',
  PROVEEDOR:       'Proveedor',
  OTRO:            'Otro',
};

const ESTADO_RESUMEN: Record<EstadoResumenPagos, { label: string; variant: BadgeProps['variant'] }> = {
  BORRADOR:  { label: 'Borrador',          variant: 'muted' },
  ENVIADO:   { label: 'Para revisar',      variant: 'warning' },
  REVISADO:  { label: 'Revisado',          variant: 'success' },
  HISTORICO: { label: 'De la planilla',    variant: 'info' },
};

const ESTADO_LINEA: Record<EstadoLineaPago, { label: string; variant: BadgeProps['variant'] }> = {
  PENDIENTE: { label: 'Pendiente',      variant: 'muted' },
  APROBADA:  { label: 'Aprobada',       variant: 'success' },
  OBSERVADA: { label: 'Pide un cambio', variant: 'orange' },
  RECHAZADA: { label: 'No se paga',     variant: 'destructive' },
};

const isoDia = (d: Date) => d.toISOString().slice(0, 10);

// Lunes que viene (o hoy, si es lunes) → domingo, como las semanas de la planilla
function proximaSemana(): { desde: string; hasta: string } {
  const hoy = new Date();
  const base = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
  const dow = base.getUTCDay(); // 0 domingo
  const delta = dow === 1 ? 0 : (8 - dow) % 7;
  const lunes = new Date(base.getTime() + delta * 86_400_000);
  const domingo = new Date(lunes.getTime() + 6 * 86_400_000);
  return { desde: isoDia(lunes), hasta: isoDia(domingo) };
}

function rangoSemana(desde: string, hasta: string) {
  return `${formatDate(desde)} al ${formatDate(hasta)}`;
}

// ── Nuevo resumen ─────────────────────────────────────────────────────────────

function NuevoResumenDialog({ onClose, onCreado }: { onClose: () => void; onCreado: (id: number) => void }) {
  const createMut = useCreateResumenPagos();
  const sem = proximaSemana();
  const [desde, setDesde] = useState(sem.desde);
  const [hasta, setHasta] = useState(sem.hasta);
  const [titulo, setTitulo] = useState('');
  const [copiar, setCopiar] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const r = await createMut.mutateAsync({ semana_desde: desde, semana_hasta: hasta, titulo: titulo || null, copiar_ultima: copiar });
      onCreado(r.id);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuevo resumen semanal de pagos</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Desde *</label>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Hasta *</label>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className={inputCls} required />
            </div>
          </div>
          <div>
            <label className={labelCls}>Título (opcional)</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} className={inputCls} placeholder="Ej. NOVIEMBRE (Sem. 16 al 22)" />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5" checked={copiar} onChange={e => setCopiar(e.target.checked)} />
            <span>Copiar las líneas de la semana anterior (con el importe en cero), porque los grupos se repiten</span>
          </label>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={createMut.isPending}>{createMut.isPending ? 'Creando…' : 'Crear'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Importar planilla (vista previa → importar) ───────────────────────────────

function ImportarPlanillaDialog({ onClose }: { onClose: () => void }) {
  const previewMut = usePreviewImportPagos();
  const importMut = useImportarPagos();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResumenPagos | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verPreview = async (f: File) => {
    setError(null); setPreview(null);
    try { setPreview(await previewMut.mutateAsync(f)); } catch (err) { setError(getApiErrorMessage(err)); }
  };

  const importar = async () => {
    if (!file) return;
    setError(null);
    try { await importMut.mutateAsync(file); } catch (err) { setError(getApiErrorMessage(err)); }
  };

  const resultado = importMut.data;
  const aImportar = preview?.bloques.filter(b => b.existe !== 'EN_USO').length ?? 0;

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Importar la planilla de pagos semanales</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-1">
          <p className="text-sm text-muted-foreground">
            La planilla "PAGOS+CAJAS (SOLICITUD MATIAS)", con una hoja por mes. Cada semana entra como resumen ya revisado
            (se aprobó fuera del sistema). Reimportarla no duplica: actualiza las semanas que vinieron de la planilla y no toca las que ya se trabajan acá.
          </p>
          <input type="file" accept=".xlsx,.xls" className="text-sm"
            onChange={e => { const f = e.target.files?.[0] ?? null; setFile(f); importMut.reset(); if (f) verPreview(f); }} />
          {previewMut.isPending && <p className="text-sm text-muted-foreground">Leyendo la planilla…</p>}

          {preview && !resultado && (
            <>
              <div className="max-h-80 overflow-y-auto border rounded">
                <BaseTable className="w-full text-sm card-table-scroll">
                  <thead><tr>
                    <th className={th}>Semana</th><th className={th}>Líneas</th><th className={cn(th, 'text-right')}>Total caja</th><th className={th}>Estado</th>
                  </tr></thead>
                  <tbody>
                    {preview.bloques.map(b => (
                      <tr key={b.import_key}>
                        <td className={td}>
                          <div className="font-medium">{rangoSemana(b.semana_desde, b.semana_hasta)}</div>
                          <div className="text-xs text-muted-foreground">{b.titulo} · hoja {b.hoja}</div>
                          {b.advertencias.map(a => <div key={a} className="text-xs text-orange-700">{a}</div>)}
                        </td>
                        <td className={td}>
                          {b.lineas.filter(l => l.seccion === 'CAJA_SEMANAL').length}
                          {b.lineas.some(l => l.seccion === 'COBERTURA') && <span className="text-xs text-muted-foreground"> + {b.lineas.filter(l => l.seccion === 'COBERTURA').length} de cobertura</span>}
                        </td>
                        <td className={cn(td, 'text-right tabular-nums')}>{formatCurrency(b.total_caja)}</td>
                        <td className={td}>
                          {b.existe === 'NUEVO' && <Badge variant="success">Nueva</Badge>}
                          {b.existe === 'REIMPORTA' && <Badge variant="info">Se actualiza</Badge>}
                          {b.existe === 'EN_USO' && <Badge variant="muted">Ya en uso, no se toca</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </BaseTable>
              </div>
              {preview.advertencias.length > 0 && (
                <ul className="text-xs text-orange-700 list-disc pl-4 space-y-0.5">
                  {preview.advertencias.map(a => <li key={a}>{a}</li>)}
                </ul>
              )}
            </>
          )}

          {resultado && (
            <div className="text-sm bg-green-50 border border-green-200 rounded p-3 space-y-1">
              <p>Semanas nuevas: <strong>{resultado.creados}</strong> · Actualizadas: <strong>{resultado.actualizados}</strong> · Sin tocar: <strong>{resultado.omitidos}</strong></p>
              <p>Líneas importadas: <strong>{resultado.lineas}</strong></p>
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>{resultado ? 'Cerrar' : 'Cancelar'}</Button>
            {!resultado && (
              <Button size="sm" onClick={importar} disabled={!preview || aImportar === 0 || importMut.isPending}>
                {importMut.isPending ? 'Importando…' : `Importar ${aImportar} semana(s)`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Línea: alta / edición ─────────────────────────────────────────────────────

function LineaDialog({ resumenId, seccion, linea, onClose }: {
  resumenId: number; seccion: SeccionLineaPago; linea: LineaResumenPago | null; onClose: () => void;
}) {
  const addMut = useAddLineasPago();
  const updMut = useUpdateLineaPago();
  const [tipo, setTipo] = useState<TipoLineaPago>(linea?.tipo ?? 'OTRO');
  const [detalle, setDetalle] = useState(linea?.detalle ?? '');
  const [importe, setImporte] = useState(linea ? String(linea.importe) : '');
  const [observacion, setObservacion] = useState(linea?.observacion ?? '');
  const [error, setError] = useState<string | null>(null);
  const pending = addMut.isPending || updMut.isPending;
  const revisada = linea && linea.estado !== 'PENDIENTE';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!detalle.trim()) { setError('El detalle es obligatorio'); return; }
    const payload = { tipo, detalle: detalle.trim(), importe: Number(importe) || 0, observacion: observacion.trim() || null };
    try {
      if (linea) await updMut.mutateAsync({ id: linea.id, ...payload });
      else await addMut.mutateAsync({ resumenId, lineas: [{ ...payload, seccion }] });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{linea ? 'Editar línea' : seccion === 'COBERTURA' ? 'Agregar cómo se cubre' : 'Agregar línea'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          {linea?.comentario_revision && (
            <div className="text-sm bg-orange-50 border border-orange-200 rounded p-2">
              <span className="font-medium">Pedido de revisión:</span> {linea.comentario_revision}
              {linea.importe_aprobado != null && <> · importe sugerido {formatCurrency(linea.importe_aprobado)}</>}
            </div>
          )}
          {seccion === 'CAJA_SEMANAL' && (
            <div>
              <label className={labelCls}>Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value as TipoLineaPago)} className={inputCls}>
                {(Object.keys(TIPO_LABEL) as TipoLineaPago[]).map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className={labelCls}>Detalle *</label>
            <input value={detalle} onChange={e => setDetalle(e.target.value)} className={inputCls}
              placeholder={seccion === 'COBERTURA' ? 'Ej. Entrega caja Matías, Transferencia Mayra' : 'Ej. EQUIPO FOFI - 5 PAX (Sem. 25 al 01/07)'} />
          </div>
          <div>
            <label className={labelCls}>Importe</label>
            <MoneyInput value={importe} onChange={setImporte} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Observación</label>
            <input value={observacion} onChange={e => setObservacion(e.target.value)} className={inputCls} placeholder="Ej. nombres, evento, saldo actual" />
          </div>
          {revisada && <p className="text-xs text-muted-foreground">Si cambiás el detalle o el importe, la línea vuelve a quedar pendiente de revisión.</p>}
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

// ── Revisión de una línea (comentario / cambio / rechazo) ─────────────────────

function RevisarDialog({ linea, onClose }: { linea: LineaResumenPago; onClose: () => void }) {
  const revMut = useRevisarLineaPago();
  const [estado, setEstado] = useState<Exclude<EstadoLineaPago, 'PENDIENTE'>>(linea.estado === 'PENDIENTE' ? 'OBSERVADA' : linea.estado);
  const [comentario, setComentario] = useState(linea.comentario_revision ?? '');
  const [importe, setImporte] = useState(linea.importe_aprobado != null ? String(linea.importe_aprobado) : '');
  const [error, setError] = useState<string | null>(null);

  const opciones: { value: typeof estado; label: string; ayuda: string }[] = [
    { value: 'OBSERVADA', label: 'Pedir un cambio', ayuda: 'Vuelve a quien armó el resumen para que la corrija.' },
    { value: 'APROBADA',  label: 'Aprobar con cambio', ayuda: 'Queda aprobada por el importe que pongas.' },
    { value: 'RECHAZADA', label: 'No se paga', ayuda: 'Queda afuera del total aprobado.' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await revMut.mutateAsync({
        id: linea.id, estado, comentario: comentario.trim() || null,
        importe_aprobado: estado === 'RECHAZADA' || importe === '' ? null : Number(importe),
      });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Revisar línea</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div className="text-sm">
            <div className="font-medium">{linea.detalle}</div>
            <div className="text-muted-foreground">{formatCurrency(linea.importe)}{linea.observacion ? ` · ${linea.observacion}` : ''}</div>
          </div>
          <div className="space-y-1.5">
            {opciones.map(o => (
              <label key={o.value} className="flex items-start gap-2 text-sm cursor-pointer">
                <input type="radio" className="mt-1" checked={estado === o.value} onChange={() => setEstado(o.value)} />
                <span><span className="font-medium">{o.label}</span> <span className="text-muted-foreground">— {o.ayuda}</span></span>
              </label>
            ))}
          </div>
          {estado !== 'RECHAZADA' && (
            <div>
              <label className={labelCls}>Importe {estado === 'APROBADA' ? 'aprobado' : 'que debería ser'} (opcional)</label>
              <MoneyInput value={importe} onChange={setImporte} className={inputCls} placeholder={linea.importe.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
            </div>
          )}
          <div>
            <label className={labelCls}>Comentario {estado === 'APROBADA' ? '(opcional)' : '*'}</label>
            <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={3} className={inputCls}
              placeholder="Ej. sacar el premio de Leonel, sumar a Mauro" />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={revMut.isPending}>{revMut.isPending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Traer del sistema ─────────────────────────────────────────────────────────

function SugerenciasDialog({ resumenId, onClose }: { resumenId: number; onClose: () => void }) {
  const { data: sugerencias = [], isLoading } = useSugerenciasPagos(resumenId, true);
  const addMut = useAddLineasPago();
  const [elegidas, setElegidas] = useState<Set<string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seleccion = elegidas ?? new Set(sugerencias.map(s => s.origen_ref));

  const toggle = (ref: string) => {
    const s = new Set(seleccion);
    if (s.has(ref)) s.delete(ref); else s.add(ref);
    setElegidas(s);
  };

  const agregar = async () => {
    setError(null);
    const lineas = sugerencias.filter(s => seleccion.has(s.origen_ref)).map(s => ({
      seccion: 'CAJA_SEMANAL' as const, tipo: s.tipo, detalle: s.detalle, importe: s.importe, observacion: s.observacion, origen_ref: s.origen_ref,
    }));
    if (!lineas.length) return;
    try { await addMut.mutateAsync({ resumenId, lineas }); onClose(); } catch (err) { setError(getApiErrorMessage(err)); }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Traer lo que ya está cargado</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-1">
          <p className="text-sm text-muted-foreground">
            Liquidaciones de jornaleros por grupo, adelantos, viáticos de extranjeros y gastos de cada caja, desde la semana anterior hasta el fin de esta.
            Lo que ya entró en otro resumen no se vuelve a sugerir. Después podés corregir cada línea.
          </p>
          {isLoading ? <p className="text-sm text-muted-foreground">Buscando…</p> : sugerencias.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay nada nuevo cargado para estas fechas.</p>
          ) : (
            <ul className="divide-y border rounded max-h-96 overflow-y-auto">
              {sugerencias.map(s => (
                <li key={s.origen_ref} className="flex items-start gap-3 p-2.5">
                  <input type="checkbox" className="mt-1" checked={seleccion.has(s.origen_ref)} onChange={() => toggle(s.origen_ref)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <span className="text-sm font-medium">{s.detalle}</span>
                      <span className="text-sm tabular-nums font-medium">{formatCurrency(s.importe)}</span>
                    </div>
                    {s.observacion && <div className="text-xs text-muted-foreground truncate">{s.observacion}</div>}
                    <div className="text-xs text-muted-foreground">{TIPO_LABEL[s.tipo]} · {s.fuente}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={agregar} disabled={seleccion.size === 0 || addMut.isPending || sugerencias.length === 0}>
              {addMut.isPending ? 'Agregando…' : `Agregar ${sugerencias.filter(s => seleccion.has(s.origen_ref)).length}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Exportar a Excel (CSV) para mandar por WhatsApp si hace falta ─────────────

function exportarCsv(r: ResumenPagoSemanalDetalle) {
  const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const num = (n: number | null) => (n == null ? '' : n.toFixed(2).replace('.', ','));
  const filas = [
    ['RESUMEN DE PAGOS SEMANAL', r.titulo ?? rangoSemana(r.semana_desde, r.semana_hasta)],
    ['DETALLE', 'IMPORTE', 'OBSERVACION', 'REVISION', 'IMPORTE APROBADO', 'COMENTARIO'],
    ...r.lineas.filter(l => l.seccion === 'CAJA_SEMANAL').map(l => [
      l.detalle, num(l.importe), l.observacion, ESTADO_LINEA[l.estado].label,
      l.estado === 'APROBADA' ? num(l.importe_aprobado ?? l.importe) : '', l.comentario_revision,
    ]),
    ['TOTAL CAJA SEMANAL', num(r.totales.total_pedido)],
    ['TOTAL APROBADO', num(r.totales.total_aprobado)],
    ...r.lineas.filter(l => l.seccion === 'COBERTURA').map(l => [l.detalle, num(l.importe), l.observacion]),
  ];
  const csv = '﻿' + filas.map(f => f.map(esc).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `pagos_semana_${r.semana_desde.slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Detalle de un resumen ─────────────────────────────────────────────────────

function DetalleResumen({ id, onBack }: { id: number; onBack: () => void }) {
  const { user } = useAuth();
  const canEdit = user?.rol === 'ADMIN' || user?.rol === 'OPERADOR';

  const { data: r, isLoading, error } = useResumenPagos(id);
  const canRevisar = !!r?.puede_revisar;
  const enviarMut = useEnviarResumenPagos();
  const aprobarTodoMut = useAprobarPendientes();
  const deleteResumenMut = useDeleteResumenPagos();
  const deleteLineaMut = useDeleteLineaPago();
  const revisarMut = useRevisarLineaPago();
  const updResumenMut = useUpdateResumenPagos();

  const [lineaDialog, setLineaDialog] = useState<{ seccion: SeccionLineaPago; linea: LineaResumenPago | null } | null>(null);
  const [revisando, setRevisando] = useState<LineaResumenPago | null>(null);
  const [sugerir, setSugerir] = useState(false);
  const [editNotas, setEditNotas] = useState<string | null>(null);
  const [accionError, setAccionError] = useState<string | null>(null);

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (error || !r) return <p className="text-sm text-destructive">No se encontró el resumen. <button className="underline" onClick={onBack}>Volver</button></p>;

  const historico = r.estado === 'HISTORICO';
  const editable = canEdit && !historico;
  const enRevision = r.estado === 'ENVIADO' || r.estado === 'REVISADO';
  const puedeRevisar = canRevisar && enRevision;
  const caja = r.lineas.filter(l => l.seccion === 'CAJA_SEMANAL');
  const cobertura = r.lineas.filter(l => l.seccion === 'COBERTURA');
  const t = r.totales;

  const correr = async (p: Promise<unknown>) => {
    setAccionError(null);
    try { await p; } catch (err) { setAccionError(getApiErrorMessage(err)); }
  };

  const tildar = (l: LineaResumenPago) =>
    correr(revisarMut.mutateAsync({ id: l.id, estado: l.estado === 'APROBADA' ? 'PENDIENTE' : 'APROBADA' }));

  const borrarLinea = (l: LineaResumenPago) => {
    if (!window.confirm(`¿Sacar "${l.detalle}" del resumen?`)) return;
    correr(deleteLineaMut.mutateAsync(l.id));
  };

  const borrarResumen = async () => {
    if (!window.confirm('¿Eliminar este resumen?')) return;
    setAccionError(null);
    try { await deleteResumenMut.mutateAsync(r.id); onBack(); } catch (err) { setAccionError(getApiErrorMessage(err)); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-1">
            <ArrowLeft size={12} /> Todas las semanas
          </button>
          <h2 className="text-lg font-semibold">Semana del {rangoSemana(r.semana_desde, r.semana_hasta)}</h2>
          {r.titulo && <p className="text-sm text-muted-foreground">{r.titulo}</p>}
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
            <Badge variant={ESTADO_RESUMEN[r.estado].variant}>{ESTADO_RESUMEN[r.estado].label}</Badge>
            {r.creado_por_nombre && <span>Armó: {r.creado_por_nombre}</span>}
            {r.enviado_at && <span>· Enviado el {formatFechaLocal(r.enviado_at)}</span>}
            {r.revisado_at && <span>· Revisado el {formatFechaLocal(r.revisado_at)}{r.revisado_por_nombre ? ` por ${r.revisado_por_nombre}` : ''}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => exportarCsv(r)}><Download size={13} className="mr-1.5" /> Excel</Button>
          {editable && <Button variant="outline" size="sm" onClick={() => setSugerir(true)}><Sparkles size={13} className="mr-1.5" /> Traer del sistema</Button>}
          {editable && <Button variant="outline" size="sm" onClick={() => setLineaDialog({ seccion: 'CAJA_SEMANAL', linea: null })}><Plus size={13} className="mr-1.5" /> Agregar línea</Button>}
          {editable && r.estado === 'BORRADOR' && (
            <Button size="sm" onClick={() => correr(enviarMut.mutateAsync(r.id))} disabled={enviarMut.isPending || caja.length === 0}>
              <Send size={13} className="mr-1.5" /> Enviar a revisar
            </Button>
          )}
          {puedeRevisar && t.pendientes > 0 && (
            <Button size="sm" onClick={() => { if (window.confirm(`¿Aprobar las ${t.pendientes} líneas pendientes?`)) correr(aprobarTodoMut.mutateAsync(r.id)); }} disabled={aprobarTodoMut.isPending}>
              <Check size={13} className="mr-1.5" /> Aprobar las {t.pendientes} pendientes
            </Button>
          )}
          {canEdit && (r.estado === 'BORRADOR' || historico) && (
            <Button variant="outline" size="sm" onClick={borrarResumen} className="text-destructive"><Trash2 size={13} /></Button>
          )}
        </div>
      </div>

      {r.estado === 'BORRADOR' && (
        <p className="text-sm bg-muted/40 rounded p-2.5">Todavía no se envió. Cuando esté completo, tocá <strong>Enviar a revisar</strong> y le llega el aviso a Matías.</p>
      )}
      {r.estado === 'ENVIADO' && (
        <p className="text-sm bg-yellow-50 border border-yellow-200 rounded p-2.5">
          {canRevisar
            ? <>Revisá cada línea: con el <strong>tilde</strong> la aprobás; con el <strong>globito</strong> pedís un cambio o la sacás.</>
            : <>Esperando la revisión: {t.aprobadas} aprobada(s), {t.pendientes} pendiente(s){t.observadas ? `, ${t.observadas} con cambios pedidos` : ''}.</>}
        </p>
      )}
      {historico && <p className="text-sm bg-blue-50 border border-blue-200 rounded p-2.5">Semana importada de la planilla. Se aprobó fuera del sistema, así que no tiene revisión por línea.</p>}
      {accionError && <p className="text-sm text-destructive">{accionError}</p>}

      <div className="overflow-x-auto">
        <BaseTable className="w-full text-sm">
          <thead>
            <tr>
              <th className={th}>Detalle</th>
              <th className={th}>Observación</th>
              <th className={cn(th, 'text-right')}>Importe</th>
              {!historico && <th className={th}>Revisión</th>}
              <th className={th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {caja.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">Sin líneas. Agregalas a mano o traelas del sistema.</td></tr>
            ) : caja.map(l => (
              <tr key={l.id} className={cn(l.estado === 'RECHAZADA' && 'opacity-60')}>
                <td className={td}>
                  <div className={cn('font-medium', l.estado === 'RECHAZADA' && 'line-through')}>{l.detalle}</div>
                  <div className="text-xs text-muted-foreground">{TIPO_LABEL[l.tipo]}</div>
                </td>
                <td className={cn(td, 'text-muted-foreground max-w-xs')}>{l.observacion ?? '—'}</td>
                <td className={cn(td, 'text-right tabular-nums font-medium whitespace-nowrap')}>
                  {l.importe_aprobado != null
                    ? <><div className="line-through text-muted-foreground font-normal">{formatCurrency(l.importe)}</div><div>{formatCurrency(l.importe_aprobado)}</div></>
                    : formatCurrency(l.importe)}
                </td>
                {!historico && (
                  <td className={td}>
                    <Badge variant={ESTADO_LINEA[l.estado].variant}>{ESTADO_LINEA[l.estado].label}</Badge>
                    {l.comentario_revision && (
                      <div className="text-xs mt-1 italic">"{l.comentario_revision}"{l.revisado_por_nombre ? ` — ${l.revisado_por_nombre}` : ''}</div>
                    )}
                  </td>
                )}
                <td className={cn(td, 'whitespace-nowrap')}>
                  <div className="flex gap-1">
                    {puedeRevisar && (
                      <>
                        <Button size="sm" variant={l.estado === 'APROBADA' ? 'default' : 'outline'} className="h-7 w-7 p-0"
                          title={l.estado === 'APROBADA' ? 'Deshacer aprobación' : 'Aprobar'} onClick={() => tildar(l)} disabled={revisarMut.isPending}>
                          {l.estado === 'APROBADA' ? <Undo2 size={13} /> : <Check size={13} />}
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0" title="Pedir un cambio o no pagar" onClick={() => setRevisando(l)}>
                          <MessageSquare size={13} />
                        </Button>
                        {(l.estado === 'OBSERVADA' || l.estado === 'RECHAZADA') && (
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0" title="Volver a pendiente"
                            onClick={() => correr(revisarMut.mutateAsync({ id: l.id, estado: 'PENDIENTE' }))}>
                            <X size={13} />
                          </Button>
                        )}
                      </>
                    )}
                    {editable && (
                      <>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Editar" onClick={() => setLineaDialog({ seccion: 'CAJA_SEMANAL', linea: l })}><Pencil size={13} /></Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" title="Sacar" onClick={() => borrarLinea(l)}><Trash2 size={13} /></Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {caja.length > 0 && (
            <tfoot>
              <tr>
                <td className={cn(td, 'font-semibold')} colSpan={2}>Total caja semanal</td>
                <td className={cn(td, 'text-right tabular-nums font-semibold')}>{formatCurrency(t.total_pedido)}</td>
                <td className={td} colSpan={historico ? 1 : 2} />
              </tr>
              {!historico && (
                <tr>
                  <td className={cn(td, 'font-semibold text-green-700')} colSpan={2}>Total aprobado</td>
                  <td className={cn(td, 'text-right tabular-nums font-semibold text-green-700')}>{formatCurrency(t.total_aprobado)}</td>
                  <td className={cn(td, 'text-xs text-muted-foreground')} colSpan={2}>
                    {t.aprobadas} de {t.lineas} aprobadas{t.observadas ? ` · ${t.observadas} con cambios` : ''}{t.rechazadas ? ` · ${t.rechazadas} no se pagan` : ''}
                  </td>
                </tr>
              )}
            </tfoot>
          )}
        </BaseTable>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Cómo se cubre</h3>
          {editable && <Button size="sm" variant="ghost" onClick={() => setLineaDialog({ seccion: 'COBERTURA', linea: null })}><Plus size={13} className="mr-1" /> Agregar</Button>}
        </div>
        <p className="text-xs text-muted-foreground">Entregas de efectivo, transferencias o saldo anterior con que se paga la semana. Es informativo: no se aprueba.</p>
        {cobertura.length === 0 ? <p className="text-sm text-muted-foreground">Sin datos.</p> : (
          <ul className="divide-y border rounded">
            {cobertura.map(l => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div>{l.detalle}</div>
                  {l.observacion && <div className="text-xs text-muted-foreground">{l.observacion}</div>}
                </div>
                <div className="flex items-center gap-1">
                  <span className="tabular-nums">{formatCurrency(l.importe)}</span>
                  {editable && (
                    <>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setLineaDialog({ seccion: 'COBERTURA', linea: l })}><Pencil size={13} /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => borrarLinea(l)}><Trash2 size={13} /></Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Notas</h3>
        {editNotas !== null ? (
          <div className="space-y-2">
            <textarea value={editNotas} onChange={e => setEditNotas(e.target.value)} rows={3} className={inputCls} />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => correr(updResumenMut.mutateAsync({ id: r.id, notas: editNotas || null })).then(() => setEditNotas(null))}>Guardar</Button>
              <Button size="sm" variant="outline" onClick={() => setEditNotas(null)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {r.notas || 'Sin notas.'}{' '}
            {editable && <button className="text-link hover:underline" onClick={() => setEditNotas(r.notas ?? '')}>Editar</button>}
          </p>
        )}
      </div>

      {lineaDialog && <LineaDialog resumenId={r.id} seccion={lineaDialog.seccion} linea={lineaDialog.linea} onClose={() => setLineaDialog(null)} />}
      {revisando && <RevisarDialog linea={revisando} onClose={() => setRevisando(null)} />}
      {sugerir && <SugerenciasDialog resumenId={r.id} onClose={() => setSugerir(false)} />}
    </div>
  );
}

// ── Lista de semanas ──────────────────────────────────────────────────────────

export default function PagosSemanalesTab() {
  const { user } = useAuth();
  const canEdit = user?.rol === 'ADMIN' || user?.rol === 'OPERADOR';
  const [searchParams, setSearchParams] = useSearchParams();
  const seleccionado = Number(searchParams.get('resumen')) || null;
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const { data: resumenes = [], isLoading } = useResumenesPagos(anio);

  const abrir = (id: number | null) => {
    const p = new URLSearchParams(searchParams);
    p.set('tab', 'pagos-semanales');
    if (id) p.set('resumen', String(id)); else p.delete('resumen');
    setSearchParams(p);
  };

  const anios = useMemo(() => {
    const y = new Date().getFullYear();
    return [y + 1, y, y - 1, y - 2];
  }, []);

  if (seleccionado) return <DetalleResumen id={seleccionado} onBack={() => abrir(null)} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select value={anio} onChange={e => setAnio(Number(e.target.value))} className="border border-input rounded px-2 py-1.5 text-sm">
          {anios.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Upload size={13} className="mr-1.5" /> Importar planilla</Button>
            <Button size="sm" onClick={() => setNuevoOpen(true)}><Plus size={13} className="mr-1.5" /> Nueva semana</Button>
          </div>
        )}
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : (
        <div className="overflow-x-auto">
          <BaseTable className="w-full text-sm">
            <thead>
              <tr>
                <th className={th}>Semana</th>
                <th className={th}>Estado</th>
                <th className={th}>Revisión</th>
                <th className={cn(th, 'text-right')}>Pedido</th>
                <th className={cn(th, 'text-right')}>Aprobado</th>
              </tr>
            </thead>
            <tbody>
              {resumenes.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">No hay resúmenes en {anio}. Creá la semana o importá la planilla.</td></tr>
              ) : resumenes.map(r => (
                <tr key={r.id} className="cursor-pointer" onClick={() => abrir(r.id)}>
                  <td className={td}>
                    <div className="font-medium">{rangoSemana(r.semana_desde, r.semana_hasta)}</div>
                    {r.titulo && <div className="text-xs text-muted-foreground">{r.titulo}</div>}
                  </td>
                  <td className={td}><Badge variant={ESTADO_RESUMEN[r.estado].variant}>{ESTADO_RESUMEN[r.estado].label}</Badge></td>
                  <td className={cn(td, 'text-xs')}>
                    {r.estado === 'HISTORICO' ? <span className="text-muted-foreground">{r.totales.lineas} líneas</span> : (
                      <span className="flex flex-wrap gap-x-2">
                        <span className="text-green-700">{r.totales.aprobadas} aprobadas</span>
                        {r.totales.pendientes > 0 && <span className="text-muted-foreground">{r.totales.pendientes} pendientes</span>}
                        {r.totales.observadas > 0 && <span className="text-orange-700">{r.totales.observadas} con cambios</span>}
                        {r.totales.rechazadas > 0 && <span className="text-red-700">{r.totales.rechazadas} no se pagan</span>}
                      </span>
                    )}
                  </td>
                  <td className={cn(td, 'text-right tabular-nums')}>{formatCurrency(r.totales.total_pedido)}</td>
                  <td className={cn(td, 'text-right tabular-nums font-medium')}>{r.estado === 'HISTORICO' ? '—' : formatCurrency(r.totales.total_aprobado)}</td>
                </tr>
              ))}
            </tbody>
          </BaseTable>
        </div>
      )}

      {nuevoOpen && <NuevoResumenDialog onClose={() => setNuevoOpen(false)} onCreado={id => { setNuevoOpen(false); abrir(id); }} />}
      {importOpen && <ImportarPlanillaDialog onClose={() => setImportOpen(false)} />}
    </div>
  );
}
