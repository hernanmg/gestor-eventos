import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTabConfig, useUpdateTab } from '@/hooks/useTabConfig';
import { useUsuarios, useCreateUsuario, useUpdateUsuario, useDeleteUsuario } from '@/hooks/useUsuarios';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TabConfig, Usuario, Rol } from '@/types';

// ── Tab name inline editing ───────────────────────────────────────────────────

function TabsSection() {
  const { data: tabs = [] } = useTabConfig();
  const updateTab           = useUpdateTab();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = (tab: TabConfig) => { setEditingId(tab.id); setEditValue(tab.nombre); };
  const cancelEdit = () => setEditingId(null);

  const saveEdit = () => {
    if (!editingId || !editValue.trim()) { cancelEdit(); return; }
    updateTab.mutate({ id: editingId, nombre: editValue.trim() });
    cancelEdit();
  };

  const egresoTabs  = tabs.filter(t => t.tipo === 'EGRESO');
  const ingresoTabs = tabs.filter(t => t.tipo === 'INGRESO');

  const renderGroup = (title: string, group: TabConfig[]) => (
    <div>
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-32">Código</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Nombre</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {group.map(tab => (
              <tr key={tab.id} className="group">
                <td className="px-3 py-2">
                  <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded font-mono">
                    {tab.codigo}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {editingId === tab.id ? (
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
                    <div className="flex items-center justify-between">
                      <span>{tab.nombre}</span>
                      <button
                        onClick={() => startEdit(tab)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition"
                        title="Editar nombre"
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {renderGroup('Egresos', egresoTabs)}
      {renderGroup('Ingresos', ingresoTabs)}
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

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing,    setEditing]    = useState<Usuario | null>(null);

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

  const openNew  = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (u: Usuario) => { setEditing(u); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); };

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
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Nombre</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Email</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Rol</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Activo</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {usuarios.map(u => {
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id} className={cn(!u.activo && 'opacity-60')}>
                  <td className="px-3 py-2.5 font-medium">{u.nombre}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{u.email}</td>
                  <td className="px-3 py-2.5">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ROL_CLASS[u.rol])}>
                      {ROL_LABEL[u.rol]}
                    </span>
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
  if (user.rol !== 'ADMIN') return <Navigate to="/eventos" replace />;

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
