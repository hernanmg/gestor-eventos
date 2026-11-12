import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth, ME_QUERY_KEY } from '@/hooks/useAuth';
import { getApiErrorMessage, getApiFieldErrors, cn } from '@/lib/utils';

// Cambio de contraseña propio. Obligatorio (sin "Volver") cuando el usuario
// tiene debeCambiarPassword: primer ingreso con la contraseña inicial o
// después de que un admin la resetea — ProtectedLayout lo manda acá.

const schema = z.object({
  actual:    z.string().min(1, 'Ingresá tu contraseña actual'),
  nueva:     z.string().min(8, 'Al menos 8 caracteres'),
  confirmar: z.string(),
}).refine(d => d.nueva === d.confirmar, { path: ['confirmar'], message: 'No coincide con la contraseña nueva' })
  .refine(d => d.nueva !== d.actual, { path: ['nueva'], message: 'Tiene que ser distinta de la actual' });

type FormData = z.infer<typeof schema>;

const inputCls = (error?: unknown) => cn(
  'block w-full rounded-md border px-3 py-2 text-sm',
  'focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50',
  error ? 'border-destructive' : 'border-input',
);

export default function CambiarPasswordPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isLoading, logout } = useAuth();
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) navigate('/login', { replace: true });
  }, [user, isLoading, navigate]);

  const { register, handleSubmit, setError, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const cambiar = useMutation({
    mutationFn: (d: FormData) => api.post('/auth/cambiar-password', { actual: d.actual, nueva: d.nueva }),
    onSuccess: async () => {
      setListo(true);
      await qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
    },
    onError: err => {
      const campos = getApiFieldErrors(err);
      if (campos?.actual) setError('actual', { message: campos.actual });
      if (campos?.nueva) setError('nueva', { message: campos.nueva });
    },
  });

  if (isLoading || !user) return null;
  const obligatorio = user.debeCambiarPassword && !listo;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cambiar contraseña</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {obligatorio
              ? 'Antes de seguir, elegí una contraseña propia. La que te pasaron era sólo para el primer ingreso.'
              : user.email}
          </p>
        </div>

        {listo ? (
          <div className="space-y-4">
            <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">Listo, tu contraseña quedó cambiada.</p>
            <button type="button" onClick={() => navigate('/', { replace: true })}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Continuar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(d => cambiar.mutate(d))} noValidate className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="actual" className="block text-sm font-medium text-foreground">Contraseña actual</label>
              <input id="actual" type="password" autoComplete="current-password" disabled={cambiar.isPending} {...register('actual')} className={inputCls(errors.actual)} />
              {errors.actual && <p className="text-xs text-destructive">{errors.actual.message}</p>}
            </div>
            <div className="space-y-1">
              <label htmlFor="nueva" className="block text-sm font-medium text-foreground">Contraseña nueva</label>
              <input id="nueva" type="password" autoComplete="new-password" disabled={cambiar.isPending} {...register('nueva')} className={inputCls(errors.nueva)} />
              {errors.nueva ? <p className="text-xs text-destructive">{errors.nueva.message}</p> : <p className="text-xs text-muted-foreground">Al menos 8 caracteres.</p>}
            </div>
            <div className="space-y-1">
              <label htmlFor="confirmar" className="block text-sm font-medium text-foreground">Repetir contraseña nueva</label>
              <input id="confirmar" type="password" autoComplete="new-password" disabled={cambiar.isPending} {...register('confirmar')} className={inputCls(errors.confirmar)} />
              {errors.confirmar && <p className="text-xs text-destructive">{errors.confirmar.message}</p>}
            </div>

            {cambiar.isError && !getApiFieldErrors(cambiar.error) && (
              <p className="text-sm text-destructive">{getApiErrorMessage(cambiar.error)}</p>
            )}

            <button type="submit" disabled={cambiar.isPending}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {cambiar.isPending ? 'Guardando…' : 'Cambiar contraseña'}
            </button>
            <button type="button" onClick={() => (obligatorio ? logout() : navigate(-1))}
              className="w-full text-sm text-muted-foreground hover:underline">
              {obligatorio ? 'Cerrar sesión' : 'Volver'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
