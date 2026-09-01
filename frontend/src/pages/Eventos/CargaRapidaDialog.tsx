import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useCreateEvento } from '@/hooks/useEvento';
import { useUsuarios } from '@/hooks/useUsuarios';
import { getApiErrorMessage } from '@/lib/utils';

const inputCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

const TIPOS_TRABAJO_SUGERIDOS = ['Layher', 'Vallado', 'Varios', 'Otro'];

type FacturarOpcion = 'SI' | 'NO' | 'A_DEFINIR';

interface FormState {
  nombre:         string;
  fecha:          string;
  tipo_trabajo:   string;
  cliente:        string;
  referente_id:   string;
  facturar:       FacturarOpcion;
  observaciones:  string;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const EMPTY_FORM: FormState = {
  nombre: '', fecha: todayStr(), tipo_trabajo: '', cliente: '', referente_id: '',
  facturar: 'A_DEFINIR', observaciones: '',
};

interface Props {
  open:    boolean;
  onClose: () => void;
}

// "Carga rápida de evento" — para trabajos que salen sin presupuesto formal
// (ej. Mayra: "salen 15 vallas para el panal, se arregla de otro modo y no
// van facturadas"). No pasa por la pre-macro: crea el Evento directo con
// es_informal=true y nada más — sin ficha, sin socios, sin rubros.
export default function CargaRapidaDialog({ open, onClose }: Props) {
  const [form,  setForm]  = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const createEvento = useCreateEvento();
  const { data: usuarios = [] } = useUsuarios();

  useEffect(() => {
    if (open) { setForm(EMPTY_FORM); setError(null); }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.nombre.trim()) { setError('El nombre del trabajo es obligatorio'); return; }
    if (!form.fecha)         { setError('La fecha es obligatoria'); return; }

    // No hay columnas dedicadas para tipo de trabajo / cliente / referente en
    // un evento informal (sólo es_informal/facturar/facturar_notas) — se
    // vuelcan como texto legible en facturar_notas junto a las observaciones.
    const referente = usuarios.find(u => String(u.id) === form.referente_id);
    const notasParts = [
      form.tipo_trabajo.trim() && `Tipo de trabajo: ${form.tipo_trabajo.trim()}`,
      form.cliente.trim()      && `Cliente/Destino: ${form.cliente.trim()}`,
      referente                && `Referente interno: ${referente.nombre}`,
      form.observaciones.trim(),
    ].filter(Boolean);

    try {
      await createEvento.mutateAsync({
        nombre:       form.nombre.trim(),
        fecha_inicio: form.fecha,
        fecha_fin:    null,
        socios:       [],
        moneda_base:  'ARS',
        es_informal:  true,
        facturar:      form.facturar === 'SI' ? true : form.facturar === 'NO' ? false : null,
        facturar_notas: notasParts.length > 0 ? notasParts.join('\n') : null,
      });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err) ?? 'Error al guardar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Carga rápida de evento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div>
            <label className={labelCls}>Nombre del trabajo *</label>
            <input
              value={form.nombre}
              onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
              className={inputCls}
              placeholder="Vallado panal junio"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha *</label>
              <input
                type="date"
                value={form.fecha}
                onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Tipo de trabajo</label>
              <input
                list="tipos-trabajo-sugeridos"
                value={form.tipo_trabajo}
                onChange={e => setForm(p => ({ ...p, tipo_trabajo: e.target.value }))}
                className={inputCls}
                placeholder="Layher, Vallado, Varios…"
              />
              <datalist id="tipos-trabajo-sugeridos">
                {TIPOS_TRABAJO_SUGERIDOS.map(t => <option key={t} value={t} />)}
              </datalist>
            </div>
          </div>

          <div>
            <label className={labelCls}>Cliente / Destino</label>
            <input
              value={form.cliente}
              onChange={e => setForm(p => ({ ...p, cliente: e.target.value }))}
              className={inputCls}
              placeholder="Club Atlético Talleres"
            />
          </div>

          <div>
            <label className={labelCls}>Referente interno</label>
            <select
              value={form.referente_id}
              onChange={e => setForm(p => ({ ...p, referente_id: e.target.value }))}
              className={inputCls}
            >
              <option value="">Sin asignar</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>¿Se factura?</label>
            <div className="flex gap-2">
              {(['SI', 'NO', 'A_DEFINIR'] as const).map(opt => (
                <Button
                  key={opt}
                  type="button"
                  size="sm"
                  variant={form.facturar === opt ? 'default' : 'outline'}
                  onClick={() => setForm(p => ({ ...p, facturar: opt }))}
                >
                  {opt === 'SI' ? 'Sí' : opt === 'NO' ? 'No' : 'A definir'}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Observaciones</label>
            <textarea
              value={form.observaciones}
              onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))}
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={createEvento.isPending}>
              {createEvento.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
