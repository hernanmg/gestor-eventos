import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/ui/PageHeader';
import TabStrip from '@/components/ui/TabStrip';
import VehiculosTab from './VehiculosTab';
import SegurosTab from './SegurosTab';
import PatentesPeajesTab from './PatentesPeajesTab';
import TallerTab from './TallerTab';
import SiniestrosVehiculoPanel from '@/components/siniestros/SiniestrosVehiculoPanel';
import { useAuth } from '@/hooks/useAuth';

type FlotaTab = 'vehiculos' | 'seguros' | 'patentes' | 'taller' | 'siniestros';

export default function FlotaPage() {
  const { user } = useAuth();
  const canEdit = user?.rol === 'ADMIN' || user?.rol === 'OPERADOR';
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as FlotaTab | null;
  const vehiculoParam = searchParams.get('vehiculo');
  const [tab, setTab] = useState<FlotaTab>(tabParam ?? 'vehiculos');

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <PageHeader title="Flota" />

      <TabStrip<FlotaTab>
        value={tab}
        onChange={setTab}
        items={[
          { key: 'vehiculos', label: 'Vehículos' },
          { key: 'seguros',   label: 'Seguros' },
          { key: 'patentes',  label: 'Patentes y Peajes' },
          { key: 'taller',    label: 'Taller mecánico' },
          { key: 'siniestros', label: 'Siniestros' },
        ]}
      />

      {tab === 'vehiculos' && <VehiculosTab focusVehiculoId={vehiculoParam ? Number(vehiculoParam) : null} />}
      {tab === 'seguros'   && <SegurosTab />}
      {tab === 'patentes'  && <PatentesPeajesTab focusVehiculoId={vehiculoParam ? Number(vehiculoParam) : null} />}
      {tab === 'taller'    && <TallerTab />}
      {tab === 'siniestros' && <SiniestrosVehiculoPanel canEdit={canEdit} />}
    </div>
  );
}
