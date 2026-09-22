import { useEffect, useMemo, useState } from 'react';
import { Plus, Fuel, Pencil, Trash2, Upload, ShieldCheck } from 'lucide-react';
import {
  useCombustible, useCreateCombustible, useUpdateCombustible, useDeleteCombustible, useImportarCombustible,
  useAutorizarCombustible,
  type CombustibleFiltros, type CombustiblePayload, type ImportarCombustibleResultado,
} from '@/hooks/useCombustible';
import { useVehiculosFlota } from '@/hooks/useFlota';
import { useEventos } from '@/hooks/useEvento';
import { useCuentasCorrientes } from '@/hooks/useCuentasCorrientes';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { PrintButton, PrintHeader } from '@/components/ui/PrintSection';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CombustibleEstadoBadge } from '@/components/ui/badge';
import MoneyInput from '@/components/ui/MoneyInput';
import { getApiErrorMessage } from '@/lib/utils';
import { formatDate, formatCurrency, formatLitros } from '@/lib/formatters';
import type { CargaCombustible, TipoCombustible } from '@/types';
import BaseTable from '@/components/ui/BaseTable';

const inputCls  = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls  = 'block text-xs font-medium text-muted-foreground mb-0.5';
const selectCls = 'border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';

const TIPO_LABEL: Record<TipoCombustible, string> = {
  NAFTA_SUPER:   'Nafta súper',
  NAFTA_PREMIUM: 'Nafta premium',
  DIESEL:        'Diésel',
  GNC:           'GNC',
};

// Semanas reales de la planilla de Santi — corte en sábado, no calendario ni
// períodos fijos de 7 días. Mismo criterio que el backend (ver
// combustible.controller.ts::getSemanasCombustible), verificado contra
// JUNIO/JULIO/AGOSTO.2026 reales. Dos ajustes sobre "cortar en cada sábado":
// la búsqueda arranca el día siguiente al inicio (para no dar una semana de
// 1 día si el mes empieza sábado), y el remanente final si queda < 4 días se
// funde con la semana anterior en vez de ser su propia semana.
function diasEnMes(anio: number, mesCero: number): number {
  return new Date(Date.UTC(anio, mesCero + 1, 0)).getUTCDate();
}

interface RangoSemana { numero: number; desde: Date; hasta: Date }

function getSemanasCombustible(anio: number, mesCero: number): RangoSemana[] {
  const finMes = new Date(Date.UTC(anio, mesCero, diasEnMes(anio, mesCero)));

  const cortes: { desde: Date; hasta: Date }[] = [];
  let inicio = new Date(Date.UTC(anio, mesCero, 1));
  while (inicio.getTime() <= finMes.getTime()) {
    let fin = new Date(inicio.getTime() + 86_400_000);
    while (fin.getUTCDay() !== 6 && fin.getTime() < finMes.getTime()) {
      fin = new Date(fin.getTime() + 86_400_000);
    }
    if (fin.getTime() > finMes.getTime()) fin = finMes;
    cortes.push({ desde: inicio, hasta: fin });
    inicio = new Date(fin.getTime() + 86_400_000);
  }

  if (cortes.length > 1) {
    const ultimo = cortes[cortes.length - 1];
    const dias = Math.round((ultimo.hasta.getTime() - ultimo.desde.getTime()) / 86_400_000) + 1;
    if (dias < 4) {
      cortes[cortes.length - 2].hasta = ultimo.hasta;
      cortes.pop();
    }
  }

  return cortes.map((c, i) => ({ numero: i + 1, desde: c.desde, hasta: c.hasta }));
}

