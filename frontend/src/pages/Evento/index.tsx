import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useEvento } from '@/hooks/useEvento';
import { useTabConfig } from '@/hooks/useTabConfig';
import { useAuth } from '@/hooks/useAuth';
import { EstadoBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import MovimientoTable from '@/components/domain/MovimientoTable';
import EcheqFormDialog from '@/components/domain/EcheqFormDialog';
import CajaPage from './Caja';
import ConciliatoriaPage from './Conciliatoria';
import { cn } from '@/lib/utils';
import type { Tipo } from '@/types';

type MainTab = 'EGRESO' | 'INGRESO' | 'CAJA' | 'CONCILIATORIA';

const MAIN_TABS: { key: MainTab; label: string }[] = [
  { key: 'EGRESO',        label: 'Egresos'       },
  { key: 'INGRESO',       label: 'Ingresos'      },
  { key: 'CAJA',          label: 'Caja'          },
  { key: 'CONCILIATORIA', label: 'Conciliatoria' },
];

export default function EventoPage() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const eventoId   = Number(id);
  const { user }   = useAuth();

  const { data: evento,   isLoading: loadingEvento } = useEvento(eventoId);
  const { data: tabs = [], isLoading: loadingTabs }  = useTabConfig();

  const [mainTab, setMainTab] = useState<MainTab>('EGRESO');
  const [subTab,  setSubTab]  = useState(1);
  const [echeqMovimientoId, setEcheqMovimientoId] = useState<number | null>(null);

  const canEdit = user?.rol === 'ADMIN' || user?.rol === 'OPERADOR';

  const egresoTabs  = tabs.filter(t => t.tipo === 'EGRESO');
  const ingresoTabs = tabs.filter(t => t.tipo === 'INGRESO');
  const subTabs     = mainTab === 'EGRESO' ? egresoTabs : ingresoTabs;

  const handleMainTab = (key: MainTab) => {
    setMainTab(key);
    setSubTab(1);
  };

  if (loadingEvento || loadingTabs) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Cargando...
      </div>
    );
  }

  if (!evento) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">Evento no encontrado.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/eventos')}>
          Volver
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-white shrink-0">
        <button
          onClick={() => navigate('/eventos')}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Volver a Eventos"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold truncate">{evento.nombre}</h1>
        </div>
        <EstadoBadge estado={evento.estado} />
      </div>

      {/* Main tab navigation */}
      <div className="flex border-b border-border bg-white shrink-0 px-6">
        {MAIN_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleMainTab(key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              mainTab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Sub-tab navigation (Egresos / Ingresos) */}
      {(mainTab === 'EGRESO' || mainTab === 'INGRESO') && subTabs.length > 0 && (
        <div className="flex border-b border-border bg-gray-50 shrink-0 px-6 overflow-x-auto">
          {subTabs.map(tab => (
            <button
              key={tab.numero}
              onClick={() => setSubTab(tab.numero)}
              className={cn(
                'px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
                subTab === tab.numero
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.nombre}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {(mainTab === 'EGRESO' || mainTab === 'INGRESO') && (
          <MovimientoTable
            eventoId={eventoId}
            tipo={mainTab as Tipo}
            tabNumero={subTab}
            monedaBase={evento.moneda_base}
            onCreateEcheq={canEdit ? setEcheqMovimientoId : undefined}
          />
        )}

        {mainTab === 'CAJA' && (
          <CajaPage
            eventoId={eventoId}
            monedaBase={evento.moneda_base}
            canEdit={canEdit}
          />
        )}

        {mainTab === 'CONCILIATORIA' && (
          <ConciliatoriaPage eventoId={eventoId} />
        )}
      </div>

      {echeqMovimientoId !== null && (
        <EcheqFormDialog
          eventoId={eventoId}
          movimientoId={echeqMovimientoId}
          open
          onClose={() => setEcheqMovimientoId(null)}
        />
      )}
    </div>
  );
}
