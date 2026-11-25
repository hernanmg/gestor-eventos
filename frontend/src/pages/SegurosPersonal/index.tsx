import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, ShieldCheck, Pencil, Trash2, FileText, Send, ClipboardList, UserPlus, UserMinus, History, Copy, Check, CalendarDays,
} from 'lucide-react';
import {
  usePolizasPersonal, usePersonalSeguro, useGuardarPolizaPersonal, useEliminarPolizaPersonal, documentoPolizaPersonalUrl,
  useAltaCobertura, useAltaCoberturaLote, useBajaCobertura, useEditarCobertura, useEliminarCobertura,
  usePedidoProductor, useMarcarPedido, useSugerenciasLegajo, useSeguroEvento, useAltasEvento,
} from '@/hooks/useSegurosPersonal';
import { useEventos } from '@/hooks/useEvento';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import BaseTable from '@/components/ui/BaseTable';
import PageHeader from '@/components/ui/PageHeader';
import TabStrip, { TabCount } from '@/components/ui/TabStrip';
import { formatDate } from '@/lib/formatters';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { PolizaPersonal, PersonaSeguro, TipoSeguroPersonal, EstadoSeguroPersona, CoberturaEmpleado } from '@/types';

const inputCls  = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls  = 'block text-xs font-medium text-muted-foreground mb-0.5';
const selectCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const TIPO_LABEL: Record<TipoSeguroPersonal, string> = { ART: 'ART', AP: 'Accidentes personales' };

function TipoBadge({ tipo }: { tipo: TipoSeguroPersonal }) {
  return <Badge variant={tipo === 'ART' ? 'info' : 'orange'}>{tipo}</Badge>;
}

const ESTADO_PERSONA: Record<EstadoSeguroPersona, { label: string; variant: 'success' | 'warning' | 'destructive' | 'muted' }> = {
  VIGENTE:         { label: 'Vigente',          variant: 'success' },
  POR_VENCER:      { label: 'Póliza por vencer', variant: 'warning' },
  VENCIDO:         { label: 'Póliza vencida',    variant: 'destructive' },
  SIN_VENCIMIENTO: { label: 'Sin vencimiento cargado', variant: 'muted' },
  SIN_SEGURO:      { label: 'Sin seguro',        variant: 'destructive' },
};

function VencimientoBadge({ p }: { p: PolizaPersonal }) {
  if (!p.fecha_vencimiento) return <Badge variant="muted">Sin vencimiento</Badge>;
  const e = p.estado_vencimiento;
  return (
    <Badge variant={e === 'VENCIDO' ? 'destructive' : e === 'POR_VENCER' ? 'warning' : 'success'}>
      {e === 'VENCIDO' ? 'Venció' : 'Vence'} {formatDate(p.fecha_vencimiento)}
    </Badge>
  );
}

// ── Póliza (alta / edición) ──────────────────────────────────────────────────

