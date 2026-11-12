import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Upload } from 'lucide-react';
import api from '@/lib/api';
import { comidasKey } from '@/hooks/useComidas';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { fmtMoney } from '@/lib/formatters';
import { fmtFechaCorta } from '@/lib/turnos';

// Planilla de control de comidas / viandas → Comidas del evento. POST
// /eventos/:id/comidas/importar. Una tarjeta por hoja con su total contra el de la
// planilla (las filas que no cierran se listan) y un tilde para elegir qué hojas
// importar: la planilla de la Pelota trae una segunda semana de otro lugar.

interface HojaPreview {
  hoja: string; lugar: string | null; desde: string | null; hasta: string | null;
  lineas: number; personas: number; total_calculado: number; total_planilla: number | null;
  diferencias: { fila_excel: number; fecha: string; detalle: string | null; calculado: number; planilla: number; formula: string | null }[];
  omitidas: { fila_excel: number; motivo: string }[];
  advertencias: string[];
  seleccionada: boolean; fuera_de_rango: boolean;
}
interface ResultadoComidas {
  preview: boolean;
  rango_evento: { desde: string; hasta: string } | null;
  hojas: HojaPreview[];
  dias: number; dias_nuevos: number; lineas: number; lineas_nuevas: number; personas: number; total: number;
}

