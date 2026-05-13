import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2, Plus, ToggleLeft, ToggleRight, ChevronDown, ChevronRight, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  useAllTabs, useUpdateTab, useCreateTab, useDeleteTab, useReorderTabs, useToggleTab,
} from '@/hooks/useTabConfig';
import { useUsuarios, useCreateUsuario, useUpdateUsuario, useDeleteUsuario } from '@/hooks/useUsuarios';
import { useEventoAccesos, useCreateAcceso, useUpdateAcceso, useDeleteAcceso } from '@/hooks/useEventoAccesos';
import { useEventos } from '@/hooks/useEvento';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TabConfig, Tipo, Usuario, Rol } from '@/types';

// ── Sortable tab row ──────────────────────────────────────────────────────────

function SortableTabRow({
  tab, onToggle, onDelete,
}: {
  tab:      TabConfig;
  onToggle: (tab: TabConfig) => void;
  onDelete: (tab: TabConfig) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(tab.nombre);
  const updateTab = useUpdateTab();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id });

  const style = {
    transform:  CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0.5 : 1,
    zIndex:     isDragging ? 1 : undefined,
  };

  const startEdit  = () => { setEditValue(tab.nombre); setIsEditing(true); };
  const cancelEdit = () => setIsEditing(false);
  const saveEdit   = () => {
    const v = editValue.trim();
    if (v && v !== tab.nombre) updateTab.mutate({ id: tab.id, nombre: v });
    setIsEditing(false);
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn('group', !tab.activo && 'opacity-50 bg-gray-50/50')}
    >
      <td className="px-2 py-2 w-8">
        <span
          {...attributes}
          {...listeners}
          className="flex items-center justify-center cursor-grab text-muted-foreground hover:text-foreground p-0.5 rounded"
          title="Arrastrar para reordenar"
        >
          <GripVertical size={14} />
        </span>
      </td>
      <td className="px-3 py-2 w-40">
        <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded font-mono">
          {tab.codigo}
        </span>
      </td>
      <td className="px-3 py-2">
        {isEditing ? (
          <input
            autoFocus
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={e => {
              if (e.key === 'Enter')  saveEdit();
              if (e.key === 'Escape') cancelEdit();
            }}
            className="w-full border border-ring rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className={cn(!tab.activo && 'line-through text-muted-foreground')}>
              {tab.nombre}
            </span>
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={startEdit}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition"
                title="Editar nombre"
              >
                <Pencil size={13} />
              </button>
              {!tab.es_sistema && (
                <>
                  <button
                    onClick={() => onToggle(tab)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition"
                    title={tab.activo ? 'Desactivar' : 'Activar'}
                  >
                    {tab.activo
                      ? <ToggleRight size={16} className="text-primary" />
                      : <ToggleLeft size={16} />
                    }
                  </button>
                  <button
                    onClick={() => onDelete(tab)}
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                    title="Eliminar"
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Draggable group ───────────────────────────────────────────────────────────

function DraggableTipGroup({
  title, tipo, tabs,
}: {
  title: string;
  tipo:  Tipo;
  tabs:  TabConfig[];
}) {
  const [items, setItems] = useState<TabConfig[]>(tabs);
  const reorderTabs = useReorderTabs();
  const toggleTab   = useToggleTab();
  const deleteTab   = useDeleteTab();

  useEffect(() => setItems(tabs), [tabs]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex(t => t.id === active.id);
    const newIndex = items.findIndex(t => t.id === over.id);
    const newItems = arrayMove(items, oldIndex, newIndex);
    setItems(newItems);
    reorderTabs.mutate({ tipo, orden: newItems.map((t, i) => ({ id: t.id, orden: i + 1 })) });
  };

  const handleToggle = (tab: TabConfig) => toggleTab.mutate(tab.id);

  const handleDelete = (tab: TabConfig) => {
    if (!window.confirm(`¿Eliminar la pestaña "${tab.nombre}"?`)) return;
    deleteTab.mutate(tab.id);
  };

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-border">
                <tr>
                  <th className="px-2 py-2 w-8" />
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-40">Código</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Nombre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map(tab => (
                  <SortableTabRow
                    key={tab.id}
                    tab={tab}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

// ── Tabs section ──────────────────────────────────────────────────────────────

function TabsSection() {
  const { data: tabs = [] } = useAllTabs();
  const createTab = useCreateTab();

  const [addDialog, setAddDialog] = useState<{ open: boolean; tipo: Tipo }>({ open: false, tipo: 'EGRESO' });
  const [addNombre, setAddNombre] = useState('');

  const egresoTabs  = [...tabs.filter(t => t.tipo === 'EGRESO')].sort((a, b) => a.orden - b.orden);
  const ingresoTabs = [...tabs.filter(t => t.tipo === 'INGRESO')].sort((a, b) => a.orden - b.orden);

  const openAdd  = (tipo: Tipo) => { setAddNombre(''); setAddDialog({ open: true, tipo }); };
  const closeAdd = () => setAddDialog(p => ({ ...p, open: false }));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addNombre.trim()) return;
    await createTab.mutateAsync({ tipo: addDialog.tipo, nombre: addNombre.trim() });
    closeAdd();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <p className="text-xs text-muted-foreground max-w-md">
          Las pestañas del sistema no se pueden eliminar ni desactivar.
          Arrastrá las filas para reordenar. Las pestañas inactivas no aceptan nuevos movimientos.
        </p>
        <div className="flex gap-2 flex-shrink-0">
          <Button size="sm" variant="outline" onClick={() => openAdd('EGRESO')}>
            <Plus size={14} className="mr-1" /> Egreso
          </Button>
          <Button size="sm" variant="outline" onClick={() => openAdd('INGRESO')}>
            <Plus size={14} className="mr-1" /> Ingreso
          </Button>
        </div>
      </div>

      <DraggableTipGroup title="Egresos"  tipo="EGRESO"  tabs={egresoTabs} />
      <DraggableTipGroup title="Ingresos" tipo="INGRESO" tabs={ingresoTabs} />

      <Dialog open={addDialog.open} onOpenChange={open => !open && closeAdd()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Nueva pestaña de {addDialog.tipo === 'EGRESO' ? 'egresos' : 'ingresos'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-3 mt-1">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-0.5">Nombre *</label>
              <input
                autoFocus
                value={addNombre}
                onChange={e => setAddNombre(e.target.value)}
                className="w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={closeAdd}>Cancelar</Button>
              <Button type="submit" size="sm" disabled={createTab.isPending}>
                {createTab.isPending ? 'Creando…' : 'Crear'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Usuario form dialog ───────────────────────────────────────────────────────

interface UsuarioFormData {
  nombre:   string;
  email:    string;
  password: string;
  rol:      Rol;
}

const EMPTY_FORM: UsuarioFormData = { nombre: '', email: '', password: '', rol: 'OPERADOR' };

function UsuarioDialog({
  open, usuario, isSelf, onClose,
  onCreate, onUpdate, isLoading,
}: {
  open:      boolean;
  usuario:   Usuario | null;
  isSelf:    boolean;
  onClose:   () => void;
  onCreate:  (d: UsuarioFormData) => Promise<void>;
  onUpdate:  (id: number, d: Partial<UsuarioFormData>) => Promise<void>;
  isLoading: boolean;
}) {
  const isEdit = usuario !== null;
  const [form,  setForm]  = useState<UsuarioFormData>(() =>
    usuario ? { nombre: usuario.nombre, email: usuario.email, password: '', rol: usuario.rol } : EMPTY_FORM,
  );
  const [error, setError] = useState<string | null>(null);

  const f = (key: keyof UsuarioFormData) => ({
    value:    form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value })),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (isEdit) {
        const patch: Partial<UsuarioFormData> = {};
        if (form.nombre   !== usuario!.nombre) patch.nombre   = form.nombre;
        if (form.email    !== usuario!.email)  patch.email    = form.email;
        if (form.password)                     patch.password = form.password;
        if (!isSelf && form.rol !== usuario!.rol) patch.rol   = form.rol;
        await onUpdate(usuario!.id, patch);
      } else {
        await onCreate(form);
      }
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Error al guardar');
    }
  };

  const handleChange = (open: boolean) => { if (!open) onClose(); };

  const inputCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
  const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

  return (
    <Dialog open={open} onOpenChange={handleChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div>
            <label className={labelCls}>Nombre *</label>
            <input {...f('nombre')} className={inputCls} required />
          </div>
          <div>
            <label className={labelCls}>Email *</label>
            <input type="email" {...f('email')} className={inputCls} required />
          </div>
          <div>
            <label className={labelCls}>{isEdit ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}</label>
            <input
              type="password"
              {...f('password')}
              className={inputCls}
              minLength={8}
              required={!isEdit}
            />
          </div>
          {!isSelf && (
            <div>
              <label className={labelCls}>Rol</label>
              <select {...f('rol')} className={inputCls}>
                <option value="VIEWER">Visualizador</option>
                <option value="OPERADOR">Operador</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={isLoading}>
              {isLoading ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Acceso panel ─────────────────────────────────────────────────────────────

const ROL_ACCESO_OPTS: { value: Rol; label: string }[] = [
  { value: 'VIEWER',   label: 'Visualizador' },
  { value: 'OPERADOR', label: 'Operador' },
];

function AccesoPanel({ usuarioId }: { usuarioId: number }) {
  const { data: accesos = [], isLoading } = useEventoAccesos(usuarioId);
  const { data: eventos = [] }            = useEventos();
  const createAcceso = useCreateAcceso(usuarioId);
  const updateAcceso = useUpdateAcceso(usuarioId);
  const deleteAcceso = useDeleteAcceso(usuarioId);

  const [newEventoId, setNewEventoId] = useState<number | ''>('');
  const [newRol,      setNewRol]      = useState<Rol>('VIEWER');

  const existingIds = new Set(accesos.map(a => a.evento_id));
  const disponibles = eventos.filter(e => !existingIds.has(e.id));

  const handleAdd = async () => {
    if (!newEventoId) return;
    await createAcceso.mutateAsync({ eventoId: Number(newEventoId), rol: newRol });
    setNewEventoId('');
  };

  if (isLoading) return <p className="text-xs text-muted-foreground py-2">Cargando accesos...</p>;

  return (
    <div className="space-y-2 py-2 px-1">
      {accesos.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin accesos asignados a eventos específicos.</p>
      ) : (
        <div className="space-y-1">
          {accesos.map(a => (
            <div key={a.id} className="flex items-center gap-2 text-xs">
              <span className="flex-1 truncate font-medium">{a.evento?.nombre ?? `Evento #${a.evento_id}`}</span>
              <select
                value={a.rol}
                onChange={e => updateAcceso.mutate({ eventoId: a.evento_id, rol: e.target.value as Rol })}
                className="border rounded px-1 py-0.5 text-xs"
              >
                {ROL_ACCESO_OPTS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <button
                onClick={() => deleteAcceso.mutate(a.evento_id)}
                className="text-destructive hover:bg-destructive/10 rounded p-0.5"
                title="Revocar acceso"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {disponibles.length > 0 && (
        <div className="flex items-center gap-2 pt-1 border-t">
          <select
            value={newEventoId}
            onChange={e => setNewEventoId(e.target.value ? Number(e.target.value) : '')}
            className="flex-1 border rounded px-1.5 py-1 text-xs"
          >
            <option value="">Agregar evento...</option>
            {disponibles.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
          <select
            value={newRol}
            onChange={e => setNewRol(e.target.value as Rol)}
            className="border rounded px-1.5 py-1 text-xs"
          >
            {ROL_ACCESO_OPTS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={!newEventoId || createAcceso.isPending}
            className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          >
            Agregar
          </button>
        </div>
      )}
    </div>
  );
}

// ── Usuarios section ──────────────────────────────────────────────────────────

const ROL_LABEL: Record<Rol, string> = {
  ADMIN:    'Admin',
  OPERADOR: 'Operador',
  VIEWER:   'Visualizador',
};

const ROL_CLASS: Record<Rol, string> = {
  ADMIN:    'bg-purple-50 text-purple-700',
  OPERADOR: 'bg-blue-50 text-blue-700',
  VIEWER:   'bg-gray-100 text-gray-600',
};

function UsuariosSection({ currentUserId }: { currentUserId: number }) {
  const { data: usuarios = [], isLoading } = useUsuarios();
  const createUsuario = useCreateUsuario();
  const updateUsuario = useUpdateUsuario();
  const deleteUsuario = useDeleteUsuario();

  const [dialogOpen, setDialogOpen]     = useState(false);
  const [editing,    setEditing]        = useState<Usuario | null>(null);
  const [expandedId, setExpandedId]     = useState<number | null>(null);

  const handleCreate = async (data: UsuarioFormData) => {
    await createUsuario.mutateAsync(data);
  };

  const handleUpdate = async (id: number, data: Partial<UsuarioFormData>) => {
    await updateUsuario.mutateAsync({ id, data });
  };

  const handleDelete = (u: Usuario) => {
    if (!window.confirm(`¿Eliminar al usuario ${u.nombre}?`)) return;
    deleteUsuario.mutate(u.id);
  };

  const handleToggleActivo = (u: Usuario) => {
    updateUsuario.mutate({ id: u.id, data: { activo: !u.activo } });
  };

  const openNew     = () => { setEditing(null); setDialogOpen(true); };
  const openEdit    = (u: Usuario) => { setEditing(u); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); };
  const toggleExpand = (id: number) => setExpandedId(p => p === id ? null : id);

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando usuarios...</p>;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={openNew}>
          <Plus size={14} className="mr-1.5" />
          Nuevo usuario
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-border">
            <tr>
              <th className="px-3 py-2 w-6" />
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Nombre</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Email</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Rol</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Accesos</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Activo</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {usuarios.map(u => {
              const isSelf    = u.id === currentUserId;
              const isExpanded = expandedId === u.id;
              return (
                <>
                  <tr key={u.id} className={cn(!u.activo && 'opacity-60', 'hover:bg-muted/20')}>
                    <td className="px-3 py-2.5">
                      {u.rol !== 'ADMIN' && (
                        <button
                          onClick={() => toggleExpand(u.id)}
                          className="text-muted-foreground hover:text-foreground"
                          title="Gestionar accesos a eventos"
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-medium">{u.nombre}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{u.email}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ROL_CLASS[u.rol])}>
                        {ROL_LABEL[u.rol]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {u.rol === 'ADMIN' ? (
                        <span className="flex items-center gap-1 text-xs text-purple-600">
                          <Shield size={12} />
                          Acceso total
                        </span>
                      ) : (
                        <button
                          onClick={() => toggleExpand(u.id)}
                          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                        >
                          Gestionar accesos
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => !isSelf && handleToggleActivo(u)}
                        disabled={isSelf}
                        className={cn(
                          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                          u.activo ? 'bg-primary' : 'bg-gray-200',
                          isSelf && 'cursor-not-allowed opacity-50',
                        )}
                        title={isSelf ? 'No podés desactivarte a vos mismo' : u.activo ? 'Desactivar' : 'Activar'}
                      >
                        <span className={cn(
                          'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
                          u.activo ? 'translate-x-4' : 'translate-x-0.5',
                        )} />
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Editar">
                          <Pencil size={14} />
                        </Button>
                        {!isSelf && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(u)}
                            className="text-destructive hover:text-destructive"
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && u.rol !== 'ADMIN' && (
                    <tr key={`${u.id}-accesos`} className="bg-muted/10">
                      <td colSpan={7} className="px-6 pb-3 pt-1">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Accesos por evento para {u.nombre}
                        </p>
                        <AccesoPanel usuarioId={u.id} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <UsuarioDialog
        open={dialogOpen}
        usuario={editing}
        isSelf={editing?.id === currentUserId}
        onClose={closeDialog}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        isLoading={createUsuario.isPending || updateUsuario.isPending}
      />
    </div>
  );
}

// ── ConfiguracionPage ─────────────────────────────────────────────────────────

type ActiveTab = 'tabs' | 'usuarios';

export default function ConfiguracionPage() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.rol !== 'ADMIN') return <Navigate to="/dashboard" replace />;

  const [activeTab, setActiveTab] = useState<ActiveTab>('tabs');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-foreground mb-6">Configuración</h1>

      <div className="flex border-b border-border mb-6">
        {([
          { key: 'tabs',     label: 'Pestañas del sistema' },
          { key: 'usuarios', label: 'Usuarios' },
        ] as { key: ActiveTab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'tabs'     && <TabsSection />}
      {activeTab === 'usuarios' && <UsuariosSection currentUserId={user.id} />}
    </div>
  );
}
