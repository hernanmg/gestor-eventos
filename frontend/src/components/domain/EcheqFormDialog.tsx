import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useCreateEcheq } from '@/hooks/useEcheqs';
import type { Moneda } from '@/types';

interface Props {
  eventoId:     number;
  movimientoId: number;
  open:         boolean;
  onClose:      () => void;
}

interface FormData {
  numero:               string;
  razon_social:         string;
  detalle:              string;
  importe:              string;
  moneda:               Moneda;
  fecha_emision:        string;
  fecha_cobro_estimada: string;
}

const EMPTY: FormData = {
  numero:               '',
  razon_social:         '',
  detalle:              '',
  importe:              '',
  moneda:               'ARS',
  fecha_emision:        '',
  fecha_cobro_estimada: '',
};

export default function EcheqFormDialog({ eventoId, movimientoId, open, onClose }: Props) {
  const [form,  setForm]  = useState<FormData>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const createEcheq = useCreateEcheq(eventoId);

  const field = (key: keyof FormData) => ({
    value:    form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value })),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.numero.trim())       { setError('Número es obligatorio');   return; }
    if (!form.razon_social.trim()) { setError('Razón social es obligatoria'); return; }
    if (!form.importe || parseFloat(form.importe) <= 0) {
      setError('Importe debe ser mayor a cero'); return;
    }

    try {
      await createEcheq.mutateAsync({
        movimiento_id:        movimientoId,
        numero:               form.numero.trim(),
        razon_social:         form.razon_social.trim(),
        detalle:              form.detalle.trim()              || null,
        importe:              parseFloat(form.importe),
        moneda:               form.moneda,
        fecha_emision:        form.fecha_emision              || null,
        fecha_cobro_estimada: form.fecha_cobro_estimada       || null,
      });
      setForm(EMPTY);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Error al guardar');
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) { setForm(EMPTY); setError(null); onClose(); }
  };

  const input = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
  const label = 'block text-xs font-medium text-muted-foreground mb-0.5';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo echeq</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>N° de cheque *</label>
              <input {...field('numero')} className={input} placeholder="00012345" />
            </div>
            <div>
              <label className={label}>Importe *</label>
              <input
                type="number" min="0.01" step="0.01"
                {...field('importe')}
                className={input}
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className={label}>Razón social *</label>
            <input {...field('razon_social')} className={input} placeholder="Empresa S.A." />
          </div>

          <div>
            <label className={label}>Detalle</label>
            <input {...field('detalle')} className={input} placeholder="Descripción opcional" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={label}>Moneda</label>
              <select {...field('moneda')} className={input}>
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className={label}>Fecha emisión</label>
              <input type="date" {...field('fecha_emision')} className={input} />
            </div>
            <div>
              <label className={label}>Fecha cobro est.</label>
              <input type="date" {...field('fecha_cobro_estimada')} className={input} />
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => handleClose(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={createEcheq.isPending}>
              {createEcheq.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
