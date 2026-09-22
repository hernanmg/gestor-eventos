import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

// Tabla con estilo "card por fila" (ver `.card-table` en index.css): cada fila es
// una tarjeta blanca con sombra que se levanta al pasar el mouse, y el header es
// una franja gris muy suave en mayúsculas — el mismo look que Gastos del mes.
//
// Es un <table> real (no una grilla de divs), así que sigue admitiendo thead /
// tbody / tfoot, colSpan, headers sticky y celdas editables. Se usa igual que
// <table>: <BaseTable><thead>…</thead><tbody>…</tbody></BaseTable>.
//
// El separado de filas va inline a propósito: muchas tablas viejas traen la clase
// `border-collapse` de Tailwind, que como utilidad le ganaría al CSS de la clase
// y anularía el espaciado entre tarjetas.
const BaseTable = forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(
  ({ className, style, ...props }, ref) => (
    <table
      ref={ref}
      className={cn('card-table', className)}
      style={{ borderCollapse: 'separate', borderSpacing: '0 4px', ...style }}
      {...props}
    />
  ),
);
BaseTable.displayName = 'BaseTable';

export default BaseTable;
