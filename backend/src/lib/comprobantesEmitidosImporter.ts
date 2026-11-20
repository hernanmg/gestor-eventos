import * as XLSX from 'xlsx';
import type { TipoComprobanteEmitido, EstadoFacturaEmitida, Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { withTenant } from './tenant';
import { registrarAuditoria } from './auditoria';
import { parseTipoComprobante, parseFechaLibro, parseImporte, esNotaCredito, formatCuit } from './libroComprasImporter';

// ── Importador de "Mis Comprobantes Emitidos" de AFIP (facturas de venta) ─────
// Acepta dos formatos, reconocidos por los encabezados de cada hoja:
//  1. La planilla de Mayra (docs/dos57/mayra/FACTURAS DE VENTAS): una hoja por
//     mes con el export de AFIP más columnas propias de cobranza —
//     Fecha de Factura | Tipo de Factura | Punto de Venta | Número | Cuit Cliente |
//     Denominación Receptor | Imp. Neto Gravado | IVA | Imp. Total | Responsable Venta |
//     Forma de Pago | Condición de Plazo | Situación Cliente | Contacto Cliente |
//     Fecha Ingreso Pago | Donde Ingresó Pago | Observaciones
//     y una hoja CONCILIACIÓN con la columna "Situación Factura" (PENDIENTE DE PAGO).
//  2. El export crudo de AFIP: Fecha (de Emisión) | Tipo (de Comprobante) | Punto de
//     Venta | Número Desde | Número Hasta | Cód. Autorización | Tipo/Nro. Doc. Receptor |
//     Denominación Receptor | Tipo Cambio | Moneda | Imp. Neto Gravado | … | IVA | Imp. Total
//
// Reglas de cobro (sólo formato 1):
//  - En CONCILIACIÓN como pendiente → sin cobrar; si las observaciones traen
//    "pago parcial $X …", se registra un cobro parcial por la suma de los $.
//  - Con fecha de ingreso (o "cobrado …") y no pendiente → cobrada por el total.
//    Lo que ingresó al banco va en las notas del cobro (la diferencia suele ser
//    retenciones, o un pago conjunto con otras facturas).
//  - Sin cobro y con "NC nn" en observaciones → anulada por nota de crédito.
// Los cobros no mueven ninguna caja (igual que el cobro manual).
// Reimportar no duplica: clave tipo + punto de venta + número. A una factura que
// ya existe sólo se le completan campos vacíos y, si no tiene cobros, el cobro.
// Las notas de crédito del export crudo no se cargan como factura: se listan
// para aplicarlas a mano sobre la factura que anulan.

const norm = (s: unknown) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const r2 = (n: number) => Math.round(n * 100) / 100;
const digitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');

type Campo =
  | 'fecha' | 'tipo' | 'pv' | 'numero' | 'cuit' | 'nombre' | 'moneda' | 'tipo_cambio'
  | 'neto' | 'no_gravado' | 'exento' | 'otros' | 'iva' | 'total'
  | 'responsable' | 'forma_pago' | 'plazo' | 'situacion_cliente' | 'contacto'
  | 'fecha_ingreso' | 'donde_ingreso' | 'observaciones' | 'situacion_factura';

// Encabezado normalizado → campo. El primero que aparece gana.
const ALIAS: [Campo, string[]][] = [
  ['fecha',             ['fecha de factura', 'fecha de emision', 'fecha']],
  ['tipo',              ['tipo de factura', 'tipo de comprobante', 'tipo']],
  ['pv',                ['punto de venta']],
  ['numero',            ['numero', 'numero desde', 'nro', 'nro.']],
  ['cuit',              ['cuit cliente', 'nro. doc. receptor', 'nro doc receptor', 'cuit']],
  ['nombre',            ['denominacion receptor', 'denominacion cliente', 'cliente']],
  ['moneda',            ['moneda']],
  ['tipo_cambio',       ['tipo cambio', 'tipo de cambio']],
  ['neto',              ['imp. neto gravado', 'neto gravado', 'imp. neto gravado total']],
  ['no_gravado',        ['imp. neto no gravado', 'neto no gravado', 'no gravado']],
  ['exento',            ['imp. op. exentas', 'exento', 'op. exentas']],
  ['otros',             ['otros tributos']],
  ['iva',               ['iva', 'total iva']],
  ['total',             ['imp. total', 'total']],
  ['responsable',       ['responsable venta']],
  ['forma_pago',        ['forma de pago']],
  ['plazo',             ['condicion de plazo']],
  ['situacion_cliente', ['situacion cliente']],
  ['contacto',          ['contacto cliente']],
  ['fecha_ingreso',     ['fecha ingreso pago', 'fecha de cobro']],
  ['donde_ingreso',     ['donde ingreso pago']],
  ['observaciones',     ['observaciones']],
  ['situacion_factura', ['situacion factura']],
];

function mapearEncabezados(fila: unknown[]): Partial<Record<Campo, number>> {
  const cols: Partial<Record<Campo, number>> = {};
  const headers = fila.map(norm);
  for (const [campo, alias] of ALIAS) {
    for (const a of alias) {
      const i = headers.findIndex((h, idx) => h === a && !Object.values(cols).includes(idx));
      if (i >= 0) { cols[campo] = i; break; }
    }
  }
  return cols;
}

export interface FilaEmitida {
  hoja:          string;
  fila_excel:    number;
  fecha:         Date;
  tipo_texto:    string;
  tipo:          TipoComprobanteEmitido;
  punto_venta:   number;
  numero:        string;        // 8 dígitos
  cuit:          string | null; // sólo dígitos
  nombre:        string;
  moneda:        'ARS' | 'USD' | 'EUR';
  tipo_cambio:   number | null;
  neto:          number | null;
  iva:           number | null;
  otros:         number | null;
  total:         number;
  forma_pago:    string | null;
  fecha_ingreso: Date | null;
  texto_ingreso: string | null; // "xx/xx/xxxx" u otro texto en la columna de fecha
  donde_ingreso: string | null;
  observaciones: string | null;
  extra:         string[];      // responsable, plazo, contacto… si vinieran
  formato:       'PLANILLA' | 'AFIP';
}

export interface ErrorFilaEmitida { hoja: string; fila_excel: number; motivo: string }

const clave = (tipo: string, pv: number, numero: string) => `${tipo}|${pv}|${Number(numero)}`;

function parseMoneda(v: unknown): 'ARS' | 'USD' | 'EUR' | null {
  const s = String(v ?? '').trim().toUpperCase();
  if (!s || s === '$' || s === 'ARS' || s === 'PES' || s === 'PESOS') return 'ARS';
  if (s === 'USD' || s === 'DOL' || s.startsWith('DOLAR') || s === 'U$S') return 'USD';
  if (s === 'EUR' || s === '060') return 'EUR';
  return null;
}

export function parseComprobantesEmitidos(buffer: Buffer, nombreArchivo = '') {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const filas: FilaEmitida[] = [];
  const errores: ErrorFilaEmitida[] = [];
  const pendientes = new Set<string>(); // clave → pendiente de pago (hoja CONCILIACIÓN)
  const hojas_leidas: string[] = [];
  let cuitArchivo: string | null = nombreArchivo.match(/CUIT\s*(\d{11})/i)?.[1] ?? null;

  for (const nombre of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nombre], { header: 1, defval: '', raw: true });
    if (!cuitArchivo) {
      for (const r of rows.slice(0, 3)) {
        const m = r.map(String).join(' ').match(/CUIT\s*:?\s*(\d{2}-?\d{8}-?\d)/i);
        if (m) { cuitArchivo = digitos(m[1]); break; }
      }
    }
    const hIdx = rows.slice(0, 10).findIndex(r => {
      const c = mapearEncabezados(r);
      return c.fecha !== undefined && c.nombre !== undefined && c.total !== undefined;
    });
    if (hIdx < 0) continue;
    const cols = mapearEncabezados(rows[hIdx]);
    const get = (r: unknown[], c: Campo) => (cols[c] === undefined ? '' : r[cols[c]!]);
    const txt = (r: unknown[], c: Campo) => String(get(r, c) ?? '').trim() || null;
    hojas_leidas.push(nombre);
    const formato: FilaEmitida['formato'] = cols.fecha_ingreso !== undefined || cols.observaciones !== undefined ? 'PLANILLA' : 'AFIP';

    for (let i = hIdx + 1; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const fila_excel = i + 1;
      const fechaRaw = get(r, 'fecha');
      if (fechaRaw === '' || fechaRaw == null) continue; // totales, "ACTUALIZADO …", filas vacías
      const err = (motivo: string) => errores.push({ hoja: nombre, fila_excel, motivo });

      const tipo_texto = String(get(r, 'tipo') ?? '').trim();
      const { tipo } = parseTipoComprobante(tipo_texto);
      const pv = Number(digitos(get(r, 'pv')));
      const nro = digitos(get(r, 'numero'));
      const fecha = parseFechaLibro(fechaRaw);

      // Hoja de conciliación: sólo marca qué está pendiente (las facturas ya están en su mes).
      if (cols.situacion_factura !== undefined) {
        if (tipo && pv && nro && /pendiente/i.test(String(get(r, 'situacion_factura')))) pendientes.add(clave(tipo, pv, nro));
        continue;
      }

      if (!fecha) { err(`Fecha inválida: "${fechaRaw}"`); continue; }
      if (!tipo) { err(`Tipo de comprobante no reconocido: "${tipo_texto}"`); continue; }
      if (!pv || !nro) { err('Falta punto de venta o número'); continue; }
      const totalRaw = parseImporte(get(r, 'total'));
      if (totalRaw === null || totalRaw === 0) { err(`Total inválido: "${get(r, 'total')}"`); continue; }
      const moneda = parseMoneda(get(r, 'moneda'));
      if (!moneda) { err(`Moneda no reconocida: "${get(r, 'moneda')}"`); continue; }
      const cuit = digitos(get(r, 'cuit'));
      const ingresoRaw = get(r, 'fecha_ingreso');
      const fecha_ingreso = ingresoRaw === '' ? null : parseFechaLibro(ingresoRaw);
      const extra: string[] = [];
      for (const [c, rot] of [['responsable', 'Responsable de la venta'], ['plazo', 'Condición de plazo'], ['situacion_cliente', 'Situación del cliente'], ['contacto', 'Contacto']] as [Campo, string][]) {
        const v = txt(r, c);
        if (v) extra.push(`${rot}: ${v}`);
      }
      const num = (c: Campo) => { const n = parseImporte(get(r, c)); return n === null ? null : r2(Math.abs(n)); };
      const otros = [num('no_gravado'), num('exento'), num('otros')].reduce<number | null>((s, n) => (n ? (s ?? 0) + n : s), null);

      filas.push({
        hoja: nombre, fila_excel, fecha, tipo_texto, tipo,
        punto_venta: pv, numero: nro.padStart(8, '0'),
        cuit: cuit.length === 11 ? cuit : null,
        nombre: String(get(r, 'nombre') ?? '').trim() || '(sin nombre)',
        moneda,
        tipo_cambio: moneda === 'ARS' ? null : parseImporte(get(r, 'tipo_cambio')),
        neto: num('neto'), iva: num('iva'), otros: otros === null ? null : r2(otros),
        total: r2(Math.abs(totalRaw)),
        forma_pago: txt(r, 'forma_pago'),
        fecha_ingreso,
        texto_ingreso: ingresoRaw !== '' && !fecha_ingreso ? String(ingresoRaw).trim() : null,
        donde_ingreso: txt(r, 'donde_ingreso'),
        observaciones: txt(r, 'observaciones'),
        extra,
        formato,
      });
    }
  }
  return { filas, errores, pendientes, hojas_leidas, cuit_archivo: cuitArchivo };
}

