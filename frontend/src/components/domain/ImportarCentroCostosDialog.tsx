import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Upload } from 'lucide-react';
import api from '@/lib/api';
import { fichaKey } from '@/hooks/useFichaEvento';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import BaseTable from '@/components/ui/BaseTable';
import { formatCurrency } from '@/lib/formatters';
import { cn, getApiErrorMessage } from '@/lib/utils';

// Planilla de Male "KM - Centro de Costos" → Centro de costos del evento.
// POST /eventos/:id/centro-costos/importar. Lee Costos, RRHH y Extras (las hojas
// de Acciones se ignoran). En la vista previa se corrige el rubro de cada línea
// de Costos (o "No importar"), y hay un rubro por defecto para las que no se
// reconocen. Reimportar el mismo archivo actualiza las mismas líneas.

type Hoja = 'COSTOS' | 'RRHH' | 'EXTRAS';
type Accion = 'CREAR' | 'ACTUALIZAR' | 'COMPLETAR_FICHA' | 'SIN_RUBRO' | 'OMITIDO';

interface FilaPreview {
  clave: string;
  hoja: Hoja;
  fila: number;
  descripcion: string;
  responsable: string | null;
  neto: number;
  iva: number;
  total: number;
  pagado: boolean;
  pagado_parcial: number;
  plazo_pago: string | null;
  notas: string[];
  advertencias: string[];
  accion: Accion;
  rubro_id: number | null;
  rubro_nombre: string | null;
  rubro_automatico: boolean;
  proveedor_id: number | null;
  proveedor_nombre: string | null;
}

interface HojaResumen {
  nombre: string;
  tipo: Hoja | 'IGNORADA';
  motivo?: string;
  filas: number;
  total_planilla: number | null;
  total_leido: number;
}

interface ResultadoKM {
  evento_planilla: string | null;
  hojas: HojaResumen[];
  filas: FilaPreview[];
  resumen: {
    crear: number; actualizar: number; completar_ficha: number; sin_rubro: number;
    omitidas: number; sin_proveedor: number; con_advertencias: number;
  };
  rubros: { id: number; nombre: string }[];
  falta_rubro_rrhh: boolean;
  importado?: boolean;
}

const HOJA_LABEL: Record<Hoja, string> = { COSTOS: 'Costos', RRHH: 'RRHH', EXTRAS: 'Extras' };

const ACCION: Record<Accion, { label: string; variant: 'success' | 'warning' | 'muted' | 'default' }> = {
  CREAR:           { label: 'Nueva',            variant: 'success' },
  ACTUALIZAR:      { label: 'Se actualiza',     variant: 'default' },
  COMPLETAR_FICHA: { label: 'Completa la Ficha', variant: 'default' },
  SIN_RUBRO:       { label: 'Falta rubro',      variant: 'warning' },
  OMITIDO:         { label: 'No se importa',    variant: 'muted' },
};

