import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, ChevronRight, Upload } from 'lucide-react';
import api from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import BaseTable from '@/components/ui/BaseTable';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { fmtMoney, formatDate } from '@/lib/formatters';

// Planilla "Cheques Pendientes - <BANCO>" de Mayra → POST /cheques/importar.
// Primero vista previa por hoja (año); se eligen las hojas y se importa.
// Reimportar no duplica y no vuelve atrás lo que ya se marcó en el sistema.

interface HojaPreview {
  hoja: string; cheques: number; pendientes: number; debitados: number; rechazados: number;
  financiamiento: number; total: number; salteadas: { fila: number; motivo: string }[]; advertencias: string[];
}
interface Resultado {
  preview: boolean; bancos: string[]; hojas: HojaPreview[]; hojas_ignoradas: string[];
  total_cheques: number; creados: number; actualizados: number; vinculados: number; sin_cambios: number;
  sgr_sin_match: string[];
  pendientes: { hoja: string; fila: number; numero: string; concepto: string; importe: number; fecha_pago: string; estado_texto: string }[];
}

export default function ImportarChequesDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Resultado | null>(null);
  const [final, setFinal] = useState<Resultado | null>(null);
  const [hojas, setHojas] = useState<Set<string>>(new Set());
  const [abierta, setAbierta] = useState<string | null>(null);
  const [verPendientes, setVerPendientes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importar = useMutation({
    mutationFn: async ({ archivo, preview, hojas }: { archivo: File; preview: boolean; hojas?: string[] }) => {
      const fd = new FormData();
      fd.append('archivo', archivo);
      const q = new URLSearchParams({ preview: String(preview), ...(hojas ? { hojas: hojas.join(',') } : {}) });
      return (await api.post<Resultado>(`/cheques/importar?${q}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
    },
    onSuccess: d => {
      if (!d.preview) {
        qc.invalidateQueries({ queryKey: ['cheques'] });
        qc.invalidateQueries({ queryKey: ['calendario'] });
        qc.invalidateQueries({ queryKey: ['notificaciones'] });
      }
    },
  });

  const elegir = async (f: File) => {
    setFile(f); setPreview(null); setError(null);
    try {
      const r = await importar.mutateAsync({ archivo: f, preview: true });
      setPreview(r);
      setHojas(new Set(r.hojas.map(h => h.hoja)));
    } catch (err) { setError(getApiErrorMessage(err)); }
  };

  const elegidas = useMemo(() => preview?.hojas.filter(h => hojas.has(h.hoja)) ?? [], [preview, hojas]);
  const totalElegidos = elegidas.reduce((a, h) => a + h.cheques, 0);
  const pendientesElegidos = (preview?.pendientes ?? []).filter(p => hojas.has(p.hoja));
  const hoy = new Date().toISOString().slice(0, 10);
  const pendientesViejos = pendientesElegidos.filter(p => p.fecha_pago && p.fecha_pago < hoy).length;

  const confirmar = async () => {
    if (!file || !preview) return;
    setError(null);
    try { setFinal(await importar.mutateAsync({ archivo: file, preview: false, hojas: [...hojas] })); }
    catch (err) { setError(getApiErrorMessage(err)); }
  };

  const toggle = (h: string) => setHojas(prev => { const n = new Set(prev); if (n.has(h)) n.delete(h); else n.add(h); return n; });

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>Importar planilla de cheques</DialogTitle></DialogHeader>
        {final ? (
          <div className="space-y-3 text-sm">
            <p>
              Listo: {final.creados} cheques nuevos, {final.actualizados} actualizados
              {final.vinculados > 0 && `, ${final.vinculados} que ya estaban en un evento o en un pago de factura (se les completó el banco)`}
              {final.sin_cambios > 0 && ` y ${final.sin_cambios} sin cambios`}.
            </p>
            <div className="flex justify-end"><Button size="sm" onClick={onClose}>Cerrar</Button></div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              La planilla de cheques de cada banco (una hoja por año, un bloque por mes). El banco sale del título de cada bloque.
              PAGADO pasa como debitado; ACEPTADO o vacío, como pendiente; VENCIDO o ANULADO, como rechazado. Los bloques de
              financiamiento entran como cheques de SGR. Las hojas de cheques recibidos no se leen.
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
                  <span>Banco: <span className="font-semibold">{preview.bancos.join(', ')}</span></span>
                  <span><span className="font-semibold">{totalElegidos}</span> cheques en las hojas elegidas</span>
                  <span>En todo el archivo: {preview.creados} nuevos · {preview.actualizados + preview.vinculados} ya cargados que se completan · {preview.sin_cambios} sin cambios</span>
                </div>

                {preview.sgr_sin_match.length > 0 && (
                  <p className="text-xs bg-yellow-50 text-yellow-800 rounded px-3 py-2 flex items-start gap-1.5">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    Estas SGR no están cargadas en AFIP / Créditos → SGR: {preview.sgr_sin_match.join(', ')}. Los cheques entran igual con el nombre en el concepto;
                    si las cargás antes de importar, quedan ligados.
                  </p>
                )}
                {pendientesViejos > 0 && (
                  <p className="text-xs bg-yellow-50 text-yellow-800 rounded px-3 py-2 flex items-start gap-1.5">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    <span>
                      {pendientesViejos} cheque{pendientesViejos !== 1 ? 's' : ''} sin PAGADO en la planilla tienen fecha pasada: entran como pendientes y se marcan en rojo en Cheques
                      hasta que los marques debitados.{' '}
                      <button className="underline" onClick={() => setVerPendientes(v => !v)}>{verPendientes ? 'Ocultar' : 'Ver cuáles'}</button>
                    </span>
                  </p>
                )}
                {verPendientes && (
                  <div className="max-h-40 overflow-y-auto text-[11px] border rounded">
                    <table className="w-full">
                      <tbody>
                        {pendientesElegidos.filter(p => p.fecha_pago < hoy).map(p => (
                          <tr key={`${p.hoja}-${p.fila}`} className="border-b border-border/40">
                            <td className="px-2 py-0.5 text-muted-foreground">{p.hoja} · fila {p.fila}</td>
                            <td className="px-2 py-0.5">{formatDate(p.fecha_pago)}</td>
                            <td className="px-2 py-0.5 font-mono">{p.numero}</td>
                            <td className="px-2 py-0.5">{p.concepto}</td>
                            <td className="px-2 py-0.5 text-right tabular-nums">{fmtMoney(p.importe)}</td>
                            <td className="px-2 py-0.5 text-muted-foreground">{p.estado_texto || 'sin estado'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="max-h-[46vh] overflow-y-auto">
                  <BaseTable className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr className="border-b border-border text-muted-foreground font-medium">
                        <th className="w-6" />
                        <th className="px-2 py-1.5 text-left">Hoja</th>
                        <th className="px-2 py-1.5 text-right">Cheques</th>
                        <th className="px-2 py-1.5 text-right">Debitados</th>
                        <th className="px-2 py-1.5 text-right">Pendientes</th>
                        <th className="px-2 py-1.5 text-right">Rechazados</th>
                        <th className="px-2 py-1.5 text-right">Financiamiento</th>
                        <th className="px-2 py-1.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {preview.hojas.flatMap(h => {
                        const sel = hojas.has(h.hoja);
                        const avisos = h.salteadas.length + h.advertencias.length;
                        const filas = [
                          <tr key={h.hoja} className={cn(!sel && 'opacity-55')}>
                            <td className="px-1 py-1.5" data-label="Importar"><input type="checkbox" checked={sel} onChange={() => toggle(h.hoja)} /></td>
                            <td className="px-2 py-1.5 font-medium" data-label="Hoja">
                              {avisos > 0 ? (
                                <button className="flex items-center gap-1" onClick={() => setAbierta(a => (a === h.hoja ? null : h.hoja))}>
                                  {abierta === h.hoja ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                  {h.hoja}
                                  <span className="text-yellow-800 font-normal">· {avisos} aviso{avisos !== 1 ? 's' : ''}</span>
                                </button>
                              ) : h.hoja}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums" data-label="Cheques">{h.cheques}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums" data-label="Debitados">{h.debitados}</td>
                            <td className={cn('px-2 py-1.5 text-right tabular-nums', h.pendientes > 0 && 'font-semibold')} data-label="Pendientes">{h.pendientes}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums" data-label="Rechazados">{h.rechazados}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums" data-label="Financiamiento">{h.financiamiento}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums" data-label="Total">{fmtMoney(h.total)}</td>
                          </tr>,
                        ];
                        if (abierta === h.hoja) {
                          filas.push(
                            <tr key={`${h.hoja}-d`}>
                              <td />
                              <td colSpan={7} className="px-2 pb-2 text-[11px] space-y-0.5">
                                {h.salteadas.map(s => <p key={`s${s.fila}`} className="text-muted-foreground">Fila {s.fila}: no se importa ({s.motivo})</p>)}
                                {h.advertencias.map(a => <p key={a} className="text-yellow-800">{a}</p>)}
                              </td>
                            </tr>,
                          );
                        }
                        return filas;
                      })}
                    </tbody>
                  </BaseTable>
                </div>
                {preview.hojas_ignoradas.length > 0 && (
                  <p className="text-xs text-muted-foreground">No se leen: {preview.hojas_ignoradas.join(', ')}.</p>
                )}
              </>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" onClick={confirmar} disabled={!preview || elegidas.length === 0 || importar.isPending}>
                {importar.isPending && preview ? 'Importando…' : `Importar ${totalElegidos} cheques`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
