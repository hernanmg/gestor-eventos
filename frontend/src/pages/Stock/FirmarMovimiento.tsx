import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Truck, LogIn, LogOut, CheckCircle2 } from 'lucide-react';
import {
  usePendientesFirma, useFirmarSalida, useFirmarLlegada, useFirmarRetorno,
  type PasoFirma,
} from '@/hooks/useStock';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AsignacionStock } from '@/types';

const PASO_LABEL: Record<PasoFirma, string> = {
  salida:  'Saliendo del depósito',
  llegada: 'Llegando al evento',
  retorno: 'Partiendo hacia siguiente destino',
};

const PASO_ICON: Record<PasoFirma, typeof Truck> = {
  salida:  LogOut,
  llegada: LogIn,
  retorno: Truck,
};

type Step = 1 | 2 | 3;

export default function FirmarMovimientoPage() {
  const navigate = useNavigate();
  const [paso, setPaso]         = useState<PasoFirma | null>(null);
  const [asignacion, setAsignacion] = useState<AsignacionStock | null>(null);
  const [step, setStep]         = useState<Step>(1);
  const [excedente, setExcedente] = useState(0);
  const [confirmado, setConfirmado] = useState<{ fecha: Date } | null>(null);

  const { data, isLoading } = usePendientesFirma(paso ?? 'salida');
  const firmarSalida  = useFirmarSalida();
  const firmarLlegada = useFirmarLlegada();
  const firmarRetorno = useFirmarRetorno();

  const pendientes = paso ? (data?.asignaciones ?? []) : [];

  const reset = () => { setPaso(null); setAsignacion(null); setStep(1); setExcedente(0); setConfirmado(null); };

  const handleFirmar = async () => {
    if (!asignacion || !paso) return;
    try {
      if (paso === 'salida')  await firmarSalida.mutateAsync(asignacion.id);
      if (paso === 'llegada') await firmarLlegada.mutateAsync({ id: asignacion.id, cantidad_excedente: excedente });
      if (paso === 'retorno') await firmarRetorno.mutateAsync(asignacion.id);
      setConfirmado({ fecha: new Date() });
    } catch {
      // el error se refleja en el estado isError del mutation
    }
  };

  const isPending = firmarSalida.isPending || firmarLlegada.isPending || firmarRetorno.isPending;
  const isError   = firmarSalida.isError   || firmarLlegada.isError   || firmarRetorno.isError;

  return (
    <div className="min-h-full bg-muted/20 p-4 max-w-md mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => (step === 1 ? navigate('/stock') : reset())} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">Firmar movimiento</h1>
      </div>

      {confirmado ? (
        <div className="text-center py-16 space-y-4">
          <CheckCircle2 size={64} className="mx-auto text-green-600" />
          <p className="text-xl font-bold text-green-700">✓ Firmado</p>
          <p className="text-sm text-muted-foreground">
            {confirmado.fecha.toLocaleDateString('es-AR')} — {confirmado.fecha.toLocaleTimeString('es-AR')}
          </p>
          <Button size="lg" className="w-full" onClick={reset}>Firmar otro movimiento</Button>
        </div>
      ) : step === 1 ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground mb-2">¿Qué estás haciendo?</p>
          {(Object.keys(PASO_LABEL) as PasoFirma[]).map(p => {
            const Icon = PASO_ICON[p];
            return (
              <button
                key={p}
                onClick={() => { setPaso(p); setStep(2); }}
                className="w-full flex items-center gap-3 rounded-lg border bg-white p-4 text-left hover:bg-accent transition-colors"
              >
                <Icon size={22} className="text-primary shrink-0" />
                <span className="font-medium">{PASO_LABEL[p]}</span>
              </button>
            );
          })}
        </div>
      ) : step === 2 ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground mb-2">¿Cuál es tu asignación?</p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : pendientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay asignaciones pendientes para este paso.</p>
          ) : (
            pendientes.map(a => (
              <button
                key={a.id}
                onClick={() => { setAsignacion(a); setStep(3); }}
                className="w-full rounded-lg border bg-white p-4 text-left hover:bg-accent transition-colors space-y-1"
              >
                <p className="font-semibold">{a.producto?.nombre ?? `Producto #${a.producto_id}`} × {a.cantidad}</p>
                <p className="text-xs text-muted-foreground">
                  {a.camion ? `Camión ${a.camion.codigo}` : 'Sin camión'} · {a.evento?.nombre ?? `Evento #${a.evento_id}`}
                </p>
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm font-medium text-muted-foreground">Confirmá con tu firma</p>
          <div className="rounded-lg border bg-white p-4 space-y-2">
            <p className="text-xs text-muted-foreground">{PASO_LABEL[paso!]}</p>
            <p className="font-semibold text-lg">{asignacion?.producto?.nombre} × {asignacion?.cantidad}</p>
            <p className="text-sm text-muted-foreground">
              {asignacion?.camion ? `Camión ${asignacion.camion.codigo}` : 'Sin camión'}
            </p>
            <p className="text-sm text-muted-foreground">{asignacion?.evento?.nombre}</p>
          </div>

          {paso === 'llegada' && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                ¿Llevaste material de más? ¿Cuánto?
              </label>
              <input
                type="number" min={0} value={excedente}
                onChange={e => setExcedente(Number(e.target.value))}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          )}

          {isError && <p className="text-xs text-destructive">No se pudo registrar la firma. Intentá de nuevo.</p>}

          <Button
            size="lg"
            className={cn('w-full text-base py-6', isPending && 'opacity-70')}
            onClick={handleFirmar}
            disabled={isPending}
          >
            {isPending ? 'Firmando…' : 'FIRMAR'}
          </Button>
        </div>
      )}
    </div>
  );
}
