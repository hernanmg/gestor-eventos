import * as XLSX from 'xlsx';
import type { EstadoPagoFijo } from '@prisma/client';
import { prisma } from './prisma';
import { registrarAuditoria } from './auditoria';

// ── Importador de la PLANILLA PAGOS MENSUALES TOTALES (Mayra) ────────────────
// docs/dos57/mayra/PLANILLAS VARIAS DE CONTROL. Una hoja por mes ("MARZO 2024")
// con bloques: MATIAS PERSONAL, POLLO PERSONAL, COWORKING, ENJOY, DOS57. Cada
// bloque es una fila de título (celda combinada), el encabezado
// SERVICIO | DATOS | MODO DE PAGO | VENCIMIENTO | MONTO | ESTADO y las filas;
// la columna G a veces trae una nota ("CAJA $125.000").
//
// Reglas:
//  - El bloque ENJOY sólo entra en Enjoy y el DOS57 en DOS57 (grupo "Empresa").
//    Los otros entran con su nombre de grupo si se eligen (no vienen marcados:
//    falta definir si los personales de los socios van en el sistema, y el
//    coworking puede estar ya en Espacios compartidos).
//  - "PLAN AFIP …" no se importa: las cuotas están en AFIP / Créditos y la
//    agenda las muestra desde ahí.
//  - DATOS: se guarda sólo el n° de cliente / contrato. Se descartan mails,
//    "AFIP <cuit> / <clave>", lo que sigue a un mail o a un teléfono y los links
//    a archivos — la planilla tiene usuarios y claves escritos.
//  - "SUELDOS DOS57 FEBRERO 2024" → concepto "SUELDOS DOS57" (el mes sale de la hoja).
//  - Clave del concepto: grupo|nombre|ocurrencia (TARJETA CORPORATIVA va dos
//    veces, una por banco). Reimportar no duplica: el concepto y el mes sólo
//    completan lo que esté vacío, y el estado sólo si el mes seguía pendiente.

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (v: unknown) => sinAcentos(String(v ?? '')).toUpperCase().replace(/\s+/g, ' ').trim();
const texto = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();

function periodoDeHoja(nombre: string): string | null {
  const m = norm(nombre).match(/^(SETIEMBRE|[A-Z]+)\s+(\d{4})$/);
  if (!m) return null;
  const idx = m[1] === 'SETIEMBRE' ? 8 : MESES.indexOf(m[1]);
  return idx < 0 ? null : `${m[2]}-${String(idx + 1).padStart(2, '0')}`;
}

// Serial de Excel → medianoche UTC (sin pasar por la hora local)
function fechaSerial(v: unknown): Date | null {
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  return null;
}

const ETIQUETA_REF = /^(contrato|cliente|client|medidor|cuenta|nis|dni|socio|suministro|n[°º]|nro)\b/i;
// Devuelve la referencia que se puede guardar y cuántas partes se descartaron.
export function limpiarReferencia(raw: unknown): { ref: string | null; omitidos: number } {
  const s = texto(raw);
  if (!s) return { ref: null, omitidos: 0 };
  if (s.startsWith('..') || s.includes('\\')) return { ref: null, omitidos: 0 }; // link a un archivo
  const partes = s.split(/\s+\/\s+/);
  const guardar: string[] = [];
  let omitidos = 0;
  const primeraEsAcceso = /@|^mail\b|^afip\b|^wsp\b|\+\d/i.test(partes[0]);
  partes.forEach((p, i) => {
    const acceso = /@|^mail\b|^afip\b|clave|contrase|pass/i.test(p);
    const ok = !acceso && (i === 0 ? !primeraEsAcceso : ETIQUETA_REF.test(p));
    if (ok) guardar.push(p); else omitidos++;
  });
  // "WSP AL +54 …" sin la parte que sigue: el teléfono del proveedor sí sirve
  if (primeraEsAcceso && /^wsp\b/i.test(partes[0])) { guardar.unshift(partes[0]); omitidos--; }
  return { ref: guardar.length ? guardar.join(' / ') : null, omitidos };
}

// "DÉBITO EN CUENTA GALICIA" → "Débito en cuenta Galicia"
const SIGLAS: Record<string, string> = { vep: 'VEP', bbva: 'BBVA', galicia: 'Galicia', nacion: 'Nación', 'nación': 'Nación', bancor: 'Bancor', frances: 'Francés', 'francés': 'Francés', mayra: 'Mayra', andre: 'Andre', fede: 'Fede', matias: 'Matías', 'patrón': 'patrón' };
export function medioLegible(raw: unknown): string | null {
  const s = texto(raw);
  if (!s) return null;
  const words = s.toLowerCase().split(' ').map(w => SIGLAS[w] ?? w);
  const out = words.join(' ');
  return out.charAt(0).toUpperCase() + out.slice(1);
}

