import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { getApiErrorMessage, cn } from '@/lib/utils';

const schema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, isLoading, login, loginError, isLoginLoading } = useAuth();

  // Si ya hay sesión activa, redirige sin mostrar el formulario
  useEffect(() => {
    if (!isLoading && user) {
      navigate('/eventos', { replace: true });
    }
  }, [user, isLoading, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await login(data);
    } catch {
      // El error queda en loginError — no se necesita nada aquí
    }
  };

  // Evita flash del formulario mientras se verifica la sesión
  if (isLoading || user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-white p-8 shadow-sm">
        {/* Brand */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Portal</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gestión de Eventos</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {/* Email */}
          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              disabled={isLoginLoading}
              {...register('email')}
              className={cn(
                'block w-full rounded-md border px-3 py-2 text-sm',
                'focus:outline-none focus:ring-2 focus:ring-ring',
                'disabled:opacity-50',
                errors.email ? 'border-destructive' : 'border-input',
              )}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              disabled={isLoginLoading}
              {...register('password')}
              className={cn(
                'block w-full rounded-md border px-3 py-2 text-sm',
                'focus:outline-none focus:ring-2 focus:ring-ring',
                'disabled:opacity-50',
                errors.password ? 'border-destructive' : 'border-input',
              )}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          {/* Error del servidor */}
          {loginError && (
            <div className="rounded-md bg-destructive/10 px-3 py-2">
              <p className="text-sm text-destructive">{getApiErrorMessage(loginError)}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoginLoading}
            className={cn(
              'w-full rounded-md bg-primary px-4 py-2 text-sm font-medium',
              'text-primary-foreground hover:bg-primary/90',
              'transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isLoginLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}
