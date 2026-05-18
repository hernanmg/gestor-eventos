import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileSpreadsheet, ChevronDown, Loader2, ChevronRight } from 'lucide-react';
import { useEvento, useExportarExcel, useExportarPDF } from '@/hooks/useEvento';
import { useTabConfig } from '@/hooks/useTabConfig';
import { useAuth } from '@/hooks/useAuth';
import { useEcheqs, useAlertasEcheqs } from '@/hooks/useEcheqs';
import { useAuditoriaEvento } from '@/hooks/useAuditoria';
import type { AuditoriaLog } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { EstadoBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import MovimientoTable from '@/components/domain/MovimientoTable';
import EcheqFormDialog from '@/components/domain/EcheqFormDialog';
import CajaPage from './Caja';
import ConciliatoriaPage from './Conciliatoria';
import EcheqsPage from './Echeqs';
import EventoStockPage from './Stock';
import { cn } from '@/lib/utils';
import type { TabConfig, Tipo } from '@/types';

// ── Export Dropdown ───────────────────────────────────────────────────────────

function ExportDropdown({ eventoId, tabs }: { eventoId: number; tabs: TabConfig[] }) {
  const { exportar: exportExcel } = useExportarExcel();
  const { exportar: exportPDF }   = useExportarPDF();
  const [open,        setOpen]        = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleExcel = async (tab?: string) => {
    setOpen(false);
    setIsExporting(true);
    try { await exportExcel(eventoId, tab); } finally { setIsExporting(false); }
  };

  const handlePDF = async (seccion?: string) => {
    setOpen(false);
    setIsExporting(true);
    try { await exportPDF(eventoId, seccion); } finally { setIsExporting(false); }
  };

  const egresoTabs  = tabs.filter(t => t.tipo === 'EGRESO');
  const ingresoTabs = tabs.filter(t => t.tipo === 'INGRESO');

  const itemClass = 'w-full px-3 py-1.5 text-sm text-left hover:bg-accent transition-colors disabled:opacity-50';
  const sectionLabel = 'px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-gray-50';

  return (
    <div ref={ref} className="relative">
      <Button
        variant="outline"
        size="sm"
        disabled={isExporting}
        onClick={() => !isExporting && setOpen(v => !v)}
        className="flex items-center gap-1.5"
      >
        {isExporting
          ? <Loader2 size={13} className="animate-spin" />
          : <FileSpreadsheet size={13} />
        }
        Exportar
        <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </Button>
      {open && !isExporting && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-border bg-white shadow-lg py-1 max-h-96 overflow-y-auto">
          {/* Excel section */}
          <div className={sectionLabel}>Excel</div>
          <button onClick={() => handleExcel()} className={itemClass}>
            Evento completo
          </button>
          <hr className="my-0.5 border-border" />
          {egresoTabs.map(t => (
            <button key={t.codigo} onClick={() => handleExcel(t.codigo)} className={itemClass}>
              {t.nombre}
            </button>
          ))}
          <hr className="my-0.5 border-border" />
          {ingresoTabs.map(t => (
            <button key={t.codigo} onClick={() => handleExcel(t.codigo)} className={itemClass}>
              {t.nombre}
            </button>
          ))}
          <hr className="my-0.5 border-border" />
          <button onClick={() => handleExcel('CONCILIATORIA')} className={itemClass}>
            Solo Conciliatoria
          </button>

          {/* PDF section */}
          <hr className="my-1 border-border" />
          <div className={sectionLabel}>PDF</div>
          <button onClick={() => handlePDF()} className={itemClass}>
            Reporte completo (PDF)
          </button>
          <button onClick={() => handlePDF('conciliatoria')} className={itemClass}>
            Conciliatoria (PDF)
          </button>
          <button onClick={() => handlePDF('caja')} className={itemClass}>
            Resumen de Caja (PDF)
          </button>
        </div>
      )}
    </div>
  );
}

// ── Auditoria tab (inline) ───────────────────────────────────────────────────

