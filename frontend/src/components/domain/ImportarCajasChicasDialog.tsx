import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, ChevronRight, Upload } from 'lucide-react';
import api from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import BaseTable from '@/components/ui/BaseTable';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { fmtMoney } from '@/lib/formatters';
import { fmtFechaCorta } from '@/lib/turnos';

// Planilla de cajas chicas (CAJAS 2026.xlsx) → una caja de efectivo por
// rendición (persona + mes), cerrada, en Caja Global. POST
// /caja/importar-cajas-chicas. La vista previa compara cada caja contra la fila
// TOTALES de su bloque y deja afuera los bloques repetidos (se pueden tildar).

interface MovPreview { fila_excel: number; fecha: string | null; descripcion: string; ingreso: number; egreso: number }
interface BloquePreview {
  clave: string; hoja: string; fila_inicio: number; fila_fin: number;
  persona: string; nombre_planilla: string; mes: string; nombre_cuenta: string;
  movimientos: number; movimientos_nuevos: number;
  ingresos: number; egresos: number; saldo: number; desde: string | null; hasta: string | null;
  totales_planilla: { ingresos: number | null; egresos: number | null; saldo: number | null } | null;
  diferencias: string[]; duplicado_de: string | null; responsable: string | null;
  cuenta_existente: boolean; importar: boolean;
  detalle?: MovPreview[];
}
interface Resultado {
  preview: boolean; hojas_omitidas: string[];
  cajas: number; cajas_nuevas: number; movimientos: number; movimientos_nuevos: number;
  ingresos: number; egresos: number; con_diferencias: number;
  bloques: BloquePreview[];
}

