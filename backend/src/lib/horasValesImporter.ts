import * as XLSX from 'xlsx';
import { CategoriaEmpleado, EstadoJornada, EstadoLiquidacion, TipoAnticipo, type Empleado } from '@prisma/client';
import { prisma } from './prisma';
import { HORAS_BASE_LINEAL } from './calcularLiquidacion';

// ═══════════════════════════════════════════════════════════════════════════
// Importador de "HORAS Y VALES <MES> 2026" (Male, Enjoy).
//
// Planilla real (docs/especificaciones/HORAS Y VALES MARZO 2026 -.xlsx):
// - Una hoja por persona con el nombre de pila ("CRISTIAN", "FRANCISCO").
//   Las hojas "EVENTOS" y "LIQUIDACIONES MARZO" no son de horas y se saltean.
// - Fila 2: "SUELDO MARZO 2026". Fila 3: "Nombre:" | "CRISTIAN GUTIERREZ" | … | "DNI:" | 23105929.
// - Fila 4: encabezados Convocatoria | Dia | Fecha | Inicio de Actividades | | Fin de Actividades | | Hrs trabajadas | (detalle, sin título).
// - Las horas vienen como fracción de día (0.375 = 9:00) y el egreso puede
//   pasar la medianoche (0.3125 → 0.125 = 7:30 a 3:00 del día siguiente).
// - "LIBRE" en Convocatoria = día sin trabajo. Termina en "TOTALES".
// - Abajo, "VALES": FECHA | DETALLE | | MONTO a la izquierda y
//   "DETALLE DE PRESTAMOS / DESCUENTOS / MULTAS" (FECHA | DETALLE | | IMPORTE) a la derecha.
//
// Las horas que se toman son las de "Hrs trabajadas" (lo que se paga); si no
// están, se calculan con el ingreso y el egreso. Las jornadas entran
// APROBADAS: la planilla ya es la revisada por Male. Reimportar no duplica:
// upsert por [empleado, fecha] y los vales se reconocen por fecha+monto+detalle.
// ═══════════════════════════════════════════════════════════════════════════

const norm = (v: unknown) => String(v ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

const soloDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');

const round2 = (n: number) => Math.round(n * 100) / 100;

const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());

// Fecha de calendario → medianoche UTC (convención del sistema).
function fechaExcel(v: unknown): Date | null {
  if (typeof v === 'number' && v > 20000) {
    const p = XLSX.SSF.parse_date_code(v);
    if (!p) return null;
    return new Date(Date.UTC(p.y, p.m - 1, p.d));
  }
  if (v instanceof Date) return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
  return null;
}

// Fracción de día → minutos desde medianoche (null si no es una hora).
function minutosExcel(v: unknown): number | null {
  if (typeof v === 'number' && v >= 0 && v < 1.0001) return Math.round(v * 24 * 60) % (24 * 60);
  const m = String(v ?? '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  return null;
}

// Timestamp real (hora local del servidor, TZ Buenos Aires) del día `fecha` + minutos.
function timestampLocal(fecha: Date, minutos: number, diasExtra = 0): Date {
  return new Date(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate() + diasExtra, Math.floor(minutos / 60), minutos % 60);
}

// Parte las horas del día según el modelo del empleado (misma regla que la carga manual).
export function partirHorasEmpleado(
  empleado: Pick<Empleado, 'tipo_liquidacion' | 'umbral_horas_jornada'> | null,
  horas: number,
) {
  const base = empleado?.tipo_liquidacion === 'JORNADA'
    ? Number(empleado.umbral_horas_jornada ?? 0) || HORAS_BASE_LINEAL
    : HORAS_BASE_LINEAL;
  if (horas <= base) return { horas_normales: round2(horas), horas_extras: 0 };
  return { horas_normales: base, horas_extras: round2(horas - base) };
}

interface Columnas { header: number; convocatoria: number; fecha: number; inicio: number; fin: number; horas: number; detalle: number }

function detectarColumnas(rows: any[][]): Columnas | null {
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = (rows[r] ?? []).map(norm);
    const fecha = row.indexOf('fecha');
    const inicio = row.findIndex(c => c.startsWith('inicio'));
    const fin = row.findIndex(c => c.startsWith('fin'));
    const horas = row.findIndex(c => c.startsWith('hrs') || c.startsWith('horas'));
    if (fecha === -1 || inicio === -1 || fin === -1 || horas === -1) continue;
    const convocatoria = row.indexOf('convocatoria');
    const detalleTitulado = row.findIndex(c => c.startsWith('detalle') || c.startsWith('descripcion') || c.startsWith('evento'));
    return { header: r, convocatoria, fecha, inicio, fin, horas, detalle: detalleTitulado !== -1 ? detalleTitulado : horas + 1 };
  }
  return null;
}

