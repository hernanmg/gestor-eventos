import * as XLSX from 'xlsx';
import type { TipoCambioVehiculo } from '@prisma/client';
import { prisma } from './prisma';
import { registrarAuditoria } from './auditoria';
import { ROTACION_CADA_KM } from './cambiosVehiculo';

// Importador de NOVEDADES Y PENDIENTES PARQUE AUTOMOTOR (Santi), hojas
// "CAMBIO DE NEUMATICOS" y "CAMBIO DE BATERIA".
//   Neumáticos, tabla 1: MARCA Y MODELO | numero | DOMINIO | ÚLTIMO RODAMIENTO |
//     km actual | PROXIMO ROTACION | FECHA DE COLOCACIÓN | OBSERVACIONES
//   Neumáticos, tabla 2 (autoelevadores): MARCA Y MODELO | numero | RUEDAS
//     DELANTERAS | RUEDAS TRASERAS | SINTESIS | ULT.CAMBIO | DESCRIPCION
//   Batería: MARCA Y MODELO | numero | DOMINIO | ÚLTIMO CAMBIO | PROXIMO CAMBIO | OBSERVACIONES
// El vehículo se busca por patente (sin espacios); los autoelevadores por su
// número (AUTOELEV-N). Una patente con una letra cambiada o dos letras
// invertidas se acepta si hay un solo vehículo así, y se avisa.
// Reimportar no duplica (import_key) y sólo completa lo vacío. El km actual
// del vehículo se actualiza sólo si la planilla tiene uno mayor.

type Celda = string | number | Date | null;

const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const patenteNorm = (s: unknown) => norm(s).replace(/[^A-Z0-9]/g, '');

function fechaCal(v: Celda): Date | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    const d = new Date(v.getTime() + 12 * 3_600_000); // la planilla trae la medianoche de Argentina
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  return null;
}
function entero(v: Celda): number | null {
  if (typeof v === 'number' && isFinite(v)) return Math.round(v);
  const t = String(v ?? '').replace(/[^\d]/g, '');
  return t ? Number(t) : null;
}
const texto = (v: Celda) => { const t = String(v ?? '').trim(); return t && t !== '-' ? t : null; };
const cap = (t: string | null) => (t ? t.charAt(0) + t.slice(1).toLowerCase() : null);

// Damerau-Levenshtein ≤ 1 (una letra cambiada, de más, de menos o dos invertidas)
function casiIgual(a: string, b: string) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const dif = [...a].map((c, i) => (c !== b[i] ? i : -1)).filter(i => i >= 0);
    if (dif.length === 1) return true;
    return dif.length === 2 && dif[1] === dif[0] + 1 && a[dif[0]] === b[dif[1]] && a[dif[1]] === b[dif[0]];
  }
  const [l, c] = a.length > b.length ? [a, b] : [b, a];
  for (let i = 0; i < l.length; i++) if (l.slice(0, i) + l.slice(i + 1) === c) return true;
  return false;
}

interface Accion {
  tipo: TipoCambioVehiculo; fecha: Date | null; km: number | null; detalle: string | null;
  proximo_km: number | null; proxima_fecha: Date | null; notas: string | null; clave: string;
}
export interface FilaCambios {
  hoja: string; fila: number; vehiculo: string;
  camion: { id: number; codigo: string } | null; aproximado: boolean;
  acciones: (Accion & { estado: 'NUEVO' | 'EXISTE' })[];
  km_actual: number | null;
}
export interface ResultadoCambios {
  aplicado: boolean;
  filas: FilaCambios[];
  sin_vehiculo: { hoja: string; fila: number; vehiculo: string }[];
  nuevos: number; existentes: number; km_actualizados: { codigo: string; antes: number | null; despues: number }[];
}

function buscarHeader(rows: Celda[][], pred: (h: string[]) => boolean, desde = 0) {
  for (let i = desde; i < rows.length; i++) { const h = (rows[i] ?? []).map(norm); if (pred(h)) return { i, h }; }
  return null;
}
const col = (h: string[], re: RegExp) => h.findIndex(x => re.test(x));