// ── Interpretación del cobro (planilla de Mayra) ──────────────────────────────

export interface CobroPlan {
  estado:      EstadoFacturaEmitida;
  monto:       number | null;  // cobro a registrar (null = ninguno)
  fecha:       Date | null;
  forma_cobro: string | null;
  notas:       string | null;
  motivo:      string;         // explicación para la vista previa
}

const fmt = (n: number) => '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// "$10.000.000" / "$ 7.763.172,00" → número. Sólo montos precedidos por $.
function montosConPeso(s: string): number[] {
  return [...s.matchAll(/\$\s?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/g)]
    .map(m => Number(m[1].replace(/\./g, '').replace(',', '.')))
    .filter(n => n > 0);
}

function formaCobro(obs: string | null): string | null {
  if (!obs) return null;
  if (/e-?\s?cheq/i.test(obs)) return 'Echeq';
  if (/cheque/i.test(obs)) return 'Cheque';
  if (/^\$?\s?[\d.,]+$/.test(obs.trim())) return 'Transferencia';
  return null;
}

export function planCobro(f: FilaEmitida, pendiente: boolean): CobroPlan {
  const obs = f.observaciones;
  const donde = f.donde_ingreso ? `Ingresó en: ${f.donde_ingreso}` : null;
  if (f.formato === 'AFIP') return { estado: 'EMITIDA', monto: null, fecha: null, forma_cobro: null, notas: null, motivo: 'El export de AFIP no trae cobros' };

  if (pendiente) {
    const parcial = obs && /parcial/i.test(obs) ? r2(montosConPeso(obs).reduce((s, n) => s + n, 0)) : 0;
    if (parcial > 0 && parcial < f.total - 1) {
      return {
        estado: 'COBRADA_PARCIAL', monto: parcial, fecha: f.fecha_ingreso ?? f.fecha, forma_cobro: formaCobro(obs),
        notas: [obs && `Planilla: ${obs}`, donde].filter(Boolean).join(' · ') || null,
        motivo: `Pendiente en la conciliación, con pagos parciales por ${fmt(parcial)}`,
      };
    }
    return { estado: 'EMITIDA', monto: null, fecha: null, forma_cobro: null, notas: null, motivo: 'Pendiente de pago en la conciliación' };
  }

  const cobradoTexto = !!obs && /cobrad/i.test(obs);
  if (f.fecha_ingreso || cobradoTexto || f.texto_ingreso) {
    const notas: string[] = [];
    const soloNumero = obs && /^\$?\s?[\d.,]+$/.test(obs.trim()) ? parseImporte(obs.replace('$', '').trim()) : null;
    if (soloNumero !== null) {
      const dif = r2(f.total - soloNumero);
      notas.push(`Ingresó ${fmt(soloNumero)}` + (dif > 1 ? ` (${fmt(dif)} menos: retenciones u otros descuentos)` : dif < -1 ? ' (pago conjunto con otras facturas)' : ''));
    } else if (obs) {
      notas.push(`Planilla: ${obs}`);
    }
    if (donde) notas.push(donde);
    if (!f.fecha_ingreso) notas.push('Fecha de cobro no informada en la planilla (se usa la de la factura)');
    return {
      estado: 'COBRADA', monto: f.total, fecha: f.fecha_ingreso ?? f.fecha, forma_cobro: formaCobro(obs),
      notas: notas.join(' · '), motivo: 'Cobrada según la planilla',
    };
  }

  if (obs && /\bN\.?\s?C\.?\s*\d+/i.test(obs)) {
    return { estado: 'ANULADA', monto: null, fecha: null, forma_cobro: null, notas: null, motivo: `Anulada con nota de crédito (${obs})` };
  }
  return { estado: 'EMITIDA', monto: null, fecha: null, forma_cobro: null, notas: null, motivo: 'Sin datos de cobro' };
}

