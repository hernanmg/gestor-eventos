import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import {
  useEmpleados, useEmpleado, useCreateEmpleado, useUpdateEmpleado, useDeleteEmpleado,
  type EmpleadoPayload, type EmpleadoFiltros,
} from '@/hooks/useRRHH';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, getApiErrorMessage, getApiFieldErrors } from '@/lib/utils';
import type { Empleado, CategoriaEmpleado, EstadoEmpleado } from '@/types';

const CATEGORIA_LABEL: Record<CategoriaEmpleado, string> = {
  CAPITAN: 'Capitán', ARMADOR: 'Armador', CHOFER: 'Chofer',
  ADMINISTRATIVO: 'Administrativo', TECNICO: 'Técnico', OTRO: 'Otro',
};

const ESTADO_LABEL: Record<EstadoEmpleado, string> = { ACTIVO: 'Activo', INACTIVO: 'Inactivo', SUSPENDIDO: 'Suspendido' };
const ESTADO_VARIANT: Record<EstadoEmpleado, 'success' | 'muted' | 'destructive'> = {
  ACTIVO: 'success', INACTIVO: 'muted', SUSPENDIDO: 'destructive',
};

const inputCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

// ── Form dialog ───────────────────────────────────────────────────────────────

const EMPTY: EmpleadoPayload = {
  nombre: '', apellido: '', dni: '', cuit: '', email: '', telefono: '', domicilio: '',
  cbu: '', alias: '', banco: '', categoria: 'OTRO', valor_hora: 0, valor_hora_extra: 0, estado: 'ACTIVO', notas: '',
};

function empleadoToForm(empleado: Empleado): EmpleadoPayload {
  return {
    nombre:           empleado.nombre,
    apellido:         empleado.apellido,
    dni:              empleado.dni,
    cuit:             empleado.cuit ?? '',
    email:            empleado.email ?? '',
    telefono:         empleado.telefono ?? '',
    domicilio:        empleado.domicilio ?? '',
    cbu:              empleado.cbu ?? '',
    alias:            empleado.alias ?? '',
    banco:            empleado.banco ?? '',
    categoria:        empleado.categoria,
    valor_hora:       empleado.valor_hora,
    valor_hora_extra: empleado.valor_hora_extra,
    estado:           empleado.estado,
    notas:            empleado.notas ?? '',
  };
}

