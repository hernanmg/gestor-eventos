import { Check, Pencil, Trash2, UserRound, Mail, IdCard } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/formatters';
import type { CortesiaEvento, CortesiaItem } from '@/hooks/useCortesias';
import { VisadoBadge, EntregadoBadge } from './badges';

const tieneInscripto = (i: CortesiaItem) => !!(i.bib_number || i.nombre_inscripto || i.apellido_inscripto || i.dni || i.email);

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{children || <span className="text-muted-foreground">—</span>}</p>
    </div>
  );
}

export default function CortesiaDrawer({ cortesia, canEdit, onClose, onEditar, onEliminar, onMarcar }: {
  cortesia: CortesiaEvento | null;
  canEdit:  boolean;
  onClose:  () => void;
  onEditar: (c: CortesiaEvento) => void;
  onEliminar: (c: CortesiaEvento) => void;
  onMarcar: (c: CortesiaEvento, campo: 'visar' | 'entregar') => void;
}) {
  const inscriptos = cortesia?.items.filter(tieneInscripto) ?? [];

  return (
    <Drawer open={cortesia !== null} onOpenChange={o => !o && onClose()}>
      <DrawerContent>
        {cortesia && (
          <div className="space-y-5">
            <div className="pr-6">
              <DrawerTitle className="text-lg font-semibold leading-snug">{cortesia.cliente_nombre}</DrawerTitle>
              <DrawerDescription className="sr-only">Detalle de la cortesía</DrawerDescription>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <VisadoBadge visado={cortesia.visado} />
                <EntregadoBadge entregado={cortesia.entregado} />
              </div>
            </div>

            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={cortesia.visado ? 'outline' : 'default'} onClick={() => onMarcar(cortesia, 'visar')}>
                  <Check size={13} className="mr-1" />{cortesia.visado ? 'Quitar visado' : 'Visar'}
                </Button>
                <Button size="sm" variant={cortesia.entregado ? 'outline' : 'default'} onClick={() => onMarcar(cortesia, 'entregar')}>
                  <Check size={13} className="mr-1" />{cortesia.entregado ? 'Quitar entrega' : 'Marcar entregado'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => onEditar(cortesia)}><Pencil size={13} className="mr-1" />Editar</Button>
                <Button size="sm" variant="outline" onClick={() => onEliminar(cortesia)} className="text-destructive"><Trash2 size={13} className="mr-1" />Eliminar</Button>
              </div>
            )}

            <section className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Dato label="Persona de contacto">{cortesia.contacto_nombre}</Dato>
              <Dato label="Autoriza">{cortesia.autorizado_por}</Dato>
              <div className="col-span-2"><Dato label="Observación">{cortesia.observacion}</Dato></div>
              <Dato label="Cargada">{formatDate(cortesia.created_at)}</Dato>
            </section>

            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Tickets · {cortesia.total}
              </p>
              <ul className="divide-y divide-border rounded-md border border-border">
                {cortesia.items.map(i => (
                  <li key={i.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{i.tipo_ticket}</span>
                    <span className="font-semibold tabular-nums">{i.cantidad}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Inscriptos vinculados · {inscriptos.length}
              </p>
              {inscriptos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todavía no hay ningún inscripto vinculado a esta cortesía.{canEdit ? ' Podés cargar sus datos desde "Editar" (ícono de persona en cada ticket).' : ''}
                </p>
              ) : (
                <ul className="space-y-2">
                  {inscriptos.map(i => (
                    <li key={i.id} className="rounded-md border border-border p-3 text-sm space-y-1">
                      <p className="font-medium flex items-center gap-1.5">
                        <UserRound size={14} className="text-muted-foreground" />
                        {[i.apellido_inscripto, i.nombre_inscripto].filter(Boolean).join(', ') || 'Sin nombre'}
                      </p>
                      <p className="text-xs text-muted-foreground">{i.tipo_ticket}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        {i.bib_number && <span><span className="text-muted-foreground">Bib</span> <span className="font-semibold">{i.bib_number}</span></span>}
                        {i.dni && <span className="flex items-center gap-1"><IdCard size={12} className="text-muted-foreground" />{i.dni}</span>}
                        {i.email && <span className="flex items-center gap-1"><Mail size={12} className="text-muted-foreground" />{i.email}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
