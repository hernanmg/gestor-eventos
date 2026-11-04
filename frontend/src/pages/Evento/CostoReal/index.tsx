import { useState } from 'react';
import { AlertTriangle, Download, FileUp, Loader2, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BaseTable from '@/components/ui/BaseTable';
import {
  useCostoReal, useDeleteLineaCostoReal, useExportarCostoReal, useSincronizarCostoReal,
} from '@/hooks/useCostoReal';
import { formatCurrency, formatDate, formatFechaLocal } from '@/lib/formatters';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { BloqueCostoReal, BloqueCostoRealData, LineaCostoReal, OrigenLineaCostoReal } from '@/types';
import LineaCostoRealDialog from './LineaCostoRealDialog';
import ImportarMatrizDialog from './ImportarMatrizDialog';

// Pestaña "Costo real" (DOS57, eventos en modalidad OPERATIVA) — la matriz que
// arma Flor por evento (docs/dos57/jazmin/DOS57_NORTE ROCK_2026.xlsx): arriba el
// resumen de la hoja CC, abajo el detalle del bloque elegido. Cada bloque se
// carga a mano, se importa de la planilla o se trae de lo que ya está en el
// sistema (jornadas, comidas, combustible, remitos, pañol).

const cell = 'px-2 py-2 align-top';

const ORIGEN: Record<OrigenLineaCostoReal, { label: string; cls: string; title: string }> = {
  MANUAL:   { label: 'Manual',   cls: 'bg-gray-100 text-gray-700',   title: 'Cargada a mano' },
  PLANILLA: { label: 'Planilla', cls: 'bg-blue-50 text-blue-700',    title: 'Importada de la matriz Excel' },
  SISTEMA:  { label: 'Sistema',  cls: 'bg-green-50 text-green-700',  title: 'Traída de lo cargado en el sistema' },
};

const fmtCant = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 3 });

const GRUPOS: { label: string; bloques: BloqueCostoReal[] }[] = [
  { label: 'Opex',   bloques: ['STAFF', 'ALOJAMIENTO', 'COMIDAS', 'COMBUSTIBLE_PERSONAL', 'COMBUSTIBLE_MATERIAL', 'PANOL', 'VARIOS'] },
  { label: 'Rental', bloques: ['RENTAL_NAC', 'RENTAL_IMP'] },
  { label: 'L&A',    bloques: ['PERDIDAS'] },
];

interface Props {
  eventoId: number;
  canEdit:  boolean;
}

