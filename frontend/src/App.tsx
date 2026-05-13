import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProtectedLayout      from '@/components/layout/ProtectedLayout';
import LoginPage            from '@/pages/Login';
import DashboardPage        from '@/pages/Dashboard';
import EventosPage          from '@/pages/Eventos';
import EventoPage           from '@/pages/Evento';
import ConfiguracionPage    from '@/pages/Configuracion';
import ImporterPage         from '@/pages/Importer';
import ProveedoresPage      from '@/pages/Proveedores';
import ProveedorDetallePage from '@/pages/Proveedores/ProveedorDetalle';
import AuditoriaPage        from '@/pages/Auditoria';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry:                false,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedLayout />}>
            <Route path="/dashboard"     element={<DashboardPage />} />
            <Route path="/eventos"       element={<EventosPage />} />
            <Route path="/eventos/:id"   element={<EventoPage />} />
            <Route path="/configuracion"    element={<ConfiguracionPage />} />
            <Route path="/importer"         element={<ImporterPage />} />
            <Route path="/proveedores"      element={<ProveedoresPage />} />
            <Route path="/proveedores/:id"  element={<ProveedorDetallePage />} />
            <Route path="/auditoria"        element={<AuditoriaPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