function PolizaDialog({ open, poliza, inicial, onClose }: {
  open: boolean; poliza: PolizaPersonal | null; inicial?: { tipo: TipoSeguroPersonal; aseguradora: string } | null; onClose: () => void;
}) {
  const guardar = useGuardarPolizaPersonal();
  const [form, setForm] = useState({
    tipo: 'AP' as TipoSeguroPersonal, aseguradora: '', numero_poliza: '', productor: '', productor_contacto: '',
    fecha_inicio: '', fecha_vencimiento: '', notas: '',
  });
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(poliza ? {
      tipo: poliza.tipo, aseguradora: poliza.aseguradora, numero_poliza: poliza.numero_poliza ?? '',
      productor: poliza.productor ?? '', productor_contacto: poliza.productor_contacto ?? '',
      fecha_inicio: poliza.fecha_inicio?.slice(0, 10) ?? '', fecha_vencimiento: poliza.fecha_vencimiento?.slice(0, 10) ?? '',
      notas: poliza.notas ?? '',
    } : {
      tipo: inicial?.tipo ?? 'AP', aseguradora: inicial?.aseguradora ?? '', numero_poliza: '', productor: '', productor_contacto: '',
      fecha_inicio: '', fecha_vencimiento: '', notas: '',
    });
    setArchivo(null); setError(null);
  }, [open, poliza, inicial]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    try {
      await guardar.mutateAsync({
        id: poliza?.id,
        data: {
          tipo: form.tipo, aseguradora: form.aseguradora.trim(),
          numero_poliza: form.numero_poliza || null, productor: form.productor || null, productor_contacto: form.productor_contacto || null,
          fecha_inicio: form.fecha_inicio || null, fecha_vencimiento: form.fecha_vencimiento || null, notas: form.notas || null,
          archivo,
        },
      });
      onClose();
    } catch (err) { setError(getApiErrorMessage(err)); }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{poliza ? 'Editar póliza' : 'Nueva póliza del personal'}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3 mt-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tipo *</label>
              <select value={form.tipo} onChange={set('tipo')} className={selectCls}>
                <option value="ART">ART (personal registrado)</option>
                <option value="AP">Accidentes personales (AP)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Aseguradora *</label>
              <input value={form.aseguradora} onChange={set('aseguradora')} className={inputCls} required placeholder="Sancor, Federación Patronal…" />
            </div>
            <div>
              <label className={labelCls}>N° de póliza</label>
              <input value={form.numero_poliza} onChange={set('numero_poliza')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Productor</label>
              <input value={form.productor} onChange={set('productor')} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Contacto del productor (teléfono o mail)</label>
              <input value={form.productor_contacto} onChange={set('productor_contacto')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Vigencia desde</label>
              <input type="date" value={form.fecha_inicio} onChange={set('fecha_inicio')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Vence</label>
              <input type="date" value={form.fecha_vencimiento} onChange={set('fecha_vencimiento')} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Póliza (PDF o imagen){poliza?.documento_nombre ? ` — actual: ${poliza.documento_nombre}` : ''}</label>
              <input type="file" accept="application/pdf,image/*" onChange={e => setArchivo(e.target.files?.[0] ?? null)} className="text-sm" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Notas</label>
              <textarea value={form.notas} onChange={set('notas')} className={inputCls} rows={2} />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={guardar.isPending}>{guardar.isPending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Alta / cambio de póliza ──────────────────────────────────────────────────

function AltaDialog({ persona, polizas, onClose }: { persona: PersonaSeguro | null; polizas: PolizaPersonal[]; onClose: () => void }) {
  const alta = useAltaCobertura();
  const [polizaId, setPolizaId] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setPolizaId(''); setFecha(hoyISO()); setError(null); }, [persona]);
  if (!persona) return null;
  const actual = persona.cobertura_actual;
  const opciones = polizas.filter(p => p.id !== actual?.poliza_id);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (!polizaId) { setError('Elegí la póliza'); return; }
    try { await alta.mutateAsync({ empleado_id: persona.id, poliza_id: Number(polizaId), fecha_alta: fecha }); onClose(); }
    catch (err) { setError(getApiErrorMessage(err)); }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{actual ? 'Cambiar de póliza' : 'Dar de alta en el seguro'} — {persona.apellido}, {persona.nombre}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3 mt-1">
          {actual && (
            <p className="text-xs text-muted-foreground bg-muted/40 rounded p-2">
              Hoy está en {actual.poliza.tipo} {actual.poliza.aseguradora}. Al pasarlo a otra póliza, la actual se cierra en la misma fecha.
            </p>
          )}
          {persona.tipo_contratacion && <p className="text-xs text-muted-foreground">En el legajo dice: <span className="font-medium">{persona.tipo_contratacion}</span></p>}
          <div>
            <label className={labelCls}>Póliza *</label>
            <select value={polizaId} onChange={e => setPolizaId(e.target.value)} className={selectCls} required>
              <option value="">Elegir…</option>
              {opciones.map(p => <option key={p.id} value={p.id}>{p.tipo} — {p.aseguradora}{p.numero_poliza ? ` (N° ${p.numero_poliza})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Cubierto desde *</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} required />
          </div>
          <p className="text-xs text-muted-foreground">El alta queda en el próximo pedido al productor.</p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={alta.isPending}>{alta.isPending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BajaDialog({ persona, onClose }: { persona: PersonaSeguro | null; onClose: () => void }) {
  const baja = useBajaCobertura();
  const [fecha, setFecha] = useState(hoyISO());
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setFecha(hoyISO()); setError(null); }, [persona]);
  if (!persona?.cobertura_actual) return null;
  const c = persona.cobertura_actual;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    try { await baja.mutateAsync({ id: c.id, fecha_baja: fecha }); onClose(); }
    catch (err) { setError(getApiErrorMessage(err)); }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Dar de baja del seguro — {persona.apellido}, {persona.nombre}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3 mt-1">
          <p className="text-sm">Póliza: <span className="font-medium">{c.poliza.tipo} {c.poliza.aseguradora}</span>, cubierto desde el {formatDate(c.fecha_alta)}.</p>
          <div>
            <label className={labelCls}>Baja desde *</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} required />
          </div>
          <p className="text-xs text-muted-foreground">La baja queda en el próximo pedido al productor.</p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" variant="destructive" disabled={baja.isPending}>{baja.isPending ? 'Guardando…' : 'Dar de baja'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Historial (con corrección de fechas) ─────────────────────────────────────

function FilaHistorial({ c, canEdit }: { c: CoberturaEmpleado; canEdit: boolean }) {
  const editar = useEditarCobertura();
  const eliminar = useEliminarCobertura();
  const [editando, setEditando] = useState(false);
  const [alta, setAlta] = useState(c.fecha_alta.slice(0, 10));
  const [baja, setBaja] = useState(c.fecha_baja?.slice(0, 10) ?? '');
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    setError(null);
    try { await editar.mutateAsync({ id: c.id, fecha_alta: alta, fecha_baja: baja || null }); setEditando(false); }
    catch (err) { setError(getApiErrorMessage(err)); }
  };
  const borrar = () => {
    if (!window.confirm('¿Eliminar este registro? Usalo sólo si se cargó por error: para que deje de estar cubierto, dalo de baja.')) return;
    eliminar.mutate(c.id, { onError: err => alert(getApiErrorMessage(err)) });
  };

  return (
    <li className="border rounded p-2 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2"><TipoBadge tipo={c.poliza.tipo} /> <span className="font-medium">{c.poliza.aseguradora}</span></div>
          {!editando && (
            <p className="text-xs text-muted-foreground mt-1">
              Desde {formatDate(c.fecha_alta)}{c.fecha_baja ? ` hasta ${formatDate(c.fecha_baja)}` : ' — sigue cubierto'}
              {!c.alta_informada_at && ' · alta sin pedir al productor'}
              {c.fecha_baja && !c.baja_informada_at && ' · baja sin pedir al productor'}
            </p>
          )}
        </div>
        {canEdit && !editando && (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" title="Corregir fechas" onClick={() => setEditando(true)}><Pencil size={13} /></Button>
            <Button variant="ghost" size="icon" title="Eliminar (error de carga)" className="text-destructive hover:text-destructive" onClick={borrar}><Trash2 size={13} /></Button>
          </div>
        )}
      </div>
      {editando && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div><label className={labelCls}>Desde</label><input type="date" value={alta} onChange={e => setAlta(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Hasta (vacío = sigue)</label><input type="date" value={baja} onChange={e => setBaja(e.target.value)} className={inputCls} /></div>
          {error && <p className="col-span-2 text-xs text-destructive">{error}</p>}
          <div className="col-span-2 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditando(false)}>Cancelar</Button>
            <Button size="sm" onClick={guardar} disabled={editar.isPending}>Guardar</Button>
          </div>
        </div>
      )}
    </li>
  );
}

function HistorialDialog({ persona, canEdit, onClose }: { persona: PersonaSeguro | null; canEdit: boolean; onClose: () => void }) {
  if (!persona) return null;
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Historial de seguro — {persona.apellido}, {persona.nombre}</DialogTitle></DialogHeader>
        {persona.historial.length === 0
          ? <p className="text-sm text-muted-foreground">Nunca estuvo anotado en una póliza.</p>
          : <ul className="space-y-2 mt-1">{persona.historial.map(c => <FilaHistorial key={c.id} c={c} canEdit={canEdit} />)}</ul>}
      </DialogContent>
    </Dialog>
  );
}

// ── Pedido al productor ──────────────────────────────────────────────────────

function PedidoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: grupos = [], isLoading } = usePedidoProductor(open);
  const marcar = useMarcarPedido();
  const [copiado, setCopiado] = useState<number | null>(null);

  const copiar = async (polizaId: number, texto: string) => {
    try { await navigator.clipboard.writeText(texto); setCopiado(polizaId); setTimeout(() => setCopiado(null), 2000); }
    catch { alert('No se pudo copiar: seleccioná el texto y copialo a mano.'); }
  };
  const marcarGrupo = (g: typeof grupos[number]) => {
    marcar.mutate({ altas: g.altas.map(a => a.cobertura_id), bajas: g.bajas.map(b => b.cobertura_id) }, { onError: err => alert(getApiErrorMessage(err)) });
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Pedido al productor</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-1 text-sm">
          <p className="text-xs text-muted-foreground">
            Altas y bajas que todavía no se le pidieron, por póliza. Copiá el mensaje, mandáselo por WhatsApp o mail y después marcalo como pedido.
          </p>
          {isLoading && <p className="text-muted-foreground">Cargando…</p>}
          {!isLoading && grupos.length === 0 && <p className="text-muted-foreground">No hay nada pendiente de pedir.</p>}
          {grupos.map(g => (
            <div key={g.poliza.id} className="border rounded p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <TipoBadge tipo={g.poliza.tipo} />
                  <span className="font-medium">{g.poliza.aseguradora}</span>
                  <span className="text-xs text-muted-foreground">{g.altas.length} alta(s) · {g.bajas.length} baja(s)</span>
                </div>
                {g.poliza.productor_contacto && <span className="text-xs text-muted-foreground">{g.poliza.productor ?? 'Productor'}: {g.poliza.productor_contacto}</span>}
              </div>
              <textarea readOnly value={g.texto} rows={Math.min(14, g.texto.split('\n').length + 1)} className={cn(inputCls, 'font-mono text-xs bg-muted/30')} />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => copiar(g.poliza.id, g.texto)}>
                  {copiado === g.poliza.id ? <><Check size={14} className="mr-1.5" /> Copiado</> : <><Copy size={14} className="mr-1.5" /> Copiar mensaje</>}
                </Button>
                <Button size="sm" onClick={() => marcarGrupo(g)} disabled={marcar.isPending}>
                  <Send size={14} className="mr-1.5" /> Marcar como pedido
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Tomar del legajo ─────────────────────────────────────────────────────────

function LegajoDialog({ open, polizas, onCrearPoliza, onClose }: {
  open: boolean; polizas: PolizaPersonal[]; onCrearPoliza: (p: { tipo: TipoSeguroPersonal; aseguradora: string }) => void; onClose: () => void;
}) {
  const { data, isLoading } = useSugerenciasLegajo(open);
  const lote = useAltaCoberturaLote();
  const [eleccion, setEleccion] = useState<Record<number, string>>({});
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !data) return;
    setEleccion(Object.fromEntries(data.items.map(i => [i.empleado_id, i.poliza_id ? String(i.poliza_id) : ''])));
  }, [open, data]);
  useEffect(() => { if (open) { setResultado(null); setError(null); } }, [open]);

  const items = data?.items ?? [];
  const elegidos = items.filter(i => eleccion[i.empleado_id]);

  const aplicar = async () => {
    setError(null);
    try {
      const r = await lote.mutateAsync({
        ya_informada: true,
        items: elegidos.map(i => ({ empleado_id: i.empleado_id, poliza_id: Number(eleccion[i.empleado_id]) })),
      });
      setResultado(`Se anotaron ${r.creadas} persona(s).${r.errores.length ? ` Errores: ${r.errores.join('; ')}` : ''}`);
    } catch (err) { setError(getApiErrorMessage(err)); }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Tomar el seguro del legajo</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-1 text-sm">
          <p className="text-xs text-muted-foreground">
            Personal activo que todavía no está en ninguna póliza, con lo que dice su legajo en "tipo de contratación".
            Lo que no dice ART se propone como accidentes personales: revisalo antes de confirmar.
            Como es la cobertura que ya tienen, no entra en el pedido al productor. La fecha de alta es la de ingreso (o hoy, si no está cargada).
          </p>
          {(data?.polizas_a_crear.length ?? 0) > 0 && (
            <div className="bg-amber-50 text-amber-800 rounded p-2 text-xs space-y-1">
              <p className="font-medium">Faltan estas pólizas para poder anotarlos:</p>
              {data!.polizas_a_crear.map(p => (
                <div key={`${p.tipo}-${p.aseguradora}`} className="flex items-center justify-between gap-2">
                  <span>{p.tipo} {p.aseguradora || '(aseguradora a completar)'} — {p.empleados} persona(s)</span>
                  <Button size="sm" variant="outline" onClick={() => onCrearPoliza({ tipo: p.tipo, aseguradora: p.aseguradora })}>Crear póliza</Button>
                </div>
              ))}
            </div>
          )}
          {isLoading && <p className="text-muted-foreground">Cargando…</p>}
          {!isLoading && items.length === 0 && <p className="text-muted-foreground">Todo el personal activo ya está anotado en una póliza.</p>}
          {items.length > 0 && !resultado && (
            <div className="max-h-[50vh] overflow-y-auto">
              <BaseTable className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Persona</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">En el legajo</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Anotar en</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map(i => (
                    <tr key={i.empleado_id}>
                      <td className="px-3 py-2 font-medium" data-label="Persona">{i.empleado}</td>
                      <td className="px-3 py-2 text-muted-foreground" data-label="En el legajo">{i.texto_legajo ?? '—'}</td>
                      <td className="px-3 py-2" data-label="Anotar en">
                        <select value={eleccion[i.empleado_id] ?? ''} onChange={e => setEleccion(p => ({ ...p, [i.empleado_id]: e.target.value }))} className={selectCls}>
                          <option value="">No anotar</option>
                          {polizas.map(p => <option key={p.id} value={p.id}>{p.tipo} — {p.aseguradora}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </BaseTable>
            </div>
          )}
          {resultado && <p className="text-green-700 bg-green-50 rounded p-2">{resultado}</p>}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={onClose}>Cerrar</Button>
            {!resultado && items.length > 0 && (
              <Button size="sm" onClick={aplicar} disabled={elegidos.length === 0 || lote.isPending}>
                {lote.isPending ? 'Anotando…' : `Anotar ${elegidos.length}`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Por evento o viaje ───────────────────────────────────────────────────────

const ESTADO_EVENTO: Record<'CUBIERTO' | 'EN_PARTE' | 'SIN_SEGURO', { label: string; variant: 'success' | 'warning' | 'destructive' }> = {
  CUBIERTO:   { label: 'Cubierto',          variant: 'success' },
  EN_PARTE:   { label: 'Cubierto en parte', variant: 'warning' },
  SIN_SEGURO: { label: 'Sin seguro',        variant: 'destructive' },
};

function EventoDialog({ open, polizas, personal, onPedido, onClose }: {
  open: boolean; polizas: PolizaPersonal[]; personal: PersonaSeguro[]; onPedido: () => void; onClose: () => void;
}) {
  const { data: eventos = [] } = useEventos();
  const [eventoId, setEventoId] = useState<number | null>(null);
  const { data, isLoading } = useSeguroEvento(open ? eventoId : null);
  const altas = useAltasEvento();
  const polizasAP = polizas.filter(p => p.tipo === 'AP');
  const [polizaId, setPolizaId] = useState('');
  const [sel, setSel] = useState<Record<number, { on: boolean; desde: string; hasta: string }>>({});
  const [extra, setExtra] = useState<number[]>([]);
  const [agregar, setAgregar] = useState('');
  const [resultado, setResultado] = useState<{ creadas: number; errores: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setResultado(null); setError(null); } }, [open]);
  useEffect(() => { setExtra([]); setResultado(null); setError(null); }, [eventoId]);
  useEffect(() => { if (!polizaId && polizasAP.length === 1) setPolizaId(String(polizasAP[0].id)); }, [polizasAP, polizaId]);
  // Por defecto: todos los que no están cubiertos, con sus fechas
  useEffect(() => {
    if (!data) return;
    setSel(Object.fromEntries(data.personas.map(p => [p.empleado_id, {
      on: p.estado_seguro === 'SIN_SEGURO' && !p.tiene_abierta, desde: p.desde ?? data.evento.desde ?? '', hasta: p.hasta ?? data.evento.hasta ?? '',
    }])));
  }, [data]);

  const filas = useMemo(() => {
    if (!data) return [];
    const enLista = new Set(data.personas.map(p => p.empleado_id));
    const extras = extra.filter(id => !enLista.has(id)).map(id => personal.find(p => p.id === id)).filter((p): p is PersonaSeguro => !!p).map(p => ({
      empleado_id: p.id, empleado: `${p.apellido}, ${p.nombre}`, apodo: p.apodo, documento: p.cuit ?? p.dni, categoria: p.categoria, estado: p.estado,
      fuentes: ['Agregado a mano'], dias: 0, desde: data.evento.desde, hasta: data.evento.hasta,
      cobertura: p.cobertura_actual ? { ...p.cobertura_actual, evento_id: null } : null,
      estado_seguro: p.cobertura_actual ? 'CUBIERTO' as const : 'SIN_SEGURO' as const, tiene_abierta: !!p.cobertura_actual,
    }));
    return [...data.personas, ...extras];
  }, [data, extra, personal]);
  const elegidos = filas.filter(p => sel[p.empleado_id]?.on);
  const disponibles = personal.filter(p => p.estado === 'ACTIVO' && !filas.some(f => f.empleado_id === p.id));
  const setFila = (id: number, cambio: Partial<{ on: boolean; desde: string; hasta: string }>) =>
    setSel(s => ({ ...s, [id]: { ...(s[id] as typeof s[number] | undefined ?? { on: false, desde: data?.evento.desde ?? '', hasta: data?.evento.hasta ?? '' }), ...cambio } }));

  const sumar = (id: string) => {
    if (!id) return;
    const n = Number(id);
    setExtra(x => [...x, n]);
    const p = personal.find(x => x.id === n);
    setFila(n, { on: !p?.cobertura_actual, desde: data?.evento.desde ?? '', hasta: data?.evento.hasta ?? '' });
    setAgregar('');
  };

  const anotar = async () => {
    setError(null);
    if (!eventoId) return;
    if (!polizaId) { setError('Elegí la póliza'); return; }
    for (const p of elegidos) {
      const f = sel[p.empleado_id];
      if (!f.desde || !f.hasta || f.hasta < f.desde) { setError(`Revisá las fechas de ${p.empleado}`); return; }
    }
    try {
      const r = await altas.mutateAsync({ eventoId, poliza_id: Number(polizaId), items: elegidos.map(p => ({ empleado_id: p.empleado_id, desde: sel[p.empleado_id].desde, hasta: sel[p.empleado_id].hasta })) });
      setResultado(r); setExtra([]);
    } catch (err) { setError(getApiErrorMessage(err)); }
  };

  const eventosOrd = [...eventos].sort((a, b) => (b.fecha_inicio ?? '').localeCompare(a.fecha_inicio ?? ''));

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Seguro por evento o viaje</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-1 text-sm">
          <p className="text-xs text-muted-foreground">
            Quién va al evento sale del parte diario, las jornadas y la bitácora de viajes; si falta alguien, agregalo. A los que no están cubiertos en esas fechas
            se los anota en la póliza de accidentes personales del primer al último día, y el pedido al productor les pide el alta "del … al …".
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Evento</label>
              <select value={eventoId ?? ''} onChange={e => setEventoId(e.target.value ? Number(e.target.value) : null)} className={selectCls} aria-label="Evento">
                <option value="">Elegir…</option>
                {eventosOrd.map(ev => <option key={ev.id} value={ev.id}>{ev.nombre}{ev.fecha_inicio ? ` — ${formatDate(ev.fecha_inicio)}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Póliza en la que se anotan</label>
              <select value={polizaId} onChange={e => setPolizaId(e.target.value)} className={selectCls} aria-label="Póliza">
                <option value="">Elegir…</option>
                {[...polizasAP, ...polizas.filter(p => p.tipo !== 'AP')].map(p => <option key={p.id} value={p.id}>{p.tipo} — {p.aseguradora}{p.numero_poliza ? ` (N° ${p.numero_poliza})` : ''}</option>)}
              </select>
            </div>
          </div>
          {data && (
            <p className="text-xs text-muted-foreground">
              {data.evento.desde ? <>Del {formatDate(data.evento.desde)} al {formatDate(data.evento.hasta)} (con montaje y desmontaje)</> : 'El evento no tiene fechas cargadas'}{data.evento.lugar ? ` · ${data.evento.lugar}` : ''}
            </p>
          )}
          {eventoId && isLoading && <p className="text-muted-foreground">Cargando…</p>}
          {resultado && (
            <div className="text-green-700 bg-green-50 rounded p-2 flex flex-wrap items-center justify-between gap-2">
              <span>Se anotaron {resultado.creadas} persona(s).{resultado.errores.length ? ` No se pudo: ${resultado.errores.join('; ')}` : ''}</span>
              {resultado.creadas > 0 && <Button size="sm" variant="outline" onClick={onPedido}><Send size={14} className="mr-1.5" />Ver el pedido al productor</Button>}
            </div>
          )}
          {data && (
            <>
              {filas.length === 0 && <p className="text-muted-foreground">Todavía no hay nadie cargado en este evento (parte diario, jornadas o bitácora). Agregá a quienes viajan.</p>}
              {filas.length > 0 && (
                <div className="overflow-x-auto">
                  <BaseTable className="w-full text-sm min-w-[720px]">
                    <thead className="border-b bg-muted/30">
                      <tr>
                        <th className="px-2 py-2 w-8" />
                        <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">Persona</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">De dónde</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">Seguro</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">Desde</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">Hasta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filas.map(p => {
                        const f = sel[p.empleado_id];
                        const bloqueada = p.tiene_abierta;
                        const est = ESTADO_EVENTO[p.estado_seguro];
                        return (
                          <tr key={p.empleado_id} className={cn(p.estado_seguro === 'CUBIERTO' && 'text-muted-foreground')}>
                            <td className="px-2 py-1.5"><input type="checkbox" checked={!!f?.on} disabled={bloqueada} onChange={e => setFila(p.empleado_id, { on: e.target.checked })} aria-label={`Anotar a ${p.empleado}`} /></td>
                            <td className="px-2 py-1.5" data-label="Persona"><span className="font-medium text-foreground">{p.empleado}</span>{p.documento ? <span className="block text-xs text-muted-foreground">{p.documento}</span> : null}</td>
                            <td className="px-2 py-1.5 text-xs text-muted-foreground" data-label="De dónde">{p.fuentes.join(', ')}{p.dias ? ` · ${p.dias} día${p.dias === 1 ? '' : 's'}` : ''}</td>
                            <td className="px-2 py-1.5" data-label="Seguro">
                              <Badge variant={est.variant}>{est.label}</Badge>
                              {p.cobertura && <span className="block text-xs text-muted-foreground mt-0.5">{p.cobertura.poliza.tipo} {p.cobertura.poliza.aseguradora}{p.cobertura.fecha_baja ? ` · hasta ${formatDate(p.cobertura.fecha_baja)}` : ''}</span>}
                              {bloqueada && p.estado_seguro !== 'CUBIERTO' && <span className="block text-xs text-amber-700">Tiene un seguro abierto: corregí sus fechas desde el historial</span>}
                            </td>
                            <td className="px-2 py-1.5" data-label="Desde"><input type="date" value={f?.desde ?? ''} onChange={e => setFila(p.empleado_id, { desde: e.target.value })} className={inputCls} disabled={bloqueada} /></td>
                            <td className="px-2 py-1.5" data-label="Hasta"><input type="date" value={f?.hasta ?? ''} onChange={e => setFila(p.empleado_id, { hasta: e.target.value })} className={inputCls} disabled={bloqueada} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </BaseTable>
                </div>
              )}
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-full sm:w-80">
                  <label className={labelCls}>Agregar a alguien que viaja</label>
                  <select value={agregar} onChange={e => sumar(e.target.value)} className={selectCls} aria-label="Agregar persona">
                    <option value="">Elegir del padrón…</option>
                    {disponibles.map(p => <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}{p.apodo ? ` (${p.apodo})` : ''}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={onClose}>Cerrar</Button>
            {data && <Button size="sm" onClick={anotar} disabled={!elegidos.length || altas.isPending}>{altas.isPending ? 'Anotando…' : `Anotar ${elegidos.length}`}</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────

type Filtro = 'todos' | 'sin_seguro' | 'ART' | 'AP' | 'inactivos';

export default function SegurosPersonalPage() {
  const { user } = useAuth();
  const canEdit = user?.rol === 'ADMIN' || user?.rol === 'OPERADOR';
  const [searchParams, setSearchParams] = useSearchParams();
  const filtroParam = searchParams.get('filtro') as Filtro | null;
  const filtro: Filtro = filtroParam && ['todos', 'sin_seguro', 'ART', 'AP', 'inactivos'].includes(filtroParam) ? filtroParam : 'todos';
  const setFiltro = (f: Filtro) => setSearchParams(f === 'todos' ? {} : { filtro: f }, { replace: true });

  const { data: polizas = [], isLoading: cargandoPolizas } = usePolizasPersonal();
  const { data: personal = [], isLoading } = usePersonalSeguro();
  const eliminarPoliza = useEliminarPolizaPersonal();

  const [polizaDialog, setPolizaDialog] = useState<{ poliza: PolizaPersonal | null; inicial?: { tipo: TipoSeguroPersonal; aseguradora: string } } | null>(null);
  const [alta, setAlta] = useState<PersonaSeguro | null>(null);
  const [baja, setBaja] = useState<PersonaSeguro | null>(null);
  const [historial, setHistorial] = useState<PersonaSeguro | null>(null);
  const [pedidoOpen, setPedidoOpen] = useState(searchParams.get('pedido') === '1');
  const [legajoOpen, setLegajoOpen] = useState(false);
  const [eventoOpen, setEventoOpen] = useState(false);
  const [buscar, setBuscar] = useState('');

  // El historial abierto se refresca con los datos nuevos después de editar
  const historialActual = historial ? personal.find(p => p.id === historial.id) ?? historial : null;

  const conteo = useMemo(() => ({
    sin_seguro: personal.filter(p => p.estado === 'ACTIVO' && !p.cobertura_actual).length,
    ART:        personal.filter(p => p.cobertura_actual?.poliza.tipo === 'ART').length,
    AP:         personal.filter(p => p.cobertura_actual?.poliza.tipo === 'AP').length,
    inactivos:  personal.filter(p => p.estado !== 'ACTIVO' && p.cobertura_actual).length,
    pedido:     personal.reduce((n, p) => n + p.historial.filter(c => !c.alta_informada_at || (c.fecha_baja && !c.baja_informada_at)).length, 0),
  }), [personal]);

  const filas = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return personal.filter(p => {
      if (filtro === 'sin_seguro' && (p.estado !== 'ACTIVO' || p.cobertura_actual)) return false;
      if ((filtro === 'ART' || filtro === 'AP') && p.cobertura_actual?.poliza.tipo !== filtro) return false;
      if (filtro === 'inactivos' && !(p.estado !== 'ACTIVO' && p.cobertura_actual)) return false;
      if (q && !`${p.apellido} ${p.nombre} ${p.apodo ?? ''} ${p.cuit ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [personal, filtro, buscar]);

  const borrarPoliza = (p: PolizaPersonal) => {
    if (!window.confirm(`¿Eliminar la póliza ${p.tipo} de ${p.aseguradora}?`)) return;
    eliminarPoliza.mutate(p.id, { onError: err => alert(getApiErrorMessage(err)) });
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <PageHeader
        title="Seguro del personal"
        subtitle="ART del personal registrado y accidentes personales (AP) de jornaleros, eventuales y extranjeros: quién está cubierto, desde cuándo y qué hay que pedirle al productor."
        actions={canEdit && (
          <>
            <Button size="sm" variant="outline" onClick={() => setPedidoOpen(true)}>
              <Send size={14} className="mr-1.5" /> Pedido al productor {conteo.pedido > 0 && <span className="ml-1.5"><TabCount count={conteo.pedido} /></span>}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEventoOpen(true)} disabled={polizas.length === 0} title={polizas.length === 0 ? 'Primero cargá las pólizas' : 'Anotar en el seguro a los que van a un evento o un viaje'}>
              <CalendarDays size={14} className="mr-1.5" /> Por evento
            </Button>
            <Button size="sm" variant="outline" onClick={() => setLegajoOpen(true)} disabled={polizas.length === 0} title={polizas.length === 0 ? 'Primero cargá las pólizas' : undefined}>
              <ClipboardList size={14} className="mr-1.5" /> Tomar del legajo
            </Button>
            <Button size="sm" onClick={() => setPolizaDialog({ poliza: null })}>
              <Plus size={14} className="mr-1.5" /> Nueva póliza
            </Button>
          </>
        )}
      />

      {/* Pólizas */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Pólizas</h2>
        {cargandoPolizas ? <p className="text-sm text-muted-foreground">Cargando…</p> : polizas.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border rounded-lg">
            <ShieldCheck size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay pólizas cargadas. Empezá por la ART y las de accidentes personales que tiene la empresa.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {polizas.map(p => (
              <div key={p.id} className="rounded-lg border bg-card p-3 space-y-2 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><TipoBadge tipo={p.tipo} /><span className="font-medium truncate">{p.aseguradora}</span></div>
                    <p className="text-xs text-muted-foreground mt-0.5">{TIPO_LABEL[p.tipo]}{p.numero_poliza ? ` · N° ${p.numero_poliza}` : ''}</p>
                  </div>
                  <div className="flex shrink-0">
                    {p.documento_nombre && <Button variant="ghost" size="icon" title="Ver póliza" onClick={() => window.open(documentoPolizaPersonalUrl(p.id), '_blank')}><FileText size={14} /></Button>}
                    {canEdit && <Button variant="ghost" size="icon" title="Editar" onClick={() => setPolizaDialog({ poliza: p })}><Pencil size={14} /></Button>}
                    {canEdit && <Button variant="ghost" size="icon" title="Eliminar" className="text-destructive hover:text-destructive" onClick={() => borrarPoliza(p)}><Trash2 size={14} /></Button>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <VencimientoBadge p={p} />
                  <span className="text-muted-foreground">{p.cubiertos} persona{p.cubiertos === 1 ? '' : 's'}</span>
                </div>
                {p.productor && <p className="text-xs text-muted-foreground">Productor: {p.productor}{p.productor_contacto ? ` · ${p.productor_contacto}` : ''}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Personal */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabStrip<Filtro>
            variant="pill"
            value={filtro}
            onChange={setFiltro}
            items={[
              { key: 'todos',      label: 'Todos' },
              { key: 'sin_seguro', label: 'Sin seguro', badge: <TabCount count={conteo.sin_seguro} /> },
              { key: 'ART',        label: 'ART', badge: <TabCount count={conteo.ART} tone="neutral" /> },
              { key: 'AP',         label: 'AP', badge: <TabCount count={conteo.AP} tone="neutral" /> },
              { key: 'inactivos',  label: 'Inactivos con seguro', badge: <TabCount count={conteo.inactivos} /> },
            ]}
          />
          <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar por nombre o CUIL" className={cn(inputCls, 'w-full sm:w-64')} />
        </div>

        {isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : filas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No hay personas en esta vista.</p>
        ) : (
          <div className="overflow-x-auto">
            <BaseTable className="w-full text-sm min-w-[760px]">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Persona</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">CUIL</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Seguro</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Desde</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filas.map(p => {
                  const c = p.cobertura_actual;
                  const est = ESTADO_PERSONA[p.estado_seguro];
                  const sinPedir = c && !c.alta_informada_at;
                  return (
                    <tr key={p.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2.5 font-medium" data-label="Persona">
                        {p.apellido}, {p.nombre}{p.apodo ? <span className="text-muted-foreground font-normal"> ({p.apodo})</span> : null}
                        {p.estado !== 'ACTIVO' && <Badge variant="muted" className="ml-2">{p.estado === 'INACTIVO' ? 'Inactivo' : 'Suspendido'}</Badge>}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground" data-label="CUIL">{p.cuit ?? p.dni ?? '—'}</td>
                      <td className="px-3 py-2.5" data-label="Seguro">
                        {c ? <span className="inline-flex items-center gap-1.5"><TipoBadge tipo={c.poliza.tipo} /> {c.poliza.aseguradora}</span>
                           : <span className="text-muted-foreground">{p.tipo_contratacion ? `Legajo: ${p.tipo_contratacion}` : '—'}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground" data-label="Desde">{c ? formatDate(c.fecha_alta) : p.ultima_cobertura?.fecha_baja ? `Baja ${formatDate(p.ultima_cobertura.fecha_baja)}` : '—'}</td>
                      <td className="px-3 py-2.5" data-label="Estado">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={est.variant}>{est.label}</Badge>
                          {sinPedir && <Badge variant="info">Alta sin pedir</Badge>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <Button variant="ghost" size="sm" onClick={() => setAlta(p)} disabled={polizas.length === 0} title={c ? 'Pasar a otra póliza' : 'Dar de alta'}>
                              <UserPlus size={14} className="mr-1" /> {c ? 'Cambiar' : 'Alta'}
                            </Button>
                          )}
                          {canEdit && c && (
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setBaja(p)}>
                              <UserMinus size={14} className="mr-1" /> Baja
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" title="Historial" onClick={() => setHistorial(p)}><History size={14} /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </BaseTable>
          </div>
        )}
      </section>

      <PolizaDialog open={!!polizaDialog} poliza={polizaDialog?.poliza ?? null} inicial={polizaDialog?.inicial} onClose={() => setPolizaDialog(null)} />
      <AltaDialog persona={alta} polizas={polizas} onClose={() => setAlta(null)} />
      <BajaDialog persona={baja} onClose={() => setBaja(null)} />
      <HistorialDialog persona={historialActual} canEdit={canEdit} onClose={() => setHistorial(null)} />
      <PedidoDialog open={pedidoOpen} onClose={() => { setPedidoOpen(false); if (searchParams.get('pedido')) { searchParams.delete('pedido'); setSearchParams(searchParams, { replace: true }); } }} />
      <EventoDialog open={eventoOpen} polizas={polizas} personal={personal} onPedido={() => { setEventoOpen(false); setPedidoOpen(true); }} onClose={() => setEventoOpen(false)} />
      <LegajoDialog open={legajoOpen} polizas={polizas} onCrearPoliza={p => { setLegajoOpen(false); setPolizaDialog({ poliza: null, inicial: p }); }} onClose={() => setLegajoOpen(false)} />
    </div>
  );
}
