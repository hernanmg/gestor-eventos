import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useBuscarProveedores } from '@/hooks/useProveedores';
import { cn } from '@/lib/utils';
import type { ProveedorBusqueda } from '@/types';

interface Props {
  value:    ProveedorBusqueda | null;
  onChange: (v: ProveedorBusqueda | null) => void;
  className?: string;
}

export default function ProveedorCombobox({ value, onChange, className }: Props) {
  const [query,   setQuery]   = useState('');
  const [open,    setOpen]    = useState(false);
  const [results, setResults] = useState<ProveedorBusqueda[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buscar = useBuscarProveedores();

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      const data = await buscar(query);
      setResults(data);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Click outside to close
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
        <Link
          to={`/proveedores/${value.id}`}
          className="text-xs text-primary hover:underline truncate max-w-[120px]"
          title={value.nombre}
          onClick={e => e.stopPropagation()}
        >
          {value.nombre}
        </Link>
        <button
          onClick={e => { e.stopPropagation(); onChange(null); }}
          className="shrink-0 text-muted-foreground hover:text-destructive p-0.5 rounded transition"
          title="Desvincular proveedor"
        >
          <X size={10} />
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
        onClick={e => e.stopPropagation()}
        placeholder="Proveedor…"
        className="w-full text-xs border border-transparent rounded px-1 py-0.5 focus:border-ring/50 focus:outline-none placeholder:text-muted-foreground/30 bg-transparent hover:bg-accent/30 focus:bg-white transition"
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 mt-0.5 w-56 rounded-lg border border-border bg-white shadow-lg max-h-48 overflow-y-auto">
          {results.map(r => (
            <button
              key={r.id}
              onClick={e => {
                e.stopPropagation();
                onChange(r);
                setOpen(false);
                setQuery('');
                setResults([]);
              }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition"
            >
              <div className="font-medium truncate">
                {r.nombre}
                {r.alias && <span className="text-muted-foreground ml-1">({r.alias})</span>}
              </div>
              {r.cuit && <div className="text-muted-foreground font-mono">{r.cuit}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
