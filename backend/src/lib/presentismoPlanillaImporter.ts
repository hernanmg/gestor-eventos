import * as XLSX from 'xlsx';
import type { EstadoAsistencia } from '@prisma/client';
import { prisma } from './prisma';
import {
  DESCUENTA_POR_DEFECTO, calcularHorasTrabajadas, calcularMinutosTardanza, clasificarLlegada,
} from './presentismoCalculo';

// ── Importador de la planilla mensual de presentismo de Lorena ───────────────
// Formato real (docs/dos57/lorena/SEPTIEMBRE_Registro de Faltas.xlsx): una
// hoja por persona (ANDRE, LORE, FURIA…) con
//   fila 1:  MES | SEPTIEMBRE … NOMBRE | OLIVETTO ANDREA
//   fila 2:  ITEM | CONVOCATORIA | DIA | FECHA | HORARIO | SI | DEMORA |
//            LLEGADA TARDE | NO CONVOCADO | FALTO | MEDICA | VACACIONES |
//            FRANCO POR DOMINGO | OBSERVACION
// y una fila por día con un "1" en la columna que corresponde. Las hojas
// GRAFICO e "Informe <mes>" (resumen con SUBTOTAL) se ignoran: el resumen lo
// recalcula el sistema.
//
// Prioridad para decidir el estado del día:
//   1. La marca de Lorena (columna con 1) — siempre manda.
//   2. Sin marca: el texto de CONVOCATORIA (LIBRE, FRANCO, FALTO, LICENCIA…).
//   3. Sin marca ni texto pero con HORARIO: se clasifica contra la citación
//      (PRESENTE / DEMORA / TARDE, ver clasificarLlegada).
//   4. Nada de eso: el día todavía no se cargó → se saltea.
// Si CONVOCATORIA dice LICENCIA, gana LICENCIA aunque la marca sea NO
// CONVOCADO (así lo marca ella: "LICENCIA MATERNIDAD" + NO CONVOCADO).

const MARCAS: { header: string; estado: EstadoAsistencia; motivo?: string }[] = [
  { header: 'SI',               estado: 'PRESENTE' },
  { header: 'DEMORA',           estado: 'DEMORA' },
  { header: 'LLEGADATARDE',     estado: 'TARDE' },
  { header: 'NOCONVOCADO',      estado: 'LIBRE' },
  { header: 'FALTO',            estado: 'AUSENTE' },
  { header: 'MEDICA',           estado: 'JUSTIFICADO', motivo: 'Médica' },
  { header: 'VACACIONES',       estado: 'VACACIONES' },
  { header: 'FRANCOPORDOMINGO', estado: 'FRANCO' },
];

export interface DiaPlanilla {
  fecha:             string; // YYYY-MM-DD
  estado:            EstadoAsistencia;
  hora_convocatoria: string | null;
  hora_ingreso:      string | null;
  motivo:            string | null;
  origen_estado:     'MARCA' | 'CONVOCATORIA' | 'HORARIO';
}

export interface HojaPlanilla {
  hoja:   string;
  nombre: string;
  mes:    string | null;
  dias:   DiaPlanilla[];
}

export interface ParseoPlanillaPresentismo {
  hojas:        HojaPlanilla[];
  advertencias: string[];
}

function norm(s: unknown): string {
  return String(s ?? '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '');
}

function tokens(s: string): string[] {
  return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^A-Z0-9]+/).filter(Boolean);
}

// Hora de Excel: fracción de día (0,375 = 9:00) o texto "9:00 AM".
function horaCelda(v: unknown): string | null {
  if (typeof v === 'number' && v >= 0 && v < 1) {
    const min = Math.round(v * 1440) % 1440;
    return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  }
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
    if (!m) return null;
    let h = Number(m[1]);
    const ampm = m[3]?.toUpperCase();
    if (ampm === 'AM' && h === 12) h = 0;
    if (ampm === 'PM' && h < 12) h += 12;
    if (h > 23 || Number(m[2]) > 59) return null;
    return `${String(h).padStart(2, '0')}:${m[2]}`;
  }
  return null;
}

