import * as XLSX from 'xlsx';
import { TipoCombustible } from '@prisma/client';
import { prisma } from './prisma';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

function normalize(s: string): string {
  return s.toString().trim().toUpperCase().normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '');
}

// Las hojas de mes de la planilla real de Santi no siguen un único formato de
// nombre ("AGOSTO.2026", "Agosto 2026", "AGOSTO-2026") — se detectan por
// contener un nombre de mes en español + un año de 4 dígitos, sin importar el
// separador (ver relevamiento — [[combustible_flota_dos57]]).
function detectarHojaMes(sheetName: string): { mes: number; anio: number } | null {
  const norm = normalize(sheetName);
  const anioMatch = norm.match(/\b(20\d{2})\b/);
  if (!anioMatch) return null;
  const mesIdx = MESES.findIndex(m => norm.includes(m) || norm.includes(m.slice(0, 4)));
  if (mesIdx === -1) return null;
  return { mes: mesIdx + 1, anio: Number(anioMatch[1]) };
}

function esHojaCargasAutorizadas(sheetName: string): boolean {
  const norm = normalize(sheetName);
  return norm.includes('CARGA') && norm.includes('AUTORIZAD');
}

function excelDateToJs(value: any): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  const s = String(value).trim();
  // Formatos vistos en la planilla real: "8/3/26", "8/3/2026"
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let anio = Number(m[3]);
    if (anio < 100) anio += 2000;
    return new Date(Date.UTC(anio, Number(m[1]) - 1, Number(m[2])));
  }
  return null;
}

function toNumber(value: any): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3},)/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function normalizeDominio(s: string): string {
  return s.toString().trim().toUpperCase().replace(/\s+/g, '');
}

// monto_total/pagos/saldo son Decimal(x,2) en la DB — se redondea acá para
// que el fallback de deduplicación por conteo compare contra el mismo valor
// que termina persistido.
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// litros es Decimal(10,3) — 3 decimales, igual que la planilla real (ej.
// 781,103 L).
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// Fila de cierre del mes — no es un movimiento, se ignora.
const VEHICULO_IGNORAR = ['TOTAL'];

export interface ImportResultado {
  hojas_procesadas:    number;
  creados:             number;
  omitidos:            number;
  actualizados:        number;
  errores:             string[];
  vehiculos_creados:   { codigo: string; patente: string }[];
  vehiculos_vinculados: number;
}

// Registro compartido de vehículos durante todo el import — resuelve por
// patente/código, y si no existe lo crea automáticamente (FIX pedido por
// Santi: no debería hacer falta cargar la flota a mano antes de importar).
// Trackea qué vehículos son nuevos de este run (vehiculos_creados) vs. cuáles
// ya existían y sólo recibieron cargas (vehiculos_vinculados).
class RegistroVehiculos {
  private porPatente = new Map<string, { id: number; codigo: string; patente: string | null }>();
  private porCodigo  = new Map<string, { id: number; codigo: string; patente: string | null }>();
  private vinculados = new Set<number>();
  readonly creados: { codigo: string; patente: string }[] = [];

  constructor(private empresaId: number, camiones: { id: number; codigo: string; patente: string | null }[]) {
    for (const c of camiones) this.indexar(c);
  }

  private indexar(c: { id: number; codigo: string; patente: string | null }) {
    if (c.patente) this.porPatente.set(normalizeDominio(c.patente), c);
    this.porCodigo.set(normalizeDominio(c.codigo), c);
  }

  buscar(valorRaw: string): { id: number; codigo: string; patente: string | null } | null {
    const key = normalizeDominio(valorRaw);
    return this.porPatente.get(key) ?? this.porCodigo.get(key) ?? null;
  }

