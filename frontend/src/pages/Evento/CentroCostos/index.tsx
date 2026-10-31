import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, Paperclip, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BaseTable from '@/components/ui/BaseTable';
import TabStrip, { TabCount } from '@/components/ui/TabStrip';
import { MOVIMIENTO_LABEL } from '@/components/ui/badge';
import { ESTADO_SELECT_CLASS } from '@/components/domain/MovimientoTable';
import { IvaDialog, PagosDialog } from '@/components/domain/CentroCostoDialogs';
import {
  useCentroCostos, useUpdateExtra, useDeleteExtra, useSubirComprobanteExtra, useQuitarComprobanteExtra,
  descargarComprobanteExtra, useExportarCentroCostos,
} from '@/hooks/useCentroCostos';
import { useDeleteMovimiento } from '@/hooks/useMovimientos';
import { useRubros } from '@/hooks/useRubros';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { RUBROS_SISTEMA } from '@/lib/rubrosConstants';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { ExtraEvento, Moneda, Movimiento, TotalCentroCostos } from '@/types';
import LineaCostoDialog from './LineaCostoDialog';
import ExtraDialog from './ExtraDialog';

// Pestaña "Centro de costos" — la planilla de Male (docs/enjoy/KM - Centro de
// Costos.xlsx) dentro del evento. Costos y RRHH son los mismos movimientos de
// egreso que ve la pestaña Egresos (las líneas de la Ficha aparecen solas);
// Extras es aparte y por defecto no suma al costo. En eventos CENTRO_COSTOS
// reemplaza a Egresos/Ingresos/Caja/Conciliatoria/Echeqs.

type Seccion = 'COSTOS' | 'RRHH' | 'EXTRAS';

const cell = 'px-2 py-2 align-top';

function fechaPago(m: Movimiento): string {
  if (m.plazo_pago) return m.plazo_pago;
  if (m.estado_movimiento === 'PAGADO') return m.fecha_pago ? `Pagado ${formatDate(m.fecha_pago)}` : 'Pagado';
  return m.fecha_pago ? formatDate(m.fecha_pago) : '';
}

function Resumen({ label, valor, moneda, tono, nota }: { label: string; valor: number; moneda: Moneda; tono?: string; nota?: string }) {
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('text-base font-semibold tabular-nums truncate', tono)}>{formatCurrency(valor, moneda)}</p>
      {nota && <p className="text-[11px] text-muted-foreground truncate">{nota}</p>}
    </div>
  );
}

function notaOtrasMonedas(t: TotalCentroCostos): string | undefined {
  return t.otras_monedas > 0 ? `${t.otras_monedas} línea${t.otras_monedas !== 1 ? 's' : ''} en otra moneda sin sumar` : undefined;
}

interface Props {
  eventoId: number;
  canEdit:  boolean;
}

