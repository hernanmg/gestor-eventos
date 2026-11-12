import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useGuardarRemito, useEmitirRemito, useSugerenciasRemito, useVerPdfRemito, abrirPestanaPdf } from '@/hooks/useRemitos';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { EncabezadoRemito, Remito, RemitoPayload, TipoRemitoInfo } from '@/types';

// Alta/edición de un remito (sólo BORRADOR). Muestra el catálogo completo del
// tipo con un input de cantidad por ítem; al guardar viajan sólo los > 0.
// Encabezado precompletado con /remitos/sugerencias (Pre-Macro + último remito).

const inputCls = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

const clave = (i: { codigo?: string; descripcion: string }) => `${i.codigo ?? ''}|${i.descripcion}`;
const hoy   = () => new Date().toISOString().slice(0, 10);
const norm  = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const CAMPOS: { key: keyof EncabezadoRemito; label: string }[] = [
  { key: 'cliente',           label: 'Cliente' },
  { key: 'domicilio',         label: 'Domicilio' },
  { key: 'localidad',         label: 'Localidad' },
  { key: 'telefono',          label: 'Teléfono de contacto' },
  { key: 'chofer',            label: 'Chofer' },
  { key: 'chasis_acoplado',   label: 'Chasis / Acoplado' },
  { key: 'responsable_carga', label: 'Responsable de carga' },
];

type Encabezado = Record<keyof EncabezadoRemito, string>;
const encabezadoVacio = (): Encabezado =>
  Object.fromEntries(CAMPOS.map(c => [c.key, ''])) as Encabezado;
const encabezadoDe = (src: Partial<EncabezadoRemito> | undefined): Encabezado =>
  Object.fromEntries(CAMPOS.map(c => [c.key, src?.[c.key] ?? ''])) as Encabezado;

interface Props {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  eventoId:      number;
  eventoNombre:  string;
  tipo:          TipoRemitoInfo;
  remito?:       Remito; // undefined = nuevo
}

