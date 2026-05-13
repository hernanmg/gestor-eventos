import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  useProveedores, useCreateProveedor, useUpdateProveedor,
  useDeleteProveedor, useToggleProveedor,
} from '@/hooks/useProveedores';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Proveedor } from '@/types';

// ── CUIT formatter ────────────────────────────────────────────────────────────

function formatCuit(cuit: string | null) {
  if (!cuit) return '—';
  return cuit;
}

// ── Proveedor form ────────────────────────────────────────────────────────────

interface FormData {
  nombre:    string;
  alias:     string;
  cuit:      string;
  categoria: string;
  notas:     string;
}

const EMPTY_FORM: FormData = { nombre: '', alias: '', cuit: '', categoria: '', notas: '' };

function ProveedorDialog({
  open, proveedor, onClose,
}: {
  open:      boolean;
  proveedor: Proveedor | null;
  onClose:   () => void;
}) {
  const isEdit = proveedor !== null;
  const [form,  setForm]  = useState<FormData>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const createProveedor = useCreateProveedor();
  const updateProveedor = useUpdateProveedor(proveedor?.id ?? 0);

  useEffect(() => {
    if (open) {
      setForm(proveedor ? {
        nombre:    proveedor.nombre,
        alias:     proveedor.alias     ?? '',
        cuit:      proveedor.cuit      ?? '',
        categoria: proveedor.categoria ?? '',
        notas:     proveedor.notas     ?? '',
      } : EMPTY_FORM);
      setError(null);
    }
  }, [open, proveedor]);

  const f = (key: keyof FormData) => ({
    value:    form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value })),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload = {
      nombre:    form.nombre.trim(),
      alias:     form.alias.trim()     || undefined,
      cuit:      form.cuit.trim()      || undefined,
      categoria: form.categoria.trim() || undefined,
      notas:     form.notas.trim()     || undefined,
    };
    try {
      if (isEdit) {
        await updateProveedor.mutateAsync(payload);
      } else {
        await createProveedor.mutateAsync(payload);
      }
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.response?.data?.detail?.cuit?.[0] ?? 'Error al guardar');
    }
  };

  const input  = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
  const label  = 'block text-xs font-medium text-muted-foreground mb-0.5';

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div>
            <label className={label}>Nombre / Razón social *</label>
            <input {...f('nombre')} className={input} required minLength={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Alias (nombre corto)</label>
              <input {...f('alias')} className={input} placeholder="Empresa" />
            </div>
            <div>
              <label className={label}>CUIT</label>
              <input {...f('cuit')} className={input} placeholder="30-12345678-9" />
            </div>
          </div>
          <div>
            <label className={label}>Categoría</label>
            <input {...f('categoria')} className={input} placeholder="Servicio, Insumo, Impuesto…" />
          </div>
          <div>
            <label className={label}>Notas</label>
            <textarea
              {...f('notas')}
              rows={2}
              className={cn(input, 'resize-none')}
              placeholder="Observaciones opcionales"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={createProveedor.isPending || updateProveedor.isPending}>
              {createProveedor.isPending || updateProveedor.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── ProveedoresPage ───────────────────────────────────────────────────────────

export default function ProveedoresPage() {
  const navigate      = useNavigate();
  const { user }      = useAuth();
  const [search,      setSearch]      = useState('');
  const [debouncedQ,  setDebouncedQ]  = useState('');
  const [categoria,   setCategoria]   = useState('');
  const [showInactivo, setShowInactivo] = useState(false);
  const [dialogOpen,  setDialogOpen]  = useState(false);
  const [editing,     setEditing]     = useState<Proveedor | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQ(search), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const { data: proveedores = [], isLoading } = useProveedores({
    q:        debouncedQ || undefined,
    categoria: categoria || undefined,
    activo:   showInactivo ? 'all' : 'true',
  });

  const deleteProveedor = useDeleteProveedor();
  const toggleProveedor = useToggleProveedor();

  // Unique categories for filter
  const categorias = [...new Set(proveedores.map(p => p.categoria).filter(Boolean) as string[])].sort();

  const handleDelete = (p: Proveedor) => {
    if (!window.confirm(`¿Eliminar a "${p.nombre}"? Esta acción no se puede deshacer.`)) return;
    deleteProveedor.mutate(p.id);
  };

  const openNew  = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (p: Proveedor) => { setEditing(p); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); };

  const th = 'px-3 py-2 text-left text-xs font-medium text-muted-foreground';
  const td = 'px-3 py-2.5 text-sm';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Proveedores</h1>
        {(user?.rol === 'ADMIN' || user?.rol === 'OPERADOR') && (
          <Button size="sm" onClick={openNew}>
            <Plus size={14} className="mr-1.5" /> Nuevo proveedor
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5 border border-input rounded px-2.5 py-1.5 bg-white">
          <Search size={13} className="text-muted-foreground shrink-0" />
          <input
            placeholder="Buscar por nombre, alias o CUIT…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-sm focus:outline-none w-56"
          />
        </div>
        <select
          value={categoria}
          onChange={e => setCategoria(e.target.value)}
          className="border border-input rounded px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={showInactivo}
            onChange={e => setShowInactivo(e.target.checked)}
            className="rounded"
          />
          Mostrar inactivos
        </label>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className={th}>Nombre</th>
                <th className={th}>Alias</th>
                <th className={th}>CUIT</th>
                <th className={th}>Categoría</th>
                <th className={th}>Estado</th>
                <th className={cn(th, 'text-right')}>Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {proveedores.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Sin proveedores.
                  </td>
                </tr>
              ) : proveedores.map(p => (
                <tr
                  key={p.id}
                  className={cn('group cursor-pointer hover:bg-accent/30 transition-colors', !p.activo && 'opacity-60')}
                  onClick={() => navigate(`/proveedores/${p.id}`)}
                >
                  <td className={cn(td, 'font-medium')}>{p.nombre}</td>
                  <td className={cn(td, 'text-muted-foreground')}>{p.alias ?? '—'}</td>
                  <td className={cn(td, 'font-mono text-xs text-muted-foreground')}>{formatCuit(p.cuit)}</td>
                  <td className={td}>
                    {p.categoria ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                        {p.categoria}
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className={td}>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      p.activo ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500',
                    )}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className={td}>
                    <div
                      className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition"
                      onClick={e => e.stopPropagation()}
                    >
                      {(user?.rol === 'ADMIN' || user?.rol === 'OPERADOR') && (
                        <>
                          <button
                            onClick={() => openEdit(p)}
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition"
                            title="Editar"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => toggleProveedor.mutate(p.id)}
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition text-xs"
                            title={p.activo ? 'Desactivar' : 'Activar'}
                          >
                            {p.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </>
                      )}
                      {user?.rol === 'ADMIN' && (
                        <button
                          onClick={() => handleDelete(p)}
                          className="p-1 rounded text-destructive hover:bg-destructive/10 transition"
                          title="Eliminar"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProveedorDialog
        open={dialogOpen}
        proveedor={editing}
        onClose={closeDialog}
      />
    </div>
  );
}