function parseEstado(raw: unknown): { estado: EstadoPagoFijo; nota: string | null } {
  const s = norm(raw);
  if (!s) return { estado: 'PENDIENTE', nota: null };
  const nota = texto(raw);
  if (/^SE PAGO/.test(s)) return { estado: 'NO_CORRESPONDE', nota };
  if (/^DEBITADO/.test(s)) return { estado: 'DEBITADO', nota: s === 'DEBITADO' ? null : nota };
  if (/^PAGADO/.test(s)) return { estado: 'PAGADO', nota: s === 'PAGADO' ? null : nota };
  if (/A FAVOR/.test(s)) return { estado: 'A_FAVOR', nota: null };
  return { estado: 'PENDIENTE', nota };
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
function grupoDeSeccion(sec: string): string {
  if (sec === 'ENJOY' || sec === 'DOS57') return 'Empresa';
  return titleCase(sec).replace(/^Matias\b/, 'Matías');
}
const nombreConcepto = (nombre: string) =>
  nombre.replace(new RegExp(`\\s+(${MESES.join('|')}|SETIEMBRE)\\s+\\d{4}$`, 'i'), '').trim();

interface FilaPlanilla {
  periodo: string; seccion: string; nombre: string; key: string;
  referencia: string | null; medio: string | null; vencimiento: Date | null; venc_texto: string | null;
  monto: number | null; estado: EstadoPagoFijo; notas: string | null;
}

export function leerPlanilla(buffer: Buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const filas: FilaPlanilla[] = [];
  const hojas: string[] = [];
  let omitidosAfip = 0;
  let omitidosAcceso = 0;
  for (const nombreHoja of wb.SheetNames) {
    const periodo = periodoDeHoja(nombreHoja);
    if (!periodo) continue;
    hojas.push(periodo);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nombreHoja], { header: 1, raw: true, defval: null });
    let seccion: string | null = null;
    const ocurrencias = new Map<string, number>();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const a = texto(r[0]);
      if (!a) continue;
      // Título de bloque: celda combinada (sólo la columna A) y abajo el encabezado SERVICIO
      if (norm(rows[i + 1]?.[0]) === 'SERVICIO') { seccion = norm(a); ocurrencias.clear(); continue; }
      if (norm(a) === 'SERVICIO') continue;
      if (!seccion) continue;
      if (/^PLAN AFIP/i.test(a)) { omitidosAfip++; continue; }
      const nombre = nombreConcepto(a);
      const base = `${seccion}|${norm(nombre)}`;
      const k = (ocurrencias.get(base) ?? 0) + 1;
      ocurrencias.set(base, k);
      const { ref, omitidos } = limpiarReferencia(r[1]);
      omitidosAcceso += omitidos;
      const venc = fechaSerial(r[3]);
      const vencTexto = !venc && texto(r[3]) ? texto(r[3]) : null;
      const montoRaw = r[4];
      const monto = typeof montoRaw === 'number' ? Math.round(montoRaw * 100) / 100 : null;
      const { estado, nota } = parseEstado(r[5]);
      const notas = [nota, texto(r[6]) || null, vencTexto ? `Vence ${vencTexto}` : null].filter(Boolean).join(' · ') || null;
      filas.push({
        periodo, seccion, nombre, key: `${base}|${k}`, referencia: ref, medio: medioLegible(r[2]),
        vencimiento: venc, venc_texto: vencTexto, monto, estado, notas,
      });
    }
  }
  return { filas, hojas: [...new Set(hojas)].sort(), omitidosAfip, omitidosAcceso };
}

const esDeEmpresa = (seccion: string, empresaNombre: string) =>
  (seccion === 'ENJOY' && /enjoy/i.test(empresaNombre)) || (seccion === 'DOS57' && /dos\s?57/i.test(empresaNombre));

