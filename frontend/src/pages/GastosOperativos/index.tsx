import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import CajaDelMesTab from './CajaDelMesTab';
import SiniestrosTab from './SiniestrosTab';
import ExcedenteHorasTab from './ExcedenteHorasTab';

type Seccion = 'caja' | 'siniestros' | 'excedente-horas';

const SECCION_QUERY: Record<string, Seccion> = {
  caja: 'caja',
  siniestros: 'siniestros',
  'excedente-horas': 'excedente-horas',
};

// "Siniestros" son de EMPLEADOS acá (accidentes de trabajo/ART, modelo
// SiniestroEmpleado) — distinto de los siniestros de VEHÍCULOS (Lorena/Santi,
// choques/robos/daños), que no tienen módulo todavía. Ícono 🚑 (no un ícono
// de auto) para no confundir los dos dominios.
const NAV: { key: Seccion; label: string; icon?: typeof ClipboardList; emoji?: string }[] = [
  { key: 'caja',             label: 'Caja del mes',     icon: ClipboardList },
  { key: 'siniestros',       label: 'Siniestros',       emoji: '🚑' },
  { key: 'excedente-horas',  label: 'Excedente horas',  icon: Clock },
];

export default function GastosOperativosPage() {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [seccion, setSeccion] = useState<Seccion>(tabParam && SECCION_QUERY[tabParam] ? SECCION_QUERY[tabParam] : 'caja');

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Gastos del mes</h1>
        <p className="text-sm text-muted-foreground">Caja general de DOS57, siniestros de empleados y excedente de horas de Fofi/Nestoras.</p>
      </div>

      <div className="flex gap-1 border-b">
        {NAV.map(n => (
          <button
            key={n.key}
            onClick={() => setSeccion(n.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              seccion === n.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {n.icon ? <n.icon size={15} /> : <span className="text-sm leading-none">{n.emoji}</span>}
            {n.label}
          </button>
        ))}
      </div>

      {seccion === 'caja' && <CajaDelMesTab />}
      {seccion === 'siniestros' && <SiniestrosTab />}
      {seccion === 'excedente-horas' && <ExcedenteHorasTab />}
    </div>
  );
}
