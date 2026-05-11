// Shared utilities for PDF templates

export const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10pt;
  color: #1f2937;
  line-height: 1.4;
}
h1 { font-size: 20pt; color: #111827; margin-bottom: 0.4rem; }
h2 { font-size: 13pt; color: #111827; margin-bottom: 0.4rem;
     padding-bottom: 4px; border-bottom: 2px solid #374151; }
h3 { font-size: 11pt; color: #374151; margin-bottom: 0.3rem; }
h4 { font-size: 10pt; color: #374151; margin-bottom: 0.3rem; }

table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 0.8rem; }
thead th {
  background: #374151;
  color: #fff;
  padding: 5px 8px;
  text-align: left;
  font-weight: 600;
}
tbody td { padding: 3px 8px; border-bottom: 1px solid #e5e7eb; }
tbody tr:nth-child(even) td { background: #f9fafb; }
tfoot td {
  padding: 5px 8px;
  border-top: 2px solid #374151;
  font-weight: 700;
  background: #f3f4f6;
}

.text-right  { text-align: right; }
.text-center { text-align: center; }
.positive    { color: #16a34a; font-weight: 600; }
.negative    { color: #dc2626; font-weight: 600; }
.muted       { color: #6b7280; }
.bold        { font-weight: 700; }

.section      { margin-bottom: 1.5rem; }
.page-break   { page-break-after: always; }
.no-break     { page-break-inside: avoid; }

.badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 9999px;
  font-size: 8.5pt;
  font-weight: 600;
}
.badge-ACTIVO    { background: #dcfce7; color: #16a34a; }
.badge-CERRADO   { background: #fee2e2; color: #dc2626; }
.badge-IMPORTADO { background: #dbeafe; color: #2563eb; }

.saldo-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 14px;
  border-radius: 6px;
  font-weight: 700;
  margin: 0.5rem 0;
}
.saldo-pos { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
.saldo-neg { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
.saldo-zero { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }

.info-grid { display: flex; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 0.8rem; font-size: 9pt; }
.info-grid span { color: #6b7280; }
.info-grid strong { color: #111827; }

.transfer-icon { color: #6b7280; font-size: 8pt; }

@media print {
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  tbody tr  { page-break-inside: avoid; }
  thead     { display: table-header-group; }
  tfoot     { display: table-footer-group; }
  h2, h3, h4 { page-break-after: avoid; }
}
`;

export const esc = (s: string | null | undefined): string =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const fmt = (n: number): string =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export const fmtDate = (d: Date | string | null | undefined): string => {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '—';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
};

export const saldoClass = (n: number): string =>
  n > 0 ? 'positive' : n < 0 ? 'negative' : '';

export const saldoBoxClass = (n: number): string =>
  n > 0 ? 'saldo-box saldo-pos' : n < 0 ? 'saldo-box saldo-neg' : 'saldo-box saldo-zero';

// ── Shared data types ─────────────────────────────────────────────────────────

export interface MovRow {
  fecha:                 Date | null;
  concepto:              string | null;
  descripcion:           string | null;
  debe:                  number;
  haber:                 number;
  saldo:                 number;
  impuesto_subcategoria: string | null;
}

export interface EcheqRow {
  numero:               string;
  razon_social:         string;
  detalle:              string | null;
  importe:              number;
  moneda:               string;
  fecha_emision:        Date | null;
  fecha_cobro_estimada: Date | null;
  fecha_cobro_real:     Date | null;
  estado:               string;
}

export interface TabData {
  nombre:      string;
  codigo:      string;
  tipo:        string;
  movimientos: MovRow[];
  total_debe:  number;
  total_haber: number;
  saldo_final: number;
}

export interface CajaMovRow {
  fecha:           Date | null;
  descripcion:     string | null;
  debe:            number;
  haber:           number;
  saldo_corriente: number;
  is_transfer:     boolean;
}

export interface CuentaData {
  nombre:        string;
  tipo:          string;
  moneda:        string;
  saldo_inicial: number;
  saldo_actual:  number;
  movimientos:   CajaMovRow[];
}

export interface ConcilTabRow {
  nombre:      string;
  total_debe:  number;
  total_haber: number;
  saldo:       number;
}

export interface ConcilMoneda {
  moneda:         string;
  ingresos:       ConcilTabRow[];
  egresos:        ConcilTabRow[];
  total_ingresos: number;
  total_egresos:  number;
  saldo_final:    number;
  distribucion_socios: Array<{ nombre: string; porcentaje: number; monto: number }>;
}

export interface EventoExportData {
  evento: {
    nombre:       string;
    estado:       string;
    fecha_inicio: Date | null;
    fecha_fin:    Date | null;
    socios:       Array<{ nombre: string; porcentaje: number }>;
    moneda_base:  string;
  };
  tabs:       TabData[];   // all tabs, even empty ones; filter by movimientos.length > 0 in templates
  echeqs:     EcheqRow[];
  cuentas:    CuentaData[];
  conciliatoria: { por_moneda: ConcilMoneda[] };
  fecha_generacion: Date;
}