export async function procesarPagosFijos(
  buffer: Buffer, empresa: { id: number; nombre: string }, usuarioId: number, aplicar: boolean, seccionesElegidas?: string[],
) {
  const { filas, hojas, omitidosAfip, omitidosAcceso } = leerPlanilla(buffer);
  if (!filas.length) throw new Error('No encontré hojas por mes ("MARZO 2024") con el formato de la planilla de pagos mensuales');

  const nombresSecciones = [...new Set(filas.map(f => f.seccion))];
  const secciones = nombresSecciones.map(sec => {
    const empresaSec = sec === 'ENJOY' || sec === 'DOS57';
    const importable = !empresaSec || esDeEmpresa(sec, empresa.nombre);
    const delGrupo = filas.filter(f => f.seccion === sec);
    const conceptos = new Map<string, FilaPlanilla>();
    for (const f of delGrupo) conceptos.set(f.key, f); // queda la del último mes
    return {
      clave: sec,
      titulo: sec,
      grupo: grupoDeSeccion(sec),
      importable,
      por_defecto: importable && empresaSec,
      aviso: !importable ? `Es de la otra empresa: cambiá a ${sec === 'ENJOY' ? 'Enjoy' : 'DOS57'} para importarlo`
        : sec === 'COWORKING' ? 'Si el coworking ya está en Espacios compartidos, no lo importes: quedaría dos veces'
        : /PERSONAL/.test(sec) ? 'Gastos personales del socio: importalo sólo si se llevan en el sistema'
        : null,
      conceptos: [...conceptos.values()].map(f => ({ nombre: f.nombre, medio_pago: f.medio, referencia: f.referencia, ultimo_monto: f.monto })),
      meses_con_datos: delGrupo.filter(f => f.vencimiento || f.monto != null || f.estado !== 'PENDIENTE').length,
    };
  });
  const elegidas = new Set(
    (seccionesElegidas ?? secciones.filter(s => s.por_defecto).map(s => s.clave))
      .filter(c => secciones.some(s => s.clave === c && s.importable)),
  );

  const resultado = {
    hojas, secciones, elegidas: [...elegidas],
    omitidos: { afip: omitidosAfip, datos_de_acceso: omitidosAcceso },
    aplicado: false, conceptos_creados: 0, conceptos_actualizados: 0, meses_creados: 0, meses_actualizados: 0,
  };
  if (!aplicar) return resultado;
  if (!elegidas.size) throw new Error('Elegí al menos un bloque para importar');

  const aImportar = filas.filter(f => elegidas.has(f.seccion)).sort((a, b) => a.periodo.localeCompare(b.periodo));
  // Datos del concepto: los del último mes en que aparecen
  const porKey = new Map<string, FilaPlanilla[]>();
  for (const f of aImportar) porKey.set(f.key, [...(porKey.get(f.key) ?? []), f]);

  await prisma.$transaction(async tx => {
    let orden = 0;
    for (const [key, meses] of porKey) {
      orden++;
      const ultimo = meses[meses.length - 1];
      const ultimoVenc = [...meses].reverse().find(m => m.vencimiento)?.vencimiento ?? null;
      const ultimoMonto = [...meses].reverse().find(m => m.monto != null && m.monto > 0)?.monto ?? null;
      const ultimaRef = [...meses].reverse().find(m => m.referencia)?.referencia ?? null;
      const ultimoMedio = [...meses].reverse().find(m => m.medio)?.medio ?? null;
      const datos = {
        grupo: grupoDeSeccion(ultimo.seccion), nombre: ultimo.nombre, referencia: ultimaRef, medio_pago: ultimoMedio,
        dia_vencimiento: ultimoVenc ? ultimoVenc.getUTCDate() : null, monto_estimado: ultimoMonto,
      };
      const existente = await tx.pagoFijo.findUnique({ where: { empresa_id_import_key: { empresa_id: empresa.id, import_key: key } } });
      let conceptoId: number;
      if (existente) {
        const completar: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(datos)) if ((existente as any)[k] == null && v != null) completar[k] = v;
        if (existente.deleted_at) completar.deleted_at = null;
        if (Object.keys(completar).length) { await tx.pagoFijo.update({ where: { id: existente.id }, data: completar }); resultado.conceptos_actualizados++; }
        conceptoId = existente.id;
      } else {
        const c = await tx.pagoFijo.create({ data: { ...datos, empresa_id: empresa.id, import_key: key, orden, created_by: usuarioId } });
        conceptoId = c.id;
        resultado.conceptos_creados++;
      }

      for (const m of meses) {
        const tieneDatos = m.vencimiento || m.monto != null || m.estado !== 'PENDIENTE' || m.notas;
        if (!tieneDatos) continue;
        const pagado = m.estado === 'PAGADO' || m.estado === 'DEBITADO';
        const ya = await tx.pagoFijoMes.findUnique({ where: { pago_fijo_id_periodo: { pago_fijo_id: conceptoId, periodo: m.periodo } } });
        if (!ya) {
          await tx.pagoFijoMes.create({
            data: {
              pago_fijo_id: conceptoId, periodo: m.periodo, vencimiento: m.vencimiento, monto: m.monto, estado: m.estado,
              // La planilla no dice cuándo se pagó: se toma el vencimiento
              fecha_pago: pagado ? m.vencimiento : null, medio_pago: m.medio, notas: m.notas, created_by: usuarioId, updated_by: usuarioId,
            },
          });
          resultado.meses_creados++;
        } else {
          const completar: Record<string, unknown> = {};
          if (ya.vencimiento == null && m.vencimiento) completar.vencimiento = m.vencimiento;
          if (ya.monto == null && m.monto != null) completar.monto = m.monto;
          if (ya.medio_pago == null && m.medio) completar.medio_pago = m.medio;
          if (ya.notas == null && m.notas) completar.notas = m.notas;
          if (ya.estado === 'PENDIENTE' && m.estado !== 'PENDIENTE') { completar.estado = m.estado; if (pagado && !ya.fecha_pago) completar.fecha_pago = m.vencimiento; }
          if (Object.keys(completar).length) { await tx.pagoFijoMes.update({ where: { id: ya.id }, data: { ...completar, updated_by: usuarioId } }); resultado.meses_actualizados++; }
        }
      }
    }
    await registrarAuditoria({
      usuarioId, empresaId: empresa.id, accion: 'IMPORT', entidad: 'PagoFijo',
      descripcion: `Importó la planilla de pagos mensuales (${[...elegidas].join(', ')}): ${resultado.conceptos_creados} pagos fijos nuevos, ${resultado.meses_creados} meses`,
      tx: tx as any,
    });
  }, { timeout: 60000 });
  resultado.aplicado = true;
  return resultado;
}