export async function procesarCambiosVehiculo(buffer: Buffer, empresaId: number, usuarioId: number, aplicar: boolean): Promise<ResultadoCambios> {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const hojaNeu = wb.SheetNames.find(n => /NEUMATIC/.test(norm(n)));
  const hojaBat = wb.SheetNames.find(n => /BATERI/.test(norm(n)));
  if (!hojaNeu && !hojaBat) throw new Error('El archivo no tiene las hojas CAMBIO DE NEUMATICOS ni CAMBIO DE BATERIA.');

  const camiones = await prisma.camion.findMany({ where: { empresa_id: empresaId, deleted_at: null }, select: { id: true, codigo: true, patente: true, km_actual: true } });
  const porPatente = new Map<string, typeof camiones[number]>();
  // Primero los códigos: un acoplado comparte la patente de su tractor ("HLW156-ACOPLADO"),
  // y la patente suelta tiene que ser la del vehículo cuyo código es esa patente.
  for (const c of camiones) porPatente.set(patenteNorm(c.codigo), c);
  for (const c of camiones) if (c.patente && !porPatente.has(patenteNorm(c.patente))) porPatente.set(patenteNorm(c.patente), c);

  const buscar = (dominio: Celda, numero: Celda, modelo: Celda): { camion: typeof camiones[number] | null; aproximado: boolean } => {
    const m = norm(modelo), d = norm(dominio);
    if (/AUTOELEV/.test(m) || /^NUMERO \d|^4X4$/.test(d)) {
      const n = entero(numero) ?? entero(d.replace(/\D/g, '') ? d : '');
      const cod = n != null && !/4X4/.test(m + d) ? `AUTOELEV-${n}` : null;
      const c = cod ? camiones.find(x => x.codigo.toUpperCase() === cod) ?? null : null;
      return { camion: c, aproximado: false };
    }
    const p = patenteNorm(dominio);
    if (!p) return { camion: null, aproximado: false };
    const exacto = porPatente.get(p);
    if (exacto) return { camion: exacto, aproximado: false };
    const cand = [...new Map([...porPatente.entries()].filter(([k]) => casiIgual(k, p)).map(([, c]) => [c.id, c])).values()];
    return cand.length === 1 ? { camion: cand[0], aproximado: true } : { camion: null, aproximado: false };
  };

  const filas: FilaCambios[] = [];
  const sinVehiculo: ResultadoCambios['sin_vehiculo'] = [];
  const agregar = (hoja: string, fila: number, vehiculo: string, b: ReturnType<typeof buscar>, acciones: Accion[], kmActual: number | null) => {
    if (!acciones.length && kmActual == null) return;
    if (!b.camion) { sinVehiculo.push({ hoja, fila, vehiculo }); return; }
    filas.push({ hoja, fila, vehiculo, camion: { id: b.camion.id, codigo: b.camion.codigo }, aproximado: b.aproximado, acciones: acciones.map(a => ({ ...a, estado: 'NUEVO' as const })), km_actual: kmActual });
  };

  if (hojaNeu) {
    const rows: Celda[][] = XLSX.utils.sheet_to_json(wb.Sheets[hojaNeu], { header: 1, defval: null, raw: true });
    const t1 = buscarHeader(rows, h => h.some(x => /^DOMINIO/.test(x)) && h.some(x => /COLOCACI/.test(x)));
    if (t1) {
      const h = t1.h;
      const c = { modelo: col(h, /MARCA/), num: col(h, /^NUMERO/), dom: col(h, /^DOMINIO/), rod: col(h, /RODAMIENTO/), km: col(h, /^KM ACTUAL/), prox: col(h, /PROXIM/), fecha: col(h, /COLOCACI/), obs: col(h, /OBSERVAC/) };
      for (let i = t1.i + 1; i < rows.length; i++) {
        const r = rows[i] ?? [];
        if ((r ?? []).map(norm).some(x => /RUEDAS DELANTERAS/.test(x))) break;  // empieza la tabla de autoelevadores
        const dominio = r[c.dom]; if (!texto(dominio)) continue;
        const b = buscar(dominio, r[c.num], r[c.modelo]);
        const p = patenteNorm(dominio);
        const fecha = fechaCal(r[c.fecha]); const obs = texto(r[c.obs]); const rod = entero(texto(r[c.rod]) ? r[c.rod] : null);
        const acciones: Accion[] = [];
        if (fecha || obs) acciones.push({ tipo: 'NEUMATICOS', fecha, km: null, detalle: obs, proximo_km: null, proxima_fecha: null, notas: null, clave: `NEU|${p}|${fecha ? fecha.toISOString().slice(0, 10) : 'sin-fecha'}` });
        if (rod != null) acciones.push({ tipo: 'ROTACION', fecha: null, km: rod, detalle: null, proximo_km: entero(texto(r[c.prox]) ? r[c.prox] : null) ?? rod + ROTACION_CADA_KM, proxima_fecha: null, notas: null, clave: `ROT|${p}|${rod}` });
        agregar(hojaNeu, i + 1, `${texto(r[c.modelo]) ?? ''} ${texto(dominio)}`.trim(), b, acciones, entero(texto(r[c.km]) ? r[c.km] : null));
      }
    }
    const t2 = buscarHeader(rows, h => h.some(x => /RUEDAS DELANTERAS/.test(x)));
    if (t2) {
      const h = t2.h;
      const c = { modelo: col(h, /MARCA/), num: col(h, /^NUMERO/), del: col(h, /DELANTERAS/), tras: col(h, /TRASERAS/), sint: col(h, /SINTESIS/), fecha: col(h, /ULT/), desc: col(h, /DESCRIPCION/) };
      for (let i = t2.i + 1; i < rows.length; i++) {
        const r = rows[i] ?? [];
        const modelo = texto(r[c.modelo]); if (!modelo) continue;
        const numero = r[c.num];
        const b = buscar(null, numero, `${modelo} ${texto(numero) ?? ''}`);
        const fecha = fechaCal(r[c.fecha]);
        const ruedas = [texto(r[c.del]) && `delanteras ${String(r[c.del]).toLowerCase()}`, texto(r[c.tras]) && `traseras ${String(r[c.tras]).toLowerCase()}`].filter(Boolean).join(', ');
        const notas = [ruedas && `Ruedas ${ruedas}`, cap(texto(r[c.sint]))].filter(Boolean).join('. ') || null;
        const id = b.camion?.codigo ?? `${modelo}${texto(numero) ?? ''}`;
        agregar(hojaNeu, i + 1, `${modelo} ${texto(numero) ?? ''}`.trim(), b, [{ tipo: 'NEUMATICOS', fecha, km: null, detalle: texto(r[c.desc]), proximo_km: null, proxima_fecha: null, notas, clave: `NEU|${patenteNorm(id)}|${fecha ? fecha.toISOString().slice(0, 10) : 'sin-fecha'}` }], null);
      }
    }
  }

  if (hojaBat) {
    const rows: Celda[][] = XLSX.utils.sheet_to_json(wb.Sheets[hojaBat], { header: 1, defval: null, raw: true });
    const t = buscarHeader(rows, h => h.some(x => /^DOMINIO/.test(x)) && h.some(x => /ULTIMO CAMBIO/.test(x)));
    if (t) {
      const h = t.h;
      const c = { modelo: col(h, /MARCA/), num: col(h, /^NUMERO/), dom: col(h, /^DOMINIO/), ult: col(h, /ULTIMO CAMBIO/), prox: col(h, /PROXIMO/), obs: col(h, /OBSERVAC/) };
      for (let i = t.i + 1; i < rows.length; i++) {
        const r = rows[i] ?? [];
        const dominio = r[c.dom]; if (!texto(dominio)) continue;
        const fecha = fechaCal(r[c.ult]);
        if (!fecha) continue;   // sin fecha de cambio no hay nada que registrar
        const b = buscar(dominio, r[c.num], r[c.modelo]);
        const id = b.camion?.codigo ?? patenteNorm(dominio);
        agregar(hojaBat, i + 1, `${texto(r[c.modelo]) ?? ''} ${texto(dominio)}`.trim(), b,
          [{ tipo: 'BATERIA', fecha, km: null, detalle: texto(r[c.obs]), proximo_km: null, proxima_fecha: fechaCal(r[c.prox]), notas: null, clave: `BAT|${patenteNorm(id)}|${fecha.toISOString().slice(0, 10)}` }], null);
      }
    }
  }

  // Ya importados
  const claves = filas.flatMap(f => f.acciones.map(a => a.clave));
  const existentes = await prisma.cambioVehiculo.findMany({ where: { empresa_id: empresaId, import_key: { in: claves } } });
  const porClave = new Map(existentes.map(e => [e.import_key!, e]));
  let nuevos = 0, yaEstaban = 0;
  for (const f of filas) for (const a of f.acciones) { if (porClave.has(a.clave)) { a.estado = 'EXISTE'; yaEstaban++; } else nuevos++; }

  const kmActualizados: ResultadoCambios['km_actualizados'] = [];
  for (const f of filas) {
    const cam = camiones.find(c => c.id === f.camion!.id)!;
    if (f.km_actual != null && (cam.km_actual == null || f.km_actual > cam.km_actual)) kmActualizados.push({ codigo: cam.codigo, antes: cam.km_actual, despues: f.km_actual });
  }

  if (aplicar) {
    await prisma.$transaction(async tx => {
      for (const f of filas) {
        for (const a of f.acciones) {
          const previo = porClave.get(a.clave);
          const datos = { fecha: a.fecha, km: a.km, detalle: a.detalle, proximo_km: a.proximo_km, proxima_fecha: a.proxima_fecha, notas: a.notas };
          if (!previo) {
            await tx.cambioVehiculo.create({ data: { empresa_id: empresaId, camion_id: f.camion!.id, tipo: a.tipo, ...datos, import_key: a.clave, created_by: usuarioId } });
          } else {
            // Reimportar sólo completa lo vacío (lo corregido a mano no se pisa)
            const completar = Object.fromEntries(Object.entries(datos).filter(([k, v]) => v != null && (previo as any)[k] == null));
            if (Object.keys(completar).length && !previo.deleted_at) {
              await tx.cambioVehiculo.update({ where: { id: previo.id }, data: completar });
            }
          }
        }
        const k = kmActualizados.find(x => x.codigo === f.camion!.codigo);
        if (k) await tx.camion.update({ where: { id: f.camion!.id }, data: { km_actual: k.despues } });
      }
      await registrarAuditoria({ usuarioId, empresaId, accion: 'IMPORT', entidad: 'CambioVehiculo', descripcion: `Importó neumáticos y baterías: ${nuevos} nuevos, ${yaEstaban} ya estaban`, tx: tx as any });
    });
  }

  return { aplicado: aplicar, filas, sin_vehiculo: sinVehiculo, nuevos, existentes: yaEstaban, km_actualizados: kmActualizados };
}