export default function CentroCostosTab({ eventoId, canEdit }: Props) {
  const { data, isLoading } = useCentroCostos(eventoId);
  const { data: rubros = [] } = useRubros('EGRESO');
  const { exportar, isExporting } = useExportarCentroCostos();
  const [seccion, setSeccion] = useState<Seccion>('COSTOS');

  const [lineaDialog, setLineaDialog] = useState<{ mov?: Movimiento; rrhh?: boolean } | null>(null);
  const [movDialog,   setMovDialog]   = useState<{ tipo: 'iva' | 'pagos'; movId: number } | null>(null);
  const [extraDialog, setExtraDialog] = useState<{ extra?: ExtraEvento } | null>(null);

  if (isLoading || !data) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Cargando centro de costos…</p>;
  }

  const { totales } = data;
  const moneda = totales.moneda;
  const rubrosOperativos = rubros.filter(r => r.activo && !r.codigo);
  const rubroRRHH = rubros.find(r => r.codigo === RUBROS_SISTEMA.RRHH);
  const lineas = seccion === 'RRHH' ? data.rrhh : data.costos;
  const movSel = movDialog ? [...data.costos, ...data.rrhh].find(m => m.id === movDialog.movId) : undefined;

  const handleExportar = (hoja?: 'extras') => {
    exportar(eventoId, hoja).catch(err => alert(getApiErrorMessage(err)));
  };

  return (
    <div className="space-y-3">
      {/* Totales */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Resumen label="Costos" valor={totales.costos.total} moneda={moneda} nota={notaOtrasMonedas(totales.costos)} />
        <Resumen label="RRHH" valor={totales.rrhh.total} moneda={moneda} nota={notaOtrasMonedas(totales.rrhh)} />
        <Resumen label="Extras a cargo nuestro" valor={totales.extras_empresa.total} moneda={moneda} />
        <Resumen label="Costo del evento" valor={totales.costo_evento} moneda={moneda} tono="text-foreground" />
        <Resumen
          label="Falta pagar" valor={totales.falta_pagar} moneda={moneda}
          tono={totales.falta_pagar > 0 ? 'text-orange-600' : 'text-green-700'}
        />
        <Resumen
          label="Extras del cliente" valor={totales.extras_cliente.total} moneda={moneda}
          nota="No suman al costo"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TabStrip<Seccion>
          variant="pill"
          value={seccion}
          onChange={setSeccion}
          items={[
            { key: 'COSTOS', label: 'Costos', badge: <TabCount count={data.costos.length} tone="neutral" /> },
            { key: 'RRHH',   label: 'RRHH',   badge: <TabCount count={data.rrhh.length} tone="neutral" /> },
            { key: 'EXTRAS', label: 'Extras', badge: <TabCount count={data.extras.length} tone="neutral" /> },
          ]}
        />
        <div className="ml-auto flex flex-wrap gap-2">
          {canEdit && seccion !== 'EXTRAS' && (seccion === 'COSTOS' || rubroRRHH) && (
            <Button size="sm" onClick={() => setLineaDialog({ rrhh: seccion === 'RRHH' })}>
              <Plus size={14} className="mr-1.5" /> Agregar línea
            </Button>
          )}
          {canEdit && seccion === 'EXTRAS' && (
            <Button size="sm" onClick={() => setExtraDialog({})}>
              <Plus size={14} className="mr-1.5" /> Agregar extra
            </Button>
          )}
          {seccion === 'EXTRAS' && (
            <Button variant="outline" size="sm" disabled={isExporting || data.extras.length === 0} onClick={() => handleExportar('extras')}>
              <FileSpreadsheet size={14} className="mr-1.5" /> Exportar extras
            </Button>
          )}
          <Button variant="outline" size="sm" disabled={isExporting} onClick={() => handleExportar()}>
            {isExporting ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Download size={14} className="mr-1.5" />}
            Exportar Excel
          </Button>
        </div>
      </div>

      {seccion !== 'EXTRAS' ? (
        <LineasTabla
          eventoId={eventoId}
          lineas={lineas}
          total={seccion === 'RRHH' ? totales.rrhh : totales.costos}
          moneda={moneda}
          canEdit={canEdit}
          vacio={seccion === 'RRHH'
            ? 'No hay líneas de RRHH. Las liquidaciones aprobadas del evento aparecen acá.'
            : 'No hay costos cargados. Los rubros que confirmes en la Ficha aparecen acá solos.'}
          onEditar={mov => setLineaDialog({ mov })}
          onIva={id => setMovDialog({ tipo: 'iva', movId: id })}
          onPagos={id => setMovDialog({ tipo: 'pagos', movId: id })}
        />
      ) : (
        <ExtrasTabla
          eventoId={eventoId}
          extras={data.extras}
          moneda={moneda}
          canEdit={canEdit}
          onEditar={extra => setExtraDialog({ extra })}
        />
      )}

      {lineaDialog && (
        <LineaCostoDialog
          eventoId={eventoId}
          monedaBase={moneda}
          open
          onClose={() => setLineaDialog(null)}
          mov={lineaDialog.mov}
          rubros={rubrosOperativos}
          rubroFijo={lineaDialog.rrhh ? rubroRRHH : undefined}
        />
      )}
      {movSel && movSel.rubro_id !== null && (
        <>
          <IvaDialog
            mov={movSel} eventoId={eventoId} rubroId={movSel.rubro_id}
            open={movDialog?.tipo === 'iva'} onClose={() => setMovDialog(null)}
          />
          <PagosDialog
            mov={movSel} eventoId={eventoId} rubroId={movSel.rubro_id}
            open={movDialog?.tipo === 'pagos'} onClose={() => setMovDialog(null)}
          />
        </>
      )}
      {extraDialog && (
        <ExtraDialog
          eventoId={eventoId}
          monedaBase={moneda}
          open
          onClose={() => setExtraDialog(null)}
          extra={extraDialog.extra}
        />
      )}
    </div>
  );
}

// ── Costos / RRHH ─────────────────────────────────────────────────────────────