export default function CostoRealTab({ eventoId, canEdit }: Props) {
  const { data, isLoading } = useCostoReal(eventoId);
  const { exportar, exportando } = useExportarCostoReal();
  const sincronizar = useSincronizarCostoReal(eventoId);
  const [sel, setSel] = useState<BloqueCostoReal>('STAFF');
  const [dialog, setDialog] = useState<{ linea?: LineaCostoReal } | null>(null);
  const [importando, setImportando] = useState(false);
  const [avisos, setAvisos] = useState<{ titulo: string; items: string[] } | null>(null);

  if (isLoading || !data) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Cargando costo real…</p>;
  }

  const bloque = data.bloques.find(b => b.bloque === sel)!;
  const porKey = Object.fromEntries(data.bloques.map(b => [b.bloque, b])) as Record<BloqueCostoReal, BloqueCostoRealData>;
  const totalGrupo = (bs: BloqueCostoReal[]) => bs.reduce((a, b) => a + porKey[b].total, 0);
  const rentalReal = totalGrupo(['RENTAL_NAC', 'RENTAL_IMP']);

  const handleSincronizar = () => {
    const tiene = bloque.lineas.some(l => l.origen === 'SISTEMA');
    if (tiene && !confirm(`Se reemplazan las líneas de ${bloque.label} que se habían traído del sistema. ¿Seguir?`)) return;
    sincronizar.mutate(bloque.bloque, {
      onSuccess: r => setAvisos({ titulo: `${bloque.label}: ${r.creadas} línea(s) traídas del sistema`, items: r.avisos }),
      onError:   e => alert(getApiErrorMessage(e)),
    });
  };

  return (
    <div className="space-y-3">
      {/* Resumen (hoja CC) */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tarjeta label="Costo real del evento" valor={data.total} destacado
          nota={data.actualizado ? `Actualizado ${formatFechaLocal(data.actualizado)}` : 'Sin datos cargados'} />
        <Tarjeta label="Opex" valor={totalGrupo(GRUPOS[0].bloques)} nota="Personal, viaje y consumibles" />
        <Tarjeta label="Rental de material" valor={rentalReal}
          nota={data.presupuesto ? `Presupuestado ${formatCurrency(data.presupuesto.total_rental, 'ARS')}` : 'Sin presupuesto vinculado'}
          tono={data.presupuesto && rentalReal > data.presupuesto.total_rental ? 'text-orange-600' : undefined} />
        <Tarjeta label="Pérdidas y roturas" valor={porKey.PERDIDAS.total} nota="L&A" />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setImportando(true)}>
            <FileUp size={14} className="mr-1.5" /> Importar matriz
          </Button>
        )}
        <Button variant="outline" size="sm" disabled={exportando !== null}
          onClick={() => exportar(eventoId).catch(err => alert(getApiErrorMessage(err)))}>
          {exportando !== null ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Download size={14} className="mr-1.5" />}
          Exportar matriz
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[17rem_1fr]">
        {/* Bloques */}
        <div className="rounded-lg border border-border bg-white">
          {GRUPOS.map(g => (
            <div key={g.label} className="border-b border-border last:border-b-0">
              <div className="flex items-center justify-between px-3 pt-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                <span>{g.label}</span>
                <span className="tabular-nums">{formatCurrency(totalGrupo(g.bloques), 'ARS')}</span>
              </div>
              <ul className="py-1">
                {g.bloques.map(k => {
                  const b = porKey[k];
                  return (
                    <li key={k}>
                      <button
                        onClick={() => { setSel(k); setAvisos(null); }}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted/60',
                          sel === k && 'bg-muted font-medium',
                        )}
                      >
                        <span className="truncate">{b.label}</span>
                        <span className={cn('tabular-nums', !b.lineas.length && 'text-muted-foreground/60')}>
                          {b.lineas.length ? formatCurrency(b.total, 'ARS') : '—'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <div className="flex items-center justify-between bg-amber-50 px-3 py-2 text-sm font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatCurrency(data.total, 'ARS')}</span>
          </div>
        </div>

        {/* Detalle del bloque */}
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{bloque.label}</h3>
            <span className="text-xs text-muted-foreground">({bloque.cc})</span>
            <div className="ml-auto flex flex-wrap gap-2">
              {canEdit && bloque.fuente && (
                <Button variant="outline" size="sm" onClick={handleSincronizar} disabled={sincronizar.isPending} title={`Desde: ${bloque.fuente}`}>
                  {sincronizar.isPending ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <RefreshCw size={14} className="mr-1.5" />}
                  Traer del sistema
                </Button>
              )}
              {canEdit && (
                <Button size="sm" onClick={() => setDialog({})}>
                  <Plus size={14} className="mr-1.5" /> Agregar línea
                </Button>
              )}
            </div>
          </div>
          {bloque.fuente && (
            <p className="text-xs text-muted-foreground">Se puede traer de: {bloque.fuente}.</p>
          )}
          {avisos && (
            <div className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{avisos.titulo}</p>
                <button onClick={() => setAvisos(null)} title="Cerrar"><X size={12} /></button>
              </div>
              <ul className="mt-1 space-y-0.5">
                {avisos.items.map((a, i) => <li key={i} className="flex gap-1.5"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{a}</li>)}
              </ul>
            </div>
          )}
          <LineasTabla eventoId={eventoId} bloque={bloque} canEdit={canEdit} onEditar={linea => setDialog({ linea })} />
        </div>
      </div>

      {dialog && (
        <LineaCostoRealDialog eventoId={eventoId} bloque={bloque} linea={dialog.linea} open onClose={() => setDialog(null)} />
      )}
      <ImportarMatrizDialog eventoId={eventoId} eventoNombre={data.evento.nombre} open={importando} onClose={() => setImportando(false)} />
    </div>
  );
}

// Para el Resumen del evento: el costo real total (el resumen por rubro mira los
// egresos, que en DOS57 casi no se cargan) con un link a la pestaña.
export function ResumenCostoReal({ eventoId, onVer }: { eventoId: number; onVer: () => void }) {
  const { data } = useCostoReal(eventoId);
  if (!data) return null;
  const cargados = data.bloques.filter(b => b.lineas.length).length;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Costo real del evento</p>
        <p className="text-lg font-semibold tabular-nums">{formatCurrency(data.total, 'ARS')}</p>
      </div>
      <p className="text-xs text-muted-foreground">
        {cargados ? `${cargados} de ${data.bloques.length} bloques cargados` : 'Todavía sin cargar'}
        {data.presupuesto && ` · Rental presupuestado ${formatCurrency(data.presupuesto.total_rental, 'ARS')}`}
      </p>
      <Button variant="outline" size="sm" className="ml-auto" onClick={onVer}>Ver costo real</Button>
    </div>
  );
}

function Tarjeta({ label, valor, nota, destacado, tono }: { label: string; valor: number; nota?: string; destacado?: boolean; tono?: string }) {
  return (
    <div className={cn('rounded-lg border border-border bg-white px-3 py-2 min-w-0', destacado && 'border-amber-300 bg-amber-50')}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('truncate font-semibold tabular-nums', destacado ? 'text-lg' : 'text-base', tono)}>{formatCurrency(valor, 'ARS')}</p>
      {nota && <p className="truncate text-[11px] text-muted-foreground">{nota}</p>}
    </div>
  );
}

function LineasTabla({ eventoId, bloque, canEdit, onEditar }: {
  eventoId: number;
  bloque:   BloqueCostoRealData;
  canEdit:  boolean;
  onEditar: (l: LineaCostoReal) => void;
}) {
  const remove = useDeleteLineaCostoReal(eventoId);
  const conPct = bloque.porcentaje_default !== null || bloque.lineas.some(l => l.porcentaje !== null);
  const esAloj = bloque.bloque === 'ALOJAMIENTO';
  const cols = 5 + (conPct ? 1 : 0) + (esAloj ? 1 : 0) + (canEdit ? 1 : 0);

  const handleBorrar = (l: LineaCostoReal) => {
    if (!confirm(`¿Eliminar "${l.concepto}"?`)) return;
    remove.mutate(l.id, { onError: err => alert(getApiErrorMessage(err)) });
  };

  return (
    <div className="overflow-x-auto">
      <BaseTable className="min-w-[720px] text-sm">
        <thead>
          <tr>
            <th className="px-2 py-2 text-left">Concepto</th>
            <th className="px-2 py-2 text-left">Detalle</th>
            {esAloj && <th className="px-2 py-2 text-left w-36">Entrada / salida</th>}
            <th className="px-2 py-2 text-right w-24">{bloque.unidad}</th>
            <th className="px-2 py-2 text-right w-32">{bloque.valor}</th>
            {conPct && <th className="px-2 py-2 text-right w-16">%</th>}
            <th className="px-2 py-2 text-right w-32">Total</th>
            {canEdit && <th className="px-2 py-2 w-16" />}
          </tr>
        </thead>
        <tbody>
          {bloque.lineas.length === 0 && (
            <tr>
              <td colSpan={cols} className="py-8 text-center text-sm text-muted-foreground">
                Sin líneas. {bloque.fuente ? 'Traelas del sistema, importá la matriz o agregalas a mano.' : 'Importá la matriz o agregalas a mano.'}
              </td>
            </tr>
          )}
          {bloque.lineas.map(l => (
            <tr key={l.id}>
              <td className={cell} data-label="Concepto">
                <span className="font-medium">{l.concepto}</span>
                <span className={cn('ml-1.5 rounded px-1 py-0.5 text-[10px] font-medium', ORIGEN[l.origen].cls)} title={ORIGEN[l.origen].title}>
                  {ORIGEN[l.origen].label}
                </span>
                {l.codigo && <span className="block text-[11px] text-muted-foreground">Cód. {l.codigo}</span>}
                {l.notas && <span className="block text-[11px] text-muted-foreground">{l.notas}</span>}
              </td>
              <td className={cn(cell, 'text-xs')} data-label="Detalle">{l.detalle ?? <span className="text-muted-foreground/50">—</span>}</td>
              {esAloj && (
                <td className={cn(cell, 'text-xs')} data-label="Fechas">
                  {l.fecha_desde ? `${formatDate(l.fecha_desde)} → ${l.fecha_hasta ? formatDate(l.fecha_hasta) : '…'}` : <span className="text-muted-foreground/50">—</span>}
                </td>
              )}
              <td className={cn(cell, 'text-right tabular-nums')} data-label={bloque.unidad}>{fmtCant(l.cantidad)}</td>
              <td className={cn(cell, 'text-right tabular-nums')} data-label={bloque.valor}>{formatCurrency(l.valor_unitario, 'ARS')}</td>
              {conPct && <td className={cn(cell, 'text-right tabular-nums')} data-label="%">{l.porcentaje !== null ? `${l.porcentaje}%` : '—'}</td>}
              <td className={cn(cell, 'text-right tabular-nums font-medium')} data-label="Total">{formatCurrency(l.total, 'ARS')}</td>
              {canEdit && (
                <td className={cn(cell, 'whitespace-nowrap text-right')}>
                  <button className="p-1 text-muted-foreground hover:text-foreground" title="Editar" onClick={() => onEditar(l)}><Pencil size={14} /></button>
                  <button className="p-1 text-muted-foreground hover:text-destructive" title="Eliminar" onClick={() => handleBorrar(l)}><Trash2 size={14} /></button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        {bloque.lineas.length > 0 && (
          <tfoot>
            <tr className="font-semibold">
              <td className={cell} colSpan={cols - 1 - (canEdit ? 1 : 0)}>Total {bloque.label}</td>
              <td className={cn(cell, 'text-right tabular-nums')}>{formatCurrency(bloque.total, 'ARS')}</td>
              {canEdit && <td className={cell} />}
            </tr>
          </tfoot>
        )}
      </BaseTable>
    </div>
  );
}
