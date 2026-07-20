import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, Building2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  useEmpresas, useEmpresa, useUpdateEmpresa, useUploadLogo, useLogoBlobUrl,
} from '@/hooks/useEmpresas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { Empresa, Moneda } from '@/types';

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

const TIMEZONES = [
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires' },
  { value: 'America/Argentina/Cordoba',      label: 'Córdoba' },
  { value: 'America/Argentina/Mendoza',      label: 'Mendoza' },
];

// ── Selector de empresa ────────────────────────────────────────────────────────

function EmpresaSelector({ empresas, selectedId, onSelect }: {
  empresas:   Empresa[];
  selectedId: number | null;
  onSelect:   (id: number) => void;
}) {
  return (
    <div className="flex border-b border-border mb-6">
      {empresas.map(e => (
        <button
          key={e.id}
          onClick={() => onSelect(e.id)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            selectedId === e.id
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {e.nombre_corto ?? e.nombre}
        </button>
      ))}
    </div>
  );
}

// ── Identidad visual ──────────────────────────────────────────────────────────

function IdentidadVisualSection({ empresa }: { empresa: Empresa }) {
  const uploadLogo   = useUploadLogo();
  const updateEmpresa = useUpdateEmpresa();

  const [colorPrimario,   setColorPrimario]   = useState(empresa.color_primario   ?? '#1E3A5F');
  const [colorSecundario, setColorSecundario] = useState(empresa.color_secundario ?? '#2E6DA4');
  const [localPreview,    setLocalPreview]    = useState<string | null>(null);
  const [error,           setError]           = useState<string | null>(null);

  const existingLogoUrl = useLogoBlobUrl(empresa.id, !!empresa.logo_mime);
  const logoPreview = localPreview ?? existingLogoUrl;

  useEffect(() => {
    setColorPrimario(empresa.color_primario ?? '#1E3A5F');
    setColorSecundario(empresa.color_secundario ?? '#2E6DA4');
    setLocalPreview(null);
  }, [empresa.id]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Solo se aceptan imágenes JPEG, PNG o WEBP'); return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('El archivo supera el límite de 2MB'); return;
    }
    setLocalPreview(URL.createObjectURL(file));
    try {
      await uploadLogo.mutateAsync({ id: empresa.id, file });
    } catch (err) {
      setError(getApiErrorMessage(err) ?? 'Error al subir el logo');
    }
  };

  const saveColores = async () => {
    setError(null);
    if (!HEX_RE.test(colorPrimario) || !HEX_RE.test(colorSecundario)) {
      setError('Los colores deben tener formato hex (#RRGGBB)'); return;
    }
    try {
      await updateEmpresa.mutateAsync({
        id:   empresa.id,
        data: { color_primario: colorPrimario, color_secundario: colorSecundario },
      });
    } catch (err) {
      setError(getApiErrorMessage(err) ?? 'Error al guardar los colores');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Label className="mb-2">Logo</Label>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-md border border-border flex items-center justify-center overflow-hidden bg-gray-50 shrink-0">
            {logoPreview
              ? <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />
              : <Building2 size={24} className="text-muted-foreground" />}
          </div>
          <label className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-input hover:bg-accent cursor-pointer transition-colors">
            <Upload size={14} />
            {uploadLogo.isPending ? 'Subiendo…' : 'Subir logo'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={e => handleFile(e.target.files?.[0])}
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="mb-1">Color primario</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={colorPrimario}
              onChange={e => setColorPrimario(e.target.value)}
              className="w-10 h-9 border rounded cursor-pointer p-0.5"
            />
            <Input
              value={colorPrimario}
              onChange={e => setColorPrimario(e.target.value)}
              className="font-mono"
              placeholder="#1E3A5F"
            />
          </div>
        </div>
        <div>
          <Label className="mb-1">Color secundario</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={colorSecundario}
              onChange={e => setColorSecundario(e.target.value)}
              className="w-10 h-9 border rounded cursor-pointer p-0.5"
            />
            <Input
              value={colorSecundario}
              onChange={e => setColorSecundario(e.target.value)}
              className="font-mono"
              placeholder="#2E6DA4"
            />
          </div>
        </div>
      </div>

      {/* Preview en tiempo real del sidebar con estos colores */}
      <div>
        <Label className="mb-1">Preview del sidebar</Label>
        <div className="flex w-56 rounded-md border border-border overflow-hidden shadow-sm">
          <div className="w-2" style={{ backgroundColor: colorPrimario }} />
          <div className="flex-1 bg-white p-3">
            <div className="flex items-center gap-2 mb-3">
              {logoPreview
                ? <img src={logoPreview} alt="" className="h-5 w-5 object-contain" />
                : <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorPrimario }} />}
              <span className="text-sm font-semibold" style={{ color: logoPreview ? undefined : colorPrimario }}>
                {empresa.nombre_corto ?? empresa.nombre}
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="h-2 w-full rounded" style={{ backgroundColor: colorSecundario, opacity: 0.25 }} />
              <div className="h-2 w-3/4 rounded bg-gray-100" />
              <div className="h-2 w-5/6 rounded bg-gray-100" />
            </div>
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button size="sm" onClick={saveColores} disabled={updateEmpresa.isPending}>
        {updateEmpresa.isPending ? 'Guardando…' : 'Guardar colores'}
      </Button>
    </div>
  );
}

