import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getApiErrorMessage, cn } from '@/lib/utils';

export default function SeleccionarEmpresaPage() {
  const navigate = useNavigate();
  const { user, isLoading, switchEmpresa, isSwitchingEmpresa, switchEmpresaError } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) { navigate('/login', { replace: true }); return; }
    if (user.empresaId !== null) { navigate('/eventos', { replace: true }); }
  }, [user, isLoading, navigate]);

  if (isLoading || !user || user.empresaId !== null) return null;

  const empresas = user.empresasDisponibles ?? [];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Elegí una empresa</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tu usuario tiene acceso a más de una empresa. Seleccioná con cuál querés trabajar.
          </p>
        </div>

        {switchEmpresaError && (
          <div className="rounded-md bg-destructive/10 px-3 py-2">
            <p className="text-sm text-destructive">{getApiErrorMessage(switchEmpresaError)}</p>
          </div>
        )}

        <div className="space-y-2">
          {empresas.map((empresa) => (
            <button
              key={empresa.id}
              type="button"
              disabled={isSwitchingEmpresa}
              onClick={() => switchEmpresa(empresa.id)}
              className={cn(
                'w-full rounded-md border border-input px-4 py-3 text-left text-sm font-medium',
                'hover:border-primary hover:bg-primary/5 transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {empresa.nombre_corto ?? empresa.nombre}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