function AuditoriaTab({ eventoId }: { eventoId: number }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAuditoriaEvento(eventoId, { page, limit: 50 });

  const [expandedId, setExpandedId] = useState<number | null>(null);

  const accionColor: Record<string, string> = {
    CREATE: 'bg-green-100 text-green-800',
    UPDATE: 'bg-blue-100 text-blue-800',
    DELETE: 'bg-red-100 text-red-800',
    LOGIN:  'bg-purple-100 text-purple-800',
    LOGOUT: 'bg-gray-100 text-gray-800',
    EXPORT: 'bg-yellow-100 text-yellow-800',
  };

  if (isLoading) return <p className="text-sm text-muted-foreground py-4">Cargando...</p>;
  if (!data?.data.length) return <p className="text-sm text-muted-foreground py-4">Sin registros de auditoría para este evento.</p>;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Fecha</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Acción</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Entidad</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Usuario</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Descripción</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {data.data.map((log: AuditoriaLog) => {
              const hasExtra  = log.datos_antes || log.datos_despues;
              const isExpanded = expandedId === log.id;
              return (
                <>
                  <tr
                    key={log.id}
                    className={cn('border-b hover:bg-muted/20', hasExtra && 'cursor-pointer')}
                    onClick={() => hasExtra && setExpandedId(p => p === log.id ? null : log.id)}
                  >
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), 'dd/MM/yy HH:mm', { locale: es })}
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', accionColor[log.accion] ?? 'bg-gray-100 text-gray-800')}>
                        {log.accion}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">{log.entidad}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {log.usuario?.nombre ?? 'Sistema'}
                    </td>
                    <td className="px-3 py-2 text-xs max-w-xs truncate">{log.descripcion}</td>
                    <td className="px-3 py-2 text-center">
                      {hasExtra && (isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
                    </td>
                  </tr>
                  {isExpanded && hasExtra && (
                    <tr key={`${log.id}-detail`} className="border-b bg-muted/10">
                      <td colSpan={6} className="px-6 py-2 space-y-1 text-xs">
                        {log.datos_antes && (
                          <div><span className="font-medium text-muted-foreground">Antes: </span>
                            <code className="bg-muted px-1 rounded">{JSON.stringify(log.datos_antes)}</code>
                          </div>
                        )}
                        {log.datos_despues && (
                          <div><span className="font-medium text-muted-foreground">Después: </span>
                            <code className="bg-muted px-1 rounded">{JSON.stringify(log.datos_despues)}</code>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
      {data.pages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{data.total} registros — pág. {data.page}/{data.pages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-muted">Anterior</button>
            <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-muted">Siguiente</button>
          </div>
        </div>
      )}
    </div>
  );
}

type MainTab = 'EGRESO' | 'INGRESO' | 'CAJA' | 'CONCILIATORIA' | 'ECHEQS' | 'STOCK' | 'AUDITORIA';

const MAIN_TABS_BASE: { key: MainTab; label: string }[] = [
  { key: 'EGRESO',        label: 'Egresos'       },
  { key: 'INGRESO',       label: 'Ingresos'      },
  { key: 'CAJA',          label: 'Caja'          },
  { key: 'CONCILIATORIA', label: 'Conciliatoria' },
  { key: 'ECHEQS',        label: 'Echeqs'        },
  { key: 'STOCK',         label: 'Stock'         },
];

export default function EventoPage() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const eventoId   = Number(id);
  const { user }   = useAuth();

  const { data: evento,   isLoading: loadingEvento } = useEvento(eventoId);
  const { data: tabs = [], isLoading: loadingTabs }  = useTabConfig();

  const { data: echeqs = [] }    = useEcheqs(eventoId);
  const { data: alertas }        = useAlertasEcheqs(eventoId);
  const alertasCount = (alertas?.vencidos.length ?? 0) + (alertas?.vencen_pronto.length ?? 0);

  const [mainTab, setMainTab] = useState<MainTab>('EGRESO');
  const [subTab,  setSubTab]  = useState(1);
  const [echeqMovimientoId, setEcheqMovimientoId] = useState<number | null>(null);

  const canEdit  = user?.rol === 'ADMIN' || user?.rol === 'OPERADOR';
  const isAdmin  = user?.rol === 'ADMIN';
  const MAIN_TABS = isAdmin
    ? [...MAIN_TABS_BASE, { key: 'AUDITORIA' as MainTab, label: 'Auditoría' }]
    : MAIN_TABS_BASE;

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
        <ExportDropdown eventoId={eventoId} tabs={tabs} />
      </div>

      {/* Main tab navigation */}
      <div className="flex border-b border-border bg-white shrink-0 px-6">
        {MAIN_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleMainTab(key)}
            className={cn(
              'relative px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              mainTab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
            {key === 'ECHEQS' && alertasCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-red-500 text-white">
                {alertasCount}
              </span>
            )}
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
            onCreateEcheq={canEdit && mainTab === 'EGRESO' ? setEcheqMovimientoId : undefined}
            echeqs={mainTab === 'EGRESO' ? echeqs : undefined}
            onNavigateToEcheqs={() => handleMainTab('ECHEQS')}
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

        {mainTab === 'ECHEQS' && (
          <EcheqsPage eventoId={eventoId} canEdit={canEdit} />
        )}

        {mainTab === 'STOCK' && (
          <EventoStockPage evento={evento} canEdit={canEdit} />
        )}

        {mainTab === 'AUDITORIA' && isAdmin && (
          <AuditoriaTab eventoId={eventoId} />
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
