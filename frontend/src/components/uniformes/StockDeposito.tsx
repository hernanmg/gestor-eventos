import { useEffect, useMemo, useState } from 'react';
import { Upload, Warehouse } from 'lucide-react';
import { useActivos } from '@/hooks/useActivos';
import { useImportarStockUniformes } from '@/hooks/useUniformes';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { Activo, ImportarStockUniformesResultado } from '@/types';

// Stock de uniformes del depósito por talle (planilla "STOCK Uniformes" de
// Lorena) — Activo categoria UNIFORME, nombre "<Prenda> Talle <T>". Se muestra
// una grilla prenda × talle por depósito; rojo = sin stock, ámbar = bajo.

const selCls = 'border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';

function separar(nombre: string): { prenda: string; talle: string } {
  const m = nombre.match(/^(.*) Talle (.+)$/);
  return m ? { prenda: m[1], talle: m[2] } : { prenda: nombre, talle: '—' };
}

function tono(a: { cantidad?: number | null; cantidad_minima?: number | null }) {
  const c = a.cantidad ?? 0;
  if (c === 0) return 'bg-red-50 text-red-700';
  if (a.cantidad_minima != null && c <= a.cantidad_minima) return 'bg-amber-50 text-amber-800';
  return '';
}

function Grilla({ ubicacion, activos }: { ubicacion: string; activos: Activo[] }) {
  // Prendas en el orden de la planilla (orden de alta); las que comparten la
  // misma curva de talles van en la misma tabla (remeras XS-4XL, pantalones 40-56).
  const tallesDe = new Map<string, string[]>();
  const celda = new Map<string, Activo>();
  for (const a of [...activos].sort((x, y) => x.id - y.id)) {
    const { prenda, talle } = separar(a.nombre);
    const t = tallesDe.get(prenda) ?? [];
    if (!t.includes(talle)) t.push(talle);
    tallesDe.set(prenda, t);
    celda.set(`${prenda}|${talle}`, a);
  }
  const bloques = new Map<string, { talles: string[]; prendas: string[] }>();
  for (const [prenda, talles] of tallesDe) {
    const clave = talles.join('|');
    const b = bloques.get(clave) ?? { talles, prendas: [] };
    b.prendas.push(prenda);
    bloques.set(clave, b);
  }
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{ubicacion}</p>
      <div className="flex flex-wrap items-start gap-3">
        {[...bloques.values()].map(b => <Tabla key={b.prendas.join('|')} {...b} celda={celda} />)}
      </div>
    </div>
  );
}

