import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Boxes, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useMaterialesRental, useImportarMaterialesRental, useUpdateMaterialRental } from '@/hooks/usePresupuestos';
import { useIndicadores } from '@/hooks/useIndicadores';
import { useAuth } from '@/hooks/useAuth';
import IndicadoresWidget from '@/components/indicadores/IndicadoresWidget';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MoneyInput from '@/components/ui/MoneyInput';
import BaseTable from '@/components/ui/BaseTable';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import type { MaterialRental, ImportarMaterialesResultado, OrigenMaterialRental } from '@/types';

// Catálogo de materiales de rental (DOS57) — planilla DOS57_BASE MATRICES_RENTAL COST,
// hojas RENTAL COSTS (NAC.) e (IMP.). Sólo ADMIN.

const inputCls = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';
const thCls    = 'px-3 py-2 text-left text-xs font-medium text-muted-foreground';
const tdNum    = 'px-3 py-2 text-right tabular-nums';
const DASH     = <span className="text-muted-foreground">–</span>;

const fmtUsd = (n: number) => `US$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const round2 = (n: number) => Math.round(n * 100) / 100;

// Valor de alquiler por unidad para un % (sólo si el ítem lo tiene habilitado)
const valorPct = (m: MaterialRental, habilitado: boolean, pct: number) =>
  habilitado && m.costo_unitario_ars !== null ? formatCurrency(round2(m.costo_unitario_ars * pct / 100)) : DASH;

const COLS_NAC: { label: string; key: keyof MaterialRental; pct: number }[] = [
  { label: '2%',   key: 'porc_2',    pct: 2 },
  { label: '4%',   key: 'porc_4',    pct: 4 },
  { label: '6%',   key: 'porc_6',    pct: 6 },
  { label: '8%',   key: 'porc_8',    pct: 8 },
  { label: '10%',  key: 'porc_10',   pct: 10 },
  { label: 'FULL', key: 'porc_full', pct: 100 },
];

// ── Importar ──────────────────────────────────────────────────────────────────

// Diferencia (relativa al oficial) a partir de la cual se pregunta qué TC usar
const UMBRAL_DIFERENCIA_TC = 0.05;

function ImportarDialog({ onClose }: { onClose: () => void }) {
  const importar = useImportarMaterialesRental();
  const { data: indicadores } = useIndicadores();
  const [r, setR] = useState<ImportarMaterialesResultado | null>(null);
  const [error, setError] = useState<string | null>(null);
  // TC de la planilla muy distinto del oficial → se pregunta cuál usar antes de importar
  const [consulta, setConsulta] = useState<{ file: File; tcPlanilla: number; tcOficial: number } | null>(null);

  const aplicar = async (file: File, tipoCambio?: number) => {
    setConsulta(null);
    setR(await importar.mutateAsync({ file, preview: false, tipoCambio }));
  };

  // 1) preview (no escribe) para leer el TC de la planilla; 2) comparar con el oficial
  const subir = async (file: File) => {
    setError(null);
    try {
      const pre = await importar.mutateAsync({ file, preview: true });
      const tcPlanilla = pre.tipo_cambio_planilla;
      const tcOficial  = indicadores?.dolar_oficial?.venta ?? null;
      if (tcPlanilla && tcOficial && Math.abs(tcPlanilla - tcOficial) / tcOficial > UMBRAL_DIFERENCIA_TC) {
        setConsulta({ file, tcPlanilla, tcOficial });
        return;
      }
      await aplicar(file);
    } catch (err) { setError(getApiErrorMessage(err)); }
  };

  const elegirTc = (tc?: number) => {
    if (!consulta) return;
    setError(null);
    aplicar(consulta.file, tc).catch(err => setError(getApiErrorMessage(err)));
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Importar catálogo de materiales</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          {consulta && !r && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
              <p className="text-sm flex items-start gap-1.5">
                <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
                <span>
                  El tipo de cambio del Excel ({formatCurrency(consulta.tcPlanilla)}) difiere del oficial actual ({formatCurrency(consulta.tcOficial)})
                  {' '}en un {Math.round(Math.abs(consulta.tcPlanilla - consulta.tcOficial) / consulta.tcOficial * 100)}%.
                  ¿Querés usar el del sistema para recalcular los precios pesificados?
                </span>
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button size="sm" variant="outline" disabled={importar.isPending} onClick={() => elegirTc()}>Usar T/C del Excel</Button>
                <Button size="sm" disabled={importar.isPending} onClick={() => elegirTc(consulta.tcOficial)}>Usar T/C del sistema ({formatCurrency(consulta.tcOficial)})</Button>
              </div>
            </div>
          )}
          {!r && !consulta && (
            <>
              <p className="text-xs text-muted-foreground">
                Subí la planilla de matrices de rental (hojas RENTAL COSTS NAC. e IMP.). Los ítems se actualizan por N° de ítem
                (y código oficial en los importados); los que ya no están en la planilla no se tocan.
              </p>
              <input type="file" accept=".xlsx" className="text-sm" disabled={importar.isPending}
                onChange={e => { const f = e.target.files?.[0]; if (f) subir(f); }} />
            </>
          )}
          {importar.isPending && <p className="text-xs text-muted-foreground">Procesando…</p>}
          {error && <p className="text-xs text-destructive">{error}</p>}
          {r && (
            <div className="space-y-3">
              <p className="text-xs flex items-center gap-1 text-green-700"><CheckCircle2 size={13} /> Importación aplicada.</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded border p-2 text-center"><p className="text-xs text-muted-foreground">Creados</p><p className="text-lg font-semibold text-green-700">{r.creados}</p></div>
                <div className="rounded border p-2 text-center"><p className="text-xs text-muted-foreground">Actualizados</p><p className="text-lg font-semibold">{r.actualizados}</p></div>
                <div className="rounded border p-2 text-center"><p className="text-xs text-muted-foreground">Errores</p><p className={cn('text-lg font-semibold', r.errores.length && 'text-destructive')}>{r.errores.length}</p></div>
              </div>
              <p className="text-xs text-muted-foreground">
                {r.hojas.map(h => `${h.hoja}: ${h.items} ítems`).join(' · ')}
                {r.tipo_cambio && <> · Importados pesificados a {formatCurrency(r.tipo_cambio)}{r.tipo_cambio !== r.tipo_cambio_planilla && <> (T/C del sistema; el Excel decía {r.tipo_cambio_planilla ? formatCurrency(r.tipo_cambio_planilla) : '—'})</>}</>}
              </p>
              {r.sin_precio.length > 0 && (
                <p className="text-xs text-amber-800 flex items-start gap-1">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  {r.sin_precio.length} ítems sin precio en la planilla (se pueden cargar desde la tabla): {r.sin_precio.map(s => `${s.origen} ${s.nro_item}`).join(', ')}
                </p>
              )}
              {r.advertencias.length > 0 && (
                <ul className="text-xs text-amber-800 space-y-0.5 max-h-32 overflow-y-auto">
                  {r.advertencias.map((a, i) => <li key={i}>• {a.hoja} fila {a.fila}: {a.mensaje}</li>)}
                </ul>
              )}
              {r.errores.length > 0 && (
                <ul className="text-xs text-destructive space-y-0.5 max-h-32 overflow-y-auto">
                  {r.errores.map((e, i) => <li key={i}>{e.hoja} fila {e.fila}: {e.mensaje}</li>)}
                </ul>
              )}
            </div>
          )}
          <div className="flex justify-end"><Button size="sm" variant="outline" onClick={onClose}>{r ? 'Cerrar' : 'Cancelar'}</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Edición de precio ─────────────────────────────────────────────────────────

function EditarDialog({ m, onClose }: { m: MaterialRental; onClose: () => void }) {
  const update = useUpdateMaterialRental();
  const [ars, setArs] = useState(m.costo_unitario_ars !== null ? String(m.costo_unitario_ars) : '');
  const [usd, setUsd] = useState(m.costo_unitario_usd !== null ? String(m.costo_unitario_usd) : '');
  const [tc, setTc]   = useState(m.tipo_cambio !== null ? String(m.tipo_cambio) : '');
  const [activo, setActivo] = useState(m.activo);
  const [error, setError] = useState<string | null>(null);
  const esImp = m.origen === 'IMP';
  const nOrNull = (s: string) => (s.trim() === '' ? null : Number(s));
  // IMP: el pesificado se recalcula en pantalla (y en el backend) desde USD × TC
  const arsImp = nOrNull(usd) !== null && nOrNull(tc) !== null ? round2(nOrNull(usd)! * nOrNull(tc)!) : null;

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await update.mutateAsync({
        id: m.id,
        data: esImp ? { costo_unitario_usd: nOrNull(usd), tipo_cambio: nOrNull(tc), activo } : { costo_unitario_ars: nOrNull(ars), activo },
      });
      onClose();
    } catch (err) { setError(getApiErrorMessage(err)); }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{m.origen} {m.nro_item}{m.codigo_oficial && ` · ${m.codigo_oficial}`}</DialogTitle></DialogHeader>
        <form onSubmit={guardar} className="space-y-3 text-sm">
          <p className="text-muted-foreground">{m.detalle}{m.medida && ` — ${m.medida}`}</p>
          {esImp ? (
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Costo unitario USD</label><input type="number" step="0.01" min={0} value={usd} onChange={e => setUsd(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Tipo de cambio</label><input type="number" step="0.01" min={0} value={tc} onChange={e => setTc(e.target.value)} className={inputCls} /></div>
              <div className="col-span-2 rounded bg-muted/40 px-3 py-2">
                <span className="text-xs text-muted-foreground">Costo pesificado: </span>
                <span className="font-semibold tabular-nums">{arsImp !== null ? formatCurrency(arsImp) : '–'}</span>
              </div>
            </div>
          ) : (
            <div><label className={labelCls}>Costo unitario (ARS)</label><MoneyInput value={ars} onChange={setArs} className={inputCls} placeholder="Sin precio" /></div>
          )}
          <label className="flex items-center gap-2"><input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} /> Activo (aparece en el buscador de presupuestos)</label>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={update.isPending}>Guardar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function MaterialesRentalPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<OrigenMaterialRental>('NAC');
  const [buscar, setBuscar] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [editando, setEditando] = useState<MaterialRental | null>(null);
  const { data: materiales = [], isLoading } = useMaterialesRental();

  const cantidades = useMemo(() => ({
    NAC: materiales.filter(m => m.origen === 'NAC').length,
    IMP: materiales.filter(m => m.origen === 'IMP').length,
  }), [materiales]);

  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return materiales.filter(m => m.origen === tab && (!q
      || m.detalle.toLowerCase().includes(q)
      || (tab === 'IMP' && (m.codigo_oficial ?? '').toLowerCase().includes(q))
      || String(m.nro_item) === q));
  }, [materiales, tab, buscar]);

  if (user?.rol !== 'ADMIN') return <Navigate to="/" replace />;

  const filaCls = (m: MaterialRental) => cn('cursor-pointer hover:bg-muted/30', !m.activo && 'opacity-50');

  return (
    <div className="p-6 space-y-4 max-w-[1500px] mx-auto">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Boxes size={22} /> Ítems de rental</h1>
        <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}><Upload size={14} className="mr-1.5" /> Importar Excel</Button>
      </div>

      <IndicadoresWidget />

      <div className="flex flex-wrap items-center gap-3 border-b">
        {(['NAC', 'IMP'] as const).map(o => (
          <button key={o} onClick={() => setTab(o)}
            className={cn('px-3 py-2 text-sm -mb-px border-b-2', tab === o ? 'border-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {o === 'NAC' ? 'Nacionales' : 'Importados Layher'} <span className="text-xs text-muted-foreground">({cantidades[o]})</span>
          </button>
        ))}
        <input
          value={buscar} onChange={e => setBuscar(e.target.value)}
          placeholder={tab === 'NAC' ? 'Buscar por detalle…' : 'Buscar por detalle o código…'}
          className="ml-auto mb-1 border border-input rounded px-2 py-1.5 text-sm w-72 bg-white"
        />
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : materiales.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Boxes size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Todavía no hay materiales. Importá la planilla de matrices de rental.</p>
        </div>
      ) : tab === 'NAC' ? (
        <BaseTable className="w-full text-sm min-w-[1100px]">
          <thead className="border-b bg-muted/10">
            <tr>
              <th className={thCls}>Nro</th>
              <th className={thCls}>Detalle</th>
              <th className={thCls}>Medida</th>
              <th className={`${thCls} text-right`}>Costo unitario</th>
              {COLS_NAC.map(c => <th key={c.label} className={`${thCls} text-right`}>{c.label}</th>)}
              <th className={thCls}>Activo</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visibles.map(m => (
              <tr key={m.id} className={filaCls(m)} onClick={() => setEditando(m)}>
                <td className="px-3 py-2 tabular-nums">{m.nro_item}</td>
                <td className="px-3 py-2">{m.detalle}</td>
                <td className="px-3 py-2 text-muted-foreground">{m.medida ?? DASH}</td>
                <td className={cn(tdNum, 'font-medium')}>{m.costo_unitario_ars !== null ? formatCurrency(m.costo_unitario_ars) : DASH}</td>
                {COLS_NAC.map(c => <td key={c.label} className={tdNum}>{valorPct(m, m[c.key] as boolean, c.pct)}</td>)}
                <td className="px-3 py-2">{m.activo ? <Badge variant="success">Sí</Badge> : <Badge variant="muted">No</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </BaseTable>
      ) : (
        <BaseTable className="w-full text-sm min-w-[1100px]">
          <thead className="border-b bg-muted/10">
            <tr>
              <th className={thCls}>Nro</th>
              <th className={thCls}>Código</th>
              <th className={thCls}>Detalle</th>
              <th className={`${thCls} text-right`}>Peso (kg)</th>
              <th className={`${thCls} text-right`}>Costo USD</th>
              <th className={`${thCls} text-right`}>T/C</th>
              <th className={`${thCls} text-right`}>Costo ARS</th>
              <th className={`${thCls} text-right`}>4%</th>
              <th className={thCls}>Activo</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visibles.map(m => (
              <tr key={m.id} className={filaCls(m)} onClick={() => setEditando(m)}>
                <td className="px-3 py-2 tabular-nums">{m.nro_item}</td>
                <td className="px-3 py-2 font-mono text-xs">{m.codigo_oficial ?? DASH}</td>
                <td className="px-3 py-2">{m.detalle}</td>
                <td className={tdNum}>{m.peso_por_unidad !== null ? m.peso_por_unidad.toLocaleString('es-AR') : DASH}</td>
                <td className={tdNum}>{m.costo_unitario_usd !== null ? fmtUsd(m.costo_unitario_usd) : DASH}</td>
                <td className={tdNum}>{m.tipo_cambio !== null ? m.tipo_cambio.toLocaleString('es-AR') : DASH}</td>
                <td className={cn(tdNum, 'font-medium')}>{m.costo_unitario_ars !== null ? formatCurrency(m.costo_unitario_ars) : DASH}</td>
                <td className={tdNum}>{valorPct(m, true, 4)}</td>
                <td className="px-3 py-2">{m.activo ? <Badge variant="success">Sí</Badge> : <Badge variant="muted">No</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </BaseTable>
      )}
      {!isLoading && materiales.length > 0 && visibles.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Ningún ítem coincide con la búsqueda.</p>}

      {importOpen && <ImportarDialog onClose={() => setImportOpen(false)} />}
      {editando && <EditarDialog key={editando.id} m={editando} onClose={() => setEditando(null)} />}
    </div>
  );
}
