import { useState, useEffect, useRef } from 'react';
import { useBuscarClientesFacturacion } from '@/hooks/useFacturasEmitidas';
import { cn } from '@/lib/utils';
import type { CondicionCliente } from '@/types';

interface Props {
  value:      string;
  onChange:   (nombre: string) => void;
  onSelect:   (cliente_nombre: string, cliente_cuit: string | null, condicion_cliente: CondicionCliente | null) => void;
  className?: string;
}

// Combobox de cliente: siempre en modo búsqueda/texto libre (a diferencia de
// ProveedorCombobox no hay un "seleccionado" con chip — cliente_nombre es un
// campo de texto suelto, no una FK). Reutiliza el mismo debounce de 300ms +
// cierre al click afuera que ProveedorCombobox, contra
// GET /facturas-emitidas/clientes (facturas anteriores, no un ABM de clientes).
export default function ClienteCombobox({ value, onChange, onSelect, className }: Props) {
  const [open,    setOpen]    = useState(false);
  const [results, setResults] = useState<Awaited<ReturnType<ReturnType<typeof useBuscarClientesFacturacion>>>>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buscar = useBuscarClientesFacturacion();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      const data = await buscar(value);
      setResults(data);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Nombre o razón social del cliente"
        className="w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 mt-0.5 w-full rounded-md border border-border bg-white shadow-lg max-h-48 overflow-y-auto">
          {results.map(r => (
            <button
              key={r.cliente_nombre}
              type="button"
              onClick={() => {
                onSelect(r.cliente_nombre, r.cliente_cuit, r.condicion_cliente);
                setOpen(false);
                setResults([]);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              <div className="font-medium truncate">{r.cliente_nombre}</div>
              {r.cliente_cuit && <div className="text-xs text-muted-foreground font-mono">{r.cliente_cuit}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
