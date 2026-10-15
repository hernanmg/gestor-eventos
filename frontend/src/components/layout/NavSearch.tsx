import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { groupNav, type NavItem } from './navConfig';

// Buscador de módulos (Ctrl K / ⌘K): lista los mismos ítems que el menú del
// usuario, agrupados por área, y navega a la ruta elegida.
export default function NavSearch({ items, open, onOpenChange }: {
  items:        NavItem[];
  open:         boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-xl border border-border bg-popover shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Buscar módulo</DialogPrimitive.Title>
          <Command>
            <CommandInput placeholder="Buscar módulo…" className="h-12 text-base" />
            <CommandList className="max-h-[60vh] p-1">
              <CommandEmpty>No hay módulos con ese nombre.</CommandEmpty>
              {groupNav(items).map(g => (
                <CommandGroup key={g.id} heading={g.label}>
                  {g.items.map(it => (
                    <CommandItem
                      key={it.to}
                      value={`${it.label} ${g.label}`}
                      onSelect={() => { onOpenChange(false); navigate(it.to); }}
                      className="gap-3"
                    >
                      <it.icon size={16} className="shrink-0 text-muted-foreground" />
                      <span className="flex-1">{it.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
