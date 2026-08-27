import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import VehiculosTab from './VehiculosTab';
import SegurosTab from './SegurosTab';
import PatentesPeajesTab from './PatentesPeajesTab';
import TallerTab from './TallerTab';

type FlotaTab = 'vehiculos' | 'seguros' | 'patentes' | 'taller';

export default function FlotaPage() {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as FlotaTab | null;
  const vehiculoParam = searchParams.get('vehiculo');
  const [tab, setTab] = useState<FlotaTab>(tabParam ?? 'vehiculos');

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Truck size={22} />
        Flota
      </h1>

      <div className="flex border-b border-border overflow-x-auto">
        {([
          { key: 'vehiculos', label: 'Vehículos' },
          { key: 'seguros',   label: 'Seguros' },
          { key: 'patentes',  label: 'Patentes y Peajes' },
          { key: 'taller',    label: 'Taller mecánico' },
        ] as { key: FlotaTab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'vehiculos' && <VehiculosTab focusVehiculoId={vehiculoParam ? Number(vehiculoParam) : null} />}
      {tab === 'seguros'   && <SegurosTab />}
      {tab === 'patentes'  && <PatentesPeajesTab focusVehiculoId={vehiculoParam ? Number(vehiculoParam) : null} />}
      {tab === 'taller'    && <TallerTab />}
    </div>
  );
}