// ── Proceso (vista previa o aplicar) ──────────────────────────────────────────

export interface ResultadoEmitidas {
  preview:        boolean;
  formato:        'PLANILLA' | 'AFIP' | 'MIXTO' | null;
  hojas_leidas:   string[];
  cuit_archivo:   string | null;
  total_filas:    number;
  creadas:        number;
  actualizadas:   number;
  sin_cambios:    number;
  cobros_nuevos:  number;
  por_estado:     Record<string, number>;
  total_facturado: number;
  pendientes:     { numero: string; cliente: string; total: number; cobrado: number; motivo: string }[];
  anuladas:       { numero: string; cliente: string; total: number; motivo: string }[];
  notas_credito:  { numero: string; cliente: string; total: number; fecha: string }[];
  duplicadas_en_archivo: number;
  errores:        ErrorFilaEmitida[];
}

const etiqueta = (f: { tipo_texto: string; punto_venta: number; numero: string }) =>
  `${f.tipo_texto.replace(/^\d+\s*-\s*/, '')} ${String(f.punto_venta).padStart(5, '0')}-${f.numero}`;

export async function procesarComprobantesEmitidos(
  buffer: Buffer, nombreArchivo: string, empresaId: number, usuarioId: number, aplicar: boolean, cuitEmpresa: string | null,
): Promise<ResultadoEmitidas> {
  const { filas, errores, pendientes, hojas_leidas, cuit_archivo } = parseComprobantesEmitidos(buffer, nombreArchivo);
  if (hojas_leidas.length === 0) throw new Error('No se encontró ninguna hoja con los encabezados de comprobantes (Fecha, Denominación Receptor, Imp. Total)');
  if (cuit_archivo && cuitEmpresa && digitos(cuitEmpresa) !== cuit_archivo) {
    throw new Error(`El archivo es del CUIT ${formatCuit(cuit_archivo)} y la empresa activa tiene el CUIT ${cuitEmpresa}. Cambiá de empresa antes de importar.`);
  }

  const formatos = new Set(filas.map(f => f.formato));
  const res: ResultadoEmitidas = {
    preview: !aplicar,
    formato: formatos.size === 0 ? null : formatos.size > 1 ? 'MIXTO' : [...formatos][0],
    hojas_leidas, cuit_archivo,
    total_filas: filas.length,
    creadas: 0, actualizadas: 0, sin_cambios: 0, cobros_nuevos: 0,
    por_estado: {}, total_facturado: 0,
    pendientes: [], anuladas: [], notas_credito: [],
    duplicadas_en_archivo: 0, errores,
  };

  const existentes = await prisma.facturaEmitida.findMany({
    where: { ...withTenant(empresaId), deleted_at: null },
    select: {
      id: true, tipo_comprobante: true, punto_venta: true, numero: true, estado: true,
      cliente_cuit: true, neto_gravado: true, iva: true, otros_impuestos: true, observaciones: true, forma_pago: true,
      _count: { select: { cobros: true } },
    },
  });
  const porClave = new Map(existentes.filter(e => e.numero && digitos(e.numero)).map(e => [clave(e.tipo_comprobante, e.punto_venta, digitos(e.numero)), e]));
  const vistas = new Set<string>();

  type Accion = { f: FilaEmitida; plan: CobroPlan; existente?: (typeof existentes)[number]; cambios?: Prisma.FacturaEmitidaUpdateInput; cobrar: boolean };
  const acciones: Accion[] = [];

  for (const f of filas) {
    const k = clave(f.tipo, f.punto_venta, f.numero);
    if (vistas.has(k)) { res.duplicadas_en_archivo++; continue; }
    vistas.add(k);

    if (esNotaCredito(f.tipo)) {
      res.notas_credito.push({ numero: etiqueta(f), cliente: f.nombre, total: f.total, fecha: f.fecha.toISOString().slice(0, 10) });
      continue;
    }
    const plan = planCobro(f, pendientes.has(k));
    res.por_estado[plan.estado] = (res.por_estado[plan.estado] ?? 0) + 1;
    if (plan.estado !== 'ANULADA') res.total_facturado = r2(res.total_facturado + f.total);
    if (plan.estado === 'EMITIDA' || plan.estado === 'COBRADA_PARCIAL') {
      res.pendientes.push({ numero: etiqueta(f), cliente: f.nombre, total: f.total, cobrado: plan.monto ?? 0, motivo: plan.motivo });
    }
    if (plan.estado === 'ANULADA') res.anuladas.push({ numero: etiqueta(f), cliente: f.nombre, total: f.total, motivo: plan.motivo });

    const e = porClave.get(k);
    if (!e) { res.creadas++; if (plan.monto) res.cobros_nuevos++; acciones.push({ f, plan, cobrar: !!plan.monto }); continue; }

    // Existente: completar lo vacío; el cobro sólo si todavía no tiene ninguno y está EMITIDA.
    const cambios: Prisma.FacturaEmitidaUpdateInput = {};
    if (!e.cliente_cuit && f.cuit) cambios.cliente_cuit = formatCuit(f.cuit);
    if (e.neto_gravado == null && f.neto != null) cambios.neto_gravado = f.neto;
    if (e.iva == null && f.iva != null) cambios.iva = f.iva;
    if (e.otros_impuestos == null && f.otros != null) cambios.otros_impuestos = f.otros;
    if (!e.forma_pago && f.forma_pago) cambios.forma_pago = f.forma_pago;
    if (!e.observaciones && (f.observaciones || f.extra.length)) cambios.observaciones = [f.observaciones, ...f.extra].filter(Boolean).join('\n');
    const cobrar = !!plan.monto && e._count.cobros === 0 && e.estado === 'EMITIDA';
    const anular = plan.estado === 'ANULADA' && e.estado === 'EMITIDA' && e._count.cobros === 0;
    if (anular) cambios.estado = 'ANULADA';
    if (Object.keys(cambios).length || cobrar) {
      res.actualizadas++;
      if (cobrar) res.cobros_nuevos++;
      acciones.push({ f, plan, existente: e, cambios, cobrar });
    } else {
      res.sin_cambios++;
    }
  }

  if (!aplicar) return res;

  await prisma.$transaction(async tx => {
    for (const a of acciones) {
      const { f, plan } = a;
      let id: number;
      if (!a.existente) {
        const creada = await tx.facturaEmitida.create({
          data: {
            ...withTenant(empresaId),
            tipo_comprobante: f.tipo,
            punto_venta: f.punto_venta,
            numero: f.numero,
            fecha_emision: f.fecha,
            cliente_nombre: f.nombre,
            cliente_cuit: f.cuit ? formatCuit(f.cuit) : null,
            neto_gravado: f.neto, iva: f.iva, otros_impuestos: f.otros,
            total: f.total,
            moneda: f.moneda,
            tasa_cambio: f.tipo_cambio,
            total_ars: f.moneda === 'ARS' ? f.total : (f.tipo_cambio ? r2(f.total * f.tipo_cambio) : null),
            forma_pago: f.forma_pago,
            estado: plan.estado === 'ANULADA' ? 'ANULADA' : 'EMITIDA',
            observaciones: [f.observaciones, ...f.extra, plan.estado === 'ANULADA' ? plan.motivo : null].filter(Boolean).join('\n') || null,
            created_by: usuarioId, updated_by: usuarioId,
          },
        });
        id = creada.id;
      } else {
        id = a.existente.id;
        if (a.cambios && Object.keys(a.cambios).length) {
          await tx.facturaEmitida.update({ where: { id }, data: { ...a.cambios, updated_by: usuarioId } });
        }
      }
      if (a.cobrar && plan.monto) {
        await tx.cobroFacturaEmitida.create({
          data: {
            factura_emitida_id: id, fecha: plan.fecha!, monto: plan.monto, moneda: f.moneda,
            forma_cobro: plan.forma_cobro, notas: plan.notas, created_by: usuarioId,
          },
        });
        await tx.facturaEmitida.update({ where: { id }, data: { estado: plan.estado } });
      }
    }
    await registrarAuditoria({
      usuarioId, empresaId, accion: 'IMPORT', entidad: 'FacturaEmitida',
      descripcion: `Importación de comprobantes emitidos (${nombreArchivo}): ${res.creadas} nuevas, ${res.actualizadas} actualizadas, ${res.cobros_nuevos} cobros`,
      datosDespues: { creadas: res.creadas, actualizadas: res.actualizadas, cobros: res.cobros_nuevos, hojas: hojas_leidas },
      tx: tx as any,
    });
  }, { timeout: 60_000 });

  return res;
}