function LineasTabla({ eventoId, lineas, total, moneda, canEdit, vacio, onEditar, onIva, onPagos }: {
  eventoId: number;
  lineas:   Movimiento[];
  total:    TotalCentroCostos;
  moneda:   Moneda;
  canEdit:  boolean;
  vacio:    string;
  onEditar: (m: Movimiento) => void;
  onIva:    (id: number) => void;
  onPagos:  (id: number) => void;
}) {
  const remove = useDeleteMovimiento(eventoId, 0);

  const handleBorrar = (m: Movimiento) => {
    if (!confirm(`¿Eliminar la línea "${m.concepto ?? 'sin descripción'}"?`)) return;
    remove.mutate(m.id, { onError: err => alert(getApiErrorMessage(err)) });
  };

  return (
    <div className="overflow-x-auto">
      <BaseTable className="min-w-[1000px] text-sm">
        <thead>
          <tr>
            <th className="px-2 py-2 text-left w-10">Item</th>
            <th className="px-2 py-2 text-left">Descripción</th>
            <th className="px-2 py-2 text-left">Responsable</th>
            <th className="px-2 py-2 text-right w-28">Consumido</th>
            <th className="px-2 py-2 text-right w-24">IVA</th>
            <th className="px-2 py-2 text-right w-28">Total</th>
            <th className="px-2 py-2 text-right w-28">Falta pagar</th>
            <th className="px-2 py-2 text-left w-36">Fecha de pago</th>
            <th className="px-2 py-2 text-center w-16">Avisado</th>
            <th className="px-2 py-2 text-left w-28">Estado</th>
            {canEdit && <th className="px-2 py-2 w-16">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {lineas.length === 0 && (
            <tr><td colSpan={canEdit ? 11 : 10} className="py-8 text-center text-sm text-muted-foreground">{vacio}</td></tr>
          )}
          {lineas.map((m, i) => {
            const tot     = m.debe + m.haber;
            const pagado  = m.estado_movimiento === 'PAGADO';
            return (
              <tr key={m.id}>
                <td className={cn(cell, 'text-muted-foreground tabular-nums')}>{i + 1}</td>
                <td className={cell}>
                  <span className="font-medium">{m.concepto || <span className="text-muted-foreground">—</span>}</span>
                  {m.rubro_evento_id !== null && (
                    <span className="ml-1.5 rounded bg-blue-50 px-1 py-0.5 text-[10px] font-medium text-blue-700" title="Generada desde la Ficha (rubro confirmado)">Ficha</span>
                  )}
                  {m.rubro && m.rubro.nombre !== m.concepto && (
                    <span className="block text-[11px] text-muted-foreground">{m.rubro.nombre}</span>
                  )}
                </td>
                <td className={cell}>{m.proveedor?.nombre ?? <span className="text-muted-foreground/50">—</span>}</td>
                <td className={cn(cell, 'text-right tabular-nums')}>
                  {tot > 0 ? formatCurrency(tot - (m.iva ?? 0), m.moneda) : (
                    m.presupuesto !== null
                      ? <span className="text-muted-foreground italic" title="Presupuesto (todavía sin monto real)">{formatCurrency(m.presupuesto, m.moneda)}</span>
                      : <span className="text-muted-foreground/50">—</span>
                  )}
                </td>
                <td
                  className={cn(cell, 'text-right tabular-nums', canEdit && !pagado && 'cursor-pointer hover:underline')}
                  onClick={() => canEdit && !pagado && onIva(m.id)}
                  title={canEdit && !pagado ? 'Cargar neto + IVA' : undefined}
                >
                  {m.iva !== null ? formatCurrency(m.iva, m.moneda) : <span className="text-muted-foreground/50">—</span>}
                </td>
                <td className={cn(cell, 'text-right tabular-nums font-medium')}>{tot > 0 ? formatCurrency(tot, m.moneda) : <span className="text-muted-foreground/50">—</span>}</td>
                <td
                  className={cn(cell, 'text-right tabular-nums', canEdit && 'cursor-pointer')}
                  onClick={() => canEdit && onPagos(m.id)}
                  title={m.falta_pagar_sobre_presupuesto ? 'Sobre el presupuesto (todavía sin monto real)' : 'Pagos / señas al proveedor'}
                >
                  <span className={cn(
                    'font-medium',
                    (m.falta_pagar ?? 0) > 0 ? 'text-orange-600' : 'text-green-700',
                    m.falta_pagar_sobre_presupuesto && 'italic',
                  )}>
                    {formatCurrency(m.falta_pagar ?? 0, m.moneda)}
                  </span>
                  {(m.total_pagado ?? 0) > 0 && !pagado && (
                    <span className="block text-[10px] text-muted-foreground">pagado {formatCurrency(m.total_pagado ?? 0, m.moneda)}</span>
                  )}
                </td>
                <td className={cn(cell, 'text-xs')}>{fechaPago(m) || <span className="text-muted-foreground/50">—</span>}</td>
                <td className={cn(cell, 'text-center')}>{m.avisado_proveedor ? '✓' : ''}</td>
                <td className={cell}>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', ESTADO_SELECT_CLASS[m.estado_movimiento])}>
                    {MOVIMIENTO_LABEL[m.estado_movimiento]}
                  </span>
                </td>
                {canEdit && (
                  <td className={cn(cell, 'whitespace-nowrap text-right')}>
                    <button className="p-1 text-muted-foreground hover:text-foreground" title="Editar" onClick={() => onEditar(m)}><Pencil size={14} /></button>
                    {!pagado && (
                      <button className="p-1 text-muted-foreground hover:text-destructive" title="Eliminar" onClick={() => handleBorrar(m)}><Trash2 size={14} /></button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        {lineas.length > 0 && (
          <tfoot>
            <tr className="font-semibold">
              <td className={cell} />
              <td className={cell} colSpan={3}>Total</td>
              <td className={cn(cell, 'text-right tabular-nums')}>{formatCurrency(total.iva, moneda)}</td>
              <td className={cn(cell, 'text-right tabular-nums')}>{formatCurrency(total.total, moneda)}</td>
              <td className={cn(cell, 'text-right tabular-nums', total.falta_pagar > 0 ? 'text-orange-600' : 'text-green-700')}>{formatCurrency(total.falta_pagar, moneda)}</td>
              <td className={cell} colSpan={canEdit ? 4 : 3}>
                {total.otras_monedas > 0 && <span className="text-xs font-normal text-muted-foreground">{notaOtrasMonedas(total)}</span>}
              </td>
            </tr>
          </tfoot>
        )}
      </BaseTable>
    </div>
  );
}

// ── Extras ────────────────────────────────────────────────────────────────────

function ExtrasTabla({ eventoId, extras, moneda, canEdit, onEditar }: {
  eventoId: number;
  extras:   ExtraEvento[];
  moneda:   Moneda;
  canEdit:  boolean;
  onEditar: (e: ExtraEvento) => void;
}) {
  const update   = useUpdateExtra(eventoId);
  const remove   = useDeleteExtra(eventoId);
  const subir    = useSubirComprobanteExtra(eventoId);
  const quitar   = useQuitarComprobanteExtra(eventoId);
  const fileRef  = useRef<HTMLInputElement>(null);
  const [subiendoId, setSubiendoId] = useState<number | null>(null);

  const onError = (err: unknown) => alert(getApiErrorMessage(err));
  const totalDe = (filtro: (e: ExtraEvento) => boolean) =>
    extras.filter(e => filtro(e) && e.moneda === moneda).reduce((a, e) => a + e.total, 0);

  const handleArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || subiendoId === null) return;
    subir.mutate({ id: subiendoId, file }, { onError, onSettled: () => setSubiendoId(null) });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Lo que surge en el evento fuera de lo presupuestado. Por defecto lo paga el cliente y no suma al costo del evento;
        si lo paga la empresa, marcalo "a cargo de la empresa" y pasa a Gastos Extra.
      </p>
      <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleArchivo} />
      <div className="overflow-x-auto">
        <BaseTable className="min-w-[1100px] text-sm">
          <thead>
            <tr>
              <th className="px-2 py-2 text-left w-10">Item</th>
              <th className="px-2 py-2 text-left">Descripción</th>
              <th className="px-2 py-2 text-left">Responsable</th>
              <th className="px-2 py-2 text-right w-28">Consumido</th>
              <th className="px-2 py-2 text-right w-24">IVA</th>
              <th className="px-2 py-2 text-right w-28">Total</th>
              <th className="px-2 py-2 text-right w-28">Falta pagar</th>
              <th className="px-2 py-2 text-left w-32">Fecha de pago</th>
              <th className="px-2 py-2 text-left w-44">Datos cuenta</th>
              <th className="px-2 py-2 text-left w-24">FC</th>
              <th className="px-2 py-2 text-left w-28">Comprobante</th>
              <th className="px-2 py-2 text-left w-24">A cargo</th>
              {canEdit && <th className="px-2 py-2 w-16">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {extras.length === 0 && (
              <tr><td colSpan={canEdit ? 13 : 12} className="py-8 text-center text-sm text-muted-foreground">No hay extras cargados.</td></tr>
            )}
            {extras.map((e, i) => (
              <tr key={e.id}>
                <td className={cn(cell, 'text-muted-foreground tabular-nums')}>{i + 1}</td>
                <td className={cn(cell, 'font-medium')}>
                  {e.descripcion}
                  {e.notas && <span className="block text-[11px] font-normal text-muted-foreground">{e.notas}</span>}
                </td>
                <td className={cell}>{e.responsable ?? <span className="text-muted-foreground/50">—</span>}</td>
                <td className={cn(cell, 'text-right tabular-nums')}>{formatCurrency(e.neto, e.moneda)}</td>
                <td className={cn(cell, 'text-right tabular-nums')}>{e.iva > 0 ? formatCurrency(e.iva, e.moneda) : <span className="text-muted-foreground/50">—</span>}</td>
                <td className={cn(cell, 'text-right tabular-nums font-medium')}>{formatCurrency(e.total, e.moneda)}</td>
                <td className={cn(cell, 'text-right tabular-nums')}>
                  <button
                    disabled={!canEdit || update.isPending}
                    onClick={() => update.mutate({ id: e.id, data: { pagado: !e.pagado } }, { onError })}
                    title={canEdit ? (e.pagado ? 'Marcar como no pagado' : 'Marcar como pagado') : undefined}
                    className={cn('font-medium', e.pagado ? 'text-green-700' : 'text-orange-600', canEdit && 'hover:underline')}
                  >
                    {e.pagado ? 'Pagado' : formatCurrency(e.falta_pagar, e.moneda)}
                  </button>
                </td>
                <td className={cn(cell, 'text-xs')}>{e.plazo_pago ?? <span className="text-muted-foreground/50">—</span>}</td>
                <td className={cn(cell, 'text-xs whitespace-pre-line max-w-[11rem] truncate')} title={e.datos_cuenta ?? undefined}>
                  {e.datos_cuenta ?? <span className="text-muted-foreground/50">—</span>}
                </td>
                <td className={cn(cell, 'text-xs')}>{e.factura ?? <span className="text-muted-foreground/50">—</span>}</td>
                <td className={cn(cell, 'text-xs')}>
                  {e.tiene_comprobante ? (
                    <span className="inline-flex items-center gap-1">
                      <button className="text-blue-700 hover:underline truncate max-w-[6rem]" title={e.comprobante_nombre ?? undefined} onClick={() => descargarComprobanteExtra(e).catch(onError)}>
                        {e.comprobante_nombre ?? 'Ver'}
                      </button>
                      {canEdit && (
                        <button className="text-muted-foreground hover:text-destructive" title="Quitar comprobante" onClick={() => quitar.mutate(e.id, { onError })}>
                          <X size={12} />
                        </button>
                      )}
                    </span>
                  ) : canEdit ? (
                    <button
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                      disabled={subir.isPending}
                      onClick={() => { setSubiendoId(e.id); fileRef.current?.click(); }}
                    >
                      {subir.isPending && subiendoId === e.id ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
                      Adjuntar
                    </button>
                  ) : <span className="text-muted-foreground/50">—</span>}
                </td>
                <td className={cell}>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
                    e.a_cargo_cliente ? 'bg-gray-100 text-gray-700' : 'bg-purple-100 text-purple-800',
                  )}>
                    {e.a_cargo_cliente ? 'Cliente' : 'Empresa'}
                  </span>
                </td>
                {canEdit && (
                  <td className={cn(cell, 'whitespace-nowrap text-right')}>
                    <button className="p-1 text-muted-foreground hover:text-foreground" title="Editar" onClick={() => onEditar(e)}><Pencil size={14} /></button>
                    <button
                      className="p-1 text-muted-foreground hover:text-destructive" title="Eliminar"
                      onClick={() => confirm(`¿Eliminar el extra "${e.descripcion}"?`) && remove.mutate(e.id, { onError })}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {extras.length > 0 && (
            <tfoot>
              <tr className="font-semibold">
                <td className={cell} />
                <td className={cell} colSpan={4}>Total extras</td>
                <td className={cn(cell, 'text-right tabular-nums')}>{formatCurrency(totalDe(() => true), moneda)}</td>
                <td className={cn(cell, 'text-right tabular-nums text-orange-600')}>{formatCurrency(extras.filter(e => e.moneda === moneda).reduce((a, e) => a + e.falta_pagar, 0), moneda)}</td>
                <td className={cn(cell, 'text-xs font-normal text-muted-foreground')} colSpan={canEdit ? 6 : 5}>
                  Cliente {formatCurrency(totalDe(e => e.a_cargo_cliente), moneda)} · Empresa {formatCurrency(totalDe(e => !e.a_cargo_cliente), moneda)}
                </td>
              </tr>
            </tfoot>
          )}
        </BaseTable>
      </div>
    </div>
  );
}
