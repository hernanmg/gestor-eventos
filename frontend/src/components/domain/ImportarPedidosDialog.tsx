import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Upload } from 'lucide-react';
import api from '@/lib/api';
import { fichaKey } from '@/hooks/useFichaEvento';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import BaseTable from '@/components/ui/BaseTable';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { EstadoRubroEvento } from '@/types';

// Planilla de pedidos a proveedores de Dani (Festival KM - Pedidos de material /
// Ficha de evento de la Pelota) → Ficha del evento. POST
// /eventos/:id/ficha/importar-pedidos. Vista previa con un bloque por servicio:
// si el rubro detectado no es el correcto se elige otro (o "No importar"), y se
// vuelve a calcular la vista previa con esas asignaciones antes de confirmar.

interface BloquePreview {
  clave: string;
  servicio: string;
  hojas: string[];
  estado: EstadoRubroEvento;
  proveedor_excel: string | null;
  proveedor_id: number | null;
  proveedor_nombre: string | null;
  contacto_nombre: string | null;
  coordina: string | null;
  rubro_id: number | null;
  rubro_nombre: string | null;
  rubro_automatico: boolean;
  accion: 'CREAR' | 'ACTUALIZAR' | 'SIN_RUBRO' | 'OMITIDO';
  items: unknown[];
  items_nuevos: number;
  turnos: unknown[];
  notas: string[];
  advertencias: string[];
}

interface ResultadoPedidos {
  preview: boolean;
  evento_excel: string | null;
  evento_distinto: string | null;
  hojas_omitidas: { hoja: string; motivo: string }[];
  rubros_creados: number;
  rubros_actualizados: number;
  sin_rubro: number;
  items: number;
  turnos: number;
  proveedores_no_encontrados: string[];
  bloques: BloquePreview[];
  rubros: { id: number; nombre: string }[];
}

const ESTADO_LABEL: Record<EstadoRubroEvento, string> = {
  CONFIRMADO: 'Confirmado', COTIZANDO: 'Cotizando', PENDIENTE: 'Pendiente', NO_VA: 'No va', CANCELADO: 'Cancelado',
};
const ESTADO_VARIANT: Record<EstadoRubroEvento, 'success' | 'warning' | 'muted' | 'destructive'> = {
  CONFIRMADO: 'success', COTIZANDO: 'warning', PENDIENTE: 'muted', NO_VA: 'muted', CANCELADO: 'destructive',
};

