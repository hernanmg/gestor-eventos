import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Sidebar from './Sidebar';
import { MobileTabBar, MobileTopBar } from './MobileNav';
import HelpPanel from '@/components/ui/HelpPanel';

export default function ProtectedLayout() {
  const { user, isLoading, logout } = useAuth();

  // Sólo desktop: sidebar expandido o colapsado a íconos. En mobile no se
  // muestra (navegación por MobileTabBar).
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Cargando...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Contraseña inicial o reseteada por un admin: se cambia antes de seguir
  if (user.debeCambiarPassword) {
    return <Navigate to="/cambiar-password" replace />;
  }

  if (user.empresaId === null) {
    return <Navigate to="/seleccionar-empresa" replace />;
  }

  return (
    // app-wrapper: fondo con el patrón de la empresa activa (index.css + lib/empresaTheme.ts);
    // empresa-N queda como gancho para estilos puntuales por empresa.
    // Desktop: sidebar | contenido. Mobile (< md): barra superior, contenido y
    // barra inferior apilados — sin posiciones fijas, así la barra inferior
    // nunca tapa la última fila del contenido.
    <div className={`app-shell app-wrapper empresa-${user.empresaId} flex overflow-hidden`}>
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(v => !v)}
        user={user}
        onLogout={logout}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar user={user} onLogout={logout} />

        {/* Contenido principal */}
        <main className="app-main flex-1 overflow-auto min-w-0">
          <Outlet />
        </main>

        <MobileTabBar user={user} onLogout={logout} />
      </div>

      {/* Help panel — rendered once at layout level */}
      <HelpPanel />
    </div>
  );
}
