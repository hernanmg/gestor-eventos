import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Sidebar from './Sidebar';
import HelpPanel from '@/components/ui/HelpPanel';

export default function ProtectedLayout() {
  const { user, isLoading, logout } = useAuth();

  // Desktop (≥768px): sidebar abierto por defecto. Mobile: cerrado.
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);

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

  if (user.empresaId === null) {
    return <Navigate to="/seleccionar-empresa" replace />;
  }

  return (
    // app-wrapper: fondo con el patrón de la empresa activa (index.css + lib/empresaTheme.ts);
    // empresa-N queda como gancho para estilos puntuales por empresa.
    <div className={`app-shell app-wrapper empresa-${user.empresaId} flex h-screen overflow-hidden`}>
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(v => !v)}
        user={user}
        onLogout={logout}
      />

      {/* Contenido principal */}
      <main className="app-main flex-1 overflow-auto min-w-0">
        <Outlet />
      </main>

      {/* Help panel — rendered once at layout level */}
      <HelpPanel />
    </div>
  );
}
