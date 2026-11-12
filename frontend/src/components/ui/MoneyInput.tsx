import { useEffect, useState } from 'react';
import { parseMoney } from '@/lib/formatters';
import { cn } from '@/lib/utils';

const displayFmt = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface MoneyInputProps {
  // String numérico "plano" (ej. "150000.5" o "") — el mismo formato que el
  // resto de los forms ya usa para pasar a Number(...) al enviar.
  value:        string;
  onChange:     (v: string) => void;
  placeholder?: string;
  className?:   string;
  disabled?:    boolean;
  required?:    boolean;
}

// Input de monto en convención argentina — mientras se escribe acepta coma
// decimal libremente; al perder el foco reformatea con separador de miles
// (fmtMoney/parseMoney, ver lib/formatters.ts). El valor que sube por
// onChange siempre es un string plano parseable con Number(...).
export default function MoneyInput({ value, onChange, placeholder, className, disabled, required }: MoneyInputProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');

  useEffect(() => {
    if (editing) return;
    const num = value !== '' ? Number(value) : null;
    setText(num !== null && !isNaN(num) ? displayFmt.format(num) : '');
  }, [value, editing]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      placeholder={placeholder ?? '0,00'}
      disabled={disabled}
      required={required}
      onFocus={() => {
        setEditing(true);
        setText(value !== '' ? String(value).replace('.', ',') : '');
      }}
      onChange={e => setText(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (text.trim() === '') { onChange(''); return; }
        const parsed = parseMoney(text);
        onChange(String(parsed));
      }}
      className={cn(
        'w-full border border-input rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-ring',
        className,
      )}
    />
  );
}
