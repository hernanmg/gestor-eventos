import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Filter, X, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  useCuentasCorrientes,
  useCuentaCorriente,
  useCreateCuentaCorriente,
  useUpdateCuentaCorriente,
  type CuentaCorrienteFiltros,
  type CuentaCorrientePayload,
  type ParteInput,
} from '@/hooks/useCuentasCorrientes';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ProveedorCombobox from '@/components/domain/ProveedorCombobox';
import CuitInput from '@/components/ui/CuitInput';
import type { CuentaCorriente, TipoTercero, MonedaCCC, ProveedorBusqueda } from '@/types';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

const TIPO_TERCERO_LABEL: Record<TipoTercero, string> = {
  PROVEEDOR: 'Proveedor',
  CLIENTE:   'Cliente',
  SOCIO:     'Socio',
  CLUB:      'Club',
  OTRO:      'Otro',
};

const selectCls = 'border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';
const inputCls  = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls  = 'block text-xs font-medium text-muted-foreground mb-0.5';

const PARTE_VACIA: ParteInput = { nombre: '', porcentaje: 0 };

// Estado en blanco del form — usado tanto para "nueva cuenta" como para
// resetear el form al cambiar de fila en modo edición (useEffect + reset,
// mismo patrón que DatosEmpresaSection en ConfiguracionEmpresa/index.tsx).
interface FormState {
  nombre:         string;
  tipoTercero:    TipoTercero;
  proveedor:      ProveedorBusqueda | null;
  terceroNombre:  string;
  terceroCuit:    string;
  moneda:         MonedaCCC;
  descripcion:    string;
  tieneReparto:   boolean;
  partes:         ParteInput[];
}

const FORM_VACIO: FormState = {
  nombre: '', tipoTercero: 'PROVEEDOR', proveedor: null, terceroNombre: '', terceroCuit: '',
  moneda: 'ARS', descripcion: '', tieneReparto: false, partes: [PARTE_VACIA],
};

function formFromCuenta(c: CuentaCorriente): FormState {
  return {
    nombre:        c.nombre,
    tipoTercero:   c.tipo_tercero,
    proveedor:     c.proveedor ? { id: c.proveedor.id, nombre: c.proveedor.nombre, alias: null, cuit: c.proveedor.cuit ?? null, categoria: null } : null,
    terceroNombre: c.tercero_nombre ?? '',
    terceroCuit:   c.tercero_cuit ?? '',
    moneda:        c.moneda,
    descripcion:   c.descripcion ?? '',
    tieneReparto:  c.tiene_reparto,
    partes:        c.tiene_reparto && c.partes && c.partes.length > 0
      ? c.partes.map(p => ({ nombre: p.nombre, porcentaje: p.porcentaje }))
      : [PARTE_VACIA],
  };
}

// ── Fila ──────────────────────────────────────────────────────────────────────

function FilaCuenta({ c, onEdit }: { c: CuentaCorriente; onEdit: (id: number) => void }) {
  const terceroNombre = c.proveedor?.nombre ?? c.tercero_nombre ?? '—';
  const positivo = c.saldo_actual >= 0;
  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/30 text-sm transition-colors">
      <td className="py-2.5 px-3">
        <Link to={`/cuentas-corrientes/${c.id}`} className="font-medium hover:underline text-primary">
          {c.nombre}
        </Link>
      </td>
      <td className="py-2.5 px-3 text-muted-foreground">{terceroNombre}</td>
      <td className="py-2.5 px-3">
        <span className="inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 bg-secondary text-secondary-foreground">
          {TIPO_TERCERO_LABEL[c.tipo_tercero]}
        </span>
      </td>
      <td className="py-2.5 px-3 text-muted-foreground">{c.moneda}</td>
      <td className="py-2.5 px-3">
        <span className={cn('font-semibold', positivo ? 'text-green-700' : 'text-red-600')}>
          {formatCurrency(c.saldo_actual, c.moneda)}
        </span>
      </td>
      <td className="py-2.5 px-3 text-xs text-muted-foreground">
        {c.ultimo_movimiento
          ? `${format(new Date(c.ultimo_movimiento.fecha), 'dd/MM/yyyy', { locale: es })} — ${c.ultimo_movimiento.concepto}`
          : 'Sin movimientos'}
      </td>
      <td className="py-2.5 px-3 text-right">
        <button onClick={() => onEdit(c.id)} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground" title="Editar cuenta">
          <Pencil size={14} />
        </button>
      </td>
    </tr>
  );
}