function leerDatosPersona(rows: any[][], hasta: number) {
  let nombre: string | null = null;
  let dni: string | null = null;
  let periodo: string | null = null;
  for (let r = 0; r < hasta; r++) {
    const row = rows[r] ?? [];
    row.forEach((c, i) => {
      const n = norm(c);
      if (n.startsWith('sueldo ')) periodo = String(c).trim();
      if (n === 'nombre:' || n === 'nombre') {
        const v = row.slice(i + 1).find(x => x != null && String(x).trim() !== '');
        if (v) nombre = String(v).trim();
      }
      if (n === 'dni:' || n === 'dni') {
        const v = row.slice(i + 1).find(x => x != null && String(x).trim() !== '');
        if (v && soloDigitos(v).length >= 7) dni = soloDigitos(v);
      }
    });
  }
  return { nombre, dni, periodo };
}

export interface FilaHoras {
  fila_excel:   number;
  fecha:        string;
  inicio:       string | null;
  fin:          string | null;
  horas:        number;
  detalle:      string | null;
  accion:       'crear' | 'actualizar' | 'liquidada';
  aviso?:       string;
}

export interface ValeHoja {
  fila_excel: number;
  fecha:      string;
  detalle:    string | null;
  monto:      number;
  tipo:       TipoAnticipo;
  accion:     'crear' | 'existente';
}

export interface HojaHoras {
  hoja:             string;
  es_planilla:      boolean;
  periodo:          string | null;
  nombre_planilla:  string | null;
  dni:              string | null;
  empleado_id:      number | null;
  empleado_nombre:  string | null;
  crea_empleado:    boolean;
  avisos:           string[];
  dias_libres:      number;
  horas_total:      number;
  horas_planilla:   number | null; // "TOTALES" de la hoja, para comparar
  filas:            FilaHoras[];
  vales:            ValeHoja[];
}

function parsearVales(rows: any[][], desde: number): Omit<ValeHoja, 'accion'>[] {
  const vales: Omit<ValeHoja, 'accion'>[] = [];
  let r = desde;
  while (r < rows.length && norm((rows[r] ?? [])[0]) !== 'vales') r++;
  if (r >= rows.length) return vales;
  // Fila de títulos: FECHA | DETALLE | | MONTO | FECHA | DETALLE | | IMPORTE
  const titulos = (rows[r + 1] ?? []).map(norm);
  const bloques: { fecha: number; detalle: number; monto: number; derecha: boolean }[] = [];
  titulos.forEach((t, i) => {
    if (t !== 'fecha') return;
    const detalle = titulos.indexOf('detalle', i);
    const monto = titulos.findIndex((x, j) => j > i && (x === 'monto' || x === 'importe'));
    if (detalle !== -1 && monto !== -1) bloques.push({ fecha: i, detalle, monto, derecha: bloques.length > 0 });
  });
  for (let k = r + 2; k < rows.length; k++) {
    const row = rows[k] ?? [];
    if (norm(row[0]) === 'total') break;
    for (const b of bloques) {
      const fecha = fechaExcel(row[b.fecha]);
      const monto = Number(row[b.monto]);
      if (!fecha || !Number.isFinite(monto) || monto <= 0) continue;
      const detalle = row[b.detalle] != null && String(row[b.detalle]).trim() !== '' ? String(row[b.detalle]).trim() : null;
      const d = norm(detalle);
      const tipo = b.derecha
        ? (d.includes('multa') ? TipoAnticipo.MULTA : TipoAnticipo.DESCUENTO)
        : (d.includes('adelanto') ? TipoAnticipo.ADELANTO : TipoAnticipo.VALE);
      vales.push({ fila_excel: k + 1, fecha: fecha.toISOString().slice(0, 10), detalle, monto: round2(monto), tipo });
    }
  }
  return vales;
}

