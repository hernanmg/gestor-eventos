import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, X, ArrowRight, CheckCircle2 } from 'lucide-react';
import {
  useEspaciosCompartidos, useCreateEspacio, useGenerarMesActual,
  type EspacioPayload, type ParteInput,
} from '@/hooks/useEspaciosCompartidos';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import { getApiErrorMessage } from '@/lib/utils';
import { cn } from '@/lib/utils';

const inputCls = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const PARTE_VACIA: ParteInput = { nombre: '', porcentaje: 0 };

// ── Dialog: nuevo espacio ─────────────────────────────────────────────────────

function NuevoEspacioDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [nombre, setNombre]           = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [direccion, setDireccion]     = useState('');
  const [diaGeneracion, setDiaGeneracion] = useState('1');
  const [partes, setPartes]           = useState<ParteInput[]>([PARTE_VACIA, PARTE_VACIA]);
  const [error, setError]             = useState<string | null>(null);
  const createMut = useCreateEspacio();
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setNombre(''); setDescripcion(''); setDireccion(''); setDiaGeneracion('1');
      setPartes([PARTE_VACIA, PARTE_VACIA]); setError(null);
    }
  }, [open]);

  const suma = partes.reduce((s, p) => s + (Number(p.porcentaje) || 0), 0);

  const handleSubmit = async () => {
    setError(null);
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return; }
    const partesValidas = partes.filter(p => p.nombre.trim());
    if (partesValidas.length === 0) { setError('Cargá al menos una parte'); return; }
    if (Math.abs(suma - 100) > 0.01) { setError(`La suma de porcentajes debe ser 100 (actual: ${suma})`); return; }

    const payload: EspacioPayload = {
      nombre:         nombre.trim(),
      descripcion:    descripcion.trim() || null,
      direccion:      direccion.trim() || null,
      dia_generacion: Number(diaGeneracion) || 1,
      partes:         partesValidas,
    };

    try {
      const espacio = await createMut.mutateAsync(payload);
      onClose();
      navigate(`/espacios-compartidos/${espacio.id}`);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Nuevo espacio compartido</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-1">
          <div>
            <label className={labelCls}>Nombre *</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Coworking, Nave 15…" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Descripción</label>
              <input value={descripcion} onChange={e => setDescripcion(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Dirección</label>
              <input value={direccion} onChange={e => setDireccion(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Día del mes de generación automática</label>
            <input type="number" min={1} max={28} value={diaGeneracion} onChange={e => setDiaGeneracion(e.target.value)} className={cn(inputCls, 'w-24')} />
          </div>

          <div className="border-t pt-3">
            <p className="text-xs font-medium mb-2">Partes y % de reparto</p>
            <div className="space-y-2">
              {partes.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={p.nombre}
                    onChange={e => setPartes(partes.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))}
                    placeholder="Nombre de la parte"
                    className={cn(inputCls, 'flex-1')}
                  />
                  <input
                    type="number"
                    value={p.porcentaje || ''}
                    onChange={e => setPartes(partes.map((x, j) => j === i ? { ...x, porcentaje: Number(e.target.value) } : x))}
                    placeholder="%"
                    className={cn(inputCls, 'w-20')}
                  />
                  {partes.length > 1 && (
                    <button type="button" onClick={() => setPartes(partes.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setPartes([...partes, PARTE_VACIA])} className="text-xs text-primary hover:underline mt-2">
              + Agregar parte
            </button>
            <p className={cn('text-xs mt-1', Math.abs(suma - 100) < 0.01 ? 'text-green-700' : 'text-muted-foreground')}>
              Suma actual: {suma}% {Math.abs(suma - 100) < 0.01 ? '✓' : '(debe ser 100%)'}
            </p>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="button" size="sm" onClick={handleSubmit} disabled={createMut.isPending}>
              {createMut.isPending ? 'Guardando…' : 'Crear espacio'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function EspaciosCompartidosPage() {
  const { data: espacios = [], isLoading } = useEspaciosCompartidos();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const generarMesActual = useGenerarMesActual();
  const navigate = useNavigate();
  const yaDisparado = useRef(false); // evita doble disparo en StrictMode (mount x2 en dev)

  useEffect(() => {
    if (yaDisparado.current) return;
    yaDisparado.current = true;
    generarMesActual.mutate(undefined, {
      onSuccess: (data) => {
        if (data.generados.length > 0) {
          const nombres = data.generados.join(' y ');
          const label = `${MESES[data.mes - 1]} ${data.anio}`;
          setToast(`Se generaron los gastos de ${label} para ${nombres}`);
          setTimeout(() => setToast(null), 6000);
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800 shadow-md">
          <CheckCircle2 size={16} className="shrink-0" />
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 size={22} />
          Espacios Compartidos
        </h1>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus size={14} className="mr-1.5" /> Nuevo espacio
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : espacios.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay espacios compartidos cargados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {espacios.map(e => (
            <button
              key={e.id}
              onClick={() => navigate(`/espacios-compartidos/${e.id}`)}
              className="text-left rounded-lg border bg-white p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Building2 size={16} className="text-muted-foreground" />
                <h2 className="font-semibold">{e.nombre}</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {e.partes.map(p => `${p.nombre} ${Number(p.porcentaje)}%`).join(' · ')}
              </p>
              {e.mes_actual ? (
                <>
                  <p className="text-sm">Mes actual: <span className="font-semibold">{formatCurrency(e.mes_actual.total_gastos)}</span></p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {e.mes_actual.pagados} pagado{e.mes_actual.pagados !== 1 ? 's' : ''} · {e.mes_actual.pendientes} pendiente{e.mes_actual.pendientes !== 1 ? 's' : ''}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Mes actual sin generar</p>
              )}
              <p className="text-xs text-primary flex items-center gap-1 mt-3">
                Ver detalle <ArrowRight size={12} />
              </p>
            </button>
          ))}
        </div>
      )}

      <NuevoEspacioDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