export default function ImportarCentroCostosDialog({ eventoId, eventoNombre, onClose }: {
  eventoId: number; eventoNombre?: string; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [asignaciones, setAsignaciones] = useState<Record<string, number>>({});
  const [rubroDefecto, setRubroDefecto] = useState<string>('');
  const [preview, setPreview] = useState<ResultadoKM | null>(null);
  const [final, setFinal] = useState<ResultadoKM | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importar = useMutation({
    mutationFn: async ({ archivo, preview, asig, defecto }: { archivo: File; preview: boolean; asig: Record<string, number>; defecto: string }) => {
      const fd = new FormData();
      fd.append('archivo', archivo);
      fd.append('asignaciones', JSON.stringify(asig));
      if (defecto) fd.append('rubro_defecto', defecto);
      const r = await api.post<ResultadoKM>(`/eventos/${eventoId}/centro-costos/importar?preview=${preview}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return r.data;
    },
    onSuccess: data => {
      if (data.importado) {
        qc.invalidateQueries({ queryKey: ['movimientos', eventoId] });
        qc.invalidateQueries({ queryKey: fichaKey(eventoId) });
      }
    },
  });

  const verPreview = async (archivo: File, asig: Record<string, number>, defecto: string) => {
    setError(null);
    try {
      setPreview(await importar.mutateAsync({ archivo, preview: true, asig, defecto }));
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const elegirArchivo = (f: File) => {
    setFile(f);
    setAsignaciones({});
    setPreview(null);
    verPreview(f, {}, rubroDefecto);
  };

  const cambiarRubro = (clave: string, valor: string) => {
    const nuevas = { ...asignaciones, [clave]: Number(valor) };
    setAsignaciones(nuevas);
    if (file) verPreview(file, nuevas, rubroDefecto);
  };

  const cambiarDefecto = (valor: string) => {
    setRubroDefecto(valor);
    if (file) verPreview(file, asignaciones, valor);
  };

  const confirmar = async () => {
    if (!file) return;
    setError(null);
    try {
      setFinal(await importar.mutateAsync({ archivo: file, preview: false, asig: asignaciones, defecto: rubroDefecto }));
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const eventoDistinto = preview?.evento_planilla && eventoNombre
    && !eventoNombre.toLowerCase().includes(preview.evento_planilla.toLowerCase())
    && !preview.evento_planilla.toLowerCase().includes(eventoNombre.toLowerCase())
    ? preview.evento_planilla : null;

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader><DialogTitle>Importar planilla de centro de costos</DialogTitle></DialogHeader>

        {final ? (
          <div className="space-y-3">
            <p className="text-sm">
              Listo: <span className="font-semibold text-green-700">{final.resumen.crear}</span> líneas nuevas,{' '}
              <span className="font-semibold">{final.resumen.actualizar}</span> actualizadas
              {final.resumen.completar_ficha > 0 && <>, <span className="font-semibold">{final.resumen.completar_ficha}</span> completadas desde la Ficha</>}
              {final.resumen.omitidas > 0 && <> y {final.resumen.omitidas} sin importar</>}.
            </p>
            {final.resumen.sin_proveedor > 0 && (
              <p className="text-xs bg-yellow-50 text-yellow-800 rounded px-3 py-2">
                {final.resumen.sin_proveedor} líneas tienen un responsable que no está dado de alta como proveedor: el nombre quedó en
                la descripción de la línea. Se puede vincular después desde Vincular proveedores.
              </p>
            )}
            <div className="flex justify-end"><Button size="sm" onClick={onClose}>Cerrar</Button></div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Subí la planilla de centro de costos del evento (formato KM). Se leen las hojas Costos, RRHH y Extras; las de
              Acciones no se importan. Si la Ficha ya generó la línea de un rubro, se completa esa misma línea.
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
                  <span><span className="font-semibold text-green-700">{preview.resumen.crear}</span> nuevas</span>
                  {preview.resumen.actualizar > 0 && <span><span className="font-semibold">{preview.resumen.actualizar}</span> a actualizar</span>}
                  {preview.resumen.completar_ficha > 0 && <span><span className="font-semibold">{preview.resumen.completar_ficha}</span> completan la Ficha</span>}
                  {preview.resumen.sin_rubro > 0 && <span className="text-yellow-700"><span className="font-semibold">{preview.resumen.sin_rubro}</span> sin rubro</span>}
                  {preview.resumen.con_advertencias > 0 && <span className="text-yellow-700"><span className="font-semibold">{preview.resumen.con_advertencias}</span> con avisos</span>}
                </div>

                {eventoDistinto && (
                  <p className="text-xs bg-yellow-50 text-yellow-800 rounded px-3 py-2 flex items-start gap-1.5">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    La planilla es del evento "{eventoDistinto}". Revisá que estés importando en el evento correcto.
                  </p>
                )}
                {preview.falta_rubro_rrhh && (
                  <p className="text-xs bg-yellow-50 text-yellow-800 rounded px-3 py-2">
                    La empresa no tiene el rubro RRHH: las líneas de la hoja RRHH no se pueden importar.
                  </p>
                )}
                {preview.hojas.filter(h => h.tipo !== 'IGNORADA' && h.motivo).map(h => (
                  <p key={h.nombre} className="text-xs bg-yellow-50 text-yellow-800 rounded px-3 py-2 flex items-start gap-1.5">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    Hoja {h.nombre}: {h.motivo}. Se importa lo que dice cada fila.
                  </p>
                ))}

                {(preview.resumen.sin_rubro > 0 || rubroDefecto) && (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Rubro para las líneas de Costos que no se reconocen:</span>
                    <select
                      value={rubroDefecto}
                      onChange={e => cambiarDefecto(e.target.value)}
                      disabled={importar.isPending}
                      className="border rounded px-2 py-1 text-sm bg-background"
                    >
                      <option value="">— Elegir una por una —</option>
                      {preview.rubros.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                    </select>
                  </div>
                )}

                <div className="max-h-[50vh] overflow-y-auto">
                  <BaseTable className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr className="border-b border-border text-muted-foreground font-medium">
                        <th className="px-2 py-1.5 text-left">En la planilla</th>
                        <th className="px-2 py-1.5 text-left">Va a</th>
                        <th className="px-2 py-1.5 text-left">Proveedor</th>
                        <th className="px-2 py-1.5 text-right">Total</th>
                        <th className="px-2 py-1.5 text-left">Pago</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {preview.filas.map(f => {
                        const valor = asignaciones[f.clave] ?? f.rubro_id ?? '';
                        return (
                          <tr key={f.clave} className={cn(f.accion === 'OMITIDO' && 'opacity-60')}>
                            <td className="px-2 py-1.5 align-top" data-label="En la planilla">
                              <p className="font-medium">{f.descripcion}</p>
                              <p className="text-muted-foreground">{HOJA_LABEL[f.hoja]} · fila {f.fila}</p>
                              {f.notas.map(n => <p key={n} className="text-muted-foreground italic">{n}</p>)}
                              {f.advertencias.map(a => (
                                <p key={a} className="text-yellow-700 flex items-start gap-1"><AlertTriangle size={10} className="mt-0.5 shrink-0" />{a}</p>
                              ))}
                            </td>
                            <td className="px-2 py-1.5 align-top" data-label="Va a">
                              {f.hoja === 'COSTOS' ? (
                                <select
                                  value={String(valor)}
                                  onChange={e => cambiarRubro(f.clave, e.target.value)}
                                  disabled={importar.isPending}
                                  className={cn('w-full border rounded px-1.5 py-1 text-xs bg-background', f.accion === 'SIN_RUBRO' && 'border-yellow-500')}
                                >
                                  {f.accion === 'SIN_RUBRO' && <option value="">— Elegí un rubro —</option>}
                                  <option value="0">No importar</option>
                                  {preview.rubros.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                                </select>
                              ) : f.hoja === 'RRHH' ? (
                                <span>RRHH</span>
                              ) : (
                                <span>Extras (los paga el cliente)</span>
                              )}
                              <Badge variant={ACCION[f.accion].variant} className="mt-1">{ACCION[f.accion].label}</Badge>
                            </td>
                            <td className="px-2 py-1.5 align-top" data-label="Proveedor">
                              {f.responsable ?? '—'}
                              {f.hoja !== 'EXTRAS' && f.responsable && !f.proveedor_id && <span className="block text-yellow-700">No está dado de alta</span>}
                              {f.proveedor_id && f.proveedor_nombre !== f.responsable && <span className="block text-muted-foreground">→ {f.proveedor_nombre}</span>}
                            </td>
                            <td className="px-2 py-1.5 align-top text-right whitespace-nowrap tabular-nums" data-label="Total">
                              {f.total > 0 ? formatCurrency(f.total, 'ARS') : <span className="text-muted-foreground">—</span>}
                              {f.iva > 0 && <span className="block text-muted-foreground">IVA {formatCurrency(f.iva, 'ARS')}</span>}
                            </td>
                            <td className="px-2 py-1.5 align-top" data-label="Pago">
                              {f.pagado ? 'Pagado'
                                : f.pagado_parcial > 0 ? `Seña ${formatCurrency(f.pagado_parcial, 'ARS')}`
                                : f.plazo_pago ?? 'Pendiente'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </BaseTable>
                </div>
                {preview.hojas.some(h => h.tipo === 'IGNORADA') && (
                  <p className="text-xs text-muted-foreground">
                    Hojas que no se leyeron: {preview.hojas.filter(h => h.tipo === 'IGNORADA').map(h => h.nombre.trim()).join(', ')}.
                  </p>
                )}
              </>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" onClick={confirmar} disabled={!preview || importar.isPending || preview.resumen.sin_rubro > 0}>
                {importar.isPending && preview ? 'Procesando…' : preview && preview.resumen.sin_rubro > 0 ? `Faltan ${preview.resumen.sin_rubro} rubros` : 'Confirmar importación'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
