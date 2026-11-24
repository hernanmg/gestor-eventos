import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import BaseTable from '@/components/ui/BaseTable';
import MoneyInput from '@/components/ui/MoneyInput';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ProveedorCombobox from '@/components/domain/ProveedorCombobox';
import {
  useChequesRecibidos, useGuardarChequeRecibido, useEliminarChequeRecibido, useEstadoChequeRecibido, useImportarChequesRecibidos,
  type ImportRecibidosResultado,
} from '@/hooks/useChequesRecibidos';
import { useCuentasEmpresa } from '@/hooks/useCaja';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { ChequeRecibido, EstadoChequeRecibido, FormatoCheque, ProveedorBusqueda } from '@/types';

// Cheques → Recibidos: la cartera de cheques y echeqs de clientes. Mayra los
// pone en custodia el día anterior a la fecha de pago para que se acrediten
// ese día; también los deposita, los vende o los endosa a un proveedor.

const inputCls  = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls  = 'block text-xs font-medium text-muted-foreground mb-0.5';
const selectCls = 'border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';
const ars = (n: number) => formatCurrency(n, 'ARS');
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export const ESTADO_RECIBIDO: Record<EstadoChequeRecibido, { label: string; variant: 'warning' | 'info' | 'success' | 'muted' | 'destructive' | 'orange' }> = {
  EN_CARTERA:  { label: 'En cartera',  variant: 'warning' },
  EN_CUSTODIA: { label: 'En custodia', variant: 'info' },
  DEPOSITADO:  { label: 'Depositado',  variant: 'info' },
  ACREDITADO:  { label: 'Acreditado',  variant: 'success' },
  VENDIDO:     { label: 'Vendido',     variant: 'orange' },
  ENDOSADO:    { label: 'Endosado',    variant: 'muted' },
  RECHAZADO:   { label: 'Rechazado',   variant: 'destructive' },
};
// Qué se puede hacer desde cada estado (volver a cartera deshace)
const SIGUIENTES: Record<EstadoChequeRecibido, EstadoChequeRecibido[]> = {
  EN_CARTERA:  ['EN_CUSTODIA', 'DEPOSITADO', 'ACREDITADO', 'VENDIDO', 'ENDOSADO', 'RECHAZADO'],
  EN_CUSTODIA: ['ACREDITADO', 'RECHAZADO', 'EN_CARTERA'],
  DEPOSITADO:  ['ACREDITADO', 'RECHAZADO', 'EN_CARTERA'],
  ACREDITADO:  ['EN_CARTERA'],
  VENDIDO:     ['EN_CARTERA'],
  ENDOSADO:    ['EN_CARTERA'],
  RECHAZADO:   ['EN_CARTERA'],
};
const ACCION_LABEL: Record<EstadoChequeRecibido, string> = {
  EN_CARTERA: 'Volver a cartera', EN_CUSTODIA: 'Poner en custodia', DEPOSITADO: 'Depositado', ACREDITADO: 'Acreditado',
  VENDIDO: 'Vendido', ENDOSADO: 'Endosado a…', RECHAZADO: 'Rechazado',
};

function cuandoPaga(c: ChequeRecibido) {
  if (c.estado !== 'EN_CARTERA') return null;
  if (c.accion === 'VENCIDO') return <span className="text-red-700">Pasaron más de 30 días</span>;
  if (c.dias_para_pago === 1) return <span className="text-red-700 font-medium">Mañana: custodia hoy</span>;
  if (c.dias_para_pago === 0) return <span className="text-red-700 font-medium">Hoy</span>;
  if (c.dias_para_pago < 0) return <span className="text-red-700">Ya se puede cobrar</span>;
  if (c.dias_para_pago <= 7) return <span className="text-amber-700">En {c.dias_para_pago} días</span>;
  return null;
}

function useCuentasCaja() {
  const { data } = useCuentasEmpresa({ estado: 'ABIERTA' });
  return useMemo(() => (data ?? []).filter(c => c.evento_id == null), [data]);
}