function fmtCorta(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Todas las cargas vienen ya filtradas a un único mes/año (ver filtros de
// CargasTab), así que las semanas reales de ese mes se calculan una sola vez.
function agruparPorSemana(cargas: CargaCombustible[], mes: number, anio: number) {
  const semanas = getSemanasCombustible(anio, mes - 1);
  const grupos = new Map<number, { rango: RangoSemana; cargas: CargaCombustible[] }>();
  for (const c of cargas) {
    const dia = new Date(c.fecha).getUTCDate();
    const rango = semanas.find(s => dia >= s.desde.getUTCDate() && dia <= s.hasta.getUTCDate()) ?? semanas[semanas.length - 1];
    if (!grupos.has(rango.numero)) grupos.set(rango.numero, { rango, cargas: [] });
    grupos.get(rango.numero)!.cargas.push(c);
  }
  return [...grupos.entries()].sort((a, b) => b[0] - a[0]);
}

// ── Formulario ────────────────────────────────────────────────────────────────

interface FormData {
  camion_id:           string;
  fecha:               string;
  tipo_combustible:    TipoCombustible;
  litros:              string;
  precio_por_litro:    string;
  monto_total:         string;
  estacion_nombre:     string;
  km_actual:           string;
  evento_id:           string;
  cuenta_corriente_id: string;
  responsable_nombre:  string;
  numero_comprobante:  string;
  tipo_movimiento:     string;
  pagos:               string;
  saldo:               string;
  notas:               string;
}

const EMPTY: FormData = {
  camion_id: '', fecha: new Date().toISOString().slice(0, 10), tipo_combustible: 'DIESEL',
  litros: '', precio_por_litro: '', monto_total: '', estacion_nombre: '', km_actual: '',
  evento_id: '', cuenta_corriente_id: '', responsable_nombre: '',
  numero_comprobante: '', tipo_movimiento: 'FA', pagos: '', saldo: '', notas: '',
};

function formFromCarga(c: CargaCombustible): FormData {
  return {
    camion_id: String(c.camion_id), fecha: c.fecha.slice(0, 10), tipo_combustible: c.tipo_combustible,
    litros: String(c.litros), precio_por_litro: c.precio_por_litro != null ? String(c.precio_por_litro) : '',
    monto_total: String(c.monto_total), estacion_nombre: c.estacion_nombre ?? '',
    km_actual: c.km_actual != null ? String(c.km_actual) : '', evento_id: c.evento_id ? String(c.evento_id) : '',
    cuenta_corriente_id: c.cuenta_corriente_id ? String(c.cuenta_corriente_id) : '',
    responsable_nombre: c.responsable_nombre ?? '',
    numero_comprobante: c.numero_comprobante ?? '', tipo_movimiento: c.tipo_movimiento ?? '',
    pagos: c.pagos != null ? String(c.pagos) : '', saldo: c.saldo != null ? String(c.saldo) : '',
    notas: c.notas ?? '',
  };
}

function CargaDialog({ open, carga, onClose }: { open: boolean; carga: CargaCombustible | null; onClose: () => void }) {
  const isEdit = !!carga;
  const { data: vehiculos = [] } = useVehiculosFlota();
  const { data: eventos = [] } = useEventos();
  const { data: cuentas = [] } = useCuentasCorrientes({ activa: 'true' });
  const createCarga = useCreateCombustible();
  const updateCarga = useUpdateCombustible();
  const [form, setForm] = useState<FormData>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setForm(carga ? formFromCarga(carga) : EMPTY); setError(null); }, [carga, open]);

  const esCargaExtra = !form.cuenta_corriente_id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.camion_id) { setError('Seleccioná un vehículo'); return; }
    if (!form.litros || !form.monto_total) { setError('Litros y monto total son obligatorios'); return; }
    const payload: CombustiblePayload = {
      camion_id: Number(form.camion_id), fecha: form.fecha, tipo_combustible: form.tipo_combustible,
      litros: Number(form.litros), precio_por_litro: form.precio_por_litro ? Number(form.precio_por_litro) : null,
      monto_total: Number(form.monto_total), estacion_nombre: form.estacion_nombre || null,
      km_actual: form.km_actual ? Number(form.km_actual) : null,
      evento_id: form.evento_id ? Number(form.evento_id) : null,
      cuenta_corriente_id: form.cuenta_corriente_id ? Number(form.cuenta_corriente_id) : null,
      responsable_nombre: esCargaExtra ? (form.responsable_nombre || null) : null,
      numero_comprobante: form.numero_comprobante || null,
      tipo_movimiento: form.tipo_movimiento || null,
      pagos: form.pagos ? Number(form.pagos) : null,
      saldo: form.saldo ? Number(form.saldo) : null,
      notas: form.notas || null,
    };
    try {
      if (isEdit) await updateCarga.mutateAsync({ id: carga!.id, data: payload });
      else        await createCarga.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const pending = createCarga.isPending || updateCarga.isPending;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? 'Editar carga' : 'Nueva carga de combustible'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Vehículo *</label>
              <select value={form.camion_id} onChange={e => setForm(p => ({ ...p, camion_id: e.target.value }))} className={selectCls + ' w-full'} required>
                <option value="">Seleccionar…</option>
                {vehiculos.map(v => <option key={v.id} value={v.id}>{v.codigo} {v.patente ? `— ${v.patente}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Fecha *</label>
              <input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Tipo de combustible</label>
              <select value={form.tipo_combustible} onChange={e => setForm(p => ({ ...p, tipo_combustible: e.target.value as TipoCombustible }))} className={selectCls + ' w-full'}>
                {Object.entries(TIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Litros *</label>
              <input type="number" step="0.001" value={form.litros} onChange={e => setForm(p => ({ ...p, litros: e.target.value }))} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>$ por litro</label>
              <MoneyInput value={form.precio_por_litro} onChange={v => setForm(p => ({ ...p, precio_por_litro: v }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Monto total *</label>
              <MoneyInput value={form.monto_total} onChange={v => setForm(p => ({ ...p, monto_total: v }))} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Km actual (odómetro)</label>
              <input type="number" value={form.km_actual} onChange={e => setForm(p => ({ ...p, km_actual: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Estación</label>
              <input value={form.estacion_nombre} onChange={e => setForm(p => ({ ...p, estacion_nombre: e.target.value }))} className={inputCls} placeholder="YPF, Shell..." />
            </div>
            <div>
              <label className={labelCls}>Evento (opcional)</label>
              <select value={form.evento_id} onChange={e => setForm(p => ({ ...p, evento_id: e.target.value }))} className={selectCls + ' w-full'}>
                <option value="">Sin vincular</option>
                {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Cuenta corriente (proveedor)</label>
              <select value={form.cuenta_corriente_id} onChange={e => setForm(p => ({ ...p, cuenta_corriente_id: e.target.value }))} className={selectCls + ' w-full'}>
                <option value="">Carga extra (caja chica)</option>
                {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              {esCargaExtra && (
                <p className="text-xs text-muted-foreground mt-1">
                  Sin cuenta corriente, la carga queda <b>Pendiente</b> hasta que un ADMIN la autorice (botón <ShieldCheck size={11} className="inline" /> en la tabla, o desde la pestaña "Cargas autorizadas").
                </p>
              )}
            </div>
            {esCargaExtra && (
              <div className="col-span-2">
                <label className={labelCls}>Responsable (pagó de su caja)</label>
                <input value={form.responsable_nombre} onChange={e => setForm(p => ({ ...p, responsable_nombre: e.target.value }))} className={inputCls} placeholder="Nombre de quien pagó" />
              </div>
            )}
            <div className="col-span-2 border-t pt-3 mt-1">
              <p className="text-xs font-medium text-muted-foreground mb-2">Ledger (columnas de la planilla — opcional para carga manual)</p>
            </div>
            <div>
              <label className={labelCls}>N° FA/COMP</label>
              <input value={form.numero_comprobante} onChange={e => setForm(p => ({ ...p, numero_comprobante: e.target.value }))} className={inputCls} placeholder="Ej. 60-8302" />
            </div>
            <div>
              <label className={labelCls}>Tipo (TIPO)</label>
              <input value={form.tipo_movimiento} onChange={e => setForm(p => ({ ...p, tipo_movimiento: e.target.value }))} className={inputCls} placeholder="FA, NC..." />
            </div>
            <div>
              <label className={labelCls}>Pagos</label>
              <MoneyInput value={form.pagos} onChange={v => setForm(p => ({ ...p, pagos: v }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Saldo (cuenta corriente)</label>
              <MoneyInput value={form.saldo} onChange={v => setForm(p => ({ ...p, saldo: v }))} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Notas / Observaciones</label>
              <textarea value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} className={inputCls} />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Importar Excel ────────────────────────────────────────────────────────────

function ImportarDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const importar = useImportarCombustible();
  const [resultado, setResultado] = useState<ImportarCombustibleResultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setResultado(null); setError(null); } }, [open]);

  const handleFile = async (file: File) => {
    setError(null);
    try {
      const r = await importar.mutateAsync(file);
      setResultado(r);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Importar planilla de combustible</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-1">
          {!resultado && (
            <>
              <p className="text-xs text-muted-foreground">Subí el Excel de Santi — detecta automáticamente las hojas de mes y la de "Cargas Autorizadas".</p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                disabled={importar.isPending}
                className="text-sm"
              />
              {importar.isPending && <p className="text-xs text-muted-foreground">Importando…</p>}
              {error && <p className="text-xs text-destructive">{error}</p>}
            </>
          )}
          {resultado && (
            <div className="space-y-2 text-sm">
              <p>Hojas procesadas: <span className="font-medium">{resultado.hojas_procesadas}</span></p>
              <p>Cargas creadas: <span className="font-medium text-green-700">{resultado.creados}</span></p>
              {resultado.omitidos > 0 && (
                <p>Ya existían (omitidas, no duplicadas): <span className="font-medium">{resultado.omitidos}</span></p>
              )}
              <p>Límites de vehículo actualizados: <span className="font-medium">{resultado.actualizados}</span></p>
              {resultado.vehiculos_creados.length > 0 && (
                <p className="text-green-700">
                  ✓ Se crearon {resultado.vehiculos_creados.length} vehículo{resultado.vehiculos_creados.length !== 1 ? 's' : ''} nuevo{resultado.vehiculos_creados.length !== 1 ? 's' : ''}:{' '}
                  <span className="text-muted-foreground">{resultado.vehiculos_creados.map(v => v.patente).join(', ')}</span>
                </p>
              )}
              {resultado.vehiculos_vinculados > 0 && (
                <p className="text-muted-foreground">Vehículos existentes vinculados: {resultado.vehiculos_vinculados}</p>
              )}
              {resultado.errores.length > 0 && (
                <div>
                  <p className="font-medium text-destructive">{resultado.errores.length} error(es):</p>
                  <ul className="list-disc pl-5 text-xs text-destructive max-h-40 overflow-y-auto">
                    {resultado.errores.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" size="sm" onClick={onClose}>{resultado ? 'Cerrar' : 'Cancelar'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Tab principal ─────────────────────────────────────────────────────────────

export default function CargasTab() {
  const hoy = new Date();
  const { user } = useAuth();
  const isAdmin = user?.rol === 'ADMIN';
  const [filtros, setFiltros] = useState<CombustibleFiltros>({ mes: hoy.getMonth() + 1, anio: hoy.getFullYear() });
  const { data: cargas = [], isLoading } = useCombustible(filtros);
  const { data: vehiculos = [] } = useVehiculosFlota();
  const { data: eventos = [] } = useEventos();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CargaCombustible | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const deleteCarga = useDeleteCombustible();
  const autorizarCarga = useAutorizarCombustible();

  const mesFiltro  = filtros.mes  ?? hoy.getMonth() + 1;
  const anioFiltro = filtros.anio ?? hoy.getFullYear();
  const semanas = useMemo(() => agruparPorSemana(cargas, mesFiltro, anioFiltro), [cargas, mesFiltro, anioFiltro]);

  const totales = useMemo(() => {
    const litros = cargas.reduce((s, c) => s + Number(c.litros), 0);
    const monto  = cargas.reduce((s, c) => s + Number(c.monto_total), 0);
    const pagos  = cargas.reduce((s, c) => s + Number(c.pagos ?? 0), 0);
    const rends  = cargas.map(c => c.rendimiento_lts_100km).filter((r): r is number => r != null);
    const rendimiento = rends.length ? rends.reduce((a, b) => a + b, 0) / rends.length : null;
    // cargas viene ordenada por fecha desc (useCombustible) — la primera con
    // saldo cargado es la más reciente del período.
    const saldo = cargas.find(c => c.saldo != null)?.saldo ?? null;
    return { litros, monto, pagos, saldo, rendimiento };
  }, [cargas]);

  const handleDelete = (c: CargaCombustible) => {
    if (!window.confirm(`¿Eliminar la carga de "${c.camion?.codigo ?? 'movimiento sin vehículo'}" del ${formatDate(c.fecha)}?`)) return;
    deleteCarga.mutate(c.id, { onError: err => alert(getApiErrorMessage(err)) });
  };

  const handleAutorizar = (c: CargaCombustible) => {
    autorizarCarga.mutate(c.id, { onError: err => alert(getApiErrorMessage(err)) });
  };

  return (
    <div className="space-y-4">
      <PrintHeader titulo="Combustible — Cargas del mes" periodo={`${String(mesFiltro).padStart(2, '0')}/${anioFiltro}`} />

      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <select value={filtros.camion_id ?? ''} onChange={e => setFiltros(f => ({ ...f, camion_id: e.target.value ? Number(e.target.value) : undefined }))} className={selectCls}>
            <option value="">Todos los vehículos</option>
            {vehiculos.map(v => <option key={v.id} value={v.id}>{v.codigo}</option>)}
          </select>
          <input
            type="month"
            value={`${filtros.anio}-${String(filtros.mes).padStart(2, '0')}`}
            onChange={e => {
              const [anio, mes] = e.target.value.split('-').map(Number);
              setFiltros(f => ({ ...f, anio, mes }));
            }}
            className={selectCls}
          />
          <select value={filtros.evento_id ?? ''} onChange={e => setFiltros(f => ({ ...f, evento_id: e.target.value ? Number(e.target.value) : undefined }))} className={selectCls}>
            <option value="">Todos los eventos</option>
            {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nombre}</option>)}
          </select>
          <select value={filtros.estado ?? ''} onChange={e => setFiltros(f => ({ ...f, estado: e.target.value || undefined }))} className={selectCls}>
            <option value="">Todos los estados</option>
            <option value="AUTORIZADA">Autorizada</option>
            <option value="PENDIENTE_AUTORIZACION">Pendiente</option>
            <option value="RECHAZADA">Rechazada</option>
          </select>
        </div>
        <div className="flex gap-2">
          <PrintButton />
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload size={14} className="mr-1.5" /> Importar Excel
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus size={14} className="mr-1.5" /> Nueva carga
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : cargas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Fuel size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay cargas registradas en este período.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {semanas.map(([numero, { rango, cargas: cargasSemana }]) => {
            const totalLitros = cargasSemana.reduce((s, c) => s + Number(c.litros), 0);
            const totalMonto  = cargasSemana.reduce((s, c) => s + Number(c.monto_total), 0);
            const totalPagos  = cargasSemana.reduce((s, c) => s + Number(c.pagos ?? 0), 0);
            // cargasSemana viene en el mismo orden que useCombustible (fecha desc),
            // así que la primera con saldo cargado es la más reciente de la semana.
            const ultimoSaldo = cargasSemana.find(c => c.saldo != null)?.saldo ?? null;
            return (
              <div key={numero} className="rounded-lg border bg-white overflow-hidden">
                <div className="flex items-center justify-between bg-muted/40 px-3 py-2 border-b flex-wrap gap-2">
                  <p className="text-sm font-medium">Semana {numero}: {fmtCorta(rango.desde)} al {fmtCorta(rango.hasta)}</p>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span>Litros: <span className="font-semibold text-foreground">{formatLitros(totalLitros)} L</span></span>
                    <span>Consumos: <span className="font-semibold text-foreground">{formatCurrency(totalMonto)}</span></span>
                    {totalPagos > 0 && <span>Pagos: <span className="font-semibold text-foreground">{formatCurrency(totalPagos)}</span></span>}
                    {ultimoSaldo != null && <span>Saldo: <span className="font-semibold text-foreground">{formatCurrency(ultimoSaldo)}</span></span>}
                  </div>
                </div>
                <BaseTable className="w-full text-sm min-w-[1200px]">
                  <thead className="border-b bg-muted/10">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">N° Comp.</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Tipo</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Vehículo</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Litros</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">$/L</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Pagos</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Total (Consumos)</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Saldo</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Km</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Rendimiento</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Evento</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                      <th className="no-print px-3 py-2 text-right text-xs font-medium text-muted-foreground">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {cargasSemana.map(c => (
                      <tr key={c.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2.5 text-muted-foreground">{formatDate(c.fecha)}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{c.numero_comprobante ?? '-'}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{c.tipo_movimiento ?? '-'}</td>
                        <td className="px-3 py-2.5 font-mono font-medium">{c.camion?.codigo ?? <span className="text-muted-foreground italic">sin vehículo</span>}</td>
                        <td className="px-3 py-2.5">{c.camion ? `${formatLitros(c.litros)} L` : '-'}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{c.precio_por_litro != null ? formatCurrency(c.precio_por_litro) : '-'}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{c.pagos != null ? formatCurrency(c.pagos) : '-'}</td>
                        <td className="px-3 py-2.5 font-medium">{Number(c.monto_total) > 0 ? formatCurrency(c.monto_total) : '-'}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{c.saldo != null ? formatCurrency(c.saldo) : '-'}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{c.km_actual ?? '-'}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{c.rendimiento_lts_100km != null ? `${c.rendimiento_lts_100km} L/100km` : '-'}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{c.evento?.nombre ?? '-'}</td>
                        <td className="px-3 py-2.5"><CombustibleEstadoBadge estado={c.estado} /></td>
                        <td className="no-print px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isAdmin && c.estado === 'PENDIENTE_AUTORIZACION' && (
                              <Button
                                variant="ghost" size="icon" title="Autorizar"
                                className="text-green-700 hover:text-green-800"
                                onClick={() => handleAutorizar(c)}
                              >
                                <ShieldCheck size={14} />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setDialogOpen(true); }} title="Editar"><Pencil size={14} /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(c)} className="text-destructive hover:text-destructive" title="Eliminar"><Trash2 size={14} /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </BaseTable>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground border-t pt-3">
        <p>Litros del período: <span className="font-semibold text-foreground">{formatLitros(totales.litros)} L</span></p>
        <p>Consumos del mes: <span className="font-semibold text-foreground">{formatCurrency(totales.monto)}</span></p>
        {totales.pagos > 0 && <p>Pagos del mes: <span className="font-semibold text-foreground">{formatCurrency(totales.pagos)}</span></p>}
        {totales.saldo != null && <p>Saldo (último): <span className="font-semibold text-foreground">{formatCurrency(totales.saldo)}</span></p>}
        {totales.rendimiento != null && <p>Rendimiento promedio: <span className="font-semibold text-foreground">{totales.rendimiento.toFixed(1)} L/100km</span></p>}
      </div>

      <CargaDialog open={dialogOpen} carga={editing} onClose={() => { setDialogOpen(false); setEditing(null); }} />
      <ImportarDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