// ── Dialog crear/editar ───────────────────────────────────────────────────────
// cuentaId === null → alta. cuentaId numérico → edición, precarga vía
// useCuentaCorriente (incluye partes, que la lista no trae) y sincroniza el
// form con useEffect cuando llega la respuesta.

function CuentaFormDialog({ cuentaId, onClose }: { cuentaId: number | null; onClose: () => void }) {
  const esEdicion = cuentaId !== null;
  const { data: cuentaExistente, isLoading: cargandoCuenta } = useCuentaCorriente(cuentaId ?? -1);

  const [form, setForm]   = useState<FormState>(FORM_VACIO);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (esEdicion && cuentaExistente) {
      setForm(formFromCuenta(cuentaExistente));
    } else if (!esEdicion) {
      setForm(FORM_VACIO);
    }
  }, [esEdicion, cuentaExistente?.id]);

  const createMut = useCreateCuentaCorriente();
  const updateMut = useUpdateCuentaCorriente(cuentaId ?? -1);
  const pending    = createMut.isPending || updateMut.isPending;
  const navigate   = useNavigate();

  const sumaPorcentajes = form.partes.reduce((s, p) => s + (Number(p.porcentaje) || 0), 0);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = async () => {
    setError(null);
    if (!form.nombre.trim())                              { setError('El nombre es obligatorio'); return; }
    if (form.tipoTercero === 'PROVEEDOR' && !form.proveedor) { setError('Seleccioná un proveedor'); return; }
    if (form.tipoTercero !== 'PROVEEDOR' && !form.terceroNombre.trim()) { setError('El nombre del tercero es obligatorio'); return; }
    if (form.tieneReparto && Math.abs(sumaPorcentajes - 100) > 0.01) {
      setError(`La suma de porcentajes debe ser 100 (actual: ${sumaPorcentajes})`); return;
    }

    const payload: CuentaCorrientePayload = {
      nombre:         form.nombre.trim(),
      tipo_tercero:   form.tipoTercero,
      proveedor_id:   form.tipoTercero === 'PROVEEDOR' ? form.proveedor!.id : undefined,
      tercero_nombre: form.tipoTercero !== 'PROVEEDOR' ? form.terceroNombre.trim() : undefined,
      tercero_cuit:   form.terceroCuit.trim() || undefined,
      moneda:         form.moneda,
      descripcion:    form.descripcion.trim() || undefined,
      tiene_reparto:  form.tieneReparto,
      partes:         form.tieneReparto ? form.partes.filter(p => p.nombre.trim()) : undefined,
    };

    try {
      if (esEdicion) {
        await updateMut.mutateAsync(payload);
        onClose();
      } else {
        const cuenta = await createMut.mutateAsync(payload);
        onClose();
        navigate(`/cuentas-corrientes/${cuenta.id}`);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error ?? `Error al ${esEdicion ? 'editar' : 'crear'} la cuenta corriente`);
    }
  };

  if (esEdicion && cargandoCuenta) {
    return <p className="text-sm text-muted-foreground p-4">Cargando cuenta…</p>;
  }

  return (
    <div className="space-y-4">
      <DialogTitle>{esEdicion ? 'Editar cuenta corriente' : 'Nueva cuenta corriente'}</DialogTitle>

      <div className="space-y-3">
        <div>
          <label className={labelCls}>Nombre *</label>
          <input value={form.nombre} onChange={e => setField('nombre', e.target.value)} placeholder="Cta Cte Airasca" className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Tipo de tercero *</label>
          <select value={form.tipoTercero} onChange={e => setField('tipoTercero', e.target.value as TipoTercero)} className={cn(selectCls, 'w-full')}>
            {Object.entries(TIPO_TERCERO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {form.tipoTercero === 'PROVEEDOR' ? (
          <div>
            <label className={labelCls}>Proveedor *</label>
            <div className="border border-input rounded px-1 py-1">
              <ProveedorCombobox value={form.proveedor} onChange={v => setField('proveedor', v)} className="w-full" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nombre del tercero *</label>
              <input value={form.terceroNombre} onChange={e => setField('terceroNombre', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>CUIT</label>
              <CuitInput value={form.terceroCuit} onChange={v => setField('terceroCuit', v)} className={inputCls} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Moneda</label>
            <select value={form.moneda} onChange={e => setField('moneda', e.target.value as MonedaCCC)} className={cn(selectCls, 'w-full')}>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Descripción</label>
            <input value={form.descripcion} onChange={e => setField('descripcion', e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="border-t border-border pt-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.tieneReparto} onChange={e => setField('tieneReparto', e.target.checked)} />
            ¿Tiene reparto entre partes?
          </label>

          {form.tieneReparto && (
            <div className="mt-2 space-y-2">
              {form.partes.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={p.nombre}
                    onChange={e => setField('partes', form.partes.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))}
                    placeholder="Nombre de la parte"
                    className={cn(inputCls, 'flex-1')}
                  />
                  <input
                    type="number"
                    value={p.porcentaje || ''}
                    onChange={e => setField('partes', form.partes.map((x, j) => j === i ? { ...x, porcentaje: Number(e.target.value) } : x))}
                    placeholder="%"
                    className={cn(inputCls, 'w-20')}
                  />
                  {form.partes.length > 1 && (
                    <button onClick={() => setField('partes', form.partes.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setField('partes', [...form.partes, PARTE_VACIA])}
                className="text-xs text-primary hover:underline"
              >
                + Agregar parte
              </button>
              <p className={cn('text-xs', Math.abs(sumaPorcentajes - 100) < 0.01 ? 'text-green-700' : 'text-muted-foreground')}>
                Suma actual: {sumaPorcentajes}% {Math.abs(sumaPorcentajes - 100) < 0.01 ? '✓' : '(debe ser 100%)'}
              </p>
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>Cancelar</Button>
        <Button size="sm" onClick={handleSubmit} disabled={pending}>
          {pending ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear cuenta'}
        </Button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CuentasCorrientesPage() {
  const [filtros, setFiltros]       = useState<CuentaCorrienteFiltros>({ activa: 'true' });
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId]   = useState<number | null>(null);
  const { data: cuentas = [], isLoading } = useCuentasCorrientes(filtros);

  const dialogOpen = showCreate || editingId !== null;
  const closeDialog = () => { setShowCreate(false); setEditingId(null); };

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Cuentas Corrientes</h1>
          <p className="text-sm text-muted-foreground">Saldos con terceros — clubes, proveedores especiales, socios</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={14} className="mr-1.5" /> Nueva cuenta corriente
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select value={filtros.tipo_tercero ?? ''} onChange={e => setFiltros(f => ({ ...f, tipo_tercero: e.target.value as TipoTercero || undefined }))} className={selectCls}>
          <option value="">Todos los tipos</option>
          {Object.entries(TIPO_TERCERO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filtros.moneda ?? ''} onChange={e => setFiltros(f => ({ ...f, moneda: e.target.value as MonedaCCC || undefined }))} className={selectCls}>
          <option value="">Todas las monedas</option>
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
        <select value={filtros.activa ?? ''} onChange={e => setFiltros(f => ({ ...f, activa: (e.target.value as 'true' | 'false') || undefined }))} className={selectCls}>
          <option value="true">Activas</option>
          <option value="false">Inactivas</option>
          <option value="">Todas</option>
        </select>
        {(filtros.tipo_tercero || filtros.moneda || filtros.activa !== 'true') && (
          <button onClick={() => setFiltros({ activa: 'true' })} className="text-xs text-muted-foreground hover:text-foreground">
            <Filter size={12} className="inline mr-1" /> Limpiar
          </button>
        )}
      </div>

      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        {isLoading ? (
          <p className="text-sm text-muted-foreground p-6">Cargando…</p>
        ) : cuentas.length === 0 ? (
          <p className="text-sm text-muted-foreground p-6">Sin cuentas corrientes.</p>
        ) : (
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground bg-muted/30">
                <th className="text-left py-2.5 px-3 font-medium">Nombre</th>
                <th className="text-left py-2.5 px-3 font-medium">Tercero</th>
                <th className="text-left py-2.5 px-3 font-medium">Tipo</th>
                <th className="text-left py-2.5 px-3 font-medium">Moneda</th>
                <th className="text-left py-2.5 px-3 font-medium">Saldo actual</th>
                <th className="text-left py-2.5 px-3 font-medium">Último movimiento</th>
                <th className="py-2.5 px-3" />
              </tr>
            </thead>
            <tbody>
              {cuentas.map(c => <FilaCuenta key={c.id} c={c} onEdit={setEditingId} />)}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-lg">
          {dialogOpen && <CuentaFormDialog cuentaId={editingId} onClose={closeDialog} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