  // Crea el vehículo si no existe (codigo = patente = valor de la planilla,
  // en_servicio = true) y opcionalmente lo enriquece con tipo/modelo cuando
  // viene de la hoja "CARGAS AUTORIZADAS". Marca como "vinculado" a los que
  // ya existían y reciben una carga en este import.
  async resolverOCrear(valorRaw: string, opts?: { tipo?: string | null; modelo?: string | null }): Promise<{ id: number }> {
    const existente = this.buscar(valorRaw);
    if (existente) {
      this.vinculados.add(existente.id);
      return existente;
    }

    const patente = valorRaw.trim();
    const nuevo = await prisma.camion.create({
      data: {
        empresa_id:  this.empresaId,
        codigo:      patente,
        patente,
        tipo:        opts?.tipo ?? null,
        descripcion: opts?.modelo ?? null,
        en_servicio: true,
      },
      select: { id: true, codigo: true, patente: true },
    });
    this.indexar(nuevo);
    this.creados.push({ codigo: nuevo.codigo, patente: nuevo.patente! });
    return nuevo;
  }

  get vehiculosVinculados(): number {
    return this.vinculados.size;
  }
}

// Una fila de carga ya resuelta (fecha parseada, vehículo resuelto si
// aplica) a la espera de la fase de deduplicación — ver dedupEInsertar más
// abajo. camionId es null para movimientos de cuenta corriente sin vehículo
// (TIPO=RE/NC — pago o nota de crédito).
interface CandidataCarga {
  camionId:            number | null;
  fecha:               Date;
  litros:              number;
  montoTotal:          number;
  responsableNombre:   string | null;
  notas:               string | null;
  cuentaCorrienteId:   number | null;
  numeroComprobante:   string | null;
  tipoMovimiento:      string | null;
  pagos:               number | null;
  saldo:               number | null;
  // Posición dentro de la planilla (orden real de la fila) — el Excel no
  // tiene hora, así que varias filas comparten el mismo DateTime; esto
  // preserva su secuencia real dentro del día. Se asigna según el orden en
  // que se van empujando a `candidatas` (mismo orden que las hojas/filas del
  // archivo), no el orden de inserción en la DB — así una reimportación que
  // sólo completa filas faltantes no desordena las que ya existían.
  orden:               number;
}

function claveCarga(c: CandidataCarga): string {
  return `${c.camionId}|${c.fecha.getTime()}|${round3(c.litros)}|${round2(c.montoTotal)}`;
}