// Fecha de Excel: número de serie (sólo la parte entera) o Date.
function fechaCelda(v: unknown): string | null {
  if (typeof v === 'number' && v > 20000) {
    const d = XLSX.SSF.parse_date_code(Math.floor(v));
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  return null;
}

function esMarca(v: unknown): boolean {
  if (typeof v === 'number') return v > 0;
  const s = String(v ?? '').trim().toUpperCase();
  return s === '1' || s === 'X' || s === 'SI';
}

function estadoDesdeTexto(texto: string): { estado: EstadoAsistencia; motivo: string | null } | null {
  const t = norm(texto);
  if (!t) return null;
  if (t.startsWith('LIBRE') || t.startsWith('NOCONVOCADO')) return { estado: 'LIBRE', motivo: null };
  if (t.startsWith('FRANCO'))     return { estado: 'FRANCO', motivo: null };
  if (t.startsWith('FALT'))       return { estado: 'AUSENTE', motivo: null };
  if (t.startsWith('LICENCIA'))   return { estado: 'LICENCIA', motivo: texto.trim() };
  if (t.startsWith('VACACION'))   return { estado: 'VACACIONES', motivo: null };
  if (t.startsWith('MEDIC') || t.startsWith('CARPETA')) return { estado: 'JUSTIFICADO', motivo: texto.trim() };
  return null;
}

export function parsePlanillaPresentismo(buffer: Buffer): ParseoPlanillaPresentismo {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const hojas: HojaPlanilla[] = [];
  const advertencias: string[] = [];

  for (const nombreHoja of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nombreHoja], { header: 1, defval: '', raw: true });

    const headerIdx = rows.findIndex(r => r.some(c => norm(c) === 'FECHA') && r.some(c => norm(c) === 'CONVOCATORIA'));
    if (headerIdx < 0) continue; // GRAFICO / Informe / otras hojas sin la tabla diaria

    // NOMBRE y MES: en las filas de arriba, el valor es la primera celda no
    // vacía a la derecha de la etiqueta.
    let nombre = '';
    let mes: string | null = null;
    for (const r of rows.slice(0, headerIdx)) {
      r.forEach((c, i) => {
        const valor = () => String(r.slice(i + 1).find(x => String(x).trim() !== '') ?? '').trim();
        if (norm(c) === 'NOMBRE' && !nombre) nombre = valor();
        if (norm(c) === 'MES' && !mes) mes = valor() || null;
      });
    }
    if (!nombre) { advertencias.push(`Hoja "${nombreHoja}": no tiene NOMBRE, se ignora.`); continue; }

    const header = rows[headerIdx].map(norm);
    const col = (h: string) => header.indexOf(h);
    const iConv = col('CONVOCATORIA'), iFecha = col('FECHA'), iHorario = col('HORARIO'), iObs = col('OBSERVACION');
    const marcas = MARCAS.map(m => ({ ...m, idx: col(m.header) })).filter(m => m.idx >= 0);

    const dias: DiaPlanilla[] = [];
    for (const r of rows.slice(headerIdx + 1)) {
      if (norm(r[0]) === 'TOTAL') break;
      const fecha = fechaCelda(r[iFecha]);
      if (!fecha) continue;

      const convRaw    = r[iConv];
      const convHora   = horaCelda(convRaw);
      const convTexto  = convHora ? '' : String(convRaw ?? '').trim();
      const ingreso    = iHorario >= 0 ? horaCelda(r[iHorario]) : null;
      const observacion = iObs >= 0 ? String(r[iObs] ?? '').trim() || null : null;

      const marcadas = marcas.filter(m => esMarca(r[m.idx]));
      if (marcadas.length > 1) {
        advertencias.push(`${nombre} ${fecha}: tiene ${marcadas.length} marcas (${marcadas.map(m => m.header).join(', ')}) — se toma ${marcadas[0].header}.`);
      }

      let estado: EstadoAsistencia | null = null;
      let motivo: string | null = null;
      let origen: DiaPlanilla['origen_estado'] = 'MARCA';
      const porTexto = estadoDesdeTexto(convTexto);

      if (marcadas.length > 0) {
        estado = marcadas[0].estado;
        motivo = marcadas[0].motivo ?? null;
        if (porTexto?.estado === 'LICENCIA' && estado === 'LIBRE') { estado = 'LICENCIA'; motivo = porTexto.motivo; }
      } else if (porTexto) {
        estado = porTexto.estado; motivo = porTexto.motivo; origen = 'CONVOCATORIA';
      } else if (ingreso) {
        estado = clasificarLlegada(convHora, ingreso) ?? 'PRESENTE'; origen = 'HORARIO';
      }
      if (!estado) continue;

      dias.push({
        fecha, estado, origen_estado: origen,
        hora_convocatoria: convHora,
        hora_ingreso:      ingreso,
        motivo:            [motivo, observacion].filter(Boolean).join(' — ') || null,
      });
    }

    // La hoja JAZ dice MES "AGOSTO" pero sus fechas son de septiembre: manda la fecha.
    if (mes && dias.length > 0) {
      const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
      const mesHoja = MESES.indexOf(norm(mes) === 'SETIEMBRE' ? 'SEPTIEMBRE' : norm(mes)) + 1;
      const mesFechas = Number(dias[0].fecha.slice(5, 7));
      if (mesHoja > 0 && mesHoja !== mesFechas) {
        advertencias.push(`Hoja "${nombreHoja}": el encabezado dice ${mes} pero las fechas son del mes ${mesFechas} — se usan las fechas.`);
      }
    }

    hojas.push({ hoja: nombreHoja, nombre, mes, dias });
  }

  return { hojas, advertencias };
}

