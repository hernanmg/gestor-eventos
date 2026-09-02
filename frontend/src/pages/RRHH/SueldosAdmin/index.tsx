import { useState } from 'react';
import { cn } from '@/lib/utils';
import AcuerdosTab from './AcuerdosTab';
import LiquidacionesTab from './LiquidacionesTab';
import EscalafonesTab from './EscalafonesTab';
import BitacoraTab from './BitacoraTab';

type SubTabKey = 'acuerdos' | 'liquidaciones' | 'escalafones' | 'bitacora';

const SUB_TABS: { key: SubTabKey; label: string }[] = [
  { key: 'acuerdos',      label: 'Acuerdos' },
  { key: 'liquidaciones', label: 'Liquidaciones' },
  { key: 'bitacora',      label: 'Bitácora de Viajes' },
  { key: 'escalafones',   label: 'Escalafones' },
];

export default function SueldosAdminTab({ empleadoIdInicial }: { empleadoIdInicial?: number | null }) {
  const [subTab, setSubTab] = useState<SubTabKey>('acuerdos');

  return (
    <div>
      <div className="flex gap-1 mb-4">
        {SUB_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md border transition-colors',
              subTab === t.key ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'acuerdos'      && <AcuerdosTab />}
      {subTab === 'liquidaciones' && <LiquidacionesTab empleadoIdInicial={empleadoIdInicial} />}
      {subTab === 'bitacora'      && <BitacoraTab empleadoIdInicial={empleadoIdInicial} />}
      {subTab === 'escalafones'   && <EscalafonesTab />}
    </div>
  );
}
