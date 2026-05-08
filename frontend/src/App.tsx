import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProtectedLayout      from '@/components/layout/ProtectedLayout';
import LoginPage            from '@/pages/Login';
import EventosPage          from '@/pages/Eventos';
import EventoPage           from '@/pages/Evento';
import ConfiguracionPage    from '@/pages/Configuracion';

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
            <Route path="/eventos"       element={<EventosPage />} />
            <Route path="/eventos/:id"   element={<EventoPage />} />
            <Route path="/configuracion" element={<ConfiguracionPage />} />
            <Route path="*" element={<Navigate to="/eventos" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
