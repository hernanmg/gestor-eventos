import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight, Download, Wallet, Users, Building2, FileText, ClipboardList, Package } from 'lucide-react';
import {
  useCierreContable, useUpdateEstadoCierreContable, useUpdateNotaSeccionCierreContable, descargarCierreContable,
} from '@/hooks/useCierreContable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatCurrency } from '@/lib/formatters';
import type { EstadoCierreContable } from '@/types';

const ESTADO_VARIANT: Record<EstadoCierreContable, 'muted' | 'info' | 'success'> = {
  BORRADOR: 'muted', ENVIADO: 'info', APROBADO: 'success',
};
const ESTADO_LABEL: Record<EstadoCierreContable, string> = {
  BORRADOR: 'Borrador', ENVIADO: 'Enviado', APROBADO: 'Aprobado',
};

// ── Sección acordeón genérica, con nota libre al pie ─────────────────────────

function Seccion({ id, icono, titulo, defaultOpen, notaInicial, onGuardarNota, children }: {
  id: string; icono: React.ReactNode; titulo: string; defaultOpen?: boolean;
  notaInicial: string | null; onGuardarNota: (texto: string | null) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [nota, setNota] = useState(notaInicial ?? '');

  useEffect(() => { setNota(notaInicial ?? ''); }, [notaInicial]);

  return (
    <div className="rounded-lg border border-border bg-white overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full px-4 py-3 text-left font-medium"
      >
        {icono}
        <span className="flex-1">{titulo}</span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {children}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-0.5">Notas para el contador</label>
            <textarea
              value={nota}
              onChange={e => setNota(e.target.value)}
              onBlur={() => { if (nota !== (notaInicial ?? '')) onGuardarNota(nota || null); }}
              rows={2}
              placeholder="Aclaraciones libres antes de mandar al contador…"
              className="w-full border rounded px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              id={`nota-${id}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function TablaCuentas({ filas }: { filas: { cuenta: string; saldo: number }[] }) {
  const total = filas.reduce((s, f) => s + f.saldo, 0);
  if (filas.length === 0) return <p className="text-sm text-muted-foreground">Sin cuentas.</p>;
  return (
    <table className="w-full text-sm">
      <tbody className="divide-y">
        {filas.map((f, i) => (
          <tr key={i}>
            <td className="py-1.5">{f.cuenta}</td>
            <td className="py-1.5 text-right tabular-nums">{formatCurrency(f.saldo)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t font-semibold">
          <td className="py-1.5">Total</td>
          <td className="py-1.5 text-right tabular-nums">{formatCurrency(total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function TablaTerceros({ filas }: { filas: { cuit: string | null; nombre: string; importe: number }[] }) {
  const total = filas.reduce((s, f) => s + f.importe, 0);
  if (filas.length === 0) return <p className="text-sm text-muted-foreground">Sin registros.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs text-muted-foreground text-left">
          <th className="py-1">CUIT</th><th className="py-1">Nombre</th><th className="py-1 text-right">Importe</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {filas.map((f, i) => (
          <tr key={i}>
            <td className="py-1.5 font-mono text-xs">{f.cuit ?? '—'}</td>
            <td className="py-1.5">{f.nombre}</td>
            <td className="py-1.5 text-right tabular-nums">{formatCurrency(f.importe)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t font-semibold">
          <td className="py-1.5" colSpan={2}>Total</td>
          <td className="py-1.5 text-right tabular-nums">{formatCurrency(total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function TablaCreditoDeuda({ filas }: { filas: { tipo: string; descripcion: string; importe: number }[] }) {
  const total = filas.reduce((s, f) => s + f.importe, 0);
  if (filas.length === 0) return <p className="text-sm text-muted-foreground">Sin registros.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs text-muted-foreground text-left">
          <th className="py-1">Tipo</th><th className="py-1">Descripción</th><th className="py-1 text-right">Importe</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {filas.map((f, i) => (
          <tr key={i}>
            <td className="py-1.5 text-xs text-muted-foreground">{f.tipo}</td>
            <td className="py-1.5">{f.descripcion}</td>
            <td className="py-1.5 text-right tabular-nums">{formatCurrency(f.importe)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t font-semibold">
          <td className="py-1.5" colSpan={2}>Total</td>
          <td className="py-1.5 text-right tabular-nums">{formatCurrency(total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

const SIGUIENTE_ESTADO: Partial<Record<EstadoCierreContable, { next: EstadoCierreContable; label: string }>> = {
  BORRADOR: { next: 'ENVIADO', label: 'Marcar como enviado' },
  ENVIADO:  { next: 'APROBADO', label: 'Marcar como aprobado' },
};

export default function CierreContableDetallePage() {
  const { id } = useParams<{ id: string }>();
  const cierreId = Number(id);
  const navigate = useNavigate();
  const { data: cierre, isLoading } = useCierreContable(cierreId);
  const updateEstadoMut = useUpdateEstadoCierreContable(cierreId);
  const updateNotaMut   = useUpdateNotaSeccionCierreContable(cierreId);
  const [descargando, setDescargando] = useState(false);

  if (isLoading || !cierre) {
    return <div className="p-6"><p className="text-sm text-muted-foreground">Cargando…</p></div>;
  }

  const s = cierre.snapshot;
  const notas = s.notas_por_seccion ?? {};
  const guardarNota = (seccion: string) => (texto: string | null) => updateNotaMut.mutate({ seccion, texto });

  const handleExportar = async () => {
    setDescargando(true);
    try {
      await descargarCierreContable(cierre.id, `cierre-contable-${cierre.empresa?.nombre_corto ?? cierre.empresa_id}-${cierre.fecha_corte.slice(0, 10)}.xlsx`);
    } finally {
      setDescargando(false);
    }
  };

  const siguienteEstado = SIGUIENTE_ESTADO[cierre.estado];

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <button onClick={() => navigate('/cierre-contable')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> Cierre Contable
      </button>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {cierre.empresa?.nombre_corto ?? cierre.empresa?.nombre} — Corte {formatDate(cierre.fecha_corte)}
          </h1>
          <div className="mt-1"><Badge variant={ESTADO_VARIANT[cierre.estado]}>{ESTADO_LABEL[cierre.estado]}</Badge></div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={descargando} onClick={handleExportar}>
            <Download size={14} className="mr-1.5" /> {descargando ? 'Descargando…' : 'Exportar Excel'}
          </Button>
          {siguienteEstado && (
            <Button
              size="sm"
              disabled={updateEstadoMut.isPending}
              onClick={() => updateEstadoMut.mutate(siguienteEstado.next)}
            >
              {siguienteEstado.label}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <Seccion id="cajas" icono={<Wallet size={16} />} titulo="💰 Cajas y Bancos" defaultOpen
          notaInicial={notas.cajas ?? null} onGuardarNota={guardarNota('cajas')}>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Cajas</p>
              <TablaCuentas filas={s.cajas} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Bancos</p>
              <TablaCuentas filas={s.bancos} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Inversiones (plazos fijos / FIMA)</p>
              <TablaCuentas filas={s.inversiones} />
            </div>
          </div>
        </Seccion>

        <Seccion id="deudores" icono={<Users size={16} />} titulo="👥 Deudores"
          notaInicial={notas.deudores ?? null} onGuardarNota={guardarNota('deudores')}>
          <TablaTerceros filas={s.deudores} />
        </Seccion>

        <Seccion id="acreedores" icono={<Building2 size={16} />} titulo="🏢 Acreedores"
          notaInicial={notas.acreedores ?? null} onGuardarNota={guardarNota('acreedores')}>
          <TablaTerceros filas={s.acreedores} />
        </Seccion>

        <Seccion id="creditos" icono={<FileText size={16} />} titulo="📄 Créditos"
          notaInicial={notas.creditos ?? null} onGuardarNota={guardarNota('creditos')}>
          <TablaCreditoDeuda filas={s.creditos} />
        </Seccion>

        <Seccion id="deudas" icono={<ClipboardList size={16} />} titulo="📋 Deudas"
          notaInicial={notas.deudas ?? null} onGuardarNota={guardarNota('deudas')}>
          <TablaCreditoDeuda filas={s.deudas} />
        </Seccion>

        <Seccion id="mercaderias" icono={<Package size={16} />} titulo="📦 Mercaderías"
          notaInicial={notas.mercaderias ?? null} onGuardarNota={guardarNota('mercaderias')}>
          {s.mercaderias.productos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin productos activos.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground text-left">
                  <th className="py-1">Producto</th><th className="py-1 text-right">Stock</th><th className="py-1">Unidad</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {s.mercaderias.productos.map(p => (
                  <tr key={p.producto_id}>
                    <td className="py-1.5">{p.nombre}</td>
                    <td className="py-1.5 text-right tabular-nums">{p.stock_total}</td>
                    <td className="py-1.5 text-muted-foreground">{p.unidad}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <td className="py-1.5">Total ({s.mercaderias.cantidad_items} ítems)</td>
                  <td className="py-1.5 text-right tabular-nums">{s.mercaderias.total_unidades}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
          <p className="text-xs text-muted-foreground italic">Sin valorizar — a cargo del estudio contable.</p>
        </Seccion>
      </div>
    </div>
  );
}