export default function ImportarCajasChicasDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Resultado | null>(null);
  const [final, setFinal] = useState<Resultado | null>(null);
  const [incluir, setIncluir] = useState<Set<string>>(new Set());
  const [abierto, setAbierto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importar = useMutation({
    mutationFn: async ({ archivo, preview, omitir }: { archivo: File; preview: boolean; omitir?: string[] }) => {
      const fd = new FormData();
      fd.append('archivo', archivo);
      if (omitir) fd.append('omitir', JSON.stringify(omitir));
      const r = await api.post<Resultado>(`/caja/importar-cajas-chicas?preview=${preview}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      return r.data;
    },
    onSuccess: d => { if (!d.preview) { qc.invalidateQueries({ queryKey: ['cuentas-empresa'] }); qc.invalidateQueries({ queryKey: ['cuentas'] }); } },
  });

  const elegir = async (f: File) => {
    setFile(f); setPreview(null); setError(null);
    try {
      const r = await importar.mutateAsync({ archivo: f, preview: true });
      setPreview(r);
      setIncluir(new Set(r.bloques.filter(b => b.importar).map(b => b.clave)));
    } catch (err) { setError(getApiErrorMessage(err)); }
  };

  const elegidos = useMemo(() => preview?.bloques.filter(b => incluir.has(b.clave)) ?? [], [preview, incluir]);
  const totales = useMemo(() => ({
    cajas: elegidos.length,
    movimientos: elegidos.reduce((a, b) => a + b.movimientos, 0),
    nuevos: elegidos.reduce((a, b) => a + b.movimientos_nuevos, 0),
    ingresos: elegidos.reduce((a, b) => a + b.ingresos, 0),
    egresos: elegidos.reduce((a, b) => a + b.egresos, 0),
  }), [elegidos]);

  const confirmar = async () => {
    if (!file || !preview) return;
    setError(null);
    try {
      setFinal(await importar.mutateAsync({ archivo: file, preview: false, omitir: preview.bloques.filter(b => !incluir.has(b.clave)).map(b => b.clave) }));
    } catch (err) { setError(getApiErrorMessage(err)); }
  };

  const toggle = (clave: string) => setIncluir(prev => {
    const n = new Set(prev); if (n.has(clave)) n.delete(clave); else n.add(clave); return n;
  });

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader><DialogTitle>Importar cajas chicas</DialogTitle></DialogHeader>
        {final ? (
          <div className="space-y-3 text-sm">
            <p>
              Listo: {final.cajas} cajas ({final.cajas_nuevas} nuevas) con {final.movimientos_nuevos} movimientos nuevos. Quedan en Caja Global,
              cerradas, con el responsable y los totales de la planilla en las notas de la rendición.
            </p>
            <div className="flex justify-end"><Button size="sm" onClick={onClose}>Cerrar</Button></div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Cada bloque de la planilla (NOMBRE / MES, con su fila de totales) pasa a ser una caja de efectivo sin evento, ya rendida.
              Los ingresos van al debe y los gastos al haber, así el saldo de cada caja se compara con el de la planilla.
            </p>
            <label className="flex items-center gap-3 border-2 border-dashed border-border rounded-lg px-4 py-4 cursor-pointer hover:bg-accent/30 transition">
              <Upload size={18} className="text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground truncate">
                {importar.isPending && !preview ? 'Leyendo archivo…' : file ? file.name : 'Hacé clic para elegir el archivo .xlsx'}
              </span>
              <input type="file" accept=".xlsx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) elegir(f); e.target.value = ''; }} />
            </label>

            {preview && (
              <>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span><span className="font-semibold">{totales.cajas}</span> cajas</span>
                  <span><span className="font-semibold">{totales.movimientos}</span> movimientos ({totales.nuevos} nuevos)</span>
                  <span>Ingresos <span className="font-semibold">{fmtMoney(totales.ingresos)}</span></span>
                  <span>Gastos <span className="font-semibold">{fmtMoney(totales.egresos)}</span></span>
                </div>
                {preview.con_diferencias > 0 && (
                  <p className="text-xs bg-yellow-50 text-yellow-800 rounded px-3 py-2 flex items-start gap-1.5">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    {preview.con_diferencias === 1 ? 'Una caja no cierra' : `${preview.con_diferencias} cajas no cierran`} contra la fila de totales de la planilla: las filas suman distinto. Se importan las filas; revisá la planilla.
                  </p>
                )}
                <div className="max-h-[52vh] overflow-y-auto">
                  <BaseTable className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr className="border-b border-border text-muted-foreground font-medium">
                        <th className="w-6" />
                        <th className="px-2 py-1.5 text-left">Caja</th>
                        <th className="px-2 py-1.5 text-left">En la planilla</th>
                        <th className="px-2 py-1.5 text-right">Movs.</th>
                        <th className="px-2 py-1.5 text-right">Ingresos</th>
                        <th className="px-2 py-1.5 text-right">Gastos</th>
                        <th className="px-2 py-1.5 text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {preview.bloques.flatMap(b => {
                        const sel = incluir.has(b.clave);
                        const cierra = b.diferencias.length === 0;
                        const filas = [
                          <tr key={b.clave} className={cn(!sel && 'opacity-55')}>
                            <td className="px-1 py-1.5 align-top" data-label="Importar">
                              <input type="checkbox" checked={sel} onChange={() => toggle(b.clave)} />
                            </td>
                            <td className="px-2 py-1.5 align-top" data-label="Caja">
                              <button className="flex items-start gap-1 text-left font-medium" onClick={() => setAbierto(a => (a === b.clave ? null : b.clave))}>
                                {abierto === b.clave ? <ChevronDown size={12} className="mt-0.5" /> : <ChevronRight size={12} className="mt-0.5" />}
                                {b.nombre_cuenta}
                              </button>
                              <p className="text-muted-foreground pl-4">
                                {b.desde && `${fmtFechaCorta(b.desde)} al ${fmtFechaCorta(b.hasta!)}`}
                                {b.responsable ? ` · responsable: ${b.responsable}` : ' · sin usuario en el sistema'}
                                {b.cuenta_existente && ` · ya está: se agregan ${b.movimientos_nuevos} movimientos`}
                              </p>
                              {b.duplicado_de && <p className="text-muted-foreground pl-4">Repetido de {b.duplicado_de}</p>}
                              {b.diferencias.map(d => (
                                <p key={d} className="text-yellow-800 pl-4 flex items-start gap-1"><AlertTriangle size={10} className="mt-0.5 shrink-0" />{d}</p>
                              ))}
                            </td>
                            <td className="px-2 py-1.5 align-top text-muted-foreground" data-label="En la planilla">
                              {b.nombre_planilla || 'sin nombre'}<br />hoja {b.hoja}, filas {b.fila_inicio}–{b.fila_fin}
                            </td>
                            <td className="px-2 py-1.5 align-top text-right tabular-nums" data-label="Movs.">{b.movimientos}</td>
                            <td className="px-2 py-1.5 align-top text-right tabular-nums" data-label="Ingresos">{fmtMoney(b.ingresos)}</td>
                            <td className="px-2 py-1.5 align-top text-right tabular-nums" data-label="Gastos">{fmtMoney(b.egresos)}</td>
                            <td className="px-2 py-1.5 align-top text-right tabular-nums" data-label="Saldo">
                              {fmtMoney(b.saldo)}
                              {b.totales_planilla && (
                                <span className={cn('block', cierra ? 'text-green-700' : 'text-yellow-800')}>
                                  {cierra ? 'igual a la planilla ✓' : 'distinto de la planilla'}
                                </span>
                              )}
                            </td>
                          </tr>,
                        ];
                        if (abierto === b.clave && b.detalle) {
                          filas.push(
                            <tr key={`${b.clave}-d`}>
                              <td />
                              <td colSpan={6} className="px-2 pb-2">
                                <table className="w-full text-[11px]">
                                  <tbody>
                                    {b.detalle.map(m => (
                                      <tr key={m.fila_excel} className="border-b border-border/40">
                                        <td className="py-0.5 pr-2 text-muted-foreground w-12">{m.fila_excel}</td>
                                        <td className="py-0.5 pr-2 w-20">{m.fecha ? fmtFechaCorta(m.fecha) : ''}</td>
                                        <td className="py-0.5 pr-2">{m.descripcion}</td>
                                        <td className="py-0.5 pr-2 text-right tabular-nums text-green-700">{m.ingreso ? fmtMoney(m.ingreso) : ''}</td>
                                        <td className="py-0.5 text-right tabular-nums">{m.egreso ? fmtMoney(m.egreso) : ''}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>,
                          );
                        }
                        return filas;
                      })}
                    </tbody>
                  </BaseTable>
                </div>
                {preview.hojas_omitidas.length > 0 && (
                  <p className="text-xs text-muted-foreground">Hojas sin cajas (no se leen): {preview.hojas_omitidas.join(', ')}.</p>
                )}
              </>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" onClick={confirmar} disabled={!preview || elegidos.length === 0 || importar.isPending}>
                {importar.isPending && preview ? 'Importando…' : `Importar ${elegidos.length} cajas`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
