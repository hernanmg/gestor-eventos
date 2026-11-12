import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileUp, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import BaseTable from '@/components/ui/BaseTable';
import { useImportarMatriz } from '@/hooks/useCostoReal';
import { formatCurrency } from '@/lib/formatters';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { ImportarMatrizResultado } from '@/types';

// Importa la matriz de costo real de Flor (el Excel por evento: CC, OPEX,
// RENTAL COSTS, L&A COSTS). Primero muestra qué trae cada bloque y si el total
// coincide con la hoja CC; recién al confirmar reemplaza lo importado antes.

interface Props {
  eventoId:     number;
  eventoNombre: string;
  open:         boolean;
  onClose:      () => void;
}

export default function ImportarMatrizDialog({ eventoId, eventoNombre, open, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportarMatrizResultado | null>(null);
  const [hecho, setHecho] = useState<ImportarMatrizResultado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const importar = useImportarMatriz(eventoId);

  useEffect(() => {
    if (open) { setFile(null); setPreview(null); setHecho(null); setError(null); }
  }, [open]);

  const analizar = (f: File) => {
    setFile(f); setPreview(null); setError(null);
    importar.mutate({ file: f, preview: true }, { onSuccess: setPreview, onError: e => setError(getApiErrorMessage(e)) });
  };

  const confirmar = () => {
    if (!file) return;
    importar.mutate({ file, preview: false }, { onSuccess: setHecho, onError: e => setError(getApiErrorMessage(e)) });
  };

  const r = hecho ?? preview;
  const cuadra = r && r.total_planilla !== null ? Math.abs(r.total_planilla - r.total) <= 1 : null;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar matriz de costo real · {eventoNombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!hecho && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) analizar(f); }}
              />
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importar.isPending}>
                <FileUp size={14} className="mr-1.5" /> {file ? 'Elegir otro archivo' : 'Elegir planilla (.xlsx)'}
              </Button>
              {file && <span className="truncate text-sm text-muted-foreground">{file.name}</span>}
              {importar.isPending && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
            </div>
          )}
          {!file && !hecho && (
            <p className="text-xs text-muted-foreground">
              La misma planilla que armás por evento (hojas CC, OPEX, RENTAL COSTS y L&A COSTS). Se toman los valores que
              calculó el Excel. Volver a importar reemplaza lo importado antes; lo que cargaste a mano no se toca.
            </p>
          )}

          {r && (
            <>
              {hecho && (
                <p className="flex items-center gap-1.5 rounded bg-green-50 px-2 py-1.5 text-sm text-green-800">
                  <CheckCircle2 size={16} /> Importadas {hecho.creadas} líneas
                  {hecho.reemplazadas ? ` (reemplazó ${hecho.reemplazadas} de la importación anterior)` : ''}.
                </p>
              )}
              {r.titulo && <p className="text-sm">Planilla: <span className="font-medium">{r.titulo}</span></p>}
              <div className="overflow-x-auto">
                <BaseTable className="text-sm">
                  <thead>
                    <tr>
                      <th className="px-2 py-1.5 text-left">Bloque</th>
                      <th className="px-2 py-1.5 text-right">Líneas</th>
                      <th className="px-2 py-1.5 text-right">Total</th>
                      {!hecho && <th className="px-2 py-1.5 text-left">Reemplaza</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {r.bloques.map(b => (
                      <tr key={b.bloque} className={cn(!b.lineas && 'text-muted-foreground')}>
                        <td className="px-2 py-1.5">{b.label}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{b.lineas}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(b.total, 'ARS')}</td>
                        {!hecho && (
                          <td className="px-2 py-1.5 text-xs">
                            {b.lineas && b.reemplaza ? `${b.reemplaza} importadas antes` : ''}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td className="px-2 py-1.5">Total</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.bloques.reduce((a, b) => a + b.lineas, 0)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(r.total, 'ARS')}</td>
                      {!hecho && <td />}
                    </tr>
                  </tfoot>
                </BaseTable>
              </div>
              {cuadra !== null && (
                <p className={cn('text-xs', cuadra ? 'text-green-700' : 'text-orange-700')}>
                  {cuadra
                    ? `✓ Coincide con el total de la hoja CC (${formatCurrency(r.total_planilla!, 'ARS')}).`
                    : `El total de la hoja CC es ${formatCurrency(r.total_planilla!, 'ARS')}.`}
                </p>
              )}
              {r.omitidas > 0 && <p className="text-xs text-muted-foreground">{r.omitidas} fila(s) de OPEX sin total se omitieron.</p>}
              {r.avisos.length > 0 && (
                <ul className="space-y-1 rounded bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {r.avisos.map((a, i) => <li key={i} className="flex gap-1.5"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{a}</li>)}
                </ul>
              )}
            </>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>{hecho ? 'Cerrar' : 'Cancelar'}</Button>
            {!hecho && (
              <Button onClick={confirmar} disabled={!preview || importar.isPending}>
                {importar.isPending && preview ? 'Importando…' : 'Importar'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