// ── Match de empleado ─────────────────────────────────────────────────────────

interface EmpleadoMatch { id: number; nombre: string; apellido: string; apodo: string | null; hora_convocatoria_default: string | null }

// "OLIVETTO ANDREA" ↔ apellido Olivetto + nombre "Cristina Andrea": todos los
// tokens del apellido y al menos uno del nombre tienen que estar en el NOMBRE
// de la hoja (en cualquier orden — "FLORENCIA GOMEZ" viene al revés). Si no
// hay un único candidato, se prueba el nombre de la hoja contra el apodo
// (FURIA, TONI, POLA…), pero sólo si ninguna palabra del NOMBRE contradice al
// empleado: la hoja GONZALO es "CATALANO GONZALO", no Arias Gonzalo (apodo
// "Gonzalo").
export function matchEmpleado(nombreHoja: string, hoja: string, empleados: EmpleadoMatch[]): EmpleadoMatch | null {
  const t = tokens(nombreHoja);
  const set = new Set(t);
  const candidatos = empleados.filter(e => {
    const ap = tokens(e.apellido);
    const no = tokens(e.nombre);
    return ap.length > 0 && ap.every(x => set.has(x)) && no.some(x => set.has(x));
  });
  if (candidatos.length === 1) return candidatos[0];
  const porApodo = empleados.filter(e => {
    if (!e.apodo || norm(e.apodo) !== norm(hoja)) return false;
    const propios = new Set([...tokens(e.apellido), ...tokens(e.nombre), ...tokens(e.apodo)]);
    return t.every(x => propios.has(x));
  });
  if (porApodo.length === 1) return porApodo[0];
  return null;
}

// ── Aplicación ────────────────────────────────────────────────────────────────

export interface ResultadoImportPresentismo {
  preview:      boolean;
  hojas: {
    hoja: string; nombre: string;
    empleado: { id: number; label: string } | null;
    dias: number; nuevos: number; cambian: number;
    // días sin marca de Lorena, clasificados por la hora de llegada
    por_horario: number;
    por_estado: Partial<Record<EstadoAsistencia, number>>;
  }[];
  creados:      number;
  actualizados: number;
  sin_cambios:  number;
  advertencias: string[];
}

