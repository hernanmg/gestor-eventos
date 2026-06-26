import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, X, AlertTriangle, Loader2 } from 'lucide-react';
import { useEvento } from '@/hooks/useEvento';
import {
  useSinProveedor,
  useVincularProveedor,
  type GrupoSinProveedor,
  type VincularProveedorResult,
} from '@/hooks/useVincularProveedores';
import ProveedorCombobox from '@/components/domain/ProveedorCombobox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { ProveedorBusqueda, Moneda } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GrupoState {
  proveedorSeleccionado: ProveedorBusqueda | null;
  crearMode:             boolean;
  applying:              boolean;
  vinculado:             boolean;
  resultado: {
    proveedorId: number;
    nombre:      string;
    esNuevo:     boolean;
  } | null;
}

// ── GrupoCard ─────────────────────────────────────────────────────────────────

function GrupoCard({
  grupo,
  estado,
  onUpdateEstado,
  onAplicar,
}: {
  grupo:          GrupoSinProveedor;
  estado:         GrupoState;
  onUpdateEstado: (update: Partial<GrupoState>) => void;
  onAplicar:      () => Promise<void>;
}) {
  const canApply = estado.proveedorSeleccionado !== null || estado.crearMode;

  if (estado.vinculado && estado.resultado) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-base text-foreground truncate">{grupo.concepto}</span>
          <span className="flex items-center gap-1 text-xs font-medium text-green-700 shrink-0">
            <CheckCircle2 size={13} />
            Vinculado
          </span>
        </div>
        <p className="text-sm text-green-800 font-medium">{estado.resultado.nombre}</p>
        {estado.resultado.esNuevo && (
          <Link
            to={`/proveedores/${estado.resultado.proveedorId}`}
            className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full hover:bg-blue-200 transition-colors"
          >
            Proveedor nuevo — completá su info →
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-white p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <span className="font-semibold text-base text-foreground leading-tight">{grupo.concepto}</span>
        <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">
          Pendiente
        </span>
      </div>

      {/* Info badges */}
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="default">
          {grupo.cantidad_movimientos} movimiento{grupo.cantidad_movimientos !== 1 ? 's' : ''}
        </Badge>
        {grupo.tabs.map(tab => (
          <Badge key={tab} variant="muted">{tab}</Badge>
        ))}
        <Badge variant="info">
          {formatCurrency(grupo.monto_total, grupo.moneda as Moneda)} total
        </Badge>
      </div>

      {/* Combobox / Crear mode */}
      {!estado.crearMode ? (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Proveedor</label>
          <div className="w-full border border-input rounded-md px-2 py-1.5 bg-white">
            <ProveedorCombobox
              value={estado.proveedorSeleccionado}
              onChange={p => onUpdateEstado({ proveedorSeleccionado: p, crearMode: false })}
              className="w-full"
            />
          </div>
          {!estado.proveedorSeleccionado && (
            <button
              type="button"
              onClick={() => onUpdateEstado({ crearMode: true, proveedorSeleccionado: null })}
              className="text-xs text-primary hover:underline"
            >
              + Crear proveedor con este nombre
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
          <span className="text-sm text-blue-800 flex-1 min-w-0">
            Crear: <strong className="truncate">{grupo.concepto}</strong>
          </span>
          <button
            type="button"
            onClick={() => onUpdateEstado({ crearMode: false })}
            className="shrink-0 text-blue-600 hover:text-blue-900"
            title="Cancelar"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Apply button */}
      <Button
        size="sm"
        disabled={!canApply || estado.applying}
        onClick={onAplicar}
        className="w-full sm:w-auto"
      >
        {estado.applying
          ? <><Loader2 size={13} className="animate-spin mr-1.5" />Aplicando…</>
          : `Aplicar a ${grupo.cantidad_movimientos} movimiento${grupo.cantidad_movimientos !== 1 ? 's' : ''}`
        }
      </Button>
    </div>
  );
}

// ── VincularProveedoresPage ───────────────────────────────────────────────────

export default function VincularProveedoresPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const eventoId = Number(id);

  const { data: evento }                         = useEvento(eventoId);
  const { data, isLoading, error }               = useSinProveedor(eventoId);
  const { mutateAsync: vincularProveedor }        = useVincularProveedor(eventoId);

  const [estados, setEstados] = useState<Record<string, GrupoState>>({});

  // Initialize states when grupos arrive
  useEffect(() => {
    if (data?.grupos) {
      setEstados(prev => {
        const next = { ...prev };
        for (const g of data.grupos) {
          const key = g.concepto.toLowerCase();
          if (!next[key]) {
            next[key] = {
              proveedorSeleccionado: null,
              crearMode:             false,
              applying:              false,
              vinculado:             false,
              resultado:             null,
            };
          }
        }
        return next;
      });
    }
  }, [data?.grupos]);

  const updateEstado = (concepto: string, update: Partial<GrupoState>) => {
    setEstados(prev => ({
      ...prev,
      [concepto.toLowerCase()]: { ...prev[concepto.toLowerCase()], ...update },
    }));
  };

  const handleAplicar = async (grupo: GrupoSinProveedor) => {
    const key    = grupo.concepto.toLowerCase();
    const estado = estados[key];
    if (!estado) return;

    updateEstado(grupo.concepto, { applying: true });

    try {
      const payload = estado.crearMode
        ? { movimientos_ids: grupo.movimientos_ids, proveedor_id: null as null, crear_proveedor: { nombre: grupo.concepto } }
        : { movimientos_ids: grupo.movimientos_ids, proveedor_id: estado.proveedorSeleccionado!.id };

      const result: VincularProveedorResult = await vincularProveedor(payload);

      updateEstado(grupo.concepto, {
        applying:  false,
        vinculado: true,
        crearMode: false,
        resultado: {
          proveedorId: result.proveedor.id,
          nombre:      result.proveedor.nombre,
          esNuevo:     result.proveedor.es_nuevo,
        },
      });
    } catch {
      updateEstado(grupo.concepto, { applying: false });
    }
  };

  // Stats
  const grupos             = data?.grupos ?? [];
  const totalGrupos        = grupos.length;
  const gruposVinculados   = grupos.filter(g => estados[g.concepto.toLowerCase()]?.vinculado).length;
  const movimientosActualizados = grupos
    .filter(g => estados[g.concepto.toLowerCase()]?.vinculado)
    .reduce((sum, g) => sum + g.cantidad_movimientos, 0);
  const proveedoresNuevos = Object.values(estados).filter(e => e.vinculado && e.resultado?.esNuevo).length;

  const progressPct = totalGrupos > 0 ? Math.round((gruposVinculados / totalGrupos) * 100) : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-6 py-4 border-b border-border bg-white">
        <button
          onClick={() => navigate(`/eventos/${eventoId}`)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Volver al evento"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">
            Vincular proveedores
            {evento && <span className="text-muted-foreground font-normal"> — {evento.nombre}</span>}
          </h1>
          {data && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.total_sin_proveedor} movimiento{data.total_sin_proveedor !== 1 ? 's' : ''} sin proveedor · Agrupados por concepto
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/eventos/${eventoId}`)}
        >
          Finalizar
        </Button>
      </div>

      {/* Progress bar — sticky dentro del scroll en mobile */}
      <div className="shrink-0 px-6 py-3 bg-muted/20 border-b border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
          <span>{gruposVinculados} de {totalGrupos} grupos vinculados</span>
          <span className="font-medium text-foreground">{progressPct}%</span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-300 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" />
            Cargando movimientos sin proveedor…
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle size={14} />
            Error al cargar los movimientos.
          </div>
        )}

        {!isLoading && grupos.length === 0 && !error && (
          <div className="text-center py-16 space-y-3">
            <CheckCircle2 size={48} className="text-green-500 mx-auto" />
            <p className="text-sm font-medium">Todos los movimientos tienen proveedor vinculado</p>
            <Button variant="outline" size="sm" onClick={() => navigate(`/eventos/${eventoId}`)}>
              Volver al evento
            </Button>
          </div>
        )}

        <div className="space-y-3 max-w-2xl">
          {grupos.map(grupo => {
            const key    = grupo.concepto.toLowerCase();
            const estado = estados[key] ?? {
              proveedorSeleccionado: null,
              crearMode:             false,
              applying:              false,
              vinculado:             false,
              resultado:             null,
            };
            return (
              <GrupoCard
                key={key}
                grupo={grupo}
                estado={estado}
                onUpdateEstado={update => updateEstado(grupo.concepto, update)}
                onAplicar={() => handleAplicar(grupo)}
              />
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className={cn(
        'shrink-0 border-t border-border bg-white px-6 py-4',
        'flex flex-col sm:flex-row items-start sm:items-center gap-3',
      )}>
        <div className="flex-1 text-xs text-muted-foreground space-x-3">
          <span><strong className="text-foreground">{gruposVinculados}</strong> grupos vinculados</span>
          <span><strong className="text-foreground">{movimientosActualizados}</strong> movimientos actualizados</span>
          {proveedoresNuevos > 0 && (
            <span><strong className="text-foreground">{proveedoresNuevos}</strong> proveedor{proveedoresNuevos !== 1 ? 'es' : ''} nuevo{proveedoresNuevos !== 1 ? 's' : ''} creado{proveedoresNuevos !== 1 ? 's' : ''}</span>
          )}
        </div>
        <Button size="sm" onClick={() => navigate(`/eventos/${eventoId}`)}>
          Finalizar y ver evento →
        </Button>
      </div>
    </div>
  );
}
