import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import {
  useEmpleados, useEmpleado, useCreateEmpleado, useUpdateEmpleado, useDeleteEmpleado,
  type EmpleadoPayload, type EmpleadoFiltros,
} from '@/hooks/useRRHH';
import PrestamosSection from '@/components/domain/PrestamosSection';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, getApiErrorMessage, getApiFieldErrors } from '@/lib/utils';
import type { Empleado, CategoriaEmpleado, EstadoEmpleado, TipoLiquidacion } from '@/types';

const CATEGORIA_LABEL: Record<CategoriaEmpleado, string> = {
  CAPITAN: 'Capitán', ARMADOR: 'Armador', CHOFER: 'Chofer',
  ADMINISTRATIVO: 'Administrativo', TECNICO: 'Técnico',
  JORNALERO: 'Jornalero', FOFI: 'Fofi', NESTORAS: 'Nestoras', EXTRANJERO: 'Extranjero', SERENO: 'Sereno',
  OTRO: 'Otro',
};

const TIPO_LIQUIDACION_LABEL: Record<TipoLiquidacion, string> = {
  LINEAL:  'Lineal (por hora)',
  JORNADA: 'Por jornada',
};

const GRUPOS_SANGUINEOS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'];
const TALLES_ROPA = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

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
  tipo_liquidacion: 'LINEAL',
  valor_jornada_completa: null, valor_media_jornada: null,
  umbral_horas_jornada: null, umbral_horas_media: null,
  valor_hora_extra_jornada: null, valor_viaje: null,
  apodo: '', fecha_nacimiento: '', grupo_sanguineo: '',
  contacto_emergencia_nombre: '', contacto_emergencia_tel: '', contacto_emergencia_tel2: '',
  escalafon: null, art: '', tipo_contratacion: '', licencia_conducir: false, equipamiento_asignado: '',
  talle_pantalon: '', talle_remera: '', talle_buzo: '', talle_calzado: '',
};

