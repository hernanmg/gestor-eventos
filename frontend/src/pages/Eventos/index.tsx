import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Eye, FileSpreadsheet, FileDown, Loader2, FileClock, Zap } from 'lucide-react';
import { useEventos, useDeleteEvento, useExportarExcel, useExportarPDF } from '@/hooks/useEvento';
import { useCreatePreMacro, usePreMacroBorrador, useDiscardPreMacro } from '@/hooks/usePreMacro';
import { useAuth } from '@/hooks/useAuth';
import { EstadoBadge, InformalBadge, FacturarBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import EventoForm from './EventoForm';
import CargaRapidaDialog from './CargaRapidaDialog';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Evento } from '@/types';

export default function EventosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const { data: eventosRaw = [], isLoading } = useEventos();

  // Filtro por URL (?es_informal=true&facturar=null) — soporta links externos
  // que ya apunten a esta combinación.
  const filtroEsInformal = searchParams.get('es_informal');
  const filtroFacturarURL = searchParams.get('facturar');
  const [soloSinFacturar, setSoloSinFacturar] = useState(filtroFacturarURL === 'null');

  const sinFacturarCount = eventosRaw.filter(e => e.facturar === null).length;

  const eventos = eventosRaw.filter(e => {
    if (filtroEsInformal === 'true'  && !e.es_informal) return false;
    if (filtroEsInformal === 'false' &&  e.es_informal) return false;
    if (soloSinFacturar && e.facturar !== null) return false;
    return true;
  });
  const { mutate: deleteEvento }          = useDeleteEvento();
  const { exportar }                            = useExportarExcel();
  const { exportar: exportPDF }                = useExportarPDF();
  const [exportingId,    setExportingId]       = useState<number | null>(null);
  const [exportingPDFId, setExportingPDFId]    = useState<number | null>(null);

  const [dialogOpen, setDialogOpen]       = useState(false);
  const [editingEvento, setEditingEvento] = useState<Evento | null>(null);
  const [cargaRapidaOpen, setCargaRapidaOpen] = useState(false);

  const createPreMacro = useCreatePreMacro();
  const { data: borrador } = usePreMacroBorrador();
  const discardPreMacro    = useDiscardPreMacro();

  // Crear/editar/eliminar eventos (y arrancar el wizard de pre-macro) es
  // exclusivo de ADMIN — OPERADOR sólo puede ver (matriz de permisos).
  const canEdit = user?.rol === 'ADMIN';

  const handleNew = () => {
    createPreMacro.mutate();
  };

  // El panel de ayuda puede abrir el wizard de pre-macro
  useEffect(() => {
    const handler = () => handleNew();
    window.addEventListener('help:abrir_modal_nuevo_evento', handler);
    return () => window.removeEventListener('help:abrir_modal_nuevo_evento', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDescartarBorrador = () => {
    if (!borrador) return;
    if (!window.confirm(`¿Descartar la pre-macro sin completar "${borrador.nombre_evento || 'sin nombre'}"?`)) return;
    discardPreMacro.mutate(borrador.id);
  };

  const handleEdit = (evento: Evento) => {
    setEditingEvento(evento);
    setDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (!window.confirm('¿Eliminar este evento? Esta acción no se puede deshacer.')) return;
    deleteEvento(id);
  };

  const handleExport = async (id: number) => {
    setExportingId(id);
    try { await exportar(id); }
    finally { setExportingId(null); }
  };

  const handleExportPDF = async (id: number) => {
    setExportingPDFId(id);
    try { await exportPDF(id); }
    finally { setExportingPDFId(null); }
  };

  const handleFormSuccess = () => {
    setDialogOpen(false);
    setEditingEvento(null);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingEvento(null);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Eventos</h1>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button onClick={handleNew} size="sm" disabled={createPreMacro.isPending}>
              <Plus size={16} className="mr-1.5" />
              Nuevo evento
            </Button>
            <Button onClick={() => setCargaRapidaOpen(true)} size="sm" variant="outline">
              <Zap size={16} className="mr-1.5" />
              Carga rápida
            </Button>
          </div>
        )}
      </div>

      {/* Filtros rápidos */}
      <div className="flex items-center gap-2 mb-4">
        <Button
          size="sm"
          variant={soloSinFacturar ? 'default' : 'outline'}
          onClick={() => setSoloSinFacturar(v => !v)}
          className="flex items-center gap-1.5"
        >
          Sin facturar
          {sinFacturarCount > 0 && (
            <span className={cn(
              'inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold',
              soloSinFacturar ? 'bg-primary-foreground text-primary' : 'bg-amber-500 text-white',
            )}>
              {sinFacturarCount}
            </span>
          )}
        </Button>
      </div>

      {/* Banner de pre-macro sin completar */}
      {borrador && (
        <div className="flex items-center gap-2 mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <FileClock size={16} className="text-amber-600 shrink-0" />
          <span className="text-sm text-amber-800">
            Tenés una pre-macro sin completar: <strong>{borrador.nombre_evento || 'Sin nombre'}</strong>
          </span>
          <div className="ml-auto flex gap-2 shrink-0">
            <Button size="sm" onClick={() => navigate(`/pre-macro/${borrador.id}`)}>
              Continuar →
            </Button>
            <Button size="sm" variant="outline" onClick={handleDescartarBorrador} disabled={discardPreMacro.isPending}>
              Descartar
            </Button>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <p className="text-sm text-muted-foreground">Cargando eventos...</p>
      )}

      {/* Empty state */}
      {!isLoading && eventos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground text-sm">No hay eventos registrados.</p>
          {canEdit && (
            <Button variant="outline" size="sm" className="mt-3" onClick={handleNew} disabled={createPreMacro.isPending}>
              <Plus size={14} className="mr-1.5" />
              Crear el primer evento
            </Button>
          )}
        </div>
      )}

      {/* Desktop table */}
      {!isLoading && eventos.length > 0 && (
        <>
          <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nombre</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Inicio</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fin</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Moneda</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Movimientos</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {eventos.map(evento => (
                  <tr key={evento.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {evento.nombre}
                        {evento.es_informal && <InformalBadge />}
                        {evento.es_informal && <FacturarBadge facturar={evento.facturar} />}
                      </div>
                    </td>
                    <td className="px-4 py-3"><EstadoBadge estado={evento.estado} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(evento.fecha_inicio)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(evento.fecha_fin)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{evento.moneda_base}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {(evento as any).movimiento_count ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/eventos/${evento.id}`)}
                          title="Ver detalle"
                        >
                          <Eye size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleExport(evento.id)}
                          disabled={exportingId === evento.id}
                          title="Exportar Excel"
                        >
                          {exportingId === evento.id
                            ? <Loader2 size={15} className="animate-spin" />
                            : <FileSpreadsheet size={15} />
                          }
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleExportPDF(evento.id)}
                          disabled={exportingPDFId === evento.id}
                          title="Exportar PDF completo"
                        >
                          {exportingPDFId === evento.id
                            ? <Loader2 size={15} className="animate-spin" />
                            : <FileDown size={15} />
                          }
                        </Button>
                        {canEdit && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(evento)}
                              title="Editar"
                            >
                              <Pencil size={15} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(evento.id)}
                              className="text-destructive hover:text-destructive"
                              title="Eliminar"
                            >
                              <Trash2 size={15} />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {eventos.map(evento => (
              <div
                key={evento.id}
                className="rounded-lg border border-border bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium truncate">{evento.nombre}</p>
                      {evento.es_informal && <InformalBadge />}
                      {evento.es_informal && <FacturarBadge facturar={evento.facturar} />}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {evento.fecha_inicio && <span>Inicio: {formatDate(evento.fecha_inicio)}</span>}
                      {evento.fecha_fin    && <span>Fin: {formatDate(evento.fecha_fin)}</span>}
                      <span>{evento.moneda_base}</span>
                      <span>{(evento as any).movimiento_count ?? 0} movimientos</span>
                    </div>
                  </div>
                  <EstadoBadge estado={evento.estado} />
                </div>
                <div className="mt-3 flex justify-end gap-1 border-t border-border pt-3 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/eventos/${evento.id}`)}>
                    <Eye size={13} className="mr-1.5" />
                    Ver
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={exportingId === evento.id}
                    onClick={() => handleExport(evento.id)}
                  >
                    {exportingId === evento.id
                      ? <Loader2 size={13} className="animate-spin mr-1.5" />
                      : <FileSpreadsheet size={13} className="mr-1.5" />
                    }
                    Excel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={exportingPDFId === evento.id}
                    onClick={() => handleExportPDF(evento.id)}
                  >
                    {exportingPDFId === evento.id
                      ? <Loader2 size={13} className="animate-spin mr-1.5" />
                      : <FileDown size={13} className="mr-1.5" />
                    }
                    PDF
                  </Button>
                  {canEdit && (
                    <>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(evento)}>
                      <Pencil size={13} className="mr-1.5" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(evento.id)}
                      className="text-destructive border-destructive/40 hover:bg-destructive/10"
                    >
                      <Trash2 size={13} className="mr-1.5" />
                      Eliminar
                    </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Edit dialog — la creación de eventos pasa por la pre-macro */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar evento</DialogTitle>
          </DialogHeader>
          <EventoForm
            evento={editingEvento ?? undefined}
            onSuccess={handleFormSuccess}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <CargaRapidaDialog open={cargaRapidaOpen} onClose={() => setCargaRapidaOpen(false)} />
    </div>
  );
}
