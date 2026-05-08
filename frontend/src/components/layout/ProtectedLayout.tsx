import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Sidebar from './Sidebar';

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

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(v => !v)}
        user={user}
        onLogout={logout}
      />

      {/* Contenido principal */}
      <main className="flex-1 overflow-auto min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