export async function aplicarPlanillaPresentismo(
  empresaId: number, usuarioId: number, parseo: ParseoPlanillaPresentismo, dryRun: boolean,
): Promise<ResultadoImportPresentismo> {
  const empleados = await prisma.empleado.findMany({
    where:  { empresa_id: empresaId, deleted_at: null },
    select: { id: true, nombre: true, apellido: true, apodo: true, hora_convocatoria_default: true },
  });

  const resultado: ResultadoImportPresentismo = {
    preview: dryRun, hojas: [], creados: 0, actualizados: 0, sin_cambios: 0, advertencias: [...parseo.advertencias],
  };

  const sinEmpleado: string[] = [];

  for (const hoja of parseo.hojas) {
    const empleado = matchEmpleado(hoja.nombre, hoja.hoja, empleados);
    const porEstado: Partial<Record<EstadoAsistencia, number>> = {};
    for (const d of hoja.dias) porEstado[d.estado] = (porEstado[d.estado] ?? 0) + 1;
    const fila = {
      hoja: hoja.hoja, nombre: hoja.nombre,
      empleado: empleado ? { id: empleado.id, label: `${empleado.apellido}, ${empleado.nombre}` } : null,
      dias: hoja.dias.length, nuevos: 0, cambian: 0, por_estado: porEstado,
      por_horario: hoja.dias.filter(d => d.origen_estado === 'HORARIO').length,
    };
    resultado.hojas.push(fila);

    if (!empleado) {
      if (hoja.dias.length > 0) sinEmpleado.push(`${hoja.nombre} (${hoja.hoja})`);
      continue;
    }
    if (hoja.dias.length === 0) continue;

    const fechas = hoja.dias.map(d => new Date(`${d.fecha}T00:00:00.000Z`));
    const [existentes, jornadas] = await Promise.all([
      prisma.registroAsistencia.findMany({ where: { empresa_id: empresaId, empleado_id: empleado.id, fecha: { in: fechas } } }),
      prisma.jornada.findMany({ where: { empleado_id: empleado.id, fecha: { in: fechas } }, select: { id: true, fecha: true } }),
    ]);
    const existentePorFecha = new Map(existentes.map(r => [r.fecha.toISOString().slice(0, 10), r]));
    const jornadaPorFecha   = new Map(jornadas.map(j => [j.fecha.toISOString().slice(0, 10), j.id]));

    for (const d of hoja.dias) {
      const fecha = new Date(`${d.fecha}T00:00:00.000Z`);
      const ex = existentePorFecha.get(d.fecha);
      const vivo = ex && !ex.deleted_at ? ex : null;

      const igual = vivo
        && vivo.estado === d.estado
        && (vivo.hora_ingreso ?? null) === d.hora_ingreso
        && (vivo.hora_convocatoria ?? null) === d.hora_convocatoria
        && (vivo.motivo ?? null) === d.motivo;
      if (igual) { resultado.sin_cambios++; continue; }
      if (vivo) { fila.cambian++; resultado.actualizados++; } else { fila.nuevos++; resultado.creados++; }
      if (dryRun) continue;

      const esTarde = d.estado === 'TARDE';
      // Una tardanza que Matías ya resolvió no se vuelve a pedir al reimportar.
      const conservaAprobacion = esTarde && vivo?.estado === 'TARDE' && vivo.tardanza_aprobada !== null;
      const minutos = d.estado === 'DEMORA' || esTarde
        ? calcularMinutosTardanza(d.hora_convocatoria ?? empleado.hora_convocatoria_default, d.hora_ingreso)
        : null;

      const data = {
        estado:            d.estado,
        hora_ingreso:      d.hora_ingreso,
        hora_convocatoria: d.hora_convocatoria,
        horas_trabajadas:  calcularHorasTrabajadas(d.hora_ingreso, vivo?.hora_egreso ?? null),
        minutos_tardanza:  minutos,
        motivo:            d.motivo,
        origen:            'IMPORTACION',
        jornada_id:        jornadaPorFecha.get(d.fecha) ?? vivo?.jornada_id ?? null,
        deleted_at:        null,
        descuenta_presentismo: conservaAprobacion ? vivo!.descuenta_presentismo : DESCUENTA_POR_DEFECTO[d.estado],
        tardanza_requiere_aprobacion: esTarde,
        ...(!conservaAprobacion && { tardanza_aprobada: null, tardanza_aprobada_por: null, tardanza_aprobada_at: null, tardanza_nota: null }),
      };

      await prisma.registroAsistencia.upsert({
        where:  { empresa_id_empleado_id_fecha: { empresa_id: empresaId, empleado_id: empleado.id, fecha } },
        create: { ...data, empresa_id: empresaId, empleado_id: empleado.id, fecha, created_by: usuarioId },
        update: data,
      });
    }
  }

  if (sinEmpleado.length > 0) {
    resultado.advertencias.unshift(`${sinEmpleado.length} persona${sinEmpleado.length !== 1 ? "s" : ""} de la planilla no ${sinEmpleado.length !== 1 ? "están cargadas" : "está cargada"} como empleado y sus días no se importan: ${sinEmpleado.join(", ")}. Dalas de alta en RRHH y volvé a importar.`);
  }
  return resultado;
}
