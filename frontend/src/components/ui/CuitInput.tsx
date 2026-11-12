import { useState } from 'react';
import { cn } from '@/lib/utils';

// Formatea dígitos sueltos al patrón CUIT/CUIL: XX-XXXXXXXX-X — se aplica
// tanto mientras se escribe como al pegar un valor sin formato.
export function formatCuit(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 10) return digits.slice(0, 2) + '-' + digits.slice(2);
  return digits.slice(0, 2) + '-' + digits.slice(2, 10) + '-' + digits.slice(10);
}

export function isValidCuit(value: string): boolean {
  return value.replace(/\D/g, '').length === 11;
}

interface CuitInputProps {
  // String con o sin formato — el mismo formato que el resto de los forms ya
  // usa para mandar en el payload ("20-12345678-3").
  value:        string;
  onChange:     (v: string) => void;
  placeholder?: string;
  className?:   string;
  disabled?:    boolean;
  required?:    boolean;
  id?:          string;
  // Cuando el form ya muestra su propio error (p.ej. validación zod en submit),
  // pasar false para no duplicar el mensaje debajo del input.
  showOwnError?: boolean;
}

// Input de CUIT/CUIL — formatea en vivo mientras se escribe o pega (dígitos
// sueltos → XX-XXXXXXXX-X) y valida 11 dígitos al perder el foco. Sirve para
// CUIT (empresas) y CUIL (personas): mismo formato, misma validación.
export default function CuitInput({
  value, onChange, placeholder, className, disabled, required, id, showOwnError = true,
}: CuitInputProps) {
  const [touched, setTouched] = useState(false);

  const showError = showOwnError && touched && value !== '' && !isValidCuit(value);
  const showRequiredError = showOwnError && touched && required && value === '';

  return (
    <div>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={value}
        placeholder={placeholder ?? '20-12345678-3'}
        disabled={disabled}
        required={required}
        onChange={e => onChange(formatCuit(e.target.value))}
        onPaste={e => {
          e.preventDefault();
          const pasted = e.clipboardData.getData('text');
          onChange(formatCuit(pasted));
        }}
        onBlur={() => setTouched(true)}
        className={cn(
          'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring',
          (showError || showRequiredError) && 'border-destructive focus:ring-destructive',
          className,
        )}
      />
      {showError && (
        <p className="text-xs text-destructive mt-0.5">El CUIT/CUIL debe tener 11 dígitos</p>
      )}
      {showRequiredError && (
        <p className="text-xs text-destructive mt-0.5">Requerido</p>
      )}
    </div>
  );
}
