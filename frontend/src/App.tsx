import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProtectedLayout      from '@/components/layout/ProtectedLayout';
import LoginPage            from '@/pages/Login';
import SeleccionarEmpresaPage from '@/pages/SeleccionarEmpresa';
import MacroPage            from '@/pages/Macro';
import CajaGlobalPage       from '@/pages/Caja';
import CuentaDetallePage    from '@/pages/Caja/CuentaDetalle';
import CalendarioPage       from '@/pages/Calendario';
import EventosPage          from '@/pages/Eventos';
import PreMacroPage         from '@/pages/PreMacro';
import EventoPage                  from '@/pages/Evento';
import VincularProveedoresPage     from '@/pages/Evento/VincularProveedores';
import ConfiguracionPage    from '@/pages/Configuracion';
import ConfiguracionEmpresaPage from '@/pages/ConfiguracionEmpresa';
import RRHHPage             from '@/pages/RRHH';
import RRHHImportarPage     from '@/pages/RRHH/Importar';
import ImporterPage         from '@/pages/Importer';
import ProveedoresPage      from '@/pages/Proveedores';
import ProveedorDetallePage from '@/pages/Proveedores/ProveedorDetalle';
import AuditoriaPage        from '@/pages/Auditoria';
import StockPage            from '@/pages/Stock';
import ProductoDetallePage  from '@/pages/Stock/ProductoDetalle';
import FirmarMovimientoPage from '@/pages/Stock/FirmarMovimiento';
import FacturasPage         from '@/pages/Facturas';
import FacturaDetalle       from '@/pages/Facturas/FacturaDetalle';
import CuentasCorrientesPage from '@/pages/CuentasCorrientes';
import CuentaCorrienteDetalle from '@/pages/CuentasCorrientes/Detalle';
import ParteDiarioPage      from '@/pages/ParteDiario';
import ParteDiarioHistorialPage from '@/pages/ParteDiario/Historial';
import FlotaPage            from '@/pages/Flota';
import AFIPPrestamosPage    from '@/pages/AFIPPrestamos';
import FacturasEmitidasPage from '@/pages/FacturasEmitidas';
import EspaciosCompartidosPage from '@/pages/EspaciosCompartidos';
import EspacioCompartidoDetallePage from '@/pages/EspaciosCompartidos/Detalle';
import { useAuth }          from '@/hooks/useAuth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry:                false,
      refetchOnWindowFocus: false,
    },
  },
});

// Admin global (rol ADMIN sin empresa fija) va a /macro; el resto de roles a /eventos.
function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return null;
  const esAdminGlobal = user.rol === 'ADMIN' && user.puedeCambiarEmpresa;
  return <Navigate to={esAdminGlobal ? '/macro' : '/eventos'} replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/seleccionar-empresa" element={<SeleccionarEmpresaPage />} />

          <Route element={<ProtectedLayout />}>
            <Route path="/macro"         element={<MacroPage />} />
            <Route path="/caja"          element={<CajaGlobalPage />} />
            <Route path="/caja/:cuentaId" element={<CuentaDetallePage />} />
            <Route path="/dashboard"     element={<HomeRedirect />} />
            <Route path="/calendario"    element={<CalendarioPage />} />
            <Route path="/eventos"                              element={<EventosPage />} />
            <Route path="/pre-macro/:id"                        element={<PreMacroPage />} />
            <Route path="/eventos/:id"                         element={<EventoPage />} />
            <Route path="/eventos/:id/vincular-proveedores"    element={<VincularProveedoresPage />} />
            <Route path="/configuracion"    element={<ConfiguracionPage />} />
            <Route path="/configuracion/empresa" element={<ConfiguracionEmpresaPage />} />
            <Route path="/rrhh"             element={<RRHHPage />} />
            <Route path="/rrhh/importar"    element={<RRHHImportarPage />} />
            <Route path="/parte-diario"            element={<ParteDiarioPage />} />
            <Route path="/parte-diario/historial"  element={<ParteDiarioHistorialPage />} />
            <Route path="/importer"         element={<ImporterPage />} />
            <Route path="/proveedores"      element={<ProveedoresPage />} />
            <Route path="/proveedores/:id"  element={<ProveedorDetallePage />} />
            <Route path="/auditoria"               element={<AuditoriaPage />} />
            <Route path="/stock"                   element={<StockPage />} />
            <Route path="/stock/productos/:id"     element={<ProductoDetallePage />} />
            <Route path="/stock/firmar"            element={<FirmarMovimientoPage />} />
            <Route path="/facturas"                element={<FacturasPage />} />
            <Route path="/facturas/:id"            element={<FacturaDetalle />} />
            <Route path="/cuentas-corrientes"      element={<CuentasCorrientesPage />} />
            <Route path="/cuentas-corrientes/:id"  element={<CuentaCorrienteDetalle />} />
            <Route path="/flota"                   element={<FlotaPage />} />
            <Route path="/afip-prestamos"          element={<AFIPPrestamosPage />} />
            <Route path="/facturas-emitidas"       element={<FacturasEmitidasPage />} />
            <Route path="/espacios-compartidos"     element={<EspaciosCompartidosPage />} />
            <Route path="/espacios-compartidos/:id" element={<EspacioCompartidoDetallePage />} />
            <Route path="*" element={<HomeRedirect />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
