import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet, Plus, Download, Eye } from 'lucide-react';
import { useCierresContables, useGenerarCierreContable, descargarCierreContable } from '@/hooks/useCierreContable';
import { useEmpresas } from '@/hooks/useEmpresas';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/formatters';
import { getApiErrorMessage, cn } from '@/lib/utils';
import type { CierreContable, EstadoCierreContable } from '@/types';

const inputCls  = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls  = 'block text-xs font-medium text-muted-foreground mb-0.5';
const selectCls = 'border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';

const ESTADO_VARIANT: Record<EstadoCierreContable, 'muted' | 'info' | 'success'> = {
  BORRADOR: 'muted', ENVIADO: 'info', APROBADO: 'success',
};
const ESTADO_LABEL: Record<EstadoCierreContable, string> = {
  BORRADOR: 'Borrador', ENVIADO: 'Enviado', APROBADO: 'Aprobado',
};

// ── Dialog: generar nuevo cierre ──────────────────────────────────────────────

function GenerarCierreDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: empresas = [] } = useEmpresas();
  const generarMut = useGenerarCierreContable();
  const [empresaId, setEmpresaId] = useState('');
  const [fechaCorte, setFechaCorte] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const empresaSel = empresas.find(e => e.id === Number(empresaId));

  const handleGenerar = async () => {
    setError(null);
    try {
      await generarMut.mutateAsync({ empresa_id: Number(empresaId), fecha_corte: fechaCorte });
      onClose();
      setEmpresaId(''); setFechaCorte(''); setConfirmando(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const handleClose = () => { onClose(); setConfirmando(false); setError(null); };

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Generar cierre contable</DialogTitle></DialogHeader>
        {!confirmando ? (
          <div className="space-y-3 mt-1">
            <div>
              <label className={labelCls}>Empresa *</label>
              <select value={empresaId} onChange={e => setEmpresaId(e.target.value)} className={selectCls + ' w-full'}>
                <option value="">Seleccionar...</option>
                {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre_corto ?? e.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Fecha de corte *</label>
              <input type="date" value={fechaCorte} onChange={e => setFechaCorte(e.target.value)} className={inputCls} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
              <Button type="button" size="sm" disabled={!empresaId || !fechaCorte} onClick={() => setConfirmando(true)}>
                Continuar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 mt-1">
            <p className="text-sm">
              Generar cierre contable al <strong>{formatDate(fechaCorte)}</strong> para <strong>{empresaSel?.nombre_corto ?? empresaSel?.nombre}</strong>.
              Esta operación calcula el estado financiero a esa fecha. Se puede volver a generar si hay correcciones (mientras esté en Borrador).
            </p>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setConfirmando(false)}>Atrás</Button>
              <Button type="button" size="sm" disabled={generarMut.isPending} onClick={handleGenerar}>
                {generarMut.isPending ? 'Generando…' : 'Confirmar'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Card por cierre ────────────────────────────────────────────────────────────

function CierreCard({ cierre }: { cierre: CierreContable }) {
  const navigate = useNavigate();
  const [descargando, setDescargando] = useState(false);

  const handleExportar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDescargando(true);
    try {
      await descargarCierreContable(cierre.id, `cierre-contable-${cierre.empresa?.nombre_corto ?? cierre.empresa_id}-${cierre.fecha_corte.slice(0, 10)}.xlsx`);
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div
      className="rounded-lg border bg-white p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => navigate(`/cierre-contable/${cierre.id}`)}
    >
      <div className="flex items-center justify-between mb-1.5">
        <h2 className="font-semibold">{cierre.empresa?.nombre_corto ?? cierre.empresa?.nombre}</h2>
        <Badge variant={ESTADO_VARIANT[cierre.estado]}>{ESTADO_LABEL[cierre.estado]}</Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-3">Corte {formatDate(cierre.fecha_corte)}</p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={e => { e.stopPropagation(); navigate(`/cierre-contable/${cierre.id}`); }}>
          <Eye size={13} className="mr-1.5" /> Ver
        </Button>
        <Button variant="outline" size="sm" disabled={descargando} onClick={handleExportar}>
          <Download size={13} className="mr-1.5" /> {descargando ? 'Descargando…' : 'Exportar'}
        </Button>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function CierreContablePage() {
  const { data: cierres = [], isLoading } = useCierresContables();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileSpreadsheet size={22} />
          Cierre Contable
        </h1>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus size={14} className="mr-1.5" /> Generar cierre
        </Button>
      </div>
      <p className="text-sm text-muted-foreground -mt-2">
        Foto financiera a una fecha de corte fija, en el formato que el estudio contable pide todos los años.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : cierres.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileSpreadsheet size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Todavía no se generó ningún cierre contable.</p>
        </div>
      ) : (
        <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4')}>
          {cierres.map(c => <CierreCard key={c.id} cierre={c} />)}
        </div>
      )}

      <GenerarCierreDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