function Tabla({ talles, prendas, celda }: { talles: string[]; prendas: string[]; celda: Map<string, Activo> }) {
  const th = 'px-2 py-1.5 text-xs font-medium text-muted-foreground whitespace-nowrap';
  return (
    <div>
      <div className="overflow-x-auto rounded-md border border-border bg-white">
        <table className="text-sm">
          <thead className="border-b bg-muted/30">
            <tr>
              <th className={cn(th, 'text-left')}>Talle</th>
              {prendas.map(p => <th key={p} className={cn(th, 'text-right')}>{p}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {talles.map(t => (
              <tr key={t}>
                <td className="px-2 py-1 font-medium whitespace-nowrap">{t}</td>
                {prendas.map(p => {
                  const a = celda.get(`${p}|${t}`);
                  return (
                    <td key={p} className={cn('px-2 py-1 text-right tabular-nums', a && tono(a))}>
                      {a ? (a.cantidad ?? 0) : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImportarStockDialog({ onClose }: { onClose: () => void }) {
  const importar = useImportarStockUniformes();
  const [file, setFile] = useState<File | null>(null);
  const [hoja, setHoja] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportarStockUniformesResultado | null>(null);
  const [final, setFinal] = useState<ImportarStockUniformesResultado | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Hojas del archivo (vienen en la primera vista previa) — para elegir otra
  const [hojas, setHojas] = useState<string[]>([]);

  // Otro archivo invalida la vista previa y la hoja elegida
  useEffect(() => { setPreview(null); setError(null); setHoja(null); setHojas([]); }, [file]);

  const correr = async (dryRun: boolean) => {
    if (!file) return;
    setError(null);
    try {
      const r = await importar.mutateAsync({ file, hoja, dryRun });
      if (dryRun) { setPreview(r); setHojas(r.hojas); setHoja(r.hoja); } else setFinal(r);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const r = final ?? preview;
  const cambios = r?.filas.filter(f => f.anterior !== f.cantidad) ?? [];

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Importar stock de uniformes del depósito</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-1 text-sm">
          {!final && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Planilla de stock por talle (bloques TALLE | prendas). Cada hoja es un conteo en una fecha: se toma la última, o elegí otra.
                Los talles en 0 también se guardan y avisan que no hay stock.
              </p>
              <input type="file" accept=".xlsx" className="text-sm" onChange={e => setFile(e.target.files?.[0] ?? null)} />
              {hojas.length > 1 && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-0.5">Hoja</label>
                  <select value={hoja ?? ''} onChange={e => { setHoja(e.target.value); setPreview(null); }} className={selCls}>
                    {hojas.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {r && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {final ? '✓ Importación realizada' : `Vista previa — hoja "${r.hoja}"${r.fecha_revision ? ` (revisión ${r.fecha_revision})` : ''}, todavía no se guardó nada`}
              </p>
              <p>
                Talles nuevos: <span className="font-medium text-green-700">{r.creados}</span>
                {' · '}con cambio de cantidad: <span className="font-medium">{r.actualizados}</span>
                {' · '}iguales: <span className="font-medium">{r.sin_cambios}</span>
                {' · '}en stock bajo o sin stock: <span className="font-medium text-amber-700">{r.con_stock_bajo}</span>
              </p>
              {cambios.length > 0 && (
                <details className="rounded bg-muted/40 p-2 text-xs">
                  <summary className="cursor-pointer font-medium">Detalle ({cambios.length})</summary>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                    {cambios.map(f => (
                      <li key={`${f.nombre}|${f.ubicacion}`}>
                        {f.nombre} <span className="text-muted-foreground">({f.ubicacion})</span>: {f.anterior === null ? 'nuevo' : f.anterior} → <span className="font-medium">{f.cantidad}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            {final ? (
              <Button size="sm" onClick={onClose}>Cerrar</Button>
            ) : (
              <>
                <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
                {!preview ? (
                  <Button size="sm" disabled={!file || importar.isPending} onClick={() => correr(true)}>
                    {importar.isPending ? 'Analizando…' : 'Vista previa'}
                  </Button>
                ) : (
                  <Button size="sm" disabled={importar.isPending} onClick={() => correr(false)}>
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

export default function StockDeposito({ puedeGestionar }: { puedeGestionar: boolean }) {
  const { data: activos = [], isLoading, error } = useActivos({ categoria: 'UNIFORME' });
  const [importarOpen, setImportarOpen] = useState(false);

  const porUbicacion = useMemo(() => {
    const m = new Map<string, Activo[]>();
    for (const a of activos) {
      const u = a.ubicacion ?? 'Sin ubicación';
      m.set(u, [...(m.get(u) ?? []), a]);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [activos]);

  const sinStock = activos.filter(a => (a.cantidad ?? 0) === 0).length;
  const bajo = activos.filter(a => (a.cantidad ?? 0) > 0 && a.cantidad_minima != null && (a.cantidad ?? 0) <= a.cantidad_minima).length;
  const fecha = activos.find(a => a.observaciones)?.observaciones;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {activos.length > 0
            ? <>{fecha ?? 'Stock por talle'} · <span className="text-red-700">{sinStock} sin stock</span> · <span className="text-amber-700">{bajo} con stock bajo</span></>
            : 'Conteo del depósito por prenda y talle.'}
        </p>
        {puedeGestionar && (
          <Button size="sm" variant="outline" onClick={() => setImportarOpen(true)}>
            <Upload size={14} className="mr-1.5" /> Importar stock
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : error ? (
        <p className="text-sm text-destructive">{getApiErrorMessage(error)}</p>
      ) : activos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center space-y-2 flex flex-col items-center">
          <Warehouse size={32} className="text-muted-foreground/60" />
          <p className="text-sm font-medium">Todavía no se cargó el stock del depósito.</p>
          {puedeGestionar && <p className="text-xs text-muted-foreground">Usá "Importar stock" con la planilla de stock de uniformes.</p>}
        </div>
      ) : (
        porUbicacion.map(([u, items]) => <Grilla key={u} ubicacion={u} activos={items} />)
      )}

      {importarOpen && <ImportarStockDialog onClose={() => setImportarOpen(false)} />}
    </div>
  );
}