export default function ImportarPedidosDialog({ eventoId, onClose }: { eventoId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [asignaciones, setAsignaciones] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState<ResultadoPedidos | null>(null);
  const [final, setFinal] = useState<ResultadoPedidos | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importar = useMutation({
    mutationFn: async ({ archivo, preview, asig }: { archivo: File; preview: boolean; asig: Record<string, number> }) => {
      const fd = new FormData();
      fd.append('archivo', archivo);
      fd.append('asignaciones', JSON.stringify(asig));
      const r = await api.post<ResultadoPedidos>(`/eventos/${eventoId}/ficha/importar-pedidos?preview=${preview}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return r.data;
    },
    onSuccess: data => {
      if (!data.preview) {
        qc.invalidateQueries({ queryKey: fichaKey(eventoId) });
        qc.invalidateQueries({ queryKey: ['movimientos', eventoId] }); // líneas de costo de rubros confirmados
      }
    },
  });

  const verPreview = async (archivo: File, asig: Record<string, number>) => {
    setError(null);
    try {
      setPreview(await importar.mutateAsync({ archivo, preview: true, asig }));
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const elegirArchivo = (f: File) => {
    setFile(f);
    setAsignaciones({});
    setPreview(null);
    verPreview(f, {});
  };

  const cambiarRubro = (clave: string, valor: string) => {
    const nuevas = { ...asignaciones, [clave]: Number(valor) };
    setAsignaciones(nuevas);
    if (file) verPreview(file, nuevas);
  };

  const confirmar = async () => {
    if (!file) return;
    setError(null);
    try {
      setFinal(await importar.mutateAsync({ archivo: file, preview: false, asig: asignaciones }));
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>Importar planilla de pedidos a proveedores</DialogTitle></DialogHeader>

        {final ? (
          <div className="space-y-3">
            <p className="text-sm">
              Listo: <span className="font-semibold text-green-700">{final.rubros_creados}</span> rubros nuevos,{' '}
              <span className="font-semibold">{final.rubros_actualizados}</span> actualizados,{' '}
              <span className="font-semibold">{final.items}</span> ítems de pedido y{' '}
              <span className="font-semibold">{final.turnos}</span> turnos.
            </p>
            {final.proveedores_no_encontrados.length > 0 && (
              <p className="text-xs bg-yellow-50 text-yellow-800 rounded px-3 py-2">
                Proveedores que no están dados de alta (quedaron anotados en las notas del rubro):{' '}
                {final.proveedores_no_encontrados.join(', ')}
              </p>
            )}
            <div className="flex justify-end"><Button size="sm" onClick={onClose}>Cerrar</Button></div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Subí la planilla de pedidos de material (o la ficha de evento con las fichas de proveedor). Se lee la hoja de
              proveedores confirmados y una hoja de pedido por rubro.
            </p>
            <label className="flex items-center gap-3 border-2 border-dashed border-border rounded-lg px-4 py-4 cursor-pointer hover:bg-accent/30 transition">
              <Upload size={18} className="text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground truncate">
                {importar.isPending && !preview ? 'Leyendo archivo…' : file ? file.name : 'Hacé clic para elegir el archivo .xlsx'}
              </span>
              <input
                type="file" accept=".xlsx" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) elegirArchivo(f); e.target.value = ''; }}
              />
            </label>

            {preview && (
              <>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span><span className="font-semibold text-green-700">{preview.rubros_creados}</span> rubros nuevos</span>
                  <span><span className="font-semibold">{preview.rubros_actualizados}</span> a actualizar</span>
                  <span><span className="font-semibold">{preview.items}</span> ítems</span>
                  <span><span className="font-semibold">{preview.turnos}</span> turnos</span>
                  {preview.sin_rubro > 0 && <span className="text-yellow-700"><span className="font-semibold">{preview.sin_rubro}</span> sin rubro (no se importan)</span>}
                </div>

                {preview.evento_distinto && (
                  <p className="text-xs bg-yellow-50 text-yellow-800 rounded px-3 py-2 flex items-start gap-1.5">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    La planilla es del evento "{preview.evento_distinto}". Revisá que estés importando en el evento correcto.
                  </p>
                )}
                {preview.proveedores_no_encontrados.length > 0 && (
                  <p className="text-xs bg-yellow-50 text-yellow-800 rounded px-3 py-2">
                    Proveedores que no están dados de alta: {preview.proveedores_no_encontrados.join(', ')}. Se importa igual y
                    el nombre queda en las notas del rubro; si los das de alta antes, quedan vinculados.
                  </p>
                )}

                <div className="max-h-[50vh] overflow-y-auto">
                  <BaseTable className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr className="border-b border-border text-muted-foreground font-medium">
                        <th className="px-2 py-1.5 text-left">En la planilla</th>
                        <th className="px-2 py-1.5 text-left">Rubro</th>
                        <th className="px-2 py-1.5 text-left">Estado</th>
                        <th className="px-2 py-1.5 text-left">Proveedor</th>
                        <th className="px-2 py-1.5 text-right">Pedido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {preview.bloques.map(b => {
                        const valor = asignaciones[b.clave] ?? b.rubro_id ?? '';
                        return (
                          <tr key={b.clave} className={cn((b.accion === 'OMITIDO' || b.accion === 'SIN_RUBRO') && 'opacity-60')}>
                            <td className="px-2 py-1.5 align-top" data-label="En la planilla">
                              <p className="font-medium">{b.servicio}</p>
                              {b.hojas.length > 0 && <p className="text-muted-foreground">Hoja: {b.hojas.join(', ')}</p>}
                              {b.advertencias.map(a => (
                                <p key={a} className="text-yellow-700 flex items-start gap-1"><AlertTriangle size={10} className="mt-0.5 shrink-0" />{a}</p>
                              ))}
                            </td>
                            <td className="px-2 py-1.5 align-top" data-label="Rubro">
                              <select
                                value={String(valor)}
                                onChange={e => cambiarRubro(b.clave, e.target.value)}
                                disabled={importar.isPending}
                                className={cn('w-full border rounded px-1.5 py-1 text-xs bg-background', !b.rubro_id && b.accion !== 'OMITIDO' && 'border-yellow-500')}
                              >
                                {!b.rubro_id && b.accion !== 'OMITIDO' && <option value="">— Elegí un rubro —</option>}
                                <option value="0">No importar</option>
                                {preview.rubros.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                              </select>
                              {b.accion === 'ACTUALIZAR' && <p className="text-muted-foreground mt-0.5">Ya está en la ficha: se actualiza</p>}
                            </td>
                            <td className="px-2 py-1.5 align-top" data-label="Estado">
                              <Badge variant={ESTADO_VARIANT[b.estado]}>{ESTADO_LABEL[b.estado]}</Badge>
                            </td>
                            <td className="px-2 py-1.5 align-top" data-label="Proveedor">
                              {b.proveedor_excel ?? '—'}
                              {b.proveedor_excel && !b.proveedor_id && <span className="block text-yellow-700">No está dado de alta</span>}
                              {b.proveedor_id && b.proveedor_nombre !== b.proveedor_excel && <span className="block text-muted-foreground">→ {b.proveedor_nombre}</span>}
                              {b.contacto_nombre && <span className="block text-muted-foreground">Contacto: {b.contacto_nombre}</span>}
                            </td>
                            <td className="px-2 py-1.5 align-top text-right whitespace-nowrap" data-label="Pedido">
                              {b.items.length > 0 && <span className="block">{b.items.length} ítems{b.items_nuevos < b.items.length && ` (${b.items_nuevos} nuevos)`}</span>}
                              {b.turnos.length > 0 && <span className="block">{b.turnos.length} turnos</span>}
                              {b.items.length === 0 && b.turnos.length === 0 && <span className="text-muted-foreground">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </BaseTable>
                </div>
                {preview.hojas_omitidas.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Hojas que no se leyeron: {preview.hojas_omitidas.map(h => h.hoja).join(', ')}.
                  </p>
                )}
              </>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" onClick={confirmar} disabled={!preview || importar.isPending}>
                {importar.isPending && preview ? 'Procesando…' : 'Confirmar importación'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