// ── Cambiar el estado ────────────────────────────────────────────────────────
function EstadoDialog({ cheque, estado, onClose }: { cheque: ChequeRecibido; estado: EstadoChequeRecibido; onClose: () => void }) {
  const mut = useEstadoChequeRecibido();
  const cuentas = useCuentasCaja().filter(c => c.moneda === cheque.moneda);
  const [fecha, setFecha] = useState(estado === 'EN_CUSTODIA' || estado === 'DEPOSITADO' ? hoyISO() : (cheque.fecha_pago.slice(0, 10) < hoyISO() ? hoyISO() : cheque.fecha_pago.slice(0, 10)));
  const [cuentaId, setCuentaId] = useState(String(cheque.cuenta_id ?? ''));
  const [asentar, setAsentar] = useState(true);
  const [neto, setNeto] = useState('');
  const [tasa, setTasa] = useState('');
  const [bancoDesc, setBancoDesc] = useState('');
  const [proveedor, setProveedor] = useState<ProveedorBusqueda | null>(null);
  const [endosadoA, setEndosadoA] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const conCuenta = ['EN_CUSTODIA', 'DEPOSITADO', 'ACREDITADO', 'VENDIDO'].includes(estado);
  const conCaja = estado === 'ACREDITADO' || estado === 'VENDIDO';

  const guardar = async () => {
    setError('');
    try {
      const r = await mut.mutateAsync({
        id: cheque.id,
        data: {
          estado, fecha: estado === 'EN_CARTERA' ? null : fecha || null,
          cuenta_id: conCuenta && cuentaId ? Number(cuentaId) : null,
          asentar_en_caja: conCaja ? asentar : false,
          monto_neto: estado === 'VENDIDO' && neto ? Number(neto) : null,
          tasa_descuento: estado === 'VENDIDO' && tasa ? Number(tasa) : null,
          banco_descuento: estado === 'VENDIDO' ? bancoDesc || null : null,
          proveedor_id: estado === 'ENDOSADO' ? proveedor?.id ?? null : null,
          endosado_a: estado === 'ENDOSADO' ? endosadoA || null : null,
          motivo_rechazo: estado === 'RECHAZADO' ? motivo || null : null,
        },
      });
      if (r.aviso) setAviso(r.aviso); else onClose();
    } catch (e) { setError(getApiErrorMessage(e)); }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{ACCION_LABEL[estado]} · {cheque.formato === 'ECHEQ' ? 'Echeq' : 'Cheque'} {cheque.numero}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">{cheque.librador} · {formatCurrency(cheque.importe, cheque.moneda)} · paga el {formatDate(cheque.fecha_pago)}</p>
        {aviso ? (
          <>
            <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertTriangle className="inline h-4 w-4 mr-1" />{aviso}</p>
            <div className="flex justify-end gap-2">
              {cheque.factura_emitida_id && <Link to={`/facturas-emitidas?abrir=${cheque.factura_emitida_id}`}><Button variant="outline">Ir a la factura</Button></Link>}
              <Button onClick={onClose}>Cerrar</Button>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {estado !== 'EN_CARTERA' && <div><label className={labelCls}>Fecha</label><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} /></div>}
              {conCuenta && (
                <div className={estado === 'EN_CARTERA' ? 'col-span-2' : ''}>
                  <label className={labelCls}>Cuenta</label>
                  <select value={cuentaId} onChange={e => setCuentaId(e.target.value)} className={cn(selectCls, 'w-full')}>
                    <option value="">— Elegir —</option>
                    {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
              )}
              {conCaja && (
                <label className="col-span-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={asentar} onChange={e => setAsentar(e.target.checked)} />
                  Asentar el ingreso en Caja Global ({estado === 'VENDIDO' ? 'lo que entró por la venta' : 'el importe del cheque'})
                </label>
              )}
              {estado === 'VENDIDO' && <>
                <div><label className={labelCls}>Entró (neto)</label><MoneyInput value={neto} onChange={setNeto} className={inputCls} placeholder={String(cheque.importe)} /></div>
                <div><label className={labelCls}>Tasa de descuento %</label><input type="number" step="0.01" value={tasa} onChange={e => setTasa(e.target.value)} className={inputCls} /></div>
                <div className="col-span-2"><label className={labelCls}>Dónde se vendió</label><input value={bancoDesc} onChange={e => setBancoDesc(e.target.value)} className={inputCls} placeholder="Galicia, SGR…" /></div>
              </>}
              {estado === 'ENDOSADO' && <>
                <div className="col-span-2"><label className={labelCls}>A un proveedor</label><ProveedorCombobox value={proveedor} onChange={setProveedor} /></div>
                <div className="col-span-2"><label className={labelCls}>O a quién</label><input value={endosadoA} onChange={e => setEndosadoA(e.target.value)} className={inputCls} placeholder="Nombre" /></div>
              </>}
              {estado === 'RECHAZADO' && <div className="col-span-2"><label className={labelCls}>Motivo</label><input value={motivo} onChange={e => setMotivo(e.target.value)} className={inputCls} placeholder="Sin fondos, firma…" /></div>}
              {estado === 'EN_CARTERA' && <p className="col-span-2 text-sm text-muted-foreground">Vuelve a la cartera como si no se hubiera movido.{cheque.movimiento_caja_id ? ' Se borra el ingreso que estaba asentado en la caja.' : ''}</p>}
              {estado === 'EN_CUSTODIA' && <p className="col-span-2 text-xs text-muted-foreground">En custodia se acredita solo en la fecha de pago. Cuando entre, marcalo como acreditado.</p>}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={guardar} disabled={mut.isPending}>{mut.isPending ? 'Guardando…' : 'Guardar'}</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Alta / edición manual ────────────────────────────────────────────────────
function ChequeRecibidoDialog({ cheque, onClose }: { cheque: ChequeRecibido | null; onClose: () => void }) {
  const guardar = useGuardarChequeRecibido();
  const [f, setF] = useState({
    formato: (cheque?.formato ?? 'ECHEQ') as FormatoCheque, numero: cheque?.numero ?? '', banco: cheque?.banco ?? '',
    librador: cheque?.librador ?? '', librador_cuit: cheque?.librador_cuit ?? '', importe: cheque ? String(cheque.importe) : '',
    fecha_pago: cheque?.fecha_pago.slice(0, 10) ?? '', fecha_emision: cheque?.fecha_emision?.slice(0, 10) ?? '', notas: cheque?.notas ?? '',
  });
  const [error, setError] = useState('');
  const delCobro = !!cheque?.cobro_id;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF(p => ({ ...p, [k]: e.target.value }));
  const submit = async () => {
    setError('');
    if (!f.numero.trim() || !f.librador.trim() || !f.importe || !f.fecha_pago) { setError('Completá número, quién lo dio, importe y fecha de pago'); return; }
    try {
      await guardar.mutateAsync({
        id: cheque?.id,
        data: {
          formato: f.formato, numero: f.numero.trim(), banco: f.banco || null, librador: f.librador.trim(), librador_cuit: f.librador_cuit || null,
          importe: Number(f.importe), fecha_pago: f.fecha_pago, fecha_emision: f.fecha_emision || null, notas: f.notas || null,
        },
      });
      onClose();
    } catch (e) { setError(getApiErrorMessage(e)); }
  };
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{cheque ? `Editar cheque ${cheque.numero}` : 'Nuevo cheque recibido'}</DialogTitle></DialogHeader>
        {!cheque && <p className="text-xs text-muted-foreground -mt-2">Si paga una factura, cargalo desde el cobro en Facturas a Cobrar: queda ligado a la factura.</p>}
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Tipo</label><select value={f.formato} onChange={set('formato')} className={cn(selectCls, 'w-full')}><option value="ECHEQ">Echeq</option><option value="FISICO">Cheque físico</option></select></div>
          <div><label className={labelCls}>Número</label><input value={f.numero} onChange={set('numero')} className={inputCls} /></div>
          <div className="col-span-2"><label className={labelCls}>Recibido de</label><input value={f.librador} onChange={set('librador')} className={inputCls} disabled={delCobro} /></div>
          <div><label className={labelCls}>Banco</label><input value={f.banco} onChange={set('banco')} className={inputCls} placeholder="Galicia, Macro…" /></div>
          <div><label className={labelCls}>Importe</label><MoneyInput value={f.importe} onChange={v => setF(p => ({ ...p, importe: v }))} className={inputCls} disabled={delCobro} /></div>
          <div><label className={labelCls}>Fecha de pago</label><input type="date" value={f.fecha_pago} onChange={set('fecha_pago')} className={inputCls} /></div>
          <div><label className={labelCls}>Emisión</label><input type="date" value={f.fecha_emision} onChange={set('fecha_emision')} className={inputCls} /></div>
          <div className="col-span-2"><label className={labelCls}>Notas</label><input value={f.notas} onChange={set('notas')} className={inputCls} /></div>
        </div>
        {delCobro && <p className="text-xs text-muted-foreground">Entró con el cobro de una factura: el importe y quién lo dio se corrigen en el cobro.</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={guardar.isPending}>{guardar.isPending ? 'Guardando…' : 'Guardar'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Importar la hoja RECIBIDOS ───────────────────────────────────────────────
function ImportarRecibidosDialog({ onClose }: { onClose: () => void }) {
  const imp = useImportarChequesRecibidos();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [r, setR] = useState<ImportRecibidosResultado | null>(null);
  const [error, setError] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const correr = async (file: File, preview: boolean) => {
    setError('');
    try { setR(await imp.mutateAsync({ archivo: file, preview })); } catch (e) { setError(getApiErrorMessage(e)); }
  };
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Importar cheques recibidos</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1">La planilla de cheques del banco con las hojas "RECIBIDOS 2022", "RECIBIDOS 2023"…: tipo, número, recibido de, pago, emisión, importe y estado.</p>
        <input ref={ref} type="file" accept=".xlsx" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) { setArchivo(file); correr(file, true); } e.target.value = ''; }} />
        <Button variant="outline" onClick={() => ref.current?.click()} disabled={imp.isPending}><Upload className="h-4 w-4 mr-1" />{archivo?.name ?? 'Elegir archivo'}</Button>
        {r && !r.aplicado && (
          <div className="text-sm space-y-1">
            <p>{r.hojas.join(', ')}: {r.total} cheques, {r.nuevos} nuevos{r.ya_estaban ? `, ${r.ya_estaban} ya estaban` : ''}.</p>
            <p className="text-muted-foreground">{Object.entries(r.por_estado).map(([e, c]) => `${ESTADO_RECIBIDO[e as EstadoChequeRecibido]?.label ?? e}: ${c}`).join(' · ')}</p>
            <p className="text-xs text-muted-foreground">Un nombre en la columna Estado se toma como endosado a esa persona. Reimportar no duplica.</p>
          </div>
        )}
        {r?.aplicado && <p className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800"><CheckCircle2 className="inline h-4 w-4 mr-1" />Listo: {r.nuevos} cheques importados.</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{r?.aplicado ? 'Cerrar' : 'Cancelar'}</Button>
          {r && !r.aplicado && r.nuevos > 0 && archivo && <Button onClick={() => correr(archivo, false)} disabled={imp.isPending}>Importar</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Pestaña ──────────────────────────────────────────────────────────────────
export default function ChequesRecibidos({ tabs }: { tabs: ReactNode }) {
  const [vista, setVista] = useState<'cartera' | 'todos'>('cartera');
  const [q, setQ] = useState('');
  const { data, isLoading } = useChequesRecibidos({ vista, q: q.trim() || undefined });
  const eliminar = useEliminarChequeRecibido();
  const [cambio, setCambio] = useState<{ cheque: ChequeRecibido; estado: EstadoChequeRecibido } | null>(null);
  const [editando, setEditando] = useState<ChequeRecibido | null | 'nuevo'>(null);
  const [importando, setImportando] = useState(false);
  const cheques = data?.cheques ?? [];
  const r = data?.resumen;
  const total = cheques.reduce((s, c) => s + (c.moneda === 'ARS' ? c.importe : 0), 0);

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <PageHeader
        title="Cheques"
        subtitle="Los cheques y echeqs que pagan los clientes. Antes de la fecha de pago hay que depositarlos o ponerlos en custodia (el día anterior) para que se acrediten ese día."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setImportando(true)}><Upload size={14} className="mr-1.5" /> Importar planilla</Button>
            <Button size="sm" onClick={() => setEditando('nuevo')}><Plus size={14} className="mr-1.5" /> Cheque recibido</Button>
          </div>
        }
      />
      {tabs}

      {r && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <div className="card p-3"><div className="text-xs font-medium text-muted-foreground">En la empresa ({r.en_la_empresa.cantidad})</div><div className="text-lg font-semibold tabular-nums mt-1">{ars(r.en_la_empresa.total)}</div><div className="text-[11px] text-muted-foreground">En cartera, en custodia o depositados</div></div>
          <div className={cn('card p-3', r.depositar_ya.cantidad > 0 && 'ring-1 ring-red-300 bg-red-50')}><div className="text-xs font-medium text-muted-foreground">Para depositar ya ({r.depositar_ya.cantidad})</div><div className={cn('text-lg font-semibold tabular-nums mt-1', r.depositar_ya.cantidad > 0 && 'text-red-700')}>{ars(r.depositar_ya.total)}</div><div className="text-[11px] text-muted-foreground">En cartera y se pagan mañana o antes</div></div>
          <div className="card p-3"><div className="text-xs font-medium text-muted-foreground">Próximos 7 días ({r.proximos_7_dias.cantidad})</div><div className="text-lg font-semibold tabular-nums mt-1">{ars(r.proximos_7_dias.total)}</div></div>
          <div className="card p-3"><div className="text-xs font-medium text-muted-foreground">En custodia ({r.en_custodia.cantidad})</div><div className="text-lg font-semibold tabular-nums mt-1">{ars(r.en_custodia.total)}</div>{r.vencidos.cantidad > 0 && <div className="text-[11px] text-red-700 mt-0.5 flex items-center gap-1"><AlertTriangle size={11} />{r.vencidos.cantidad} en cartera hace más de 30 días</div>}</div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select value={vista} onChange={e => setVista(e.target.value as 'cartera' | 'todos')} className={selectCls}>
          <option value="cartera">En la empresa</option>
          <option value="todos">Todos (también acreditados, vendidos…)</option>
        </select>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar n°, cliente o banco" className={selectCls + ' w-56'} />
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground text-center py-10">Cargando…</p>
        : !cheques.length ? <p className="text-sm text-muted-foreground text-center py-10">{vista === 'cartera' ? 'No hay cheques de clientes en la empresa.' : 'No hay cheques con esta búsqueda.'}</p>
        : (
          <div className="overflow-x-auto">
            <BaseTable className="w-full text-sm min-w-[900px]">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Fecha de pago</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">N°</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Recibido de</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Banco</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Importe</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {cheques.map(c => (
                  <tr key={c.id} className={cn(c.accion === 'DEPOSITAR_YA' && 'bg-red-50/60')}>
                    <td className="px-3 py-2" data-label="Fecha de pago">{formatDate(c.fecha_pago)}<div className="text-[11px]">{cuandoPaga(c)}</div></td>
                    <td className="px-3 py-2 font-mono text-xs" data-label="N°">{c.numero}{c.formato === 'FISICO' && <span className="ml-1 text-[10px] text-muted-foreground">(físico)</span>}</td>
                    <td className="px-3 py-2" data-label="Recibido de">
                      <span className="font-medium">{c.librador}</span>
                      {c.factura_emitida && <div className="text-[11px]"><Link to={`/facturas-emitidas?abrir=${c.factura_emitida.id}`} className="text-link hover:underline">Factura {String(c.factura_emitida.punto_venta).padStart(4, '0')}-{c.factura_emitida.numero ?? '—'}</Link></div>}
                    </td>
                    <td className="px-3 py-2" data-label="Banco">{c.banco ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums" data-label="Importe">{formatCurrency(c.importe, c.moneda)}</td>
                    <td className="px-3 py-2" data-label="Estado">
                      <Badge variant={ESTADO_RECIBIDO[c.estado].variant}>{ESTADO_RECIBIDO[c.estado].label}</Badge>
                      <div className="text-[11px] text-muted-foreground">
                        {[c.fecha_estado && formatDate(c.fecha_estado), c.cuenta?.nombre, c.endosado_a && `a ${c.endosado_a}`, c.monto_neto != null && `neto ${ars(c.monto_neto)}`, c.motivo_rechazo].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {c.estado === 'EN_CARTERA' && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCambio({ cheque: c, estado: 'EN_CUSTODIA' })}>Custodia</Button>}
                        <select value="" onChange={e => e.target.value && setCambio({ cheque: c, estado: e.target.value as EstadoChequeRecibido })} className="h-7 rounded border px-1 text-xs bg-white" aria-label="Cambiar estado">
                          <option value="">Cambiar…</option>
                          {SIGUIENTES[c.estado].map(e => <option key={e} value={e}>{ACCION_LABEL[e]}</option>)}
                        </select>
                        <button title="Editar" onClick={() => setEditando(c)} className="p-1 rounded hover:bg-accent text-muted-foreground"><Pencil size={13} /></button>
                        {!c.cobro_id && c.estado === 'EN_CARTERA' && (
                          <button title="Eliminar (cargado por error)" onClick={async () => {
                            if (!window.confirm(`¿Eliminar el cheque ${c.numero}?`)) return;
                            try { await eliminar.mutateAsync(c.id); } catch (e) { window.alert(getApiErrorMessage(e)); }
                          }} className="p-1 rounded hover:bg-destructive/10 text-destructive"><Trash2 size={13} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-xs font-semibold">Total ({cheques.length})</td>
                  <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums">{ars(total)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </BaseTable>
          </div>
        )}

      {cambio && <EstadoDialog cheque={cambio.cheque} estado={cambio.estado} onClose={() => setCambio(null)} />}
      {editando && <ChequeRecibidoDialog cheque={editando === 'nuevo' ? null : editando} onClose={() => setEditando(null)} />}
      {importando && <ImportarRecibidosDialog onClose={() => setImportando(false)} />}
    </div>
  );
}
