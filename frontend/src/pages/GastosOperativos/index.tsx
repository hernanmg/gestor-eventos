import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Ambulance, ClipboardCheck, ClipboardList, Clock } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import TabStrip from '@/components/ui/TabStrip';
import CajaDelMesTab from './CajaDelMesTab';
import SiniestrosTab from './SiniestrosTab';
import ExcedenteHorasTab from './ExcedenteHorasTab';
import PagosSemanalesTab from './PagosSemanalesTab';

type Seccion = 'caja' | 'pagos-semanales' | 'siniestros' | 'excedente-horas';

const SECCION_QUERY: Record<string, Seccion> = {
  caja: 'caja',
  'pagos-semanales': 'pagos-semanales',
  siniestros: 'siniestros',
  'excedente-horas': 'excedente-horas',
};

// "Siniestros" son de EMPLEADOS acá (accidentes de trabajo/ART, modelo
// SiniestroEmpleado) — distinto de los siniestros de VEHÍCULOS (Lorena/Santi,
// choques/robos/daños), que no tienen módulo todavía. Ícono de ambulancia (no
// uno de auto) para no confundir los dos dominios.
const NAV: { key: Seccion; label: string; icon: typeof ClipboardList }[] = [
  { key: 'caja',             label: 'Caja del mes',     icon: ClipboardList },
  { key: 'pagos-semanales',  label: 'Pagos semanales',  icon: ClipboardCheck },
  { key: 'siniestros',       label: 'Siniestros',       icon: Ambulance },
  { key: 'excedente-horas',  label: 'Excedente horas',  icon: Clock },
];

export default function GastosOperativosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [seccion, setSeccion] = useState<Seccion>(tabParam && SECCION_QUERY[tabParam] ? SECCION_QUERY[tabParam] : 'caja');

  // Un link de la campanita (?tab=pagos-semanales&resumen=N) estando ya en la
  // página tiene que cambiar de pestaña.
  useEffect(() => {
    if (tabParam && SECCION_QUERY[tabParam]) setSeccion(SECCION_QUERY[tabParam]);
  }, [tabParam]);

  const cambiar = (s: Seccion) => {
    setSeccion(s);
    setSearchParams(s === 'caja' ? {} : { tab: s });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <PageHeader
        title="Gastos del mes"
        subtitle="Caja general de DOS57, pagos semanales para aprobar, siniestros de empleados y excedente de horas de Fofi/Nestoras."
      />

      <TabStrip<Seccion> items={NAV} value={seccion} onChange={cambiar} />

      {seccion === 'caja' && <CajaDelMesTab />}
      {seccion === 'pagos-semanales' && <PagosSemanalesTab />}
      {seccion === 'siniestros' && <SiniestrosTab />}
      {seccion === 'excedente-horas' && <ExcedenteHorasTab />}
    </div>
  );
}
