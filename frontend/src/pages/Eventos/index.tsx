import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Eye, FileSpreadsheet, FileDown, Loader2 } from 'lucide-react';
import { useEventos, useDeleteEvento, useExportarExcel, useExportarPDF } from '@/hooks/useEvento';
import { useAuth } from '@/hooks/useAuth';
import { EstadoBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import EventoForm from './EventoForm';
import { formatDate } from '@/lib/formatters';
import type { Evento } from '@/types';

export default function EventosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: eventos = [], isLoading } = useEventos();
  const { mutate: deleteEvento }          = useDeleteEvento();
  const { exportar }                            = useExportarExcel();
  const { exportar: exportPDF }                = useExportarPDF();
  const [exportingId,    setExportingId]       = useState<number | null>(null);
  const [exportingPDFId, setExportingPDFId]    = useState<number | null>(null);

  const [dialogOpen, setDialogOpen]       = useState(false);
  const [editingEvento, setEditingEvento] = useState<Evento | null>(null);

  const canEdit = user?.rol === 'ADMIN' || user?.rol === 'OPERADOR';

  const handleNew = () => {
    setEditingEvento(null);
    setDialogOpen(true);
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
          <Button onClick={handleNew} size="sm">
            <Plus size={16} className="mr-1.5" />
            Nuevo evento
          </Button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <p className="text-sm text-muted-foreground">Cargando eventos...</p>
      )}

      {/* Empty state */}
      {!isLoading && eventos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground text-sm">No hay eventos registrados.</p>
          {canEdit && (
            <Button variant="outline" size="sm" className="mt-3" onClick={handleNew}>
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
                    <td className="px-4 py-3 font-medium">{evento.nombre}</td>
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
                    <p className="font-medium truncate">{evento.nombre}</p>
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

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEvento ? 'Editar evento' : 'Nuevo evento'}
            </DialogTitle>
          </DialogHeader>
          <EventoForm
            evento={editingEvento ?? undefined}
            onSuccess={handleFormSuccess}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