export async function importarPlanillaCombustible(
  workbook: XLSX.WorkBook,
  empresaId: number,
  usuarioId: number,
): Promise<ImportResultado> {
  const camiones = await prisma.camion.findMany({
    where: { empresa_id: empresaId, deleted_at: null },
    select: { id: true, codigo: true, patente: true },
  });
  const registro = new RegistroVehiculos(empresaId, camiones);

  const resultado: ImportResultado = {
    hojas_procesadas: 0, creados: 0, omitidos: 0, actualizados: 0, errores: [],
    vehiculos_creados: [], vehiculos_vinculados: 0,
  };

  // La hoja "CARGAS AUTORIZADAS" trae patente + tipo + modelo — se procesa
  // primero para crear/enriquecer los vehículos con esos datos antes de que
  // el ledger de cada mes tenga que resolverlos con sólo un dominio suelto.
  const sheetCargasAutorizadas = workbook.SheetNames.find(esHojaCargasAutorizadas);
  const sheetsMes = workbook.SheetNames.filter(n => n !== sheetCargasAutorizadas && detectarHojaMes(n));

  if (sheetCargasAutorizadas) {
    await importarCargasAutorizadas(workbook, sheetCargasAutorizadas, registro, resultado);
  }

  const candidatas: CandidataCarga[] = [];
  // Saldo de cierre del mes recién procesado — se traslada solo al próximo
  // como su saldo de apertura, igual que hace Santi a mano con su fila
  // "SALDO ANTERIOR" (verificado: en la planilla real, la apertura de cada
  // mes es EXACTAMENTE el cierre del mes previo — a veces en la columna
  // PAGOS si el cierre fue a favor, a veces en CONSUMOS si fue en contra).
  let saldoAperturaSiguiente: number | null = null;

  for (const sheetName of sheetsMes) {
    resultado.hojas_procesadas += 1;
    const hoja = detectarHojaMes(sheetName)!; // sheetsMes ya viene filtrado por detectarHojaMes
    const ws = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });

    // 1) si el mes anterior se procesó en este mismo import, se usa ese
    //    cierre; 2) si no, se busca el último saldo cargado en la DB para el
    //    mes anterior; 3) si tampoco hay nada (primera vez que se importa
    //    este archivo), se cae al valor que Santi tipeó a mano en su propia
    //    fila "SALDO ANTERIOR" — ver más abajo.
    let saldoApertura = saldoAperturaSiguiente;
    if (saldoApertura == null) {
      const mesAnteriorNum  = hoja.mes === 1 ? 12 : hoja.mes - 1;
      const anioAnteriorNum = hoja.mes === 1 ? hoja.anio - 1 : hoja.anio;
      const cierreAnterior = await prisma.cargaCombustible.findFirst({
        where: {
          empresa_id: empresaId, deleted_at: null, saldo: { not: null },
          fecha: { gte: new Date(Date.UTC(anioAnteriorNum, mesAnteriorNum - 1, 1)), lt: new Date(Date.UTC(hoja.anio, hoja.mes - 1, 1)) },
        },
        orderBy: [{ fecha: 'desc' }, { orden: 'desc' }, { id: 'desc' }],
        select: { saldo: true },
      });
      if (cierreAnterior) saldoApertura = Number(cierreAnterior.saldo);
    }

    let saldoAperturaDeLaHoja: number | null = null;
    let saldoRodando: number | null = null;
    let enExtras = false;

    for (const row of rows) {
      const col0 = String(row[0] ?? '').trim();
      const col1 = String(row[1] ?? '').trim().toUpperCase();
      const col2 = String(row[2] ?? '').trim().toUpperCase();
      const col3 = String(row[3] ?? '').trim();
      const col3Upper = col3.toUpperCase();
      const col4 = String(row[4] ?? '').trim().toUpperCase();

      // Header de la sub-tabla "CARGAS COMBUSTIBLE EXTRAS" — a partir de acá
      // las columnas cambian de sentido (col4 = RESPONSABLE, no PAGOS).
      if (col0 === 'FECHA' && col4 === 'RESPONSABLE') { enExtras = true; continue; }
      if (col0 === 'FECHA' || col0 === '') continue; // headers / filas en blanco

      // Fila de apertura del mes — no se importa tal cual (se reemplaza por
      // la sintética de abajo, calculada desde nuestro propio cierre); sólo
      // sirve de bootstrap si no hay mes anterior en la DB.
      if (col2 === 'SALDO ANTERIOR') {
        const enPagos    = toNumber(row[4]);
        const enConsumos = toNumber(row[5]);
        saldoAperturaDeLaHoja = enPagos ?? (enConsumos != null ? -enConsumos : null);
        continue;
      }
      if (VEHICULO_IGNORAR.includes(col3Upper)) continue;

      const fecha = excelDateToJs(row[0]);
      if (!fecha) continue;

      const numeroComprobante = String(row[2] ?? '').trim() || null;
      const tipoMovimiento    = String(row[1] ?? '').trim() || null;

      if (enExtras) {
        const litros = toNumber(row[7]);
        const monto  = toNumber(row[6]);
        if (!monto || monto <= 0) continue; // filas de total / vacías
        const camion = await registro.resolverOCrear(col3);

        candidatas.push({
          camionId: camion.id, fecha, litros: litros ?? 0, montoTotal: monto,
          responsableNombre: String(row[4] ?? '').trim() || null,
          notas: String(row[8] ?? '').trim() || null,
          cuentaCorrienteId: null,
          numeroComprobante, tipoMovimiento,
          pagos: toNumber(row[5]), saldo: null, // la sub-tabla de extras no trae columna SALDO
          orden: candidatas.length,
        });
        continue;
      }

      // Ledger principal — FA es una carga de combustible real (vehículo +
      // litros + consumo). RE (transferencia/pago) y NC (nota de crédito) son
      // movimientos de la cuenta corriente sin vehículo ni litros, pero SÍ se
      // importan — antes se descartaban por completo y el total de Pagos
      // nunca se veía en ningún lado.
      if (col1 === 'FA') {
        const litros = toNumber(row[7]);
        const monto  = toNumber(row[5]);
        if (!monto || monto <= 0) continue;

        const camion = await registro.resolverOCrear(col3);
        const saldo = toNumber(row[6]);
        if (saldo != null) saldoRodando = saldo;

        candidatas.push({
          camionId: camion.id, fecha, litros: litros ?? 0, montoTotal: monto,
          responsableNombre: null, notas: String(row[8] ?? '').trim() || null,
          cuentaCorrienteId: null,
          numeroComprobante, tipoMovimiento,
          pagos: toNumber(row[4]), saldo,
          orden: candidatas.length,
        });
        continue;
      }

      if (col1 === 'RE' || col1 === 'NC') {
        // El monto puede venir en PAGOS (caso normal de RE) o, en algunas
        // notas de crédito, en CONSUMOS — se toma el que tenga valor.
        const pagos = toNumber(row[4]) ?? toNumber(row[5]);
        if (!pagos) continue;
        const saldo = toNumber(row[6]);
        if (saldo != null) saldoRodando = saldo;

        candidatas.push({
          camionId: null, fecha, litros: 0, montoTotal: 0,
          responsableNombre: null, notas: String(row[8] ?? '').trim() || null,
          cuentaCorrienteId: null,
          numeroComprobante, tipoMovimiento,
          pagos, saldo,
          orden: candidatas.length,
        });
      }
    }

    if (saldoApertura == null) saldoApertura = saldoAperturaDeLaHoja;

    if (saldoApertura != null && saldoApertura !== 0) {
      const primerDia = new Date(Date.UTC(hoja.anio, hoja.mes - 1, 1));
      candidatas.push({
        camionId: null, fecha: primerDia, litros: 0,
        montoTotal: saldoApertura < 0 ? Math.abs(saldoApertura) : 0,
        pagos: saldoApertura >= 0 ? saldoApertura : null,
        saldo: saldoApertura,
        numeroComprobante: `SALDO_ANTERIOR-${hoja.anio}-${String(hoja.mes).padStart(2, '0')}`,
        tipoMovimiento: 'SALDO_ANTERIOR',
        responsableNombre: null,
        notas: 'Saldo anterior — arrastre automático del cierre del mes previo',
        cuentaCorrienteId: null,
        orden: -1, // siempre antes que cualquier fila real del mes, aunque compartan fecha
      });
    }

    saldoAperturaSiguiente = saldoRodando;
  }

  await dedupEInsertar(candidatas, empresaId, usuarioId, resultado);

  resultado.vehiculos_creados = registro.creados;
  resultado.vehiculos_vinculados = registro.vehiculosVinculados;
  return resultado;
}

