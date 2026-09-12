import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Fuel, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { exportarCombustibleUrl } from '@/hooks/useCombustible';
import { Button } from '@/components/ui/button';
import CargasTab from './CargasTab';
import ResumenTab from './ResumenTab';
import AnalisisTab from './AnalisisTab';
import AutorizadasTab from './AutorizadasTab';

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
      <div className="no-print flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Fuel size={22} />
          Combustible
        </h1>
        <a href={exportarCombustibleUrl(new Date().getFullYear())} target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm"><Download size={14} className="mr-1.5" /> Exportar Excel</Button>
        </a>
      </div>

      <div className="no-print flex border-b border-border overflow-x-auto">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
              tab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'cargas'      && <CargasTab />}
      {tab === 'resumen'     && <ResumenTab />}
      {tab === 'analisis'    && <AnalisisTab />}
      {tab === 'autorizadas' && isAdmin && <AutorizadasTab />}
    </div>
  );
}
