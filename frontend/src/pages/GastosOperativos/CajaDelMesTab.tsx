import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Upload, Printer, Pencil, Trash2, Download, ClipboardList } from 'lucide-react';
import { useCuentasEmpresa, useResumenAndrea, useCreateMovimientoCuenta, useUpdateMovimientoCuenta, useDeleteMovimientoCuenta, useImportarCajaAndrea, comprobanteMovCajaUrl } from '@/hooks/useCaja';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MoneyInput from '@/components/ui/MoneyInput';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { CategoriaAndrea, MovimientoCaja } from '@/types';

// Orden de tabs preferido, calcado del Excel real (CAJAS_JULIO-2026.xlsx) —
// cualquier otra cuenta de empresa que exista (o se cree más adelante) se
// agrega al final, orden alfabético.
const ORDEN_PREFERIDO = ['Caja General DOS57', 'Caja Reserva', 'Caja Guardada', 'Adelantos DOS57', 'Caja Pollo', 'Caja Jazmín', 'Caja Miguel', 'Caja David'];

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

type TipoMovimiento = 'INGRESO' | CategoriaAndrea;

const TIPO_OPTIONS: { value: TipoMovimiento; label: string; columna: string }[] = [
  { value: 'INGRESO',       label: 'Ingreso',        columna: 'ingreso' },
  { value: 'COMBUSTIBLE',   label: 'Combustible',    columna: 'combustible' },
  { value: 'COMIDA',        label: 'Comida',         columna: 'comida' },
  { value: 'GASTOS_VARIOS', label: 'Gastos Varios',  columna: 'gastos_varios' },
  { value: 'SERVICIOS',     label: 'Servicios',      columna: 'servicios' },
  { value: 'DEV_GASTOS',    label: 'Dev.Gastos',     columna: 'dev_gastos' },
  { value: 'VALES',         label: 'Vales',          columna: 'vales' },
];

const COLUMNAS = [
  { key: 'ingreso',       label: 'Ingreso' },
  { key: 'combustible',   label: 'Combustible' },
  { key: 'comida',        label: 'Comida' },
  { key: 'gastos_varios', label: 'Gastos Varios' },
  { key: 'servicios',     label: 'Servicios' },
  { key: 'dev_gastos',    label: 'Dev.Gastos' },
  { key: 'vales',         label: 'Vales' },
] as const;

type ColumnaKey = (typeof COLUMNAS)[number]['key'];

// Fecha + Concepto + 7 columnas de importe (Ingreso + 6 egresos) + Saldo —
// grid compartido por el header, cada fila y el total, para que las
// columnas queden alineadas entre sí.
const GRID_TEMPLATE = 'grid-cols-[100px_1fr_repeat(7,80px)_100px]';

// Categoría del movimiento → columna donde cae. Un egreso sin categoría
// (movimiento importado de otro módulo, o cargado sin tipo) cae en Gastos
// Varios como fallback, para no perderlo de la tabla.
function columnaDe(m: MovimientoCaja): ColumnaKey | null {
  if (Number(m.debe) > 0) return 'ingreso';
  if (m.categoria_andrea === 'COMBUSTIBLE') return 'combustible';
  if (m.categoria_andrea === 'COMIDA') return 'comida';
  if (m.categoria_andrea === 'SERVICIOS') return 'servicios';
  if (m.categoria_andrea === 'DEV_GASTOS') return 'dev_gastos';
  if (m.categoria_andrea === 'VALES') return 'vales';
  if (Number(m.haber) > 0) return 'gastos_varios';
  return null;
}

const ICONO_COLUMNA: Record<ColumnaKey, string> = {
  ingreso: '💰', combustible: '⛽', comida: '🍽️', gastos_varios: '📦',
  servicios: '🔧', dev_gastos: '🔄', vales: '💳',
};

function iconoDe(m: MovimientoCaja): string {
  const col = columnaDe(m);
  return col ? ICONO_COLUMNA[col] : '📋';
}

const inputCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

// ── Dialog: agregar / editar movimiento ───────────────────────────────────────