function datosCarga(c: CandidataCarga, empresaId: number, usuarioId: number) {
  return {
    empresa_id:          empresaId,
    camion_id:           c.camionId,
    fecha:               c.fecha,
    tipo_combustible:    TipoCombustible.DIESEL,
    litros:              round3(c.litros),
    precio_por_litro:    c.litros > 0 ? round2(c.montoTotal / c.litros) : null,
    monto_total:         round2(c.montoTotal),
    estado:              'AUTORIZADA' as const,
    responsable_nombre:  c.responsableNombre,
    notas:               c.notas,
    cuenta_corriente_id: c.cuentaCorrienteId,
    numero_comprobante:  c.numeroComprobante,
    tipo_movimiento:     c.tipoMovimiento,
    pagos:               c.pagos != null ? round2(c.pagos) : null,
    saldo:               c.saldo != null ? round2(c.saldo) : null,
    orden:               c.orden,
    created_by:          usuarioId,
  };
}

// Insert-or-skip, NO upsert — dos cargas del mismo vehículo el mismo día con
// los mismos litros y monto son operaciones distintas si tienen comprobantes
// distintos, y ambas deben existir, no pisarse una a la otra.
//
// El N° FA/COMP del Excel es la clave real de deduplicación: si ya existe una
// carga con ese mismo número EN EL MISMO MES, es la misma operación
// reimportada (skip); si no existe, es una carga nueva aunque el resto de los
// valores coincida con otra fila. El mes es parte de la clave porque el
// número NO es único en todo el año — verificado en la planilla real: el
// comprobante "92-3509" aparece en ENERO y en AGOSTO como dos cargas
// distintas; sin el filtro de mes, la de agosto se pierde silenciosamente
// (el dedup la confunde con la de enero y nunca la crea). Una carga cargada
// a mano nunca tiene número de comprobante, así que nunca la toca esta
// lógica — siempre es una línea nueva.
//
// Sólo para las pocas filas del Excel sin N° FA/COMP (celda vacía) se usa el
// fallback anterior: contar cuántas filas del Excel comparten la clave
// [vehículo, fecha, litros, monto] contra cuántas ya existen en la DB con esa
// clave y crear sólo la diferencia. Ver [[combustible_flota_dos57]].
async function dedupEInsertar(
  candidatas: CandidataCarga[],
  empresaId: number,
  usuarioId: number,
  resultado: ImportResultado,
): Promise<void> {
  const conComprobante = candidatas.filter(c => c.numeroComprobante);
  const sinComprobante = candidatas.filter(c => !c.numeroComprobante);

  for (const c of conComprobante) {
    const inicioMes = new Date(Date.UTC(c.fecha.getUTCFullYear(), c.fecha.getUTCMonth(), 1));
    const finMes    = new Date(Date.UTC(c.fecha.getUTCFullYear(), c.fecha.getUTCMonth() + 1, 1));
    const yaExiste = await prisma.cargaCombustible.findFirst({
      where: { empresa_id: empresaId, numero_comprobante: c.numeroComprobante, fecha: { gte: inicioMes, lt: finMes }, deleted_at: null },
      select: { id: true, orden: true },
    });
    if (yaExiste) {
      // Auto-completa `orden` en filas ya importadas antes de que este campo
      // existiera — si no, quedan empatadas por id y "saldo más reciente"
      // puede tomar una fila que no es la última del día en la planilla real.
      if (yaExiste.orden == null) {
        await prisma.cargaCombustible.update({ where: { id: yaExiste.id }, data: { orden: c.orden } });
      }
      resultado.omitidos += 1;
      continue;
    }

    await prisma.cargaCombustible.create({ data: datosCarga(c, empresaId, usuarioId) });
    resultado.creados += 1;
  }

  const grupos = new Map<string, CandidataCarga[]>();
  for (const c of sinComprobante) {
    const key = claveCarga(c);
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(c);
  }

  for (const grupo of grupos.values()) {
    const { camionId, fecha, litros, montoTotal } = grupo[0];
    const yaEnDB = await prisma.cargaCombustible.count({
      where: {
        empresa_id: empresaId, camion_id: camionId, fecha,
        litros: round3(litros), monto_total: round2(montoTotal), deleted_at: null,
      },
    });

    const aCrear = Math.max(0, grupo.length - yaEnDB);
    for (let i = 0; i < aCrear; i++) {
      await prisma.cargaCombustible.create({ data: datosCarga(grupo[i], empresaId, usuarioId) });
      resultado.creados += 1;
    }
    resultado.omitidos += grupo.length - aCrear;
  }
}

async function importarCargasAutorizadas(
  workbook: XLSX.WorkBook,
  sheetName: string,
  registro: RegistroVehiculos,
  resultado: ImportResultado,
): Promise<void> {
  resultado.hojas_procesadas += 1;
  const ws = workbook.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });

  for (const row of rows) {
    const dominio = String(row[2] ?? '').trim();
    if (!dominio || dominio.toUpperCase() === 'DOMINIO') continue;

    const tipo   = String(row[1] ?? '').trim() || null;
    const modelo = String(row[3] ?? '').trim() || null;
    const camion = await registro.resolverOCrear(dominio, { tipo, modelo });

    const limiteRaw = row[4];
    const limite = typeof limiteRaw === 'number' ? limiteRaw : null; // texto ("SIN LÍMITE DE CARGA") → null

    await prisma.camion.update({ where: { id: camion.id }, data: { limite_mensual_combustible: limite } });
    resultado.actualizados += 1;
  }
}
