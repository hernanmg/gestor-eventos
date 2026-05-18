import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, AlertTriangle, Plus, Search, ChevronRight, X } from 'lucide-react';
import { useProductos, useCreateProducto, useUpdateProducto, useAlertasStock, useSugerencias, useCategoriasStock } from '@/hooks/useStock';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Producto, AlertaStock, SugerenciaStock, CategoriaStock } from '@/types';

// ── Badge helpers ─────────────────────────────────────────────────────────────

function DisponibleBadge({ disponible, minimo }: { disponible: number; minimo: number }) {
  if (disponible < minimo) {
    return <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-800">QUIEBRE</span>;
  }
  if (disponible <= minimo * 1.2) {
    return <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-yellow-100 text-yellow-800">RIESGO</span>;
  }
  return null;
}

// ── Producto Form Dialog ──────────────────────────────────────────────────────

function CategoriaBadge({ categoria }: { categoria: CategoriaStock | null | undefined }) {
  if (!categoria) return <span className="text-xs text-muted-foreground">-</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: categoria.color ?? '#6B7280' }}
      />
      {categoria.nombre}
    </span>
  );
}

interface ProductoFormData {
  nombre:       string;
  descripcion:  string;
  categoria_id: number | '';
  codigo:       string;
  stock_total:  number;
  stock_minimo: number;
  unidad:       string;
  notas:        string;
}

const EMPTY: ProductoFormData = {
  nombre: '', descripcion: '', categoria_id: '', codigo: '',
  stock_total: 0, stock_minimo: 0, unidad: 'unidad', notas: '',
};

