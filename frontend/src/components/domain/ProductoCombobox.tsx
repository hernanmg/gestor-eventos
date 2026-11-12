import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useProductos } from '@/hooks/useStock';
import { cn } from '@/lib/utils';

export interface ProductoLite {
  id:     number;
  nombre: string;
}

interface Props {
  value:    ProductoLite | null;
  onChange: (v: ProductoLite | null) => void;
  className?: string;
}

export default function ProductoCombobox({ value, onChange, className }: Props) {
  const [query, setQuery]         = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen]           = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: productos = [] } = useProductos({ search: debounced.length >= 2 ? debounced : undefined });
  const results = debounced.length >= 2 ? productos : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (value) {
    return (
      <div className={cn('flex items-center gap-1 min-w-0', className)}>
        <span className="text-sm truncate max-w-[220px]" title={value.nombre}>{value.nombre}</span>
        <button
          onClick={() => onChange(null)}
          className="shrink-0 text-muted-foreground hover:text-destructive p-0.5 rounded transition"
          title="Cambiar producto"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar producto…"
        className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 mt-0.5 w-72 rounded-lg border border-border bg-white shadow-lg max-h-56 overflow-y-auto">
          {results.map(p => (
            <button
              key={p.id}
              onClick={() => {
                onChange({ id: p.id, nombre: p.nombre });
                setOpen(false);
                setQuery('');
              }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition"
            >
              <div className="font-medium truncate">
                {p.nombre}
                {p.codigo_interno && <span className="text-muted-foreground ml-1">({p.codigo_interno})</span>}
              </div>
              <div className="text-muted-foreground">Disponible hoy: {p.disponible_hoy ?? p.stock_total}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
