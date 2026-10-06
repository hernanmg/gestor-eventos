import { TipoIndicador } from '@prisma/client';
import { prisma } from './prisma';

// Indicadores económicos globales (sin empresa): dólar oficial y blue
// (dolarapi.com) e IPC mensual del INDEC (series de datos.gob.ar, la misma
// serie que usa GET /rrhh/ipc-indec en sueldos). Cada actualización inserta
// una fila por tipo — se guarda historial para Nivel 2.

const URLS = {
  [TipoIndicador.DOLAR_OFICIAL]: 'https://dolarapi.com/v1/dolares/oficial',
  [TipoIndicador.DOLAR_BLUE]:    'https://dolarapi.com/v1/dolares/blue',
  [TipoIndicador.IPC]:           'https://apis.datos.gob.ar/series/api/series/?ids=145.3_INGNACUAL_DICI_M_38&limit=2&sort=desc',
} as const;

const TIMEOUT_MS = 8000;
const round2 = (n: number) => Math.round(n * 100) / 100;

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (err: any) {
    throw new Error(err?.name === 'AbortError' ? `sin respuesta en ${TIMEOUT_MS / 1000}s` : err?.message ?? String(err));
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchDolar(tipo: 'DOLAR_OFICIAL' | 'DOLAR_BLUE') {
  const j = await fetchJson(URLS[tipo]) as { compra?: unknown; venta?: unknown; fechaActualizacion?: unknown };
  const compra = Number(j.compra);
  const venta  = Number(j.venta);
  if (!(venta > 0) || !(compra > 0)) throw new Error('respuesta sin compra/venta');
  const fecha = typeof j.fechaActualizacion === 'string' ? new Date(j.fechaActualizacion) : null;
  return prisma.indicadorEconomico.create({
    data: {
      tipo, valor: venta, compra, venta,
      fuente_fecha: fecha && !isNaN(fecha.getTime()) ? fecha : null,
    },
  });
}

async function fetchIpc() {
  const j = await fetchJson(URLS.IPC) as { data?: [string, number][] };
  const [fecha, valor] = j.data?.[0] ?? [];
  if (typeof fecha !== 'string' || typeof valor !== 'number' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error('serie vacía o con formato inesperado');
  return prisma.indicadorEconomico.create({
    data: {
      tipo:         TipoIndicador.IPC,
      valor:        round2(valor * 100), // 0.01659 → 1.66 (%)
      periodo:      fecha.slice(0, 7),
      fuente_fecha: new Date(`${fecha}T00:00:00.000Z`), // mes del dato — fecha de negocio, en UTC
    },
  });
}

export interface ErrorIndicador { tipo: TipoIndicador; mensaje: string }

// Consulta las 3 fuentes en paralelo y guarda las que respondieron. Una fuente
// caída no frena a las otras: vuelve en `errores`.
export async function fetchAndSaveIndicadores(): Promise<{ guardados: TipoIndicador[]; errores: ErrorIndicador[] }> {
  const tareas = [
    [TipoIndicador.DOLAR_OFICIAL, fetchDolar('DOLAR_OFICIAL')],
    [TipoIndicador.DOLAR_BLUE,    fetchDolar('DOLAR_BLUE')],
    [TipoIndicador.IPC,           fetchIpc()],
  ] as const;
  const resultados = await Promise.allSettled(tareas.map(([, p]) => p));
  const guardados: TipoIndicador[] = [];
  const errores: ErrorIndicador[] = [];
  resultados.forEach((r, i) => {
    const tipo = tareas[i][0];
    if (r.status === 'fulfilled') guardados.push(tipo);
    else errores.push({ tipo, mensaje: r.reason?.message ?? String(r.reason) });
  });
  return { guardados, errores };
}

const ultimo = (tipo: TipoIndicador) =>
  prisma.indicadorEconomico.findFirst({ where: { tipo }, orderBy: [{ created_at: 'desc' }, { id: 'desc' }] });

// Último registro de cada tipo (null si nunca se pudo obtener)
export async function getIndicadoresActuales() {
  const [oficial, blue, ipc] = await Promise.all([ultimo('DOLAR_OFICIAL'), ultimo('DOLAR_BLUE'), ultimo('IPC')]);
  const dolar = (d: typeof oficial) => d && {
    compra: Number(d.compra), venta: Number(d.venta), fecha: d.fuente_fecha, guardado_en: d.created_at,
  };
  const fechas = [oficial, blue, ipc].filter(Boolean).map(r => r!.created_at.getTime());
  return {
    dolar_oficial:  dolar(oficial),
    dolar_blue:     dolar(blue),
    ipc:            ipc && { valor: Number(ipc.valor), periodo: ipc.periodo, fecha: ipc.fuente_fecha, guardado_en: ipc.created_at },
    actualizado_en: fechas.length ? new Date(Math.max(...fechas)) : null,
  };
}

// Al arrancar el server: sólo si el último dato tiene más de `minutos` — en
// desarrollo nodemon reinicia en cada cambio de archivo y si no se llenaría
// el historial de filas repetidas.
export async function actualizarIndicadoresSiHaceFalta(minutos = 30) {
  const u = await ultimo('DOLAR_OFICIAL');
  if (u && Date.now() - u.created_at.getTime() < minutos * 60_000) return null;
  return fetchAndSaveIndicadores();
}