// Una jornada ya entró en una liquidación que no está en borrador → no se toca.
async function fechasLiquidadas(empleadoId: number): Promise<{ desde: Date; hasta: Date }[]> {
  const liqs = await prisma.liquidacion.findMany({
    where:  { empleado_id: empleadoId, estado: { notIn: [EstadoLiquidacion.BORRADOR, EstadoLiquidacion.CANCELADA] } },
    select: { fecha_desde: true, fecha_hasta: true },
  });
  return liqs.map(l => ({ desde: l.fecha_desde, hasta: l.fecha_hasta }));
}

export async function analizarHorasVales(buffer: Buffer, empresaId: number) {
  const wb = XLSX.read(buffer, { type: 'buffer' });

  const empleados = await prisma.empleado.findMany({ where: { empresa_id: empresaId, deleted_at: null } });
  const porDni = new Map(empleados.filter(e => e.dni).map(e => [soloDigitos(e.dni), e]));
  const buscarPorNombre = (completo: string | null, hoja: string) => {
    if (completo) {
      const c = norm(completo);
      const exacto = empleados.find(e => c === norm(`${e.nombre} ${e.apellido}`) || c === norm(`${e.apellido} ${e.nombre}`));
      if (exacto) return exacto;
      const parcial = empleados.filter(e => c.includes(norm(e.apellido)) && c.includes(norm(e.nombre).split(' ')[0]));
      if (parcial.length === 1) return parcial[0];
    }
    const h = norm(hoja);
    const porHoja = empleados.filter(e => h === norm(e.nombre) || h === norm(e.apellido) || h === norm(e.apodo) || h === norm(`${e.nombre} ${e.apellido}`));
    return porHoja.length === 1 ? porHoja[0] : null;
  };

  const hojas: HojaHoras[] = [];

  for (const nombreHoja of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[nombreHoja], { header: 1, defval: null, raw: true });
    const cols = detectarColumnas(rows);
    if (!cols) {
      hojas.push({
        hoja: nombreHoja, es_planilla: false, periodo: null, nombre_planilla: null, dni: null,
        empleado_id: null, empleado_nombre: null, crea_empleado: false, avisos: [], dias_libres: 0,
        horas_total: 0, horas_planilla: null, filas: [], vales: [],
      });
      continue;
    }

    const { nombre, dni, periodo } = leerDatosPersona(rows, cols.header);
    const empleado = (dni ? porDni.get(dni) : undefined) ?? buscarPorNombre(nombre, nombreHoja);
    const avisos: string[] = [];

    const liquidadas = empleado ? await fechasLiquidadas(empleado.id) : [];
    const existentes = empleado
      ? new Set((await prisma.jornada.findMany({
          where: { empleado_id: empleado.id, deleted_at: null }, select: { fecha: true },
        })).map(j => j.fecha.toISOString().slice(0, 10)))
      : new Set<string>();

    const filas: FilaHoras[] = [];
    let diasLibres = 0;
    let horasPlanilla: number | null = null;
    let finTabla = rows.length;

    for (let r = cols.header + 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      if (row.some(c => norm(c) === 'totales')) {
        const t = Number(row[cols.horas]);
        horasPlanilla = Number.isFinite(t) ? t : null;
        finTabla = r;
        break;
      }
      const fecha = fechaExcel(row[cols.fecha]);
      if (!fecha) continue;

      const inicio = minutosExcel(row[cols.inicio]);
      const fin = minutosExcel(row[cols.fin]);
      const hrsCelda = Number(row[cols.horas]);
      let calculadas: number | null = null;
      if (inicio !== null && fin !== null) {
        const mins = fin > inicio ? fin - inicio : fin + 24 * 60 - inicio;
        calculadas = round2(mins / 60);
      }
      const horas = Number.isFinite(hrsCelda) && hrsCelda > 0 ? round2(hrsCelda) : (calculadas ?? 0);
      if (horas <= 0) { diasLibres++; continue; }

      const detalleRaw = row[cols.detalle];
      const detalle = detalleRaw != null && String(detalleRaw).trim() !== '' ? String(detalleRaw).replace(/\s+/g, ' ').trim() : null;
      const iso = fecha.toISOString().slice(0, 10);
      const liquidada = liquidadas.some(l => fecha >= l.desde && fecha <= l.hasta);

      filas.push({
        fila_excel: r + 1,
        fecha:      iso,
        inicio:     inicio !== null ? `${String(Math.floor(inicio / 60)).padStart(2, '0')}:${String(inicio % 60).padStart(2, '0')}` : null,
        fin:        fin !== null ? `${String(Math.floor(fin / 60)).padStart(2, '0')}:${String(fin % 60).padStart(2, '0')}` : null,
        horas,
        detalle,
        accion:     liquidada ? 'liquidada' : (existentes.has(iso) ? 'actualizar' : 'crear'),
        ...(calculadas !== null && Math.abs(calculadas - horas) > 0.25
          ? { aviso: `La planilla dice ${horas} h; entre el ingreso y el egreso hay ${calculadas} h` }
          : {}),
      });
    }

    const horasTotal = round2(filas.reduce((s, f) => s + f.horas, 0));
    if (horasPlanilla !== null && filas.length > 0 && Math.abs(horasPlanilla - horasTotal) > 0.01) {
      avisos.push(`El total de la hoja (${horasPlanilla} h) no coincide con la suma de los días (${horasTotal} h)`);
    }

    const valesRaw = parsearVales(rows, finTabla);
    const vales: ValeHoja[] = [];
    for (const v of valesRaw) {
      const existe = empleado ? await prisma.anticipo.findFirst({
        where: { empleado_id: empleado.id, fecha: new Date(v.fecha), monto: v.monto, motivo: v.detalle },
        select: { id: true },
      }) : null;
      vales.push({ ...v, accion: existe ? 'existente' : 'crear' });
    }

    const creaEmpleado = !empleado && !!nombre && (filas.length > 0 || vales.length > 0);
    if (!empleado && !nombre && filas.length > 0) avisos.push('La hoja no tiene "Nombre:" y no se encontró a quién corresponde: no se importa');
    if (creaEmpleado) avisos.push('No está en RRHH: se da de alta como jornalero. Después cargale el valor hora');
    if (empleado && empleado.tipo_liquidacion === 'LINEAL' && Number(empleado.valor_hora) === 0 && filas.length > 0) {
      avisos.push('No tiene valor hora cargado: la liquidación va a dar $0 hasta que se lo cargues en RRHH → Empleados');
    }
    if (filas.some(f => f.accion === 'liquidada')) {
      avisos.push(`${filas.filter(f => f.accion === 'liquidada').length} día(s) ya entraron en una liquidación enviada, aprobada o pagada: no se tocan`);
    }

    hojas.push({
      hoja: nombreHoja,
      es_planilla: true,
      periodo,
      nombre_planilla: nombre,
      dni,
      empleado_id: empleado?.id ?? null,
      empleado_nombre: empleado ? `${empleado.apellido}, ${empleado.nombre}` : (nombre ? titleCase(nombre) : null),
      crea_empleado: creaEmpleado,
      avisos,
      dias_libres: diasLibres,
      horas_total: horasTotal,
      horas_planilla: horasPlanilla,
      filas,
      vales,
    });
  }

  const importables = hojas.filter(h => h.empleado_id || h.crea_empleado);
  return {
    hojas,
    total_importables: importables.reduce((s, h) => s + h.filas.filter(f => f.accion !== 'liquidada').length, 0),
    total_vales: importables.reduce((s, h) => s + h.vales.filter(v => v.accion === 'crear').length, 0),
    empleados_nuevos: hojas.filter(h => h.crea_empleado).length,
  };
}

