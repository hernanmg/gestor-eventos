import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { exportarCombustibleUrl } from '@/hooks/useCombustible';
import { Button } from '@/components/ui/button';
import CargasTab from './CargasTab';
import ResumenTab from './ResumenTab';
import AnalisisTab from './AnalisisTab';
import AutorizadasTab from './AutorizadasTab';
import PageHeader from '@/components/ui/PageHeader';
import TabStrip from '@/components/ui/TabStrip';

type CombustibleTab = 'cargas' | 'resumen' | 'analisis' | 'autorizadas';

export default function CombustiblePage() {
  const { user } = useAuth();
  const isAdmin = user?.rol === 'ADMIN';
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as CombustibleTab | null;
  const [tab, setTab] = useState<CombustibleTab>(tabParam ?? 'cargas');

  const TABS: { key: CombustibleTab; label: string }[] = [
    { key: 'cargas',   label: 'Cargas del mes' },
    { key: 'resumen',  label: 'Resumen' },
    { key: 'analisis', label: 'Análisis anual' },
    ...(isAdmin ? [{ key: 'autorizadas' as const, label: 'Cargas autorizadas' }] : []),
  ];

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <PageHeader
        title="Combustible"
        className="no-print"
        actions={
          <a href={exportarCombustibleUrl(new Date().getFullYear())} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm"><Download size={14} className="mr-1.5" /> Exportar Excel</Button>
          </a>
        }
      />

      <TabStrip items={TABS} value={tab} onChange={setTab} />

      {tab === 'cargas'      && <CargasTab />}
      {tab === 'resumen'     && <ResumenTab />}
      {tab === 'analisis'    && <AnalisisTab />}
      {tab === 'autorizadas' && isAdmin && <AutorizadasTab />}
    </div>
  );
}
