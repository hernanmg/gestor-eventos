import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Check, ChevronLeft, ChevronRight, Plus, Trash2,
  ClipboardList, MapPin, Users, User, FileText, Loader2,
} from 'lucide-react';
import { usePreMacro, useUpdatePreMacro, useUpdateRubros, useConfirmarPreMacro } from '@/hooks/usePreMacro';
import { useUsuarios } from '@/hooks/useUsuarios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import type { PreMacro, RubroSugerido, Usuario } from '@/types';

type Vista = 'wizard' | 'resumen' | 'rubros';

const TIPOS_EVENTO = ['Festival', 'Corporativo', 'Privado', 'Deportivo', 'Otro'] as const;

const STEPS = [
  { n: 1, label: 'El evento' },
  { n: 2, label: 'Dónde y cuándo' },
  { n: 3, label: 'Quién y cómo' },
  { n: 4, label: 'Personal' },
];

interface SocioForm { nombre: string; porcentaje: string; }

interface FormState {
  nombre_evento: string;
  tipo_evento:   string;
  descripcion:   string;
  para_que_es:   string;
  es_privado:    boolean;

  fecha_inicio:    string;
  fecha_fin:       string;
  hora_inicio:     string;
  hora_fin:        string;
  lugar_nombre:    string;
  lugar_ciudad:    string;
  lugar_provincia: string;
  lugar_direccion: string;
  dias_montaje:    string;
  dias_desmontaje: string;

  cliente_nombre:    string;
  razon_social:      string;
  cuit_pagador:      string;
  quien_lo_hace:     string;
  contacto_cliente:  string;
  telefono_cliente:  string;
  presupuesto_total: string;
  moneda:            'ARS' | 'USD';
  socios:            SocioForm[];

  lleva_empleados:         boolean;
  cantidad_estimada_staff: string;
  requiere_hospedaje:      boolean;
  ciudad_hospedaje:        string;
  requiere_traslado:       boolean;
  notas_traslado:          string;
  requiere_comidas:        boolean;
  cantidad_dias_comida:    string;
  observaciones_generales: string;
}

type SetField = <K extends keyof FormState>(key: K, value: FormState[K]) => void;
interface StepProps { form: FormState; set: SetField; }

function toInputDate(iso: string | null): string {
  if (!iso) return '';
  return iso.split('T')[0];
}

function formFromPreMacro(pm: PreMacro): FormState {
  return {
    nombre_evento: pm.nombre_evento ?? '',
    tipo_evento:   pm.tipo_evento ?? '',
    descripcion:   pm.descripcion ?? '',
    para_que_es:   pm.para_que_es ?? '',
    es_privado:    pm.es_privado,

    fecha_inicio:    toInputDate(pm.fecha_inicio),
    fecha_fin:       toInputDate(pm.fecha_fin),
    hora_inicio:     pm.hora_inicio ?? '',
    hora_fin:        pm.hora_fin ?? '',
    lugar_nombre:    pm.lugar_nombre ?? '',
    lugar_ciudad:    pm.lugar_ciudad ?? '',
    lugar_provincia: pm.lugar_provincia ?? '',
    lugar_direccion: pm.lugar_direccion ?? '',
    dias_montaje:    pm.dias_montaje != null ? String(pm.dias_montaje) : '',
    dias_desmontaje: pm.dias_desmontaje != null ? String(pm.dias_desmontaje) : '',

    cliente_nombre:    pm.cliente_nombre ?? '',
    razon_social:      pm.razon_social ?? '',
    cuit_pagador:      pm.cuit_pagador ?? '',
    quien_lo_hace:     pm.quien_lo_hace ?? '',
    contacto_cliente:  pm.contacto_cliente ?? '',
    telefono_cliente:  pm.telefono_cliente ?? '',
    presupuesto_total: pm.presupuesto_total != null ? String(pm.presupuesto_total) : '',
    moneda:            pm.moneda,
    socios:            pm.socios.map(s => ({ nombre: s.nombre, porcentaje: String(s.porcentaje) })),

    lleva_empleados:         pm.lleva_empleados,
    cantidad_estimada_staff: pm.cantidad_estimada_staff != null ? String(pm.cantidad_estimada_staff) : '',
    requiere_hospedaje:      pm.requiere_hospedaje,
    ciudad_hospedaje:        pm.ciudad_hospedaje ?? '',
    requiere_traslado:       pm.requiere_traslado,
    notas_traslado:          pm.notas_traslado ?? '',
    requiere_comidas:        pm.requiere_comidas,
    cantidad_dias_comida:    pm.cantidad_dias_comida != null ? String(pm.cantidad_dias_comida) : '',
    observaciones_generales: pm.observaciones_generales ?? '',
  };
}