export async function importarHorasVales(buffer: Buffer, empresaId: number, usuarioId: number) {
  const analisis = await analizarHorasVales(buffer, empresaId);
  let creadas = 0, actualizadas = 0, vales = 0, empleadosCreados = 0;

  for (const h of analisis.hojas) {
    if (!h.es_planilla || (!h.empleado_id && !h.crea_empleado)) continue;

    let empleado = h.empleado_id ? await prisma.empleado.findUnique({ where: { id: h.empleado_id } }) : null;
    if (!empleado && h.crea_empleado && h.nombre_planilla) {
      const partes = titleCase(h.nombre_planilla).split(' ');
      empleado = await prisma.empleado.create({
        data: {
          empresa_id:       empresaId,
          nombre:           partes[0],
          apellido:         partes.slice(1).join(' ') || partes[0],
          dni:              h.dni,
          categoria:        CategoriaEmpleado.JORNALERO,
          tipo_liquidacion: 'LINEAL',
          notas:            `Alta automática desde la planilla de horas (hoja ${h.hoja})`,
          created_by:       usuarioId,
        },
      });
      empleadosCreados++;
    }
    if (!empleado) continue;

    for (const f of h.filas) {
      if (f.accion === 'liquidada') continue;
      const fecha = new Date(f.fecha);
      const [hi, mi] = f.inicio ? f.inicio.split(':').map(Number) : [null, null];
      const [hf, mf] = f.fin ? f.fin.split(':').map(Number) : [null, null];
      const ingreso = hi !== null ? timestampLocal(fecha, hi * 60 + mi!) : null;
      let egreso = hf !== null ? timestampLocal(fecha, hf * 60 + mf!) : null;
      if (ingreso && egreso && egreso <= ingreso) egreso = timestampLocal(fecha, hf! * 60 + mf!, 1);
      const { horas_normales, horas_extras } = partirHorasEmpleado(empleado, f.horas);

      const data = {
        hora_convocatoria: ingreso,
        hora_ingreso:      ingreso,
        hora_egreso:       egreso,
        horas_normales,
        horas_extras,
        descripcion:       f.detalle,
        convocatoria:      f.detalle,
        estado:            EstadoJornada.APROBADA,
        aprobado_por:      usuarioId,
        aprobado_at:       new Date(),
        deleted_at:        null,
      };
      const existente = await prisma.jornada.findUnique({ where: { empleado_id_fecha: { empleado_id: empleado.id, fecha } } });
      if (existente) {
        await prisma.jornada.update({ where: { id: existente.id }, data });
        actualizadas++;
      } else {
        await prisma.jornada.create({ data: { ...data, empleado_id: empleado.id, empresa_id: empresaId, fecha, created_by: usuarioId } });
        creadas++;
      }
    }

    for (const v of h.vales) {
      const existe = await prisma.anticipo.findFirst({
        where: { empleado_id: empleado.id, fecha: new Date(v.fecha), monto: v.monto, motivo: v.detalle },
        select: { id: true },
      });
      if (existe) continue;
      await prisma.anticipo.create({
        data: {
          empleado_id: empleado.id, empresa_id: empresaId, tipo: v.tipo,
          monto: v.monto, fecha: new Date(v.fecha), motivo: v.detalle, created_by: usuarioId,
        },
      });
      vales++;
    }
  }

  return { ...analisis, creadas, actualizadas, vales_creados: vales, empleados_creados: empleadosCreados };
}
