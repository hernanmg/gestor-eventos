import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateEvento, useUpdateEvento } from '@/hooks/useEvento';
import { getApiErrorMessage } from '@/lib/utils';
import type { Evento } from '@/types';

const socioSchema = z.object({
  nombre:     z.string().min(1, 'Requerido'),
  porcentaje: z.coerce
    .number({ invalid_type_error: 'Número requerido' })
    .positive('Debe ser > 0'),
});

const schema = z.object({
  nombre:       z.string().min(1, 'El nombre es requerido'),
  fecha_inicio: z.string().optional(),
  fecha_fin:    z.string().optional(),
  moneda_base:  z.enum(['ARS', 'USD']),
  socios:       z.array(socioSchema).default([]),
}).refine(data => {
  if (!data.socios || data.socios.length === 0) return true;
  const sum = data.socios.reduce((acc, s) => acc + s.porcentaje, 0);
  return Math.abs(sum - 100) < 0.01;
}, { message: 'Los porcentajes deben sumar exactamente 100', path: ['socios'] });

type FormData = z.infer<typeof schema>;

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.split('T')[0];
}

interface Props {
  evento?:   Evento;
  onSuccess: () => void;
  onCancel:  () => void;
}

export default function EventoForm({ evento, onSuccess, onCancel }: Props) {
  const createEvento = useCreateEvento();
  const updateEvento = useUpdateEvento();
  const isEdit       = !!evento;
  const isPending    = createEvento.isPending || updateEvento.isPending;
  const mutationError = createEvento.error || updateEvento.error;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre:       evento?.nombre       ?? '',
      fecha_inicio: toDateInputValue(evento?.fecha_inicio),
      fecha_fin:    toDateInputValue(evento?.fecha_fin),
      moneda_base:  evento?.moneda_base  ?? 'ARS',
      socios:       (evento?.socios as FormData['socios']) ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'socios' });
  const watchedSocios = useWatch({ control, name: 'socios' }) ?? [];
  const sociosSum = watchedSocios.reduce((acc, s) => acc + (Number(s.porcentaje) || 0), 0);

  const onSubmit = async (data: FormData) => {
    const payload = {
      nombre:       data.nombre,
      fecha_inicio: data.fecha_inicio || null,
      fecha_fin:    data.fecha_fin    || null,
      moneda_base:  data.moneda_base  as 'ARS' | 'USD',
      socios:       data.socios,
    };
    try {
      if (isEdit) {
        await updateEvento.mutateAsync({ id: evento!.id, data: payload });
      } else {
        await createEvento.mutateAsync(payload);
      }
      onSuccess();
    } catch {
      // error shown below via mutationError
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {/* Nombre */}
      <div className="space-y-1">
        <Label htmlFor="nombre">Nombre *</Label>
        <Input
          id="nombre"
          disabled={isPending}
          {...register('nombre')}
          className={errors.nombre ? 'border-destructive' : ''}
        />
        {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
      </div>

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="fecha_inicio">Fecha inicio</Label>
          <Input id="fecha_inicio" type="date" disabled={isPending} {...register('fecha_inicio')} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fecha_fin">Fecha fin</Label>
          <Input id="fecha_fin" type="date" disabled={isPending} {...register('fecha_fin')} />
        </div>
      </div>

      {/* Moneda base */}
      <div className="space-y-1">
        <Label htmlFor="moneda_base">Moneda base</Label>
        <select
          id="moneda_base"
          disabled={isPending}
          {...register('moneda_base')}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <option value="ARS">ARS — Peso argentino</option>
          <option value="USD">USD — Dólar</option>
        </select>
      </div>

      {/* Socios */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Socios</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => append({ nombre: '', porcentaje: 0 })}
          >
            <Plus size={14} className="mr-1" />
            Agregar
          </Button>
        </div>

        {fields.length > 0 && (
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-2 items-start">
                <div className="flex-1">
                  <Input
                    placeholder="Nombre del socio"
                    disabled={isPending}
                    {...register(`socios.${index}.nombre`)}
                    className={errors.socios?.[index]?.nombre ? 'border-destructive' : ''}
                  />
                  {errors.socios?.[index]?.nombre && (
                    <p className="text-xs text-destructive mt-0.5">{errors.socios[index]!.nombre!.message}</p>
                  )}
                </div>
                <div className="w-24">
                  <Input
                    type="number"
                    placeholder="%"
                    min={0}
                    max={100}
                    step={0.01}
                    disabled={isPending}
                    {...register(`socios.${index}.porcentaje`)}
                    className={errors.socios?.[index]?.porcentaje ? 'border-destructive' : ''}
                  />
                  {errors.socios?.[index]?.porcentaje && (
                    <p className="text-xs text-destructive mt-0.5">{errors.socios[index]!.porcentaje!.message}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isPending}
                  onClick={() => remove(index)}
                  className="text-destructive hover:text-destructive shrink-0"
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}

            {/* Suma en tiempo real */}
            <p className={`text-xs font-medium text-right ${Math.abs(sociosSum - 100) < 0.01 ? 'text-green-600' : 'text-muted-foreground'}`}>
              Total: {sociosSum.toFixed(2)}%
              {Math.abs(sociosSum - 100) < 0.01 ? ' ✓' : ' (debe ser 100%)'}
            </p>
          </div>
        )}

        {errors.socios?.root && (
          <p className="text-xs text-destructive">{errors.socios.root.message}</p>
        )}
        {errors.socios?.message && (
          <p className="text-xs text-destructive">{errors.socios.message}</p>
        )}
      </div>

      {/* Error del servidor */}
      {mutationError && (
        <div className="rounded-md bg-destructive/10 px-3 py-2">
          <p className="text-sm text-destructive">{getApiErrorMessage(mutationError)}</p>
        </div>
      )}

      {/* Acciones */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" disabled={isPending} onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear evento'}
        </Button>
      </div>
    </form>
  );
}
