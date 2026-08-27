import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import PlanesAfipTab from './PlanesAfipTab';
import PrestamosTab from './PrestamosTab';

type AfipPrestamosTab = 'afip' | 'prestamos';

export default function AFIPPrestamosPage() {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as AfipPrestamosTab | null;
  const [tab, setTab] = useState<AfipPrestamosTab>(tabParam ?? 'afip');

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Landmark size={22} />
        AFIP / Créditos
      </h1>

      <div className="flex border-b border-border overflow-x-auto">
        {([
          { key: 'afip',      label: 'Planes AFIP' },
          { key: 'prestamos', label: 'Créditos Bancarios' },
        ] as { key: AfipPrestamosTab; label: string }[]).map(({ key, label }) => (
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

      {tab === 'afip'      && <PlanesAfipTab />}
      {tab === 'prestamos' && <PrestamosTab />}
    </div>
  );
}
