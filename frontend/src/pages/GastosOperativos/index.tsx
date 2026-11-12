import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Ambulance, ClipboardList, Clock } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import TabStrip from '@/components/ui/TabStrip';
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
// choques/robos/daños), que no tienen módulo todavía. Ícono de ambulancia (no
// uno de auto) para no confundir los dos dominios.
const NAV: { key: Seccion; label: string; icon: typeof ClipboardList }[] = [
  { key: 'caja',             label: 'Caja del mes',     icon: ClipboardList },
  { key: 'siniestros',       label: 'Siniestros',       icon: Ambulance },
  { key: 'excedente-horas',  label: 'Excedente horas',  icon: Clock },
];

export default function GastosOperativosPage() {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [seccion, setSeccion] = useState<Seccion>(tabParam && SECCION_QUERY[tabParam] ? SECCION_QUERY[tabParam] : 'caja');

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <PageHeader
        title="Gastos del mes"
        subtitle="Caja general de DOS57, siniestros de empleados y excedente de horas de Fofi/Nestoras."
      />

      <TabStrip<Seccion> items={NAV} value={seccion} onChange={setSeccion} />

      {seccion === 'caja' && <CajaDelMesTab />}
      {seccion === 'siniestros' && <SiniestrosTab />}
      {seccion === 'excedente-horas' && <ExcedenteHorasTab />}
    </div>
  );
}
