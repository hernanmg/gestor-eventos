import { useState } from 'react';
import { Bell, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useGuardarTipoNovedad, useOpcionesNovedad, useTiposNovedad } from '@/hooks/useNovedades';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { TipoNovedad } from '@/types';

// Tipos de novedad de la empresa (sólo ADMIN). No se borran: se desactivan,
// así las novedades viejas conservan su tipo. "Avisar a": además del
// administrador general, quiénes reciben el aviso de las graves de ese tipo.
export default function TiposNovedadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: tipos } = useTiposNovedad();
  const { data: op } = useOpcionesNovedad(open);
  const guardar = useGuardarTipoNovedad();
  const [nuevo, setNuevo] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const g = async (p: Partial<TipoNovedad> & { id?: number }) => {
    setErr(null);
    try { await guardar.mutateAsync(p); return true; } catch (e) { setErr(getApiErrorMessage(e)); return false; }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Tipos de novedad</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Las novedades graves (alta y crítica) le llegan al administrador general y a quienes elijas en cada tipo.
          Un tipo desactivado ya no se ofrece al cargar, pero las novedades viejas lo conservan.
        </p>

        <div className="space-y-2">
          {(tipos ?? []).map(t => {
            const avisan = (op?.usuarios ?? []).filter(u => t.avisar_usuario_ids.includes(u.id));
            return (
              <div key={t.id} className={cn('flex flex-wrap items-center gap-2 rounded-xl border border-border bg-[var(--bg-card)] p-2.5 shadow-sm', !t.activo && 'opacity-60')}>
                <input type="color" value={t.color ?? '#6B7280'} onChange={e => g({ id: t.id, color: e.target.value })} className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0" title="Color" />
                <input
                  defaultValue={t.nombre}
                  onBlur={e => { const v = e.target.value.trim(); if (v && v !== t.nombre) g({ id: t.id, nombre: v }).then(ok => { if (!ok) e.target.value = t.nombre; }); }}
                  className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-medium hover:border-input focus:border-input focus:outline-none"
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8" title="Quiénes reciben el aviso de las graves">
                      <Bell size={13} className="mr-1" /> {avisan.length ? avisan.map(u => u.nombre.split(' ')[0]).join(', ') : 'Sólo admin'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="max-h-72 w-64 overflow-y-auto p-2">
                    <p className="px-1 pb-1 text-xs text-muted-foreground">Avisar de las graves de “{t.nombre}” a:</p>
                    {(op?.usuarios ?? []).filter(u => u.empresa_id !== null).map(u => {
                      const on = t.avisar_usuario_ids.includes(u.id);
                      return (
                        <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-[var(--bg-hover)]">
                          <input type="checkbox" checked={on} onChange={() => g({ id: t.id, avisar_usuario_ids: on ? t.avisar_usuario_ids.filter(x => x !== u.id) : [...t.avisar_usuario_ids, u.id] })} />
                          {u.nombre}
                        </label>
                      );
                    })}
                  </PopoverContent>
                </Popover>
                <button type="button" className="text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => g({ id: t.id, activo: !t.activo })}>
                  {t.activo ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            );
          })}
        </div>

        <form className="flex gap-2" onSubmit={async e => { e.preventDefault(); if (nuevo.trim().length >= 2 && await g({ nombre: nuevo.trim() })) setNuevo(''); }}>
          <input value={nuevo} onChange={e => setNuevo(e.target.value)} placeholder="Nuevo tipo (ej.: Seguridad)" className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          <Button type="submit" disabled={nuevo.trim().length < 2 || guardar.isPending}><Plus size={15} className="mr-1" /> Agregar</Button>
        </form>
        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{err}</p>}
      </DialogContent>
    </Dialog>
  );
}