function buildPayload(form: FormState, paso_actual: number) {
  return {
    paso_actual,
    nombre_evento: form.nombre_evento || null,
    tipo_evento:   form.tipo_evento || null,
    descripcion:   form.descripcion || null,
    para_que_es:   form.para_que_es || null,
    es_privado:    form.es_privado,

    fecha_inicio:    form.fecha_inicio || null,
    fecha_fin:       form.fecha_fin || null,
    hora_inicio:     form.hora_inicio || null,
    hora_fin:        form.hora_fin || null,
    lugar_nombre:    form.lugar_nombre || null,
    lugar_ciudad:    form.lugar_ciudad || null,
    lugar_provincia: form.lugar_provincia || null,
    lugar_direccion: form.lugar_direccion || null,
    dias_montaje:    form.dias_montaje === '' ? null : Number(form.dias_montaje),
    dias_desmontaje: form.dias_desmontaje === '' ? null : Number(form.dias_desmontaje),

    cliente_nombre:    form.cliente_nombre || null,
    razon_social:      form.razon_social || null,
    cuit_pagador:      form.cuit_pagador || null,
    quien_lo_hace:     form.quien_lo_hace || null,
    contacto_cliente:  form.contacto_cliente || null,
    telefono_cliente:  form.telefono_cliente || null,
    presupuesto_total: form.presupuesto_total === '' ? null : Number(form.presupuesto_total),
    moneda:            form.moneda,
    socios: form.socios
      .filter(s => s.nombre.trim())
      .map(s => ({ nombre: s.nombre.trim(), porcentaje: Number(s.porcentaje) || 0 })),

    lleva_empleados:         form.lleva_empleados,
    cantidad_estimada_staff: form.cantidad_estimada_staff === '' ? null : Number(form.cantidad_estimada_staff),
    requiere_hospedaje:      form.requiere_hospedaje,
    ciudad_hospedaje:        form.ciudad_hospedaje || null,
    requiere_traslado:       form.requiere_traslado,
    notas_traslado:          form.notas_traslado || null,
    requiere_comidas:        form.requiere_comidas,
    cantidad_dias_comida:    form.cantidad_dias_comida === '' ? null : Number(form.cantidad_dias_comida),
    observaciones_generales: form.observaciones_generales || null,
  };
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('space-y-1', className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function TextArea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    />
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors',
        selected
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background text-muted-foreground border-input hover:border-primary/50 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function ToggleSwitch({ checked, onChange, label, description }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 text-left hover:border-primary/40 transition-colors"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <span className={cn('flex h-6 w-10 shrink-0 items-center rounded-full p-1 transition-colors', checked ? 'bg-primary justify-end' : 'bg-gray-300 justify-start')}>
        <span className="h-4 w-4 rounded-full bg-white shadow" />
      </span>
    </button>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
      {STEPS.map((s, idx) => (
        <div key={s.n} className="flex items-center gap-1 sm:gap-2">
          <div className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
            s.n === step ? 'bg-primary text-primary-foreground' : s.n < step ? 'text-green-700' : 'text-muted-foreground',
          )}>
            {s.n < step
              ? <Check size={12} />
              : <span className={cn('flex h-4 w-4 items-center justify-center rounded-full text-[10px]', s.n === step ? 'bg-primary-foreground text-primary' : 'border border-current')}>{s.n}</span>
            }
            <span className="hidden sm:inline">{s.label}</span>
          </div>
          {idx < STEPS.length - 1 && <div className="w-4 sm:w-8 h-px bg-border" />}
        </div>
      ))}
    </div>
  );
}

// ── Paso 1 — El evento ────────────────────────────────────────────────────────

