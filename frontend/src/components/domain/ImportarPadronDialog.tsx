import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/utils';

// Padrón de empleados desde la planilla de datos personales (Lorena, DOS57) —
// POST /rrhh/importar/padron. Vista previa → confirmar, como el resto de los
// importadores. Lo usan ADMIN (RRHH) y quien tenga el permiso PADRON_EMPLEADOS
// (desde Presentismo).

interface FilaPadron { fila: number; nombre: string; cuit: string | null; accion: 'CREAR' | 'ACTUALIZAR' | 'SIN_CAMBIOS'; cambios: string[] }
interface ResultadoPadron {
  hoja: string; creados: number; actualizados: number; sin_cambios: number;
  omitidas: { fila: number; motivo: string }[];
  filas: FilaPadron[];
  no_estan_en_planilla: { id: number; nombre: string }[];
}

export default function ImportarPadronDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ResultadoPadron | null>(null);
  const [final, setFinal] = useState<ResultadoPadron | null>(null);

  useEffect(() => { setPreview(null); }, [file]);

  const importar = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const fd = new FormData();
      fd.append('file', file!);
      return api.post<ResultadoPadron>(`/rrhh/importar/padron?dry_run=${dryRun}`, fd).then(r => r.data);
    },
    onSuccess: (r, dryRun) => {
      if (dryRun) { setPreview(r); return; }
      setFinal(r);
      // Empleados nuevos: refrescar listas que los usan (RRHH, presentismo, uniformes)
      qc.invalidateQueries({ queryKey: ['rrhh'] });
      qc.invalidateQueries({ queryKey: ['presentismo'] });
      qc.invalidateQueries({ queryKey: ['empleados'] });
    },
  });

  const r = final ?? preview;
  const nuevos = r?.filas.filter(f => f.accion === 'CREAR') ?? [];
  const cambian = r?.filas.filter(f => f.accion === 'ACTUALIZAR') ?? [];

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Importar padrón de empleados</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-1 text-sm">
          {!final && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                Planilla de datos personales (hoja de fijos): nombre, CUIL, contacto, escalafón, licencia y talles.
                Los empleados que ya están se actualizan con lo que trae la planilla; una celda vacía no borra nada y nadie se da de baja.
              </p>
              <input type="file" accept=".xlsx,.xls" className="text-sm" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </div>
          )}

          {r && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {final ? '✓ Importación realizada' : `Vista previa (hoja "${r.hoja}") — todavía no se guardó nada`}
              </p>
              <p>
                {final ? 'Nuevos' : 'A crear'}: <span className="font-medium text-green-700">{r.creados}</span>
                {' · '}{final ? 'actualizados' : 'a actualizar'}: <span className="font-medium">{r.actualizados}</span>
                {' · '}sin cambios: <span className="font-medium">{r.sin_cambios}</span>
              </p>
              {nuevos.length > 0 && (
                <details className="rounded bg-green-50 text-green-900 p-2 text-xs" open={!final && nuevos.length <= 15}>
                  <summary className="cursor-pointer font-medium">Empleados nuevos ({nuevos.length})</summary>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                    {nuevos.map(f => <li key={f.fila}>{f.nombre}{f.cuit && <span className="opacity-70"> · {f.cuit}</span>}</li>)}
                  </ul>
                </details>
              )}
              {cambian.length > 0 && (
                <details className="rounded bg-muted/40 p-2 text-xs">
                  <summary className="cursor-pointer font-medium">Con datos que cambian ({cambian.length})</summary>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                    {cambian.map(f => <li key={f.fila}>{f.nombre} <span className="text-muted-foreground">— {f.cambios.join(', ')}</span></li>)}
                  </ul>
                </details>
              )}
              {r.no_estan_en_planilla.length > 0 && (
                <div className="rounded bg-amber-50 text-amber-800 p-2 text-xs">
                  <p className="font-medium mb-1">Activos en el sistema que no están en la planilla ({r.no_estan_en_planilla.length}) — no se tocan; si ya no trabajan, darlos de baja desde RRHH:</p>
                  <p>{r.no_estan_en_planilla.map(e => e.nombre).join(' · ')}</p>
                </div>
              )}
              {r.omitidas.length > 0 && (
                <details className="rounded bg-muted/40 p-2 text-xs">
                  <summary className="cursor-pointer font-medium">Filas omitidas ({r.omitidas.length})</summary>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                    {r.omitidas.map((o, i) => <li key={i}>Fila {o.fila}: {o.motivo}</li>)}
                  </ul>
                </details>
              )}
            </div>
          )}

          {importar.isError && <p className="text-xs text-destructive">{getApiErrorMessage(importar.error)}</p>}

          <div className="flex justify-end gap-2 pt-1">
            {final ? (
              <Button size="sm" onClick={onClose}>Cerrar</Button>
            ) : (
              <>
                <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
                {!preview ? (
                  <Button size="sm" disabled={!file || importar.isPending} onClick={() => importar.mutate(true)}>
                    {importar.isPending ? 'Analizando…' : 'Vista previa'}
                  </Button>
                ) : (
                  <Button size="sm" disabled={importar.isPending || (preview.creados + preview.actualizados === 0)} onClick={() => importar.mutate(false)}>
                    {importar.isPending ? 'Importando…' : 'Confirmar importación'}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
