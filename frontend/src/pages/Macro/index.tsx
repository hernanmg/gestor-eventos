import { useState } from 'react';
import { cn } from '@/lib/utils';
import KpisSection from './KpisSection';
import MovimientosSection from './MovimientosSection';

type Tab = 'kpis' | 'movimientos';

const TABS: { key: Tab; label: string }[] = [
  { key: 'kpis',        label: '📊 KPIs y Alertas' },
  { key: 'movimientos', label: '📋 Movimientos' },
];

export default function MacroPage() {
  const [tab, setTab] = useState<Tab>('kpis');

  return (
    <div className="p-4 max-w-[1600px] mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Macro</h1>
        <p className="text-sm text-muted-foreground">Visibilidad global del negocio</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'kpis' ? <KpisSection /> : <MovimientosSection />}
    </div>
  );
}