function ProductoDialog({
  open, producto, onClose,
}: {
  open:     boolean;
  producto: Producto | null;
  onClose:  () => void;
}) {
  const isEdit         = !!producto;
  const createProducto = useCreateProducto();
  const updateProducto = useUpdateProducto();
  const { data: categorias = [] } = useCategoriasStock();

  const [form, setForm]   = useState<ProductoFormData>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(producto
      ? {
          nombre:       producto.nombre,
          descripcion:  producto.descripcion ?? '',
          categoria_id: producto.categoria_id ?? '',
          codigo:       producto.codigo     ?? '',
          stock_total:  producto.stock_total,
          stock_minimo: producto.stock_minimo,
          unidad:       producto.unidad,
          notas:        producto.notas ?? '',
        }
      : EMPTY,
    );
    setError(null);
  }, [producto, open]);

  const inputCls = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
  const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload = {
      nombre:       form.nombre       || undefined,
      descripcion:  form.descripcion  || null,
      categoria_id: form.categoria_id !== '' ? Number(form.categoria_id) : null,
      codigo:       form.codigo       || null,
      stock_total:  form.stock_total,
      stock_minimo: form.stock_minimo,
      unidad:       form.unidad       || 'unidad',
      notas:        form.notas        || null,
    };
    try {
      if (isEdit) {
        await updateProducto.mutateAsync({ id: producto!.id, data: payload });
      } else {
        await createProducto.mutateAsync(payload);
      }
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Error al guardar');
    }
  };

  const activeCats = categorias.filter(c => c.activo);

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Nombre *</label>
              <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Código</label>
              <input value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Categoría</label>
              <select
                value={form.categoria_id}
                onChange={e => setForm(p => ({ ...p, categoria_id: e.target.value === '' ? '' : Number(e.target.value) }))}
                className={inputCls}
              >
                <option value="">Sin categoría</option>
                {activeCats.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
              {activeCats.length === 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  No hay categorías activas.{' '}
                  <a href="/configuracion" className="text-primary underline">Crear categoría</a>
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>Stock total *</label>
              <input type="number" min={0} value={form.stock_total} onChange={e => setForm(p => ({ ...p, stock_total: Number(e.target.value) }))} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Stock mínimo</label>
              <input type="number" min={0} value={form.stock_minimo} onChange={e => setForm(p => ({ ...p, stock_minimo: Number(e.target.value) }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Unidad</label>
              <input value={form.unidad} onChange={e => setForm(p => ({ ...p, unidad: e.target.value }))} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Descripción</label>
              <input value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Notas</label>
              <input value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} className={inputCls} />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={createProducto.isPending || updateProducto.isPending}>
              {createProducto.isPending || updateProducto.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Productos tab ─────────────────────────────────────────────────────────────

function ProductosTab() {
  const navigate = useNavigate();
  const [search,       setSearch]       = useState('');
  const [categoriaId,  setCategoriaId]  = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing,    setEditing]    = useState<Producto | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [search]);

  const { data: productos = [], isLoading } = useProductos({
    search:    debouncedSearch || undefined,
    categoria: categoriaId    || undefined,
  });
  const { data: categorias = [] } = useCategoriasStock();
  const activeCats = categorias.filter(c => c.activo);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Buscar por nombre, código, categoría…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border rounded"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
              <X size={12} />
            </button>
          )}
        </div>
        <select
          value={categoriaId}
          onChange={e => setCategoriaId(e.target.value)}
          className="border rounded px-2 py-1.5 text-sm"
        >
          <option value="">Todas las categorías</option>
          {activeCats.map(c => <option key={c.id} value={String(c.id)}>{c.nombre}</option>)}
        </select>
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus size={14} className="mr-1.5" /> Nuevo producto
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : productos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No se encontraron productos.</p>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Código</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Nombre</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Categoría</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Stock total</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Comprometido</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Disponible</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Mínimo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                <th className="px-3 py-2 w-6" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {productos.map(p => {
                const disp = p.disponible_hoy ?? p.stock_total;
                const comp = p.comprometido_hoy ?? 0;
                return (
                  <tr
                    key={p.id}
                    className="hover:bg-muted/20 cursor-pointer"
                    onClick={() => navigate(`/stock/productos/${p.id}`)}
                  >
                    <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">{p.codigo ?? '-'}</td>
                    <td className="px-3 py-2.5 font-medium">{p.nombre}</td>
                    <td className="px-3 py-2.5"><CategoriaBadge categoria={p.categoria} /></td>
                    <td className="px-3 py-2.5 text-right">{p.stock_total} {p.unidad}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{comp}</td>
                    <td className={cn('px-3 py-2.5 text-right font-semibold', disp < 0 ? 'text-red-600' : disp <= p.stock_minimo ? 'text-yellow-600' : 'text-green-700')}>
                      {disp}
                    </td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{p.stock_minimo}</td>
                    <td className="px-3 py-2.5">
                      <DisponibleBadge disponible={disp} minimo={p.stock_minimo} />
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      <ChevronRight size={14} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ProductoDialog
        open={dialogOpen}
        producto={editing}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
      />
    </div>
  );
}

// ── Alertas tab ───────────────────────────────────────────────────────────────

const RIESGO_CLASS: Record<string, string> = {
  BAJO:  'bg-green-100 text-green-800',
  MEDIO: 'bg-yellow-100 text-yellow-800',
  ALTO:  'bg-red-100 text-red-800',
};

function AlertaCard({ alerta }: { alerta: AlertaStock }) {
  const [showSug, setShowSug] = useState(false);
  const now = new Date().toISOString().split('T')[0];

  const { data: sugData } = useSugerencias({
    producto_id: showSug ? alerta.producto_id : undefined,
    fecha_desde: now,
    fecha_hasta: alerta.fecha_quiebre_proyectado?.split('T')[0] ?? now,
  });

  const sugerencias: SugerenciaStock[] = sugData?.sugerencias ?? [];

  return (
    <div className="rounded-lg border bg-white p-4 space-y-3">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className={alerta.tipo === 'QUIEBRE_ACTUAL' ? 'text-red-500 mt-0.5' : 'text-yellow-500 mt-0.5'} />
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{alerta.producto_nombre}</span>
            {alerta.categoria && <CategoriaBadge categoria={alerta.categoria} />}
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-bold',
              alerta.tipo === 'QUIEBRE_ACTUAL' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800',
            )}>
              {alerta.tipo === 'QUIEBRE_ACTUAL' ? 'Quiebre actual' : 'Quiebre proyectado'}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
            <span>Total: <strong className="text-foreground">{alerta.stock_total}</strong></span>
            <span>Disponible: <strong className={alerta.disponible_actual < alerta.stock_minimo ? 'text-red-600' : 'text-foreground'}>{alerta.disponible_actual}</strong></span>
            <span>Mínimo: <strong className="text-foreground">{alerta.stock_minimo}</strong></span>
            {alerta.fecha_quiebre_proyectado && (
              <span>Quiebre el: <strong className="text-yellow-700">{new Date(alerta.fecha_quiebre_proyectado).toLocaleDateString('es-AR')}</strong></span>
            )}
          </div>
        </div>
      </div>

      {alerta.eventos_comprometidos.length > 0 && (
        <div className="ml-7 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Eventos con stock comprometido:</p>
          {alerta.eventos_comprometidos.map((e, i) => (
            <div key={i} className="text-xs flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground inline-block" />
              <span className="font-medium">{e.evento_nombre}</span>
              <span className="text-muted-foreground">— {e.cantidad} u.</span>
              <span className="text-muted-foreground">{new Date(e.fecha_salida).toLocaleDateString('es-AR')}</span>
              {e.fecha_retorno && <span className="text-muted-foreground">→ {new Date(e.fecha_retorno).toLocaleDateString('es-AR')}</span>}
            </div>
          ))}
        </div>
      )}

      {alerta.sugerencias_disponibles && (
        <div className="ml-7">
          <button
            onClick={() => setShowSug(p => !p)}
            className="text-xs text-primary underline-offset-2 hover:underline"
          >
            {showSug ? 'Ocultar sugerencias' : 'Ver fuentes alternativas'}
          </button>
          {showSug && sugerencias.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {sugerencias.map(s => (
                <div key={s.asignacion_id} className="flex items-center gap-2 text-xs border rounded px-2 py-1.5">
                  <span className={cn('px-1.5 py-0.5 rounded font-medium', RIESGO_CLASS[s.riesgo])}>{s.riesgo}</span>
                  <span className="font-medium">{s.evento_origen_nombre}</span>
                  <span className="text-muted-foreground">— {s.cantidad_disponible} u.</span>
                  <span className="text-muted-foreground">{s.dias_de_margen}d margen</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AlertasTab() {
  const { data, isLoading } = useAlertasStock();
  const alertas = data?.alertas ?? [];

  const actuales    = alertas.filter(a => a.tipo === 'QUIEBRE_ACTUAL');
  const proyectadas = alertas.filter(a => a.tipo === 'QUIEBRE_PROYECTADO');

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando alertas...</p>;
  if (alertas.length === 0) return (
    <div className="text-center py-12 text-muted-foreground">
      <Package size={40} className="mx-auto mb-3 opacity-30" />
      <p className="text-sm">No hay alertas de stock actualmente.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {actuales.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-red-700">Quiebre actual ({actuales.length})</h3>
          {actuales.map(a => <AlertaCard key={a.producto_id} alerta={a} />)}
        </div>
      )}
      {proyectadas.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-yellow-700">Quiebre proyectado ({proyectadas.length})</h3>
          {proyectadas.map(a => <AlertaCard key={a.producto_id} alerta={a} />)}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type StockTab = 'productos' | 'alertas';

export default function StockPage() {
  const [tab, setTab] = useState<StockTab>('productos');
  const { data: alertasData } = useAlertasStock();
  const quiebresCount = (alertasData?.alertas ?? []).filter(a => a.tipo === 'QUIEBRE_ACTUAL').length;

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Package size={22} />
        Gestión de Stock
      </h1>

      <div className="flex border-b border-border">
        {([
          { key: 'productos', label: 'Productos' },
          { key: 'alertas',  label: `Alertas de stock${quiebresCount > 0 ? ` (${quiebresCount})` : ''}` },
        ] as { key: StockTab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'productos' && <ProductosTab />}
      {tab === 'alertas'   && <AlertasTab />}
    </div>
  );
}