function Paso1({ form, set }: StepProps) {
  return (
    <div className="space-y-5 max-w-2xl">
      <Field label="¿Para qué es este evento?">
        <TextArea
          rows={4}
          placeholder="Contá brevemente el motivo y el contexto del evento..."
          value={form.para_que_es}
          onChange={e => set('para_que_es', e.target.value)}
          className="text-base"
        />
      </Field>

      <Field label="Tipo de evento">
        <div className="flex flex-wrap gap-2">
          {TIPOS_EVENTO.map(t => (
            <Chip key={t} selected={form.tipo_evento === t} onClick={() => set('tipo_evento', t)}>{t}</Chip>
          ))}
        </div>
      </Field>

      <ToggleSwitch
        checked={form.es_privado}
        onChange={v => set('es_privado', v)}
        label="¿Es un evento privado?"
        description={form.es_privado ? 'Privado — acceso restringido' : 'Público'}
      />

      <Field label="Descripción adicional (opcional)">
        <TextArea rows={3} value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
      </Field>
    </div>
  );
}

// ── Paso 2 — Dónde y cuándo ───────────────────────────────────────────────────

function Paso2({ form, set }: StepProps) {
  return (
    <div className="space-y-5 max-w-2xl">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha de inicio">
          <Input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} />
        </Field>
        <Field label="Hora de inicio">
          <Input type="time" value={form.hora_inicio} onChange={e => set('hora_inicio', e.target.value)} />
        </Field>
        <Field label="Fecha de fin">
          <Input type="date" value={form.fecha_fin} onChange={e => set('fecha_fin', e.target.value)} />
        </Field>
        <Field label="Hora de fin">
          <Input type="time" value={form.hora_fin} onChange={e => set('hora_fin', e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="¿Cuántos días de montaje previo?">
          <Input type="number" min={0} value={form.dias_montaje} onChange={e => set('dias_montaje', e.target.value)} />
        </Field>
        <Field label="¿Cuántos días de desmontaje?">
          <Input type="number" min={0} value={form.dias_desmontaje} onChange={e => set('dias_desmontaje', e.target.value)} />
        </Field>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <p className="text-sm font-medium">Lugar del evento</p>
        <Field label="Nombre del lugar">
          <Input placeholder='Ej: "Estadio Mario Kempes"' value={form.lugar_nombre} onChange={e => set('lugar_nombre', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ciudad">
            <Input value={form.lugar_ciudad} onChange={e => set('lugar_ciudad', e.target.value)} />
          </Field>
          <Field label="Provincia">
            <Input value={form.lugar_provincia} onChange={e => set('lugar_provincia', e.target.value)} />
          </Field>
        </div>
        <Field label="Dirección (opcional)">
          <Input value={form.lugar_direccion} onChange={e => set('lugar_direccion', e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

// ── Paso 3 — Quién y cómo ─────────────────────────────────────────────────────

function Paso3({ form, set, usuarios }: StepProps & { usuarios: Usuario[] }) {
  const sociosSum = form.socios.reduce((a, s) => a + (Number(s.porcentaje) || 0), 0);
  const usuarioOptions: ComboboxOption[] = usuarios.map(u => ({ value: u.nombre, label: u.nombre }));

  const addSocio    = () => set('socios', [...form.socios, { nombre: '', porcentaje: '' }]);
  const removeSocio = (idx: number) => set('socios', form.socios.filter((_, i) => i !== idx));
  const updateSocio = (idx: number, patch: Partial<SocioForm>) =>
    set('socios', form.socios.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  return (
    <div className="space-y-5 max-w-2xl">
      <Field label="¿Quién lo encarga?">
        <Input value={form.cliente_nombre} onChange={e => set('cliente_nombre', e.target.value)} placeholder="Nombre del cliente" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Razón social que paga">
          <Input value={form.razon_social} onChange={e => set('razon_social', e.target.value)} />
        </Field>
        <Field label="CUIT del pagador">
          <Input value={form.cuit_pagador} onChange={e => set('cuit_pagador', e.target.value)} placeholder="XX-XXXXXXXX-X" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Contacto del cliente">
          <Input value={form.contacto_cliente} onChange={e => set('contacto_cliente', e.target.value)} placeholder="Nombre" />
        </Field>
        <Field label="Teléfono de contacto">
          <Input value={form.telefono_cliente} onChange={e => set('telefono_cliente', e.target.value)} />
        </Field>
      </div>

      <Field label="¿Quién lo hace internamente?">
        <Combobox
          options={usuarioOptions}
          value={form.quien_lo_hace || null}
          onChange={v => set('quien_lo_hace', v)}
          placeholder="Responsable interno..."
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Presupuesto total estimado">
          <Input type="number" min={0} value={form.presupuesto_total} onChange={e => set('presupuesto_total', e.target.value)} />
        </Field>
        <Field label="Moneda">
          <select
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={form.moneda}
            onChange={e => set('moneda', e.target.value as 'ARS' | 'USD')}
          >
            <option value="ARS">ARS — Peso argentino</option>
            <option value="USD">USD — Dólar</option>
          </select>
        </Field>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Socios y porcentajes</Label>
          <Button type="button" variant="outline" size="sm" onClick={addSocio}>
            <Plus size={14} className="mr-1" /> Agregar
          </Button>
        </div>
        {form.socios.map((s, idx) => (
          <div key={idx} className="flex gap-2 items-start">
            <Input
              className="flex-1"
              placeholder="Nombre del socio"
              value={s.nombre}
              onChange={e => updateSocio(idx, { nombre: e.target.value })}
            />
            <Input
              className="w-24"
              type="number" min={0} max={100} step={0.01}
              placeholder="%"
              value={s.porcentaje}
              onChange={e => updateSocio(idx, { porcentaje: e.target.value })}
            />
            <Button type="button" variant="ghost" size="icon" onClick={() => removeSocio(idx)} className="text-destructive hover:text-destructive shrink-0">
              <Trash2 size={15} />
            </Button>
          </div>
        ))}
        {form.socios.length > 0 && (
          <p className={cn('text-xs font-medium text-right', Math.abs(sociosSum - 100) < 0.01 ? 'text-green-600' : 'text-muted-foreground')}>
            Total: {sociosSum.toFixed(2)}% {Math.abs(sociosSum - 100) < 0.01 ? '✓' : '(debe sumar 100%)'}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Paso 4 — Personal y logística ─────────────────────────────────────────────

function Paso4({ form, set }: StepProps) {
  return (
    <div className="space-y-4 max-w-2xl">
      <ToggleSwitch checked={form.lleva_empleados} onChange={v => set('lleva_empleados', v)} label="¿El evento lleva empleados propios?" />
      {form.lleva_empleados && (
        <Field label="Cantidad estimada de staff" className="pl-4">
          <Input type="number" min={0} value={form.cantidad_estimada_staff} onChange={e => set('cantidad_estimada_staff', e.target.value)} />
        </Field>
      )}

      <ToggleSwitch checked={form.requiere_hospedaje} onChange={v => set('requiere_hospedaje', v)} label="¿Requiere hospedaje?" />
      {form.requiere_hospedaje && (
        <Field label="Ciudad de hospedaje" className="pl-4">
          <Input value={form.ciudad_hospedaje} onChange={e => set('ciudad_hospedaje', e.target.value)} />
        </Field>
      )}

      <ToggleSwitch checked={form.requiere_traslado} onChange={v => set('requiere_traslado', v)} label="¿Requiere traslado de material?" />
      {form.requiere_traslado && (
        <Field label="Notas de traslado" className="pl-4">
          <Input placeholder="Ej: 2 camiones + 1 van" value={form.notas_traslado} onChange={e => set('notas_traslado', e.target.value)} />
        </Field>
      )}

      <ToggleSwitch checked={form.requiere_comidas} onChange={v => set('requiere_comidas', v)} label="¿Requiere comidas para el staff?" />
      {form.requiere_comidas && (
        <Field label="Cantidad de días con comida" className="pl-4">
          <Input type="number" min={0} value={form.cantidad_dias_comida} onChange={e => set('cantidad_dias_comida', e.target.value)} />
        </Field>
      )}

      <Field label="Observaciones generales">
        <TextArea
          rows={4}
          placeholder="Todo lo que los mandos medios necesitan saber sobre este evento..."
          value={form.observaciones_generales}
          onChange={e => set('observaciones_generales', e.target.value)}
        />
      </Field>
    </div>
  );
}

// ── Resumen ───────────────────────────────────────────────────────────────────

function ResumenCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-1.5">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon} {title}
      </div>
      <div className="text-sm text-muted-foreground space-y-1">{children}</div>
    </div>
  );
}

function ResumenScreen({ form, onEdit, onConfirm }: { form: FormState; onEdit: () => void; onConfirm: () => void }) {
  const sociosStr = form.socios.filter(s => s.nombre.trim()).map(s => `${s.nombre} ${s.porcentaje || 0}%`).join(' · ');
  const presupuesto = form.presupuesto_total ? formatCurrency(Number(form.presupuesto_total), form.moneda) : '—';

  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-lg font-semibold">Resumen del evento — {form.nombre_evento || 'Sin nombre'}</h2>

      <ResumenCard icon={<ClipboardList size={16} />} title="El evento">
        <p>{form.nombre_evento || '—'} · {form.tipo_evento || 'Sin tipo'} · {form.es_privado ? 'Privado' : 'Público'}</p>
        {form.para_que_es && <p>Para qué: {form.para_que_es}</p>}
      </ResumenCard>

      <ResumenCard icon={<MapPin size={16} />} title="Dónde y cuándo">
        <p>{form.lugar_nombre || 'Sin lugar'}{form.lugar_ciudad && ` · ${form.lugar_ciudad}`}</p>
        <p>{form.fecha_inicio || '—'} al {form.fecha_fin || '—'}</p>
        <p>Montaje: {form.dias_montaje || 0} días · Desmontaje: {form.dias_desmontaje || 0} días</p>
      </ResumenCard>

      <ResumenCard icon={<User size={16} />} title="Quién y cómo">
        <p>Cliente: {form.cliente_nombre || '—'}{form.razon_social && ` (${form.razon_social})`}</p>
        <p>Responsable interno: {form.quien_lo_hace || '—'}</p>
        <p>Presupuesto: {presupuesto}</p>
        {sociosStr && <p>Socios: {sociosStr}</p>}
      </ResumenCard>

      <ResumenCard icon={<Users size={16} />} title="Personal y logística">
        <p>Empleados: {form.lleva_empleados ? `Sí (~${form.cantidad_estimada_staff || '?'} personas)` : 'No'}</p>
        <p>Hospedaje: {form.requiere_hospedaje ? `Sí (${form.ciudad_hospedaje || 'sin ciudad'})` : 'No'}</p>
        <p>Traslado: {form.requiere_traslado ? 'Sí' : 'No'}</p>
        <p>Comidas: {form.requiere_comidas ? `Sí (${form.cantidad_dias_comida || 0} días)` : 'No'}</p>
      </ResumenCard>

      {form.observaciones_generales && (
        <ResumenCard icon={<FileText size={16} />} title="Observaciones generales">
          <p className="whitespace-pre-wrap">{form.observaciones_generales}</p>
        </ResumenCard>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onEdit}><ChevronLeft size={15} className="mr-1" /> Editar</Button>
        <Button onClick={onConfirm}>Confirmar y ver rubros <ChevronRight size={15} className="ml-1" /></Button>
      </div>
    </div>
  );
}

// ── Rubros ────────────────────────────────────────────────────────────────────

function RubrosScreen({
  sugeridos, seleccion, onToggle, onBack, onConfirmar, isConfirming, nombreEvento,
}: {
  sugeridos:    RubroSugerido[];
  seleccion:    Record<number, boolean>;
  onToggle:     (id: number) => void;
  onBack:       () => void;
  onConfirmar:  () => void;
  isConfirming: boolean;
  nombreEvento: string;
}) {
  const [mostrarTodos, setMostrarTodos] = useState(false);

  const sugeridosList = sugeridos.filter(r => r.razon !== null);
  const otrosList     = sugeridos.filter(r => r.razon === null);
  const totalSeleccionados = Object.values(seleccion).filter(Boolean).length;

  const RubroRow = ({ r }: { r: RubroSugerido }) => (
    <label className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/40 cursor-pointer">
      <input type="checkbox" checked={!!seleccion[r.rubro_id]} onChange={() => onToggle(r.rubro_id)} />
      <span className="text-sm flex-1">{r.rubro_nombre}</span>
      {r.razon && <span className="text-xs text-muted-foreground">{r.razon}</span>}
    </label>
  );

  return (
    <div className="space-y-4 max-w-2xl pb-20">
      <div>
        <h2 className="text-lg font-semibold">Rubros del evento — {nombreEvento || 'Sin nombre'}</h2>
        <p className="text-sm text-muted-foreground">Seleccioná los rubros que va a necesitar este evento</p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={mostrarTodos} onChange={e => setMostrarTodos(e.target.checked)} />
        Mostrar todos en una sola lista
      </label>

      {mostrarTodos ? (
        <div className="rounded-lg border border-border divide-y divide-border">
          {[...sugeridos].sort((a, b) => a.rubro_id - b.rubro_id).map(r => <RubroRow key={r.rubro_id} r={r} />)}
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border">
            <div className="px-3 py-2 border-b border-border bg-muted/30">
              <p className="text-sm font-semibold">✓ Sugeridos ({sugeridosList.length})</p>
              <p className="text-xs text-muted-foreground">Basados en las respuestas anteriores</p>
            </div>
            <div className="divide-y divide-border">
              {sugeridosList.map(r => <RubroRow key={r.rubro_id} r={r} />)}
              {sugeridosList.length === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">Sin sugerencias.</p>}
            </div>
          </div>

          <div className="rounded-lg border border-border">
            <div className="px-3 py-2 border-b border-border bg-muted/30">
              <p className="text-sm font-semibold">Otros rubros ({otrosList.length})</p>
              <p className="text-xs text-muted-foreground">No sugeridos — activá los que necesités</p>
            </div>
            <div className="divide-y divide-border">
              {otrosList.map(r => <RubroRow key={r.rubro_id} r={r} />)}
            </div>
          </div>
        </>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border px-6 py-3 flex items-center justify-between z-10">
        <span className="text-sm font-medium">{totalSeleccionados} rubros seleccionados</span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} disabled={isConfirming}>
            <ChevronLeft size={15} className="mr-1" /> Volver al resumen
          </Button>
          <Button onClick={onConfirmar} disabled={isConfirming}>
            {isConfirming && <Loader2 size={15} className="mr-1.5 animate-spin" />}
            Crear evento
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PreMacroPage() {
  const { id: idParam } = useParams<{ id: string }>();
  const id = Number(idParam);
  const navigate = useNavigate();

  const { data: preMacro, isLoading } = usePreMacro(id);
  const updateMutation    = useUpdatePreMacro(id);
  const rubrosMutation    = useUpdateRubros(id);
  const confirmarMutation = useConfirmarPreMacro(id);
  const { data: usuarios = [] } = useUsuarios();

  const [vista, setVista] = useState<Vista>('wizard');
  const [step, setStep]   = useState(1);
  const [form, setForm]   = useState<FormState | null>(null);
  const [seleccion, setSeleccion] = useState<Record<number, boolean>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [nombreError, setNombreError] = useState(false);

  const initialized = useRef(false);

  useEffect(() => {
    if (preMacro && !initialized.current) {
      setForm(formFromPreMacro(preMacro));
      setStep(Math.min(Math.max(preMacro.paso_actual, 1), 4));
      initialized.current = true;
    }
  }, [preMacro]);

  if (isLoading || !form || !preMacro) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Cargando...</div>;
  }

  const set: SetField = (key, value) => {
    setForm(f => (f ? { ...f, [key]: value } : f));
    if (key === 'nombre_evento') setNombreError(false);
  };

  const save = async (pasoActual: number) => {
    setSaveError(null);
    try {
      return await updateMutation.mutateAsync(buildPayload(form, pasoActual));
    } catch (err) {
      setSaveError(getApiErrorMessage(err));
      throw err;
    }
  };

  const handleNext = async () => {
    if (step === 1 && !form.nombre_evento.trim()) {
      setNombreError(true);
      return;
    }
    try {
      if (step < 4) {
        await save(step + 1);
        setStep(s => s + 1);
      } else {
        await save(4);
        setVista('resumen');
      }
    } catch {
      // error ya mostrado vía saveError
    }
  };

  const handlePrev = () => {
    if (step > 1) setStep(s => s - 1);
  };

  const handleGuardarBorrador = async () => {
    try { await save(step); } catch { /* error ya mostrado vía saveError */ }
  };

  const seedSeleccion = (pm: PreMacro) => {
    const map: Record<number, boolean> = {};
    const confirmados = pm.rubros_confirmados;
    if (confirmados && confirmados.length > 0) {
      for (const r of confirmados) map[r.rubro_id] = r.seleccionado;
    } else {
      for (const r of pm.rubros_sugeridos ?? []) map[r.rubro_id] = r.seleccionado;
    }
    setSeleccion(map);
  };

  const handleEditarDesdeResumen = () => { setStep(4); setVista('wizard'); };

  const handleConfirmarResumen = () => {
    seedSeleccion(preMacro);
    setVista('rubros');
  };

  const handleToggleRubro = (rubroId: number) => {
    setSeleccion(s => ({ ...s, [rubroId]: !s[rubroId] }));
  };

  const handleCrearEvento = async () => {
    setSaveError(null);
    try {
      const rubros = Object.entries(seleccion).map(([rubroId, seleccionado]) => ({
        rubro_id: Number(rubroId), seleccionado,
      }));
      await rubrosMutation.mutateAsync(rubros);
      const { evento_id } = await confirmarMutation.mutateAsync();
      navigate(`/eventos/${evento_id}`, { state: { successMessage: 'Evento creado desde la pre-macro.' } });
    } catch (err) {
      setSaveError(getApiErrorMessage(err));
    }
  };

  const isSaving = updateMutation.isPending;

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="sticky top-0 z-10 bg-white border-b border-border px-6 py-3 space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <Input
              value={form.nombre_evento}
              onChange={e => set('nombre_evento', e.target.value)}
              placeholder="Nombre del evento"
              className={cn('text-lg font-semibold max-w-sm', nombreError && 'border-destructive')}
            />
            {nombreError && (
              <p className="text-xs text-destructive mt-1">El nombre del evento es requerido para continuar</p>
            )}
          </div>
          {vista === 'wizard' && (
            <Button variant="outline" size="sm" onClick={handleGuardarBorrador} disabled={isSaving}>
              {isSaving && <Loader2 size={13} className="mr-1.5 animate-spin" />}
              Guardar borrador
            </Button>
          )}
        </div>
        {vista === 'wizard' && <Stepper step={step} />}
      </div>

      <div className="p-6">
        {saveError && (
          <div className="max-w-2xl mb-4 rounded-md bg-destructive/10 px-3 py-2">
            <p className="text-sm text-destructive">{saveError}</p>
          </div>
        )}

        {vista === 'wizard' && (
          <>
            {step === 1 && <Paso1 form={form} set={set} />}
            {step === 2 && <Paso2 form={form} set={set} />}
            {step === 3 && <Paso3 form={form} set={set} usuarios={usuarios} />}
            {step === 4 && <Paso4 form={form} set={set} />}

            <div className="max-w-2xl flex justify-between pt-6">
              <Button variant="outline" onClick={handlePrev} disabled={step === 1 || isSaving}>
                <ChevronLeft size={15} className="mr-1" /> Anterior
              </Button>
              <Button onClick={handleNext} disabled={isSaving}>
                {isSaving && <Loader2 size={15} className="mr-1.5 animate-spin" />}
                {step < 4 ? 'Siguiente' : 'Ver resumen'} <ChevronRight size={15} className="ml-1" />
              </Button>
            </div>
          </>
        )}

        {vista === 'resumen' && (
          <ResumenScreen form={form} onEdit={handleEditarDesdeResumen} onConfirm={handleConfirmarResumen} />
        )}

        {vista === 'rubros' && (
          <RubrosScreen
            sugeridos={preMacro.rubros_sugeridos ?? []}
            seleccion={seleccion}
            onToggle={handleToggleRubro}
            onBack={() => setVista('resumen')}
            onConfirmar={handleCrearEvento}
            isConfirming={rubrosMutation.isPending || confirmarMutation.isPending}
            nombreEvento={form.nombre_evento}
          />
        )}
      </div>
    </div>
  );
}