export default function RemitoEditorDialog({ open, onOpenChange, eventoId, eventoNombre, tipo, remito }: Props) {
  const guardar = useGuardarRemito();
  const emitir  = useEmitirRemito();
  const { ver } = useVerPdfRemito();
  const { data: sugerencias } = useSugerenciasRemito(eventoId, open && !remito);

  const [fecha, setFecha]           = useState(hoy);
  const [enc, setEnc]               = useState<Encabezado>(encabezadoVacio);
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [buscar, setBuscar]         = useState('');
  const [soloCargados, setSoloCargados] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  // Si "Emitir" crea el remito y falla al emitir, el reintento tiene que
  // actualizar ese borrador en vez de crear otro con el número siguiente.
  const [idCreado, setIdCreado]     = useState<number | undefined>();
  const id = remito?.id ?? idCreado;

  // Reset al abrir: con el remito a editar, o vacío (y las sugerencias llegan después)
  useEffect(() => {
    if (!open) return;
    setFecha(remito ? remito.fecha.slice(0, 10) : hoy());
    setEnc(encabezadoDe(remito));
    setCantidades(Object.fromEntries((remito?.items ?? []).map(i => [clave(i), String(i.cantidad)])));
    setBuscar('');
    setSoloCargados(false);
    setError(null);
    setIdCreado(undefined);
  }, [open, remito]);

  // Sugerencias sólo completan campos que el usuario todavía no tocó
  useEffect(() => {
    if (!sugerencias || remito) return;
    setEnc(e => Object.fromEntries(CAMPOS.map(c => [c.key, e[c.key] || sugerencias[c.key] || ''])) as Encabezado);
  }, [sugerencias, remito]);

  const cargados = useMemo(() => {
    const out: { codigo?: string; descripcion: string; cantidad: number }[] = [];
    for (const cat of tipo.categorias) {
      for (const it of cat.items) {
        const n = Number((cantidades[clave(it)] ?? '').replace(',', '.'));
        if (n > 0) out.push({ ...(it.codigo ? { codigo: it.codigo } : {}), descripcion: it.descripcion, cantidad: n });
      }
    }
    return out;
  }, [cantidades, tipo]);

  const categoriasVisibles = useMemo(() => {
    const q = norm(buscar.trim());
    return tipo.categorias
      .map(cat => ({
        ...cat,
        items: cat.items.filter(it =>
          (!soloCargados || Number((cantidades[clave(it)] ?? '').replace(',', '.')) > 0)
          && (!q || norm(it.descripcion).includes(q) || (it.codigo ?? '').includes(q) || norm(cat.categoria).includes(q))),
      }))
      .filter(cat => cat.items.length > 0);
  }, [tipo, buscar, soloCargados, cantidades]);

  const invalido = useMemo(() => Object.entries(cantidades).find(([, v]) => {
    const t = v.trim();
    if (!t) return false;
    const n = Number(t.replace(',', '.'));
    return !Number.isFinite(n) || n < 0;
  }), [cantidades]);

  const ocupado = guardar.isPending || emitir.isPending;

  const payload = (): RemitoPayload => ({
    fecha,
    ...Object.fromEntries(CAMPOS.map(c => [c.key, enc[c.key].trim() || null])),
    items: cargados,
  });

  const validar = (): string | null => {
    if (!fecha) return 'Completá la fecha';
    if (invalido) return `Cantidad inválida en "${invalido[0].split('|')[1]}"`;
    return null;
  };

  const handleGuardar = async () => {
    const v = validar();
    if (v) { setError(v); return; }
    setError(null);
    try {
      await guardar.mutateAsync({ id, eventoId, tipo: tipo.tipo, data: payload() });
      onOpenChange(false);
    } catch (err) { setError(getApiErrorMessage(err)); }
  };

  const handleEmitir = async () => {
    const v = validar();
    if (v) { setError(v); return; }
    if (cargados.length === 0) { setError('Cargá al menos un ítem antes de emitir'); return; }
    if (!window.confirm('Una vez emitido el remito no se puede editar (sí clonar). ¿Emitir?')) return;
    setError(null);
    const pestana = abrirPestanaPdf();
    try {
      const r = await guardar.mutateAsync({ id, eventoId, tipo: tipo.tipo, data: payload() });
      setIdCreado(r.id);
      await emitir.mutateAsync(r.id);
      onOpenChange(false);
      await ver(r.id, pestana);
    } catch (err) {
      pestana?.close();
      setError(getApiErrorMessage(err));
    }
  };

  const numero = remito ? `Nº ${String(remito.numero).padStart(4, '0')}` : 'Nuevo';

  return (
    <Dialog open={open} onOpenChange={o => { if (!ocupado) onOpenChange(o); }}>
      <DialogContent className="max-w-6xl p-0 flex flex-col max-h-[92vh] overflow-hidden">
        <DialogHeader className="px-6 pt-5 mb-0">
          <DialogTitle>Remito {tipo.nombre} — {numero}</DialogTitle>
          <DialogDescription>{eventoNombre} · sólo se guardan los ítems con cantidad; en el PDF se imprimen todos (los vacíos quedan para completar a mano).</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {/* ── Encabezado ── */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className={labelCls}>Fecha *</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Evento</label>
              <input value={eventoNombre} disabled className={cn(inputCls, 'bg-muted/40')} />
            </div>
            {CAMPOS.map(c => (
              <div key={c.key}>
                <label className={labelCls}>{c.label}</label>
                <input value={enc[c.key]} onChange={e => setEnc(prev => ({ ...prev, [c.key]: e.target.value }))} className={inputCls} />
              </div>
            ))}
          </section>

          {/* ── Ítems ── */}
          <section className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar ítem, código o categoría…" className={cn(inputCls, 'pl-7')} />
              </div>
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={soloCargados} onChange={e => setSoloCargados(e.target.checked)} />
                Sólo cargados
              </label>
              <span className="text-sm text-muted-foreground ml-auto">
                {cargados.length} ítem(s) cargado(s) · {cargados.reduce((s, i) => s + i.cantidad, 0).toLocaleString('es-AR')} unidad(es)
              </span>
            </div>

            {categoriasVisibles.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Ningún ítem coincide.</p>
            ) : (
              <div className="md:columns-2 gap-6">
                {categoriasVisibles.map(cat => (
                  <div key={cat.categoria} className="break-inside-avoid-column mb-3">
                    <h4 className="text-xs font-semibold bg-muted/60 px-2 py-1 rounded-sm">{cat.categoria}</h4>
                    <div className="divide-y">
                      {cat.items.map(it => {
                        const k = clave(it);
                        const v = cantidades[k] ?? '';
                        const lleno = Number(v.replace(',', '.')) > 0;
                        return (
                          <div key={k} className={cn('flex items-center gap-2 px-2 py-1 text-sm', lleno && 'bg-emerald-50')}>
                            {tipo.conCodigo && <span className="font-mono text-[11px] text-muted-foreground w-16 shrink-0">{(it.codigo ?? '').replace(/\.0$/, '')}</span>}
                            <span className={cn('flex-1 min-w-0', lleno && 'font-medium')}>{it.descripcion}</span>
                            <input
                              inputMode="decimal"
                              value={v}
                              onChange={e => setCantidades(prev => ({ ...prev, [k]: e.target.value }))}
                              onFocus={e => e.target.select()}
                              placeholder="0"
                              aria-label={`Cantidad ${it.descripcion}`}
                              className="w-16 shrink-0 border rounded px-1.5 py-0.5 text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-ring bg-white"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="px-6 py-3 border-t flex items-center gap-2 justify-end flex-wrap">
          {error && <p className="text-sm text-destructive mr-auto">{error}</p>}
          <Button variant="outline" size="sm" disabled={ocupado} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="outline" size="sm" disabled={ocupado} onClick={handleGuardar}>Guardar borrador</Button>
          <Button size="sm" disabled={ocupado} onClick={handleEmitir}>Emitir y descargar PDF</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
