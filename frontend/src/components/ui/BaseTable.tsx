import { forwardRef, useCallback, useEffect, useRef } from 'react';
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
//
// En mobile (< 768px) cada fila se apila como una card (index.css): el header
// se oculta y cada celda muestra arriba el nombre de su columna. Ese nombre se
// copia del <thead> a `data-label` de cada <td> acá, teniendo en cuenta colSpan,
// así ninguna página tiene que repetirlo. Una celda que ya trae su propio
// `data-label` se respeta. Para mantener el scroll horizontal en una tabla
// puntual: className="card-table-scroll".
function aplicarEtiquetas(table: HTMLTableElement) {
  const headRow = table.tHead?.rows[table.tHead.rows.length - 1];
  if (!headRow) return;
  const labels: string[] = [];
  for (const th of Array.from(headRow.cells)) {
    const raw = (th.textContent ?? '').trim();
    // "Acciones" no aporta como etiqueta: los íconos ya se entienden solos.
    const text = /^acciones?$/i.test(raw) ? '' : raw;
    for (let i = 0; i < th.colSpan; i++) labels.push(text);
  }
  const rows = [...Array.from(table.tBodies).flatMap(b => Array.from(b.rows)), ...(table.tFoot ? Array.from(table.tFoot.rows) : [])];
  for (const tr of rows) {
    let col = 0;
    for (const td of Array.from(tr.cells)) {
      if (td.dataset.labelAuto !== undefined || td.dataset.label === undefined) {
        const label = td.colSpan > 1 ? '' : (labels[col] ?? '');
        if (td.dataset.label !== label) td.dataset.label = label;
        td.dataset.labelAuto = '';
      }
      col += td.colSpan;
    }
  }
}

const BaseTable = forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(
  ({ className, style, ...props }, ref) => {
    const innerRef = useRef<HTMLTableElement | null>(null);
    const setRefs = useCallback((el: HTMLTableElement | null) => {
      innerRef.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    }, [ref]);

    // Filas que agregan componentes hijos (o queries que llegan después) no
    // re-renderizan BaseTable: se observan los cambios de estructura. Escribir
    // data-label es un cambio de atributo, no de hijos, así que no realimenta.
    useEffect(() => {
      const table = innerRef.current;
      if (!table) return;
      aplicarEtiquetas(table);
      const obs = new MutationObserver(() => aplicarEtiquetas(table));
      obs.observe(table, { childList: true, subtree: true, characterData: true });
      return () => obs.disconnect();
    }, []);

    return (
      <table
        ref={setRefs}
        className={cn('card-table', className)}
        style={{ borderCollapse: 'separate', borderSpacing: '0 4px', ...style }}
        {...props}
      />
    );
  },
);
BaseTable.displayName = 'BaseTable';

export default BaseTable;