function EmpleadoDialog({ open, empleado, onClose }: { open: boolean; empleado: Empleado | null; onClose: () => void }) {
  const isEdit = !!empleado;
  const createMut = useCreateEmpleado();
  const updateMut = useUpdateEmpleado();
  const [form, setForm] = useState<EmpleadoPayload>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | null>(null);

  // Se re-ejecuta cada vez que se abre el dialog o cambia el empleado a editar —
  // el dialog queda montado entre aperturas, así que el useState inicial solo
  // corre una vez y no alcanza para precargar el formulario en edición.
  useEffect(() => {
    if (!open) return;
    setForm(empleado ? empleadoToForm(empleado) : EMPTY);
    setError(null);
    setFieldErrors(null);
  }, [open, empleado]);

  const f = (key: keyof EmpleadoPayload) => ({
    value: (form[key] ?? '') as string | number,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm(p => ({ ...p, [key]: e.target.value }));
      if (fieldErrors?.[key]) setFieldErrors(p => p && { ...p, [key]: '' });
    },
  });

  // Mensaje de error debajo del input correspondiente, si el último submit
  // devolvió un 400 con detalle por campo (validación Zod del backend).
  const fieldError = (key: keyof EmpleadoPayload) =>
    fieldErrors?.[key] ? <p className="text-xs text-destructive mt-0.5">{fieldErrors[key]}</p> : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors(null);
    const payload: EmpleadoPayload = {
      ...form,
      valor_hora:       Number(form.valor_hora) || 0,
      valor_hora_extra: Number(form.valor_hora_extra) || 0,
    };
    try {
      if (isEdit) await updateMut.mutateAsync({ id: empleado!.id, data: payload });
      else        await createMut.mutateAsync(payload);
      onClose();
    } catch (err) {
      const perField = getApiFieldErrors(err);
      if (perField) setFieldErrors(perField);
      else          setError(getApiErrorMessage(err) ?? 'Error al guardar');
    }
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{isEdit ? 'Editar empleado' : 'Nuevo empleado'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Nombre *</label><input {...f('nombre')} className={inputCls} required />{fieldError('nombre')}</div>
            <div><label className={labelCls}>Apellido *</label><input {...f('apellido')} className={inputCls} required />{fieldError('apellido')}</div>
            <div><label className={labelCls}>DNI *</label><input {...f('dni')} className={inputCls} required />{fieldError('dni')}</div>
            <div><label className={labelCls}>CUIT</label><input {...f('cuit')} className={inputCls} />{fieldError('cuit')}</div>
            <div><label className={labelCls}>Email</label><input type="email" {...f('email')} className={inputCls} />{fieldError('email')}</div>
            <div><label className={labelCls}>Teléfono</label><input {...f('telefono')} className={inputCls} />{fieldError('telefono')}</div>
          </div>
          <div><label className={labelCls}>Domicilio</label><input {...f('domicilio')} className={inputCls} />{fieldError('domicilio')}</div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={labelCls}>CBU</label><input {...f('cbu')} className={inputCls} />{fieldError('cbu')}</div>
            <div><label className={labelCls}>Alias</label><input {...f('alias')} className={inputCls} />{fieldError('alias')}</div>
            <div><label className={labelCls}>Banco</label><input {...f('banco')} className={inputCls} />{fieldError('banco')}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Categoría</label>
              <select {...f('categoria')} className={inputCls}>
                {Object.entries(CATEGORIA_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Estado</label>
              <select {...f('estado')} className={inputCls}>
                {Object.entries(ESTADO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Valor hora</label><input type="number" step="0.01" min="0" {...f('valor_hora')} className={inputCls} />{fieldError('valor_hora')}</div>
            <div><label className={labelCls}>Valor hora extra</label><input type="number" step="0.01" min="0" {...f('valor_hora_extra')} className={inputCls} />{fieldError('valor_hora_extra')}</div>
          </div>
          <div><label className={labelCls}>Notas</label><input {...f('notas')} className={inputCls} />{fieldError('notas')}</div>
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

function EmpleadoDrawer({ empleadoId, onClose, onVerJornadas, onVerLiquidaciones }: {
  empleadoId: number;
  onClose: () => void;
  onVerJornadas: (id: number) => void;
  onVerLiquidaciones: (id: number) => void;
}) {
  const { data: empleado, isLoading } = useEmpleado(empleadoId);
  const [tab, setTab] = useState<'personal' | 'bancarios'>('personal');

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-white border-l border-border shadow-xl overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">{empleado ? `${empleado.apellido}, ${empleado.nombre}` : 'Empleado'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent"><X size={18} /></button>
        </div>
        {isLoading || !empleado ? (
          <p className="p-4 text-sm text-muted-foreground">Cargando...</p>
        ) : (
          <div className="p-4 space-y-4">
            <div className="flex gap-2">
              <Badge variant={ESTADO_VARIANT[empleado.estado]}>{ESTADO_LABEL[empleado.estado]}</Badge>
              <Badge variant="info">{CATEGORIA_LABEL[empleado.categoria]}</Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border border-border p-2">
                <p className="text-lg font-semibold">{empleado.stats.horas_normales_totales}</p>
                <p className="text-[11px] text-muted-foreground">Hs. normales</p>
              </div>
              <div className="rounded-md border border-border p-2">
                <p className="text-lg font-semibold">{empleado.stats.horas_extras_totales}</p>
                <p className="text-[11px] text-muted-foreground">Hs. extras</p>
              </div>
              <div className="rounded-md border border-border p-2">
                <p className="text-lg font-semibold">${empleado.stats.anticipos_pendientes.toLocaleString('es-AR')}</p>
                <p className="text-[11px] text-muted-foreground">Anticipos pend.</p>
              </div>
            </div>

            <div className="flex border-b border-border">
              {(['personal', 'bancarios'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} className={cn(
                  'px-3 py-1.5 text-xs font-medium border-b-2 -mb-px',
                  tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground',
                )}>
                  {t === 'personal' ? 'Datos personales' : 'Datos bancarios'}
                </button>
              ))}
            </div>

            {tab === 'personal' ? (
              <dl className="text-sm space-y-1.5">
                <div className="flex justify-between"><dt className="text-muted-foreground">DNI</dt><dd>{empleado.dni}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">CUIT</dt><dd>{empleado.cuit ?? '-'}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Email</dt><dd>{empleado.email ?? '-'}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Teléfono</dt><dd>{empleado.telefono ?? '-'}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Domicilio</dt><dd>{empleado.domicilio ?? '-'}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Valor hora</dt><dd>${empleado.valor_hora}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Valor hora extra</dt><dd>${empleado.valor_hora_extra}</dd></div>
              </dl>
            ) : (
              <dl className="text-sm space-y-1.5">
                <div className="flex justify-between"><dt className="text-muted-foreground">CBU</dt><dd>{empleado.cbu ?? '-'}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Alias</dt><dd>{empleado.alias ?? '-'}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Banco</dt><dd>{empleado.banco ?? '-'}</dd></div>
              </dl>
            )}

            {empleado.stats.ultima_jornada && (
              <p className="text-xs text-muted-foreground">
                Última jornada: {empleado.stats.ultima_jornada.fecha.slice(0, 10)}
              </p>
            )}

            <div className="flex flex-col gap-2 pt-2 border-t border-border">
              <button onClick={() => onVerJornadas(empleado.id)} className="text-sm text-primary text-left hover:underline">
                Ver jornadas →
              </button>
              <button onClick={() => onVerLiquidaciones(empleado.id)} className="text-sm text-primary text-left hover:underline">
                Ver liquidaciones →
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function EmpleadosTab({ onVerJornadas, onVerLiquidaciones }: {
  onVerJornadas: (id: number) => void;
  onVerLiquidaciones: (id: number) => void;
}) {
  const [filtros, setFiltros] = useState<EmpleadoFiltros>({});
  const { data: empleados = [], isLoading } = useEmpleados(filtros);
  const deleteMut = useDeleteEmpleado();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]       = useState<Empleado | null>(null);
  const [drawerId, setDrawerId]     = useState<number | null>(null);

  const openNew  = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (e: Empleado) => { setEditing(e); setDialogOpen(true); };
  const close    = () => { setDialogOpen(false); setEditing(null); };

  const handleDelete = (e: Empleado) => {
    if (!window.confirm(`¿Eliminar a ${e.nombre} ${e.apellido}?`)) return;
    deleteMut.mutate(e.id, { onError: (err) => alert(getApiErrorMessage(err) ?? 'Error al eliminar') });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 justify-between mb-4">
        <div className="flex flex-wrap gap-2">
          <select value={filtros.categoria ?? ''} onChange={e => setFiltros(p => ({ ...p, categoria: (e.target.value || undefined) as CategoriaEmpleado | undefined }))} className={inputCls}>
            <option value="">Todas las categorías</option>
            {Object.entries(CATEGORIA_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={filtros.estado ?? ''} onChange={e => setFiltros(p => ({ ...p, estado: (e.target.value || undefined) as EstadoEmpleado | undefined }))} className={inputCls}>
            <option value="">Todos los estados</option>
            {Object.entries(ESTADO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input
            placeholder="Buscar por nombre o DNI..."
            value={filtros.q ?? ''}
            onChange={e => setFiltros(p => ({ ...p, q: e.target.value || undefined }))}
            className={cn(inputCls, 'w-56')}
          />
        </div>
        <Button size="sm" onClick={openNew}><Plus size={14} className="mr-1.5" /> Nuevo empleado</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Apellido</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Nombre</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">DNI</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Categoría</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Valor hora</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {empleados.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">No hay empleados cargados.</td></tr>
              ) : empleados.map(e => (
                <tr key={e.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => setDrawerId(e.id)}>
                  <td className="px-3 py-2.5 font-medium">{e.apellido}</td>
                  <td className="px-3 py-2.5">{e.nombre}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{e.dni}</td>
                  <td className="px-3 py-2.5"><Badge variant="info">{CATEGORIA_LABEL[e.categoria]}</Badge></td>
                  <td className="px-3 py-2.5 text-right">${e.valor_hora}</td>
                  <td className="px-3 py-2.5"><Badge variant={ESTADO_VARIANT[e.estado]}>{ESTADO_LABEL[e.estado]}</Badge></td>
                  <td className="px-3 py-2.5" onClick={ev => ev.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(e)} title="Editar"><Pencil size={14} /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(e)} className="text-destructive hover:text-destructive" title="Eliminar"><Trash2 size={14} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EmpleadoDialog open={dialogOpen} empleado={editing} onClose={close} />
      {drawerId !== null && (
        <EmpleadoDrawer
          empleadoId={drawerId}
          onClose={() => setDrawerId(null)}
          onVerJornadas={id => { setDrawerId(null); onVerJornadas(id); }}
          onVerLiquidaciones={id => { setDrawerId(null); onVerLiquidaciones(id); }}
        />
      )}
    </div>
  );
}
