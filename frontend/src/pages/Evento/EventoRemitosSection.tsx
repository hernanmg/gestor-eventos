import { useState } from 'react';
import { FileText, Plus, ChevronDown, Pencil, Copy, Send, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { RemitoEstadoBadge } from '@/components/ui/badge';
import BaseTable from '@/components/ui/BaseTable';
import { useCatalogoRemitos, useRemitosEvento, useEmitirRemito, useClonarRemito, useEliminarRemito, useVerPdfRemito } from '@/hooks/useRemitos';
import { formatDate } from '@/lib/formatters';
import { getApiErrorMessage } from '@/lib/utils';
import type { Remito, TipoRemitoInfo } from '@/types';
import RemitoEditorDialog from './RemitoEditorDialog';

// Sección "Remitos" del tab Logística (DOS57): los 5 remitos físicos que
// acompañan cada viaje (Layher, Nacional, Techos, Pañol, Lonas y Aforo).
// BORRADOR se edita/emite/elimina; EMITIDO sólo se ve y se clona.

const thCls = 'px-3 py-2 text-left text-xs font-medium text-muted-foreground';
const DASH  = <span className="text-muted-foreground">—</span>;

export default function EventoRemitosSection({ eventoId, eventoNombre }: { eventoId: number; eventoNombre: string }) {
  const { data: catalogo = [] } = useCatalogoRemitos();
  const { data: remitos = [], isLoading } = useRemitosEvento(eventoId);
  const emitir   = useEmitirRemito();
  const clonar   = useClonarRemito();
  const eliminar = useEliminarRemito();
  const { ver, cargandoId } = useVerPdfRemito();

  const [menuAbierto, setMenuAbierto] = useState(false);
  const [editor, setEditor] = useState<{ tipo: TipoRemitoInfo; remito?: Remito } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const infoDe = (r: Remito) => catalogo.find(t => t.tipo === r.tipo);
  const ocupado = emitir.isPending || clonar.isPending || eliminar.isPending;

  const ejecutar = async (accion: () => Promise<unknown>) => {
    setError(null);
    try { await accion(); } catch (err) { setError(getApiErrorMessage(err)); }
  };

  const handleEmitir = (r: Remito) => {
    if (!window.confirm(`¿Emitir el remito ${infoDe(r)?.nombre ?? r.tipo} Nº ${String(r.numero).padStart(4, '0')}? Después no se puede editar.`)) return;
    ejecutar(() => emitir.mutateAsync(r.id));
  };
  const handleEliminar = (r: Remito) => {
    if (!window.confirm(`¿Eliminar el borrador ${infoDe(r)?.nombre ?? r.tipo} Nº ${String(r.numero).padStart(4, '0')}?`)) return;
    ejecutar(() => eliminar.mutateAsync(r.id));
  };
  const handleVerPdf = (r: Remito) =>
    ejecutar(async () => {
      try { await ver(r.id); } catch { throw new Error('No se pudo generar el PDF del remito'); }
    });

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <FileText size={15} /> Remitos <span className="font-normal text-muted-foreground">({remitos.length})</span>
        </h3>
        <Popover open={menuAbierto} onOpenChange={setMenuAbierto}>
          <PopoverTrigger asChild>
            <Button size="sm" disabled={catalogo.length === 0}>
              <Plus size={14} className="mr-1" /> Nuevo remito <ChevronDown size={14} className="ml-1" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-48 p-1">
            {catalogo.map(t => (
              <button
                key={t.tipo}
                type="button"
                className="w-full text-left rounded-md px-3 py-1.5 text-sm hover:bg-muted"
                onClick={() => { setMenuAbierto(false); setEditor({ tipo: t }); }}
              >
                {t.nombre}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : remitos.length === 0 ? (
        <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          <FileText size={32} className="mx-auto mb-2 opacity-30" />
          No hay remitos para este evento. Creá uno con <span className="font-medium">Nuevo remito</span>.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <BaseTable className="w-full text-sm min-w-[800px]">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className={thCls}>Tipo</th>
                <th className={thCls}>Nº</th>
                <th className={thCls}>Fecha</th>
                <th className={thCls}>Chofer</th>
                <th className={thCls}>Chasis / Acoplado</th>
                <th className={`${thCls} text-right`}>Ítems</th>
                <th className={thCls}>Estado</th>
                <th className={`${thCls} text-right`}>Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {remitos.map(r => {
                const info = infoDe(r);
                return (
                  <tr key={r.id} className="hover:bg-muted/20">
                    <td className="px-3 py-2.5 font-medium">{info?.nombre ?? r.tipo}</td>
                    <td className="px-3 py-2.5 font-mono">{String(r.numero).padStart(4, '0')}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(r.fecha)}</td>
                    <td className="px-3 py-2.5">{r.chofer ?? DASH}</td>
                    <td className="px-3 py-2.5">{r.chasis_acoplado ?? DASH}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.items.length}</td>
                    <td className="px-3 py-2.5"><RemitoEstadoBadge estado={r.estado} /></td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        {r.estado === 'BORRADOR' && info && (
                          <Button size="sm" variant="outline" disabled={ocupado} onClick={() => setEditor({ tipo: info, remito: r })}>
                            <Pencil size={13} className="mr-1" /> Editar
                          </Button>
                        )}
                        <Button size="sm" variant="outline" disabled={cargandoId === r.id} onClick={() => handleVerPdf(r)}>
                          <FileText size={13} className="mr-1" /> {cargandoId === r.id ? 'Generando…' : 'Ver PDF'}
                        </Button>
                        {r.estado === 'BORRADOR' ? (
                          <>
                            <Button size="sm" variant="outline" disabled={ocupado} onClick={() => handleEmitir(r)}>
                              <Send size={13} className="mr-1" /> Emitir
                            </Button>
                            <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => handleEliminar(r)} title="Eliminar borrador">
                              <Trash2 size={13} />
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline" disabled={ocupado} onClick={() => ejecutar(() => clonar.mutateAsync(r.id))} title="Nuevo remito con los mismos datos (viaje de vuelta / segundo viaje)">
                            <Copy size={13} className="mr-1" /> Clonar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </BaseTable>
        </div>
      )}

      {editor && (
        <RemitoEditorDialog
          open
          onOpenChange={o => { if (!o) setEditor(null); }}
          eventoId={eventoId}
          eventoNombre={eventoNombre}
          tipo={editor.tipo}
          remito={editor.remito}
        />
      )}
    </section>
  );
}