function empleadoToForm(empleado: Empleado): EmpleadoPayload {
  return {
    nombre:           empleado.nombre,
    apellido:         empleado.apellido,
    dni:              empleado.dni ?? '',
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
    tipo_liquidacion:         empleado.tipo_liquidacion,
    valor_jornada_completa:   empleado.valor_jornada_completa,
    valor_media_jornada:      empleado.valor_media_jornada,
    umbral_horas_jornada:     empleado.umbral_horas_jornada,
    umbral_horas_media:       empleado.umbral_horas_media,
    valor_hora_extra_jornada: empleado.valor_hora_extra_jornada,
    valor_viaje:              empleado.valor_viaje,
    apodo:                      empleado.apodo ?? '',
    fecha_nacimiento:           empleado.fecha_nacimiento ? empleado.fecha_nacimiento.slice(0, 10) : '',
    grupo_sanguineo:            empleado.grupo_sanguineo ?? '',
    contacto_emergencia_nombre: empleado.contacto_emergencia_nombre ?? '',
    contacto_emergencia_tel:    empleado.contacto_emergencia_tel ?? '',
    contacto_emergencia_tel2:   empleado.contacto_emergencia_tel2 ?? '',
    escalafon:                  empleado.escalafon,
    art:                        empleado.art ?? '',
    tipo_contratacion:          empleado.tipo_contratacion ?? '',
    licencia_conducir:          empleado.licencia_conducir,
    equipamiento_asignado:      empleado.equipamiento_asignado ?? '',
    talle_pantalon:             empleado.talle_pantalon ?? '',
    talle_remera:               empleado.talle_remera ?? '',
    talle_buzo:                 empleado.talle_buzo ?? '',
    talle_calzado:              empleado.talle_calzado ?? '',
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

  const numOrNull = (v: unknown): number | null => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors(null);
    const payload: EmpleadoPayload = {
      ...form,
      valor_hora:       Number(form.valor_hora) || 0,
      valor_hora_extra: Number(form.valor_hora_extra) || 0,
      valor_jornada_completa:   numOrNull(form.valor_jornada_completa),
      valor_media_jornada:      numOrNull(form.valor_media_jornada),
      umbral_horas_jornada:     numOrNull(form.umbral_horas_jornada),
      umbral_horas_media:       numOrNull(form.umbral_horas_media),
      valor_hora_extra_jornada: numOrNull(form.valor_hora_extra_jornada),
      valor_viaje:              numOrNull(form.valor_viaje),
      escalafon:                numOrNull(form.escalafon),
      fecha_nacimiento:         form.fecha_nacimiento || null,
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
          </div>

          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Datos de liquidación</p>
            <div className="mb-3">
              <label className={labelCls}>Tipo de liquidación</label>
              <select {...f('tipo_liquidacion')} className={inputCls}>
                {Object.entries(TIPO_LIQUIDACION_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            {form.tipo_liquidacion === 'LINEAL' ? (
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Valor hora</label><input type="number" step="0.01" min="0" {...f('valor_hora')} className={inputCls} />{fieldError('valor_hora')}</div>
                <div><label className={labelCls}>Valor hora extra</label><input type="number" step="0.01" min="0" {...f('valor_hora_extra')} className={inputCls} />{fieldError('valor_hora_extra')}</div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Valor jornada completa ($)</label><input type="number" step="0.01" min="0" {...f('valor_jornada_completa')} className={inputCls} />{fieldError('valor_jornada_completa')}</div>
                <div><label className={labelCls}>Umbral horas jornada completa</label><input type="number" step="0.5" min="0" {...f('umbral_horas_jornada')} className={inputCls} placeholder="ej: 10" />{fieldError('umbral_horas_jornada')}</div>
                <div><label className={labelCls}>Valor media jornada ($)</label><input type="number" step="0.01" min="0" {...f('valor_media_jornada')} className={inputCls} />{fieldError('valor_media_jornada')}</div>
                <div><label className={labelCls}>Umbral horas media jornada</label><input type="number" step="0.5" min="0" {...f('umbral_horas_media')} className={inputCls} placeholder="ej: 5" />{fieldError('umbral_horas_media')}</div>
                <div><label className={labelCls}>Valor hora extra sobre jornada ($)</label><input type="number" step="0.01" min="0" {...f('valor_hora_extra_jornada')} className={inputCls} />{fieldError('valor_hora_extra_jornada')}</div>
                {form.categoria === 'CHOFER' && (
                  <div><label className={labelCls}>Valor por viaje ($)</label><input type="number" step="0.01" min="0" {...f('valor_viaje')} className={inputCls} />{fieldError('valor_viaje')}</div>
                )}
              </div>
            )}
          </div>

          <div><label className={labelCls}>Notas</label><input {...f('notas')} className={inputCls} />{fieldError('notas')}</div>

          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Datos del legajo</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Apodo</label><input {...f('apodo')} className={inputCls} />{fieldError('apodo')}</div>
              <div><label className={labelCls}>Fecha de nacimiento</label><input type="date" {...f('fecha_nacimiento')} className={inputCls} />{fieldError('fecha_nacimiento')}</div>
              <div>
                <label className={labelCls}>Grupo sanguíneo</label>
                <select {...f('grupo_sanguineo')} className={inputCls}>
                  <option value="">-</option>
                  {GRUPOS_SANGUINEOS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>ART</label><input {...f('art')} className={inputCls} />{fieldError('art')}</div>
              <div><label className={labelCls}>Contacto de emergencia — nombre</label><input {...f('contacto_emergencia_nombre')} className={inputCls} />{fieldError('contacto_emergencia_nombre')}</div>
              <div><label className={labelCls}>Contacto de emergencia — teléfono</label><input {...f('contacto_emergencia_tel')} className={inputCls} />{fieldError('contacto_emergencia_tel')}</div>
              <div><label className={labelCls}>Contacto de emergencia — teléfono 2</label><input {...f('contacto_emergencia_tel2')} className={inputCls} />{fieldError('contacto_emergencia_tel2')}</div>
              <div><label className={labelCls}>Escalafón</label><input type="number" step="1" {...f('escalafon')} className={inputCls} />{fieldError('escalafon')}</div>
              <div><label className={labelCls}>Equipamiento asignado</label><input {...f('equipamiento_asignado')} className={inputCls} placeholder="Celular, notebook…" />{fieldError('equipamiento_asignado')}</div>
              <div className="flex items-end pb-1.5">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.licencia_conducir ?? false}
                    onChange={e => setForm(p => ({ ...p, licencia_conducir: e.target.checked }))}
                  />
                  Licencia de conducir
                </label>
              </div>
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 mt-4">Uniforme</p>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Pantalón</label>
                <input {...f('talle_pantalon')} className={inputCls} placeholder='ej: 42/44' />{fieldError('talle_pantalon')}
              </div>
              <div>
                <label className={labelCls}>Remera</label>
                <select {...f('talle_remera')} className={inputCls}>
                  <option value="">-</option>
                  {TALLES_ROPA.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {fieldError('talle_remera')}
              </div>
              <div>
                <label className={labelCls}>Buzo/Campera</label>
                <select {...f('talle_buzo')} className={inputCls}>
                  <option value="">-</option>
                  {TALLES_ROPA.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {fieldError('talle_buzo')}
              </div>
              <div>
                <label className={labelCls}>Calzado</label>
                <input {...f('talle_calzado')} className={inputCls} />{fieldError('talle_calzado')}
              </div>
            </div>

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 mt-4">Contratación</p>
            <div>
              <label className={labelCls}>Tipo de contratación</label>
              <input {...f('tipo_contratacion')} className={inputCls} placeholder="SANCOR, ART, FEDERAL PATRONAL (AP)…" />{fieldError('tipo_contratacion')}
            </div>
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
                <div className="flex justify-between"><dt className="text-muted-foreground">DNI</dt><dd>{empleado.dni ?? '-'}</dd></div>
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

            <PrestamosSection empleadoId={empleado.id} />

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
