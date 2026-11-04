import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileUp, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import BaseTable from '@/components/ui/BaseTable';
import { descargarPlanillasCampo, useImportarCampo } from '@/hooks/useCostoReal';
import { formatCurrency } from '@/lib/formatters';
import { getApiErrorMessage } from '@/lib/utils';
import type { ImportarCampoResultado } from '@/types';

// Planillas de campo (carga sin señal): 1) bajar el Excel precargado para
// imprimir o completar en la notebook; 2) al volver, importarlo completo al
// costo real (líneas "Campo"). Ver backend lib/planillasCampo.ts.

interface Props {
  eventoId:     number;
  eventoNombre: string;
  open:         boolean;
  onClose:      () => void;
}

export default function PlanillasCampoDialog({ eventoId, eventoNombre, open, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [bajando, setBajando] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportarCampoResultado | null>(null);
  const [hecho, setHecho] = useState<ImportarCampoResultado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const importar = useImportarCampo(eventoId);

  useEffect(() => {
    if (open) { setFile(null); setPreview(null); setHecho(null); setError(null); }
  }, [open]);

  const bajar = () => {
    setBajando(true); setError(null);
    descargarPlanillasCampo(eventoId).catch(e => setError(getApiErrorMessage(e))).finally(() => setBajando(false));
  };
  const analizar = (f: File) => {
    setFile(f); setPreview(null); setError(null);
    importar.mutate({ file: f, preview: true }, { onSuccess: setPreview, onError: e => setError(getApiErrorMessage(e)) });
  };
  const confirmar = () => {
    if (!file) return;
    importar.mutate({ file, preview: false }, { onSuccess: setHecho, onError: e => setError(getApiErrorMessage(e)) });
  };
  const r = hecho ?? preview;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Planillas de campo · {eventoNombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <section className="space-y-1.5">
            <p className="text-sm font-medium">1. Antes de salir</p>
            <p className="text-xs text-muted-foreground">
              Bajá las planillas precargadas con la cuadrilla de cada día, los vehículos y el material de pañol: horas y viandas por día,
              alojamiento, pañol y combustible. Imprimilas, o completalas directo en el Excel en la notebook: no hace falta señal.
            </p>
            <Button variant="outline" size="sm" onClick={bajar} disabled={bajando}>
              {bajando ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Download size={14} className="mr-1.5" />}
              Descargar planillas
            </Button>
          </section>

          <section className="space-y-2 border-t border-border pt-3">
            <p className="text-sm font-medium">2. A la vuelta</p>
            <p className="text-xs text-muted-foreground">
              Pasá lo anotado al mismo Excel (sin cambiar títulos ni columnas) e importalo: horas → turnos de staff, viandas → comidas,
              alojamiento, lo que faltó del pañol → pérdidas, y las cargas de combustible. Volver a importarlo reemplaza lo importado antes.
            </p>
            {!hecho && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef} type="file" accept=".xlsx" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) analizar(f); }}
                />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importar.isPending}>
                  <FileUp size={14} className="mr-1.5" /> {file ? 'Elegir otro archivo' : 'Elegir planillas completas'}
                </Button>
                {file && <span className="truncate text-sm text-muted-foreground">{file.name}</span>}
                {importar.isPending && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
              </div>
            )}
            {r && (
              <>
                {hecho && (
                  <p className="flex items-center gap-1.5 rounded bg-green-50 px-2 py-1.5 text-sm text-green-800">
                    <CheckCircle2 size={16} /> Importadas {hecho.creadas} líneas al costo real
                    {hecho.reemplazadas ? ` (reemplazó ${hecho.reemplazadas} de la importación anterior)` : ''}.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Hojas leídas: {r.hojas.map(h => `${h.hoja} (${h.filas})`).join(', ')}
                </p>
                {r.bloques.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Las planillas no tienen nada completado todavía.</p>
                ) : (
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
                        <tr key={b.bloque}>
                          <td className="px-2 py-1.5">{b.label}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{b.lineas}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(b.total, 'ARS')}</td>
                          {!hecho && <td className="px-2 py-1.5 text-xs">{b.reemplaza ? `${b.reemplaza} de campo anteriores` : ''}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </BaseTable>
                )}
                {r.avisos.length > 0 && (
                  <ul className="space-y-1 rounded bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    {r.avisos.map((a, i) => <li key={i} className="flex gap-1.5"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{a}</li>)}
                  </ul>
                )}
              </>
            )}
          </section>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>{hecho ? 'Cerrar' : 'Cancelar'}</Button>
            {!hecho && (
              <Button onClick={confirmar} disabled={!preview || !preview.bloques.length || importar.isPending}>
                {importar.isPending && preview ? 'Importando…' : 'Importar'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