function MovimientoDialog({
  cuentaId, editing, onClose,
}: {
  cuentaId: number;
  editing:  MovimientoCaja | null;
  onClose:  () => void;
}) {
  const createMov = useCreateMovimientoCuenta(cuentaId);
  const updateMov = useUpdateMovimientoCuenta(cuentaId);

  const [tipo, setTipo]           = useState<TipoMovimiento>('GASTOS_VARIOS');
  const [fecha, setFecha]         = useState('');
  const [concepto, setConcepto]   = useState('');
  const [monto, setMonto]         = useState('');
  const [responsable, setResponsable] = useState('');
  const [referencia, setReferencia] = useState('');
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      const esIngreso = Number(editing.debe) > 0;
      setTipo(esIngreso ? 'INGRESO' : (editing.categoria_andrea ?? 'GASTOS_VARIOS'));
      setFecha(editing.fecha ? editing.fecha.slice(0, 10) : '');
      setConcepto(editing.descripcion ?? '');
      setMonto(String(esIngreso ? editing.debe : editing.haber));
      setResponsable(editing.responsable_nombre ?? '');
      setReferencia(editing.referencia ?? '');
    } else {
      setTipo('GASTOS_VARIOS'); setFecha(''); setConcepto(''); setMonto(''); setResponsable(''); setReferencia('');
    }
    setComprobante(null);
    setError(null);
  }, [editing]);

  const isPending = createMov.isPending || updateMov.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const montoNum = parseFloat(monto) || 0;
    if (montoNum <= 0) { setError('Ingresá un monto mayor a cero'); return; }
    if (!concepto.trim()) { setError('El concepto es obligatorio'); return; }

    const esIngreso = tipo === 'INGRESO';
    const payload = {
      fecha:              fecha || null,
      descripcion:        concepto.trim(),
      debe:               esIngreso ? montoNum : 0,
      haber:              esIngreso ? 0 : montoNum,
      categoria_andrea:   esIngreso ? null : tipo,
      responsable_nombre: responsable.trim() || null,
      referencia:         referencia.trim() || null,
      comprobante,
    };

    try {
      if (editing) {
        await updateMov.mutateAsync({ id: editing.id, data: payload });
      } else {
        await createMov.mutateAsync(payload);
      }
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? 'Editar movimiento' : 'Agregar movimiento'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tipo *</label>
              <select value={tipo} onChange={e => setTipo(e.target.value as TipoMovimiento)} className={inputCls}>
                {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Concepto *</label>
            <input value={concepto} onChange={e => setConcepto(e.target.value)} className={inputCls} placeholder="Descripción del movimiento" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Monto *</label>
              <MoneyInput value={monto} onChange={setMonto} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Responsable</label>
              <input value={responsable} onChange={e => setResponsable(e.target.value)} className={inputCls} placeholder="Nombre" />
            </div>
          </div>
          <div>
            <label className={labelCls}>N° Comprobante</label>
            <input value={referencia} onChange={e => setReferencia(e.target.value)} className={inputCls} placeholder="FA-7685, TICK 994934…" />
          </div>
          <div>
            <label className={labelCls}>Comprobante {editing?.tiene_comprobante && '(reemplaza el actual)'}</label>
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={e => setComprobante(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-muted-foreground file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-accent file:text-xs"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={isPending}>{isPending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Drawer de detalle ──────────────────────────────────────────────────────────

function MovimientoDrawer({
  movimiento, canEdit, onClose, onEdit,
}: {
  movimiento: MovimientoCaja;
  canEdit:    boolean;
  onClose:    () => void;
  onEdit:     () => void;
}) {
  const cuentaId = movimiento.cuenta_id;
  const deleteMov = useDeleteMovimientoCuenta(cuentaId);
  const esIngreso = Number(movimiento.debe) > 0;
  const tipoLabel = esIngreso ? 'Ingreso' : (TIPO_OPTIONS.find(t => t.value === movimiento.categoria_andrea)?.label ?? 'Gastos Varios');

  const handleDelete = () => {
    if (!window.confirm('¿Eliminar este movimiento?')) return;
    deleteMov.mutate(movimiento.id, { onSuccess: onClose, onError: err => alert(getApiErrorMessage(err)) });
  };

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-3 py-1.5 border-b last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
  );

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Detalle del movimiento</DialogTitle></DialogHeader>
        <div className="space-y-0.5 mt-1">
          {row('Fecha', movimiento.fecha ? formatDate(movimiento.fecha) : '—')}
          {row('Concepto', movimiento.descripcion ?? '—')}
          {row('Categoría', tipoLabel)}
          {row('Monto', <span className={esIngreso ? 'text-green-700 font-medium' : 'font-medium'}>{formatCurrency(esIngreso ? movimiento.debe : movimiento.haber)}</span>)}
          {row('Saldo luego del movimiento', formatCurrency(movimiento.saldo_corriente))}
          {row('Responsable', movimiento.responsable_nombre ?? '—')}
          {row('Comprobante', movimiento.referencia ?? '—')}
          {row('Comprobante', movimiento.tiene_comprobante
            ? <a href={comprobanteMovCajaUrl(movimiento.id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><Download size={12} /> Descargar</a>
            : '—')}
          {movimiento.movimiento_origen && row('Movimiento vinculado', `${movimiento.movimiento_origen.concepto ?? ''} (rubro ${movimiento.movimiento_origen.rubro_nombre ?? '—'})`)}
          {movimiento.liquidacion_admin_id && row('Liquidación vinculada', <a href="/rrhh?tab=sueldos-admin" className="text-primary hover:underline">Ver en Sueldos Admin</a>)}
        </div>
        {canEdit && (
          <div className="flex justify-end gap-2 pt-2 border-t mt-2">
            <Button variant="outline" size="sm" onClick={onEdit}><Pencil size={13} className="mr-1.5" /> Editar</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteMov.isPending}><Trash2 size={13} className="mr-1.5" /> Eliminar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Importar Excel ────────────────────────────────────────────────────────────

function ImportarExcelDialog({ onClose }: { onClose: () => void }) {
  const importarMut = useImportarCajaAndrea();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    if (!file) return;
    setError(null);
    try {
      await importarMut.mutateAsync(file);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Importar desde Excel</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          Subí el libro histórico (ej. CAJAS_JULIO-2026.xlsx) — procesa todas las hojas reconocidas (Caja General, Reserva, Cajas Guardadas, Adelantos, Caja Pollo/Jazmín/Miguel/David) y no duplica movimientos ya importados.
        </p>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-muted-foreground file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-accent file:text-xs"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        {importarMut.data && (
          <div className="text-xs bg-muted/40 rounded p-2 space-y-1">
            <p>Hojas procesadas: <strong>{importarMut.data.hojas_procesadas}</strong>{importarMut.data.hojas_omitidas.length > 0 && ` (omitidas: ${importarMut.data.hojas_omitidas.join(', ')})`}</p>
            <p>Movimientos creados: <strong>{importarMut.data.creados}</strong> · Omitidos (ya existían): <strong>{importarMut.data.omitidos}</strong></p>
            {importarMut.data.cuentas_creadas.length > 0 && <p>Cuentas nuevas: {importarMut.data.cuentas_creadas.join(', ')}</p>}
            {importarMut.data.errores.length > 0 && <p className="text-destructive">{importarMut.data.errores.join(' · ')}</p>}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
          <Button type="button" size="sm" onClick={handleImport} disabled={!file || importarMut.isPending}>
            {importarMut.isPending ? 'Importando…' : 'Importar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function CajaDelMesTab() {
  const { user } = useAuth();
  const canEdit = user?.rol === 'ADMIN' || user?.rol === 'OPERADOR';

  const hoy = new Date();
  const [mes, setMes]   = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [cuentaId, setCuentaId] = useState<number | null>(null);

  const { data: cuentas = [] } = useCuentasEmpresa();
  const cuentasEmpresa = useMemo(() => {
    const propias = cuentas.filter(c => c.evento_id === null);
    return propias.slice().sort((a, b) => {
      const ia = ORDEN_PREFERIDO.indexOf(a.nombre);
      const ib = ORDEN_PREFERIDO.indexOf(b.nombre);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.nombre.localeCompare(b.nombre);
    });
  }, [cuentas]);

  useEffect(() => {
    if (cuentaId === null && cuentasEmpresa.length > 0) setCuentaId(cuentasEmpresa[0].id);
  }, [cuentaId, cuentasEmpresa]);

  const { data: resumen, isLoading } = useResumenAndrea(cuentaId ?? 0, mes, anio);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<MovimientoCaja | null>(null);
  const [viewing, setViewing] = useState<MovimientoCaja | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="space-y-3 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-2">
          <select value={mes} onChange={e => setMes(Number(e.target.value))} className={cn(inputCls, 'w-auto')}>
            {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={anio} onChange={e => setAnio(Number(e.target.value))} className={cn(inputCls, 'w-auto')}>
            {[hoy.getFullYear() - 1, hoy.getFullYear(), hoy.getFullYear() + 1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Upload size={13} className="mr-1.5" /> Importar desde Excel</Button>
              <Button size="sm" onClick={() => { setEditing(null); setAddOpen(true); }}><Plus size={13} className="mr-1.5" /> Agregar movimiento</Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer size={13} className="mr-1.5" /> Exportar PDF</Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/rrhh?tab=sueldos-admin&subtab=liquidaciones&mes=${mes}&anio=${anio}`}>
              <ClipboardList size={13} className="mr-1.5" /> Ver liquidaciones del período
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 print:hidden">
        {cuentasEmpresa.map(c => (
          <button
            key={c.id}
            onClick={() => setCuentaId(c.id)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-t border border-b-0',
              cuentaId === c.id ? 'bg-white border-border text-foreground' : 'bg-muted/40 border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {c.nombre}
          </button>
        ))}
        {cuentasEmpresa.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">
            No hay cajas de empresa todavía. Importá el Excel o creá una desde <a href="/caja" className="text-primary hover:underline">Caja Global</a>.
          </p>
        )}
      </div>

      {cuentaId !== null && (
        isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : resumen && (
          <div className="overflow-x-auto">
            <div className="min-w-[900px] space-y-1">
              {/* Header */}
              <div className={cn('grid gap-2 items-center px-4 py-2 bg-gray-100 rounded-md', GRID_TEMPLATE)}>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Fecha</span>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Concepto</span>
                {COLUMNAS.map(c => (
                  <span key={c.key} className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-right">{c.label}</span>
                ))}
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-right">Saldo</span>
              </div>

              {/* Saldo anterior */}
              <div className={cn('grid gap-2 items-center px-4 py-3 bg-[#F9FAFB] rounded-lg italic text-sm text-muted-foreground', GRID_TEMPLATE)}>
                <span>—</span>
                <span>📋 SALDO ANTERIOR</span>
                {COLUMNAS.map(c => <span key={c.key} />)}
                <span className="text-right font-medium not-italic">{formatCurrency(resumen.saldo_anterior)}</span>
              </div>

              {resumen.movimientos.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">Sin movimientos este mes.</p>
              )}

              {resumen.movimientos.map(m => {
                const col = columnaDe(m);
                const saldoPositivo = m.saldo_acumulado >= 0;
                return (
                  <div
                    key={m.id}
                    onClick={() => setViewing(m)}
                    className={cn(
                      'grid gap-2 items-center px-4 py-3 bg-white rounded-lg shadow-sm border border-gray-100 text-sm cursor-pointer',
                      'hover:shadow-md hover:-translate-y-px transition-all duration-150',
                      GRID_TEMPLATE,
                    )}
                  >
                    <span>{m.fecha ? formatDate(m.fecha) : '—'}</span>
                    <span className="truncate" title={m.descripcion ?? undefined}>
                      <span className="mr-1.5">{iconoDe(m)}</span>{m.descripcion ?? '—'}
                    </span>
                    {COLUMNAS.map(c => {
                      const monto = c.key === 'ingreso' ? Number(m.debe) : Number(m.haber);
                      const mostrar = col === c.key && monto > 0;
                      if (!mostrar) return <span key={c.key} />;
                      if (c.key === 'ingreso') {
                        return (
                          <span key={c.key} className="text-right">
                            <span className="inline-block px-2 py-0.5 rounded bg-[#DCFCE7] text-[#16A34A] font-bold text-xs tabular-nums">
                              {formatCurrency(monto)}
                            </span>
                          </span>
                        );
                      }
                      return (
                        <span key={c.key} className="text-right text-[#991B1B] font-medium tabular-nums">
                          {formatCurrency(monto)}
                        </span>
                      );
                    })}
                    <span className={cn('text-right font-bold tabular-nums', saldoPositivo ? 'text-[#1E3A5F]' : 'text-[#DC2626]')}>
                      {formatCurrency(m.saldo_acumulado)}
                    </span>
                  </div>
                );
              })}

              {/* Totales */}
              <div className={cn('grid gap-2 items-center px-4 py-3 bg-[#1E3A5F] text-white font-bold rounded-lg', GRID_TEMPLATE)}>
                <span className="col-span-2">TOTAL DEL MES</span>
                {COLUMNAS.map(c => (
                  <span key={c.key} className="text-right tabular-nums">{formatCurrency(resumen.totales[c.key])}</span>
                ))}
                <span className={cn(
                  'text-right tabular-nums px-1.5 py-0.5 rounded',
                  resumen.totales.saldo_final > 0 ? 'bg-[#DCFCE7] text-[#16A34A]'
                    : resumen.totales.saldo_final < 0 ? 'bg-[#FEE2E2] text-[#DC2626]'
                    : 'bg-gray-100 text-gray-500',
                )}>
                  {formatCurrency(resumen.totales.saldo_final)}
                </span>
              </div>
            </div>
          </div>
        )
      )}

      {addOpen && cuentaId !== null && <MovimientoDialog cuentaId={cuentaId} editing={null} onClose={() => setAddOpen(false)} />}
      {editing && <MovimientoDialog cuentaId={editing.cuenta_id} editing={editing} onClose={() => setEditing(null)} />}
      {viewing && (
        <MovimientoDrawer
          movimiento={viewing}
          canEdit={canEdit}
          onClose={() => setViewing(null)}
          onEdit={() => { setEditing(viewing); setViewing(null); }}
        />
      )}
      {importOpen && <ImportarExcelDialog onClose={() => setImportOpen(false)} />}
    </div>
  );
}