// ── Datos de la empresa ───────────────────────────────────────────────────────

const datosSchema = z.object({
  razon_social: z.string().optional(),
  cuit:         z.string().regex(/^\d{2}-\d{8}-\d{1}$/, 'Formato inválido. Debe ser XX-XXXXXXXX-X').or(z.literal('')).optional(),
  domicilio:    z.string().optional(),
  telefono:     z.string().optional(),
  email:        z.string().email('Email inválido').or(z.literal('')).optional(),
  web:          z.string().optional(),
});
type DatosFormData = z.infer<typeof datosSchema>;

function DatosEmpresaSection({ empresa }: { empresa: Empresa }) {
  const updateEmpresa = useUpdateEmpresa();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<DatosFormData>({
    resolver:      zodResolver(datosSchema),
    defaultValues: {
      razon_social: empresa.razon_social ?? '',
      cuit:         empresa.cuit         ?? '',
      domicilio:    empresa.domicilio    ?? '',
      telefono:     empresa.telefono     ?? '',
      email:        empresa.email        ?? '',
      web:          empresa.web          ?? '',
    },
  });

  useEffect(() => {
    reset({
      razon_social: empresa.razon_social ?? '',
      cuit:         empresa.cuit         ?? '',
      domicilio:    empresa.domicilio    ?? '',
      telefono:     empresa.telefono     ?? '',
      email:        empresa.email        ?? '',
      web:          empresa.web          ?? '',
    });
  }, [empresa.id]);

  const onSubmit = async (data: DatosFormData) => {
    await updateEmpresa.mutateAsync({
      id:   empresa.id,
      data: {
        razon_social: data.razon_social || null,
        cuit:         data.cuit         || null,
        domicilio:    data.domicilio    || null,
        telefono:     data.telefono     || null,
        email:        data.email        || null,
        web:          data.web          || null,
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-2xl">
      <div>
        <Label className="mb-1">Razón social</Label>
        <Input {...register('razon_social')} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="mb-1">CUIT</Label>
          <Input {...register('cuit')} placeholder="30-71234567-8" />
          {errors.cuit && <p className="text-xs text-destructive mt-1">{errors.cuit.message}</p>}
        </div>
        <div>
          <Label className="mb-1">Teléfono</Label>
          <Input {...register('telefono')} />
        </div>
      </div>
      <div>
        <Label className="mb-1">Domicilio</Label>
        <Input {...register('domicilio')} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="mb-1">Email</Label>
          <Input type="email" {...register('email')} />
          {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <Label className="mb-1">Web</Label>
          <Input {...register('web')} placeholder="https://..." />
        </div>
      </div>
      {updateEmpresa.isError && (
        <p className="text-xs text-destructive">{getApiErrorMessage(updateEmpresa.error) ?? 'Error al guardar'}</p>
      )}
      <Button type="submit" size="sm" disabled={updateEmpresa.isPending}>
        {updateEmpresa.isPending ? 'Guardando…' : 'Guardar datos'}
      </Button>
    </form>
  );
}

// ── Configuración operativa ────────────────────────────────────────────────────

function ConfigOperativaSection({ empresa }: { empresa: Empresa }) {
  const updateEmpresa = useUpdateEmpresa();
  const [monedaDefault, setMonedaDefault] = useState<Moneda>(empresa.moneda_default);
  const [timezone,      setTimezone]      = useState(empresa.timezone);

  useEffect(() => {
    setMonedaDefault(empresa.moneda_default);
    setTimezone(empresa.timezone);
  }, [empresa.id]);

  const selectCls = 'w-full border border-input rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring';

  const save = () => updateEmpresa.mutate({ id: empresa.id, data: { moneda_default: monedaDefault, timezone } });

  return (
    <div className="space-y-4 max-w-md">
      <div>
        <Label className="mb-1">Moneda por defecto</Label>
        <select value={monedaDefault} onChange={e => setMonedaDefault(e.target.value as Moneda)} className={selectCls}>
          <option value="ARS">ARS — Peso argentino</option>
          <option value="USD">USD — Dólar</option>
        </select>
      </div>
      <div>
        <Label className="mb-1">Zona horaria</Label>
        <select value={timezone} onChange={e => setTimezone(e.target.value)} className={selectCls}>
          {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
        </select>
      </div>
      <Button size="sm" onClick={save} disabled={updateEmpresa.isPending}>
        {updateEmpresa.isPending ? 'Guardando…' : 'Guardar configuración'}
      </Button>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

type SeccionActiva = 'visual' | 'datos' | 'operativa';

export default function ConfiguracionEmpresaPage() {
  const { user } = useAuth();
  const { data: empresas = [], isLoading: loadingEmpresas } = useEmpresas();
  const [empresaId, setEmpresaId]   = useState<number | null>(null);
  const [seccion,   setSeccion]     = useState<SeccionActiva>('visual');
  const { data: empresa, isLoading: loadingEmpresa } = useEmpresa(empresaId);

  useEffect(() => {
    if (empresaId === null && empresas.length > 0) setEmpresaId(empresas[0].id);
  }, [empresas, empresaId]);

  if (!user) return null;
  if (!user.puedeCambiarEmpresa) return <Navigate to="/dashboard" replace />;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-foreground mb-1">Configuración de empresa</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Configurá la identidad visual y los datos de cada empresa, sin necesidad de cambiar tu empresa activa.
      </p>

      {loadingEmpresas ? (
        <p className="text-sm text-muted-foreground">Cargando empresas...</p>
      ) : (
        <EmpresaSelector empresas={empresas} selectedId={empresaId} onSelect={setEmpresaId} />
      )}

      {loadingEmpresa || !empresa ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <>
          <div className="flex border-b border-border mb-6">
            {([
              { key: 'visual',     label: 'Identidad visual' },
              { key: 'datos',      label: 'Datos de la empresa' },
              { key: 'operativa',  label: 'Configuración operativa' },
            ] as { key: SeccionActiva; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSeccion(key)}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  seccion === key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {seccion === 'visual'    && <IdentidadVisualSection empresa={empresa} />}
          {seccion === 'datos'     && <DatosEmpresaSection empresa={empresa} />}
          {seccion === 'operativa' && <ConfigOperativaSection empresa={empresa} />}
        </>
      )}
    </div>
  );
}