export default function ImportarComidasDialog({ eventoId, onClose }: { eventoId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [hojas, setHojas] = useState<string[] | null>(null);
  const [preview, setPreview] = useState<ResultadoComidas | null>(null);
  const [final, setFinal] = useState<ResultadoComidas | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importar = useMutation({
    mutationFn: async ({ archivo, preview, sel }: { archivo: File; preview: boolean; sel: string[] | null }) => {
      const fd = new FormData();
      fd.append('archivo', archivo);
      if (sel) fd.append('hojas', JSON.stringify(sel));
      const r = await api.post<ResultadoComidas>(`/eventos/${eventoId}/comidas/importar?preview=${preview}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return r.data;
    },
    onSuccess: d => { if (!d.preview) qc.invalidateQueries({ queryKey: comidasKey(eventoId) }); },
  });

  const calcular = async (archivo: File, sel: string[] | null) => {
    setError(null);
    try {
      const r = await importar.mutateAsync({ archivo, preview: true, sel });
      setPreview(r);
      // Primera lectura: se proponen las hojas que caen en las fechas del evento
      if (sel === null) {
        const propuestas = r.hojas.filter(h => h.lineas > 0 && !h.fuera_de_rango).map(h => h.hoja);
        const elegidas = propuestas.length ? propuestas : r.hojas.filter(h => h.lineas > 0).map(h => h.hoja);
        setHojas(elegidas);
        if (elegidas.length !== r.hojas.filter(h => h.lineas > 0).length) setPreview(await importar.mutateAsync({ archivo, preview: true, sel: elegidas }));
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const toggle = (hoja: string) => {
    if (!file || !hojas) return;
    const nuevas = hojas.includes(hoja) ? hojas.filter(h => h !== hoja) : [...hojas, hoja];
    setHojas(nuevas);
    calcular(file, nuevas);
  };

  const confirmar = async () => {
    if (!file) return;
    setError(null);
    try { setFinal(await importar.mutateAsync({ archivo: file, preview: false, sel: hojas })); } catch (err) { setError(getApiErrorMessage(err)); }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Importar planilla de comidas</DialogTitle></DialogHeader>
        {final ? (
          <div className="space-y-3 text-sm">
            <p>
              Listo: {final.dias} días ({final.dias_nuevos} nuevos), {final.lineas} líneas, {final.personas} comidas por{' '}
              <span className="font-semibold">{fmtMoney(final.total)}</span>.
            </p>
            <div className="flex justify-end"><Button size="sm" onClick={onClose}>Cerrar</Button></div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Subí la planilla de control de viandas o de comidas. Cada línea queda por día, comida y área (el tipo de menú o el
              proveedor); el valor por persona sale del valor o del costo de la línea.
            </p>
            <label className="flex items-center gap-3 border-2 border-dashed border-border rounded-lg px-4 py-4 cursor-pointer hover:bg-accent/30 transition">
              <Upload size={18} className="text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground truncate">
                {importar.isPending && !preview ? 'Leyendo archivo…' : file ? file.name : 'Hacé clic para elegir el archivo .xlsx'}
              </span>
              <input type="file" accept=".xlsx" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setHojas(null); setPreview(null); calcular(f, null); } e.target.value = ''; }} />
            </label>

            {preview && (
              <>
                {preview.rango_evento && (
                  <p className="text-xs text-muted-foreground">
                    Fechas del evento con montaje y desarme: {fmtFechaCorta(preview.rango_evento.desde)} al {fmtFechaCorta(preview.rango_evento.hasta)}.
                  </p>
                )}
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {preview.hojas.filter(h => h.lineas > 0 || h.omitidas.length > 0).map(h => {
                    const sel = hojas?.includes(h.hoja) ?? false;
                    const cierra = h.total_planilla === null || Math.abs(h.total_planilla - h.total_calculado) < 1;
                    return (
                      <div key={h.hoja} className={cn('rounded-lg border p-3 text-xs space-y-1', sel ? 'border-border' : 'border-dashed opacity-70')}>
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input type="checkbox" checked={sel} disabled={importar.isPending || h.lineas === 0} onChange={() => toggle(h.hoja)} className="mt-0.5" />
                          <span className="flex-1">
                            <span className="font-semibold text-sm">{h.hoja}</span>
                            {h.lugar && <span className="text-muted-foreground"> · {h.lugar}</span>}
                            {h.desde && <span className="text-muted-foreground"> · {fmtFechaCorta(h.desde)} al {fmtFechaCorta(h.hasta!)}</span>}
                          </span>
                        </label>
                        <p className="pl-6">
                          {h.personas} comidas en {h.lineas} líneas: <span className="font-semibold">{fmtMoney(h.total_calculado)}</span>
                          {h.total_planilla !== null && (
                            <span className={cn(cierra ? 'text-green-700' : 'text-yellow-800')}>
                              {' '}· la planilla dice {fmtMoney(h.total_planilla)}{cierra ? ' ✓' : ''}
                            </span>
                          )}
                        </p>
                        {h.fuera_de_rango && (
                          <p className="pl-6 text-yellow-800 flex items-start gap-1"><AlertTriangle size={11} className="mt-0.5 shrink-0" />Fuera de las fechas del evento: puede ser de otro evento.</p>
                        )}
                        {h.diferencias.map(d => (
                          <p key={d.fila_excel} className="pl-6 text-yellow-800">
                            Fila {d.fila_excel} ({fmtFechaCorta(d.fecha)}): cantidad × valor da {fmtMoney(d.calculado)} pero la planilla dice {fmtMoney(d.planilla)}
                            {d.formula && <> (fórmula <code>{d.formula}</code>)</>}.
                          </p>
                        ))}
                        {h.advertencias.map(a => <p key={a} className="pl-6 text-muted-foreground">{a}</p>)}
                        {h.omitidas.map(o => <p key={o.fila_excel} className="pl-6 text-muted-foreground">Fila {o.fila_excel}: {o.motivo} — no se importa.</p>)}
                      </div>
                    );
                  })}
                </div>
                <p className="text-sm">
                  A importar: {preview.dias} días, {preview.lineas} líneas ({preview.lineas_nuevas} nuevas), {preview.personas} comidas,{' '}
                  <span className="font-semibold">{fmtMoney(preview.total)}</span>.
                </p>
              </>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" onClick={confirmar} disabled={!preview || !hojas?.length || importar.isPending}>
                {importar.isPending && preview ? 'Procesando…' : 'Confirmar importación'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
