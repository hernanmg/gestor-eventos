import { BloqueCostoReal, OrigenLineaCostoReal, Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { withTenant } from './tenant';

// Costo real del evento (DOS57) — la matriz que arma Flor por evento
// (docs/dos57/jazmin/DOS57_NORTE ROCK_2026.xlsx). Cada bloque es una sección de
// la hoja OPEX o una de las hojas de rental / pérdidas. `cc` es el rótulo con el
// que aparece en la hoja resumen "CC (CENTRO DE COSTOS)".

export interface InfoBloque {
  bloque:   BloqueCostoReal;
  label:    string;
  cc:       string;
  unidad:   string;  // qué cuenta la columna "cantidad"
  valor:    string;  // qué es el valor unitario
  // Desde qué parte del sistema se puede traer (null = sólo a mano o importado)
  fuente:   string | null;
}

export const BLOQUES: InfoBloque[] = [
  { bloque: 'STAFF',                label: 'Staff (personal)',        cc: 'Staff Costs',       unidad: 'Turnos',   valor: 'Valor turno', fuente: 'Jornadas del evento (Parte diario)' },
  { bloque: 'ALOJAMIENTO',          label: 'Alojamiento',             cc: 'RO Costs',          unidad: 'Noches',   valor: 'Valor noche', fuente: null },
  { bloque: 'COMIDAS',              label: 'Comidas',                 cc: 'Ref. Costs',        unidad: 'Menús',    valor: 'Valor menú',  fuente: 'Pestaña Comidas del evento' },
  { bloque: 'COMBUSTIBLE_PERSONAL', label: 'Combustible personal',    cc: 'Fu Costs Personal', unidad: 'Litros',   valor: '$ por litro', fuente: 'Cargas y bitácora del evento (camionetas)' },
  { bloque: 'COMBUSTIBLE_MATERIAL', label: 'Combustible material',    cc: 'Fu Costs Material', unidad: 'Litros',   valor: '$ por litro', fuente: 'Cargas y bitácora del evento (camiones)' },
  { bloque: 'PANOL',                label: 'Pañol y consumibles',     cc: 'Tc Costs',          unidad: 'Cantidad', valor: 'Precio',      fuente: null },
  { bloque: 'VARIOS',               label: 'Gastos varios',           cc: 'Misc. Costs',       unidad: 'Cantidad', valor: 'Precio',      fuente: null },
  { bloque: 'RENTAL_NAC',           label: 'Rental nacional',         cc: 'Nacionales',        unidad: 'Cantidad', valor: 'Costo unit.', fuente: 'Remitos del evento × matriz de rental' },
  { bloque: 'RENTAL_IMP',           label: 'Rental importado',        cc: 'Importados',        unidad: 'Cantidad', valor: 'Costo unit.', fuente: 'Remitos del evento × matriz de rental' },
  { bloque: 'PERDIDAS',             label: 'Pérdidas y roturas',      cc: 'L&A Costs',         unidad: 'Cantidad', valor: 'Costo unit.', fuente: 'Faltantes del pañol del evento' },
];

export const INFO_BLOQUE = Object.fromEntries(BLOQUES.map(b => [b.bloque, b])) as Record<BloqueCostoReal, InfoBloque>;

// Porcentaje por default de cada bloque (la matriz: rental al 4%, pérdidas al 10%)
export const PORCENTAJE_DEFAULT: Partial<Record<BloqueCostoReal, number>> = {
  RENTAL_NAC: 4, RENTAL_IMP: 4, PERDIDAS: 10,
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calcularTotal(cantidad: number, valor: number, porcentaje: number | null | undefined): number {
  return r2(cantidad * valor * (porcentaje == null ? 1 : porcentaje / 100));
}

export interface LineaDraft {
  concepto:        string;
  detalle?:        string | null;
  codigo?:         string | null;
  cantidad:        number;
  valor_unitario:  number;
  porcentaje?:     number | null;
  total:           number;
  fecha_desde?:    Date | null;
  fecha_hasta?:    Date | null;
}

// Normaliza textos para cruzar ítems de remito con la matriz de rental
// ("AR Vertical LW 2.00m" ≈ "AR VERTICAL LW 2.00M", sin tildes ni dobles espacios).
export const normalizarTexto = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

// Los códigos Layher llegan como número desde Excel ("4001040.0")
export const normalizarCodigo = (s: string | number | null | undefined) =>
  s == null ? '' : String(s).trim().replace(/\.0+$/, '');

// ── Fuentes del sistema ───────────────────────────────────────────────────────

const NOMBRE_CATEGORIA: Record<string, string> = {
  CAPITAN: 'Capitanes', ARMADOR: 'Armadores', CHOFER: 'Choferes DOS57', ADMINISTRATIVO: 'Administrativos',
  TECNICO: 'Técnicos', JORNALERO: 'Jornaleros', FOFI: 'Fofis', NESTORAS: 'Nestoras',
  EXTRANJERO: 'Extranjeros', SERENO: 'Serenos', OTRO: 'Otros',
};

async function desdeJornadas(eventoId: number, empresaId: number): Promise<{ lineas: LineaDraft[]; avisos: string[] }> {
  const jornadas = await prisma.jornada.findMany({
    where:  { evento_id: eventoId, deleted_at: null, estado: { not: 'RECHAZADA' }, ...withTenant(empresaId) },
    select: { empleado: { select: { id: true, categoria: true, valor_jornada_completa: true } } },
  });
  const grupos = new Map<string, { turnos: number; total: number; personas: Set<number>; sinValor: number }>();
  for (const j of jornadas) {
    const g = grupos.get(j.empleado.categoria) ?? { turnos: 0, total: 0, personas: new Set(), sinValor: 0 };
    g.turnos++;
    g.personas.add(j.empleado.id);
    const v = Number(j.empleado.valor_jornada_completa ?? 0);
    if (v > 0) g.total += v; else g.sinValor++;
    grupos.set(j.empleado.categoria, g);
  }
  const avisos: string[] = [];
  if (!jornadas.length) avisos.push('No hay jornadas cargadas para este evento (se generan al cerrar el Parte diario).');
  const lineas = [...grupos.entries()].map(([cat, g]) => {
    if (g.sinValor) avisos.push(`${NOMBRE_CATEGORIA[cat] ?? cat}: ${g.sinValor} turno(s) de empleados sin valor de jornada — completá el valor del turno.`);
    return {
      concepto:       `Staff ${NOMBRE_CATEGORIA[cat] ?? cat}`,
      detalle:        `${g.personas.size} persona${g.personas.size === 1 ? '' : 's'}`,
      cantidad:       g.turnos,
      valor_unitario: g.turnos ? r2(g.total / g.turnos) : 0,
      total:          r2(g.total),
    };
  });
  avisos.push('Los extranjeros y las cargas locales que no son empleados del sistema se cargan a mano.');
  return { lineas, avisos };
}

async function desdeComidas(eventoId: number, empresaId: number) {
  const lineasComida = await prisma.lineaComida.findMany({
    where:  { deleted_at: null, pedido_comida: { evento_id: eventoId, deleted_at: null, ...withTenant(empresaId) } },
    select: { tipo: true, area: true, cantidad: true, valor_unitario: true },
  });
  const grupos = new Map<string, { cantidad: number; total: number; sinValor: number }>();
  for (const l of lineasComida) {
    const k = `${l.area} — ${l.tipo.charAt(0) + l.tipo.slice(1).toLowerCase()}`;
    const g = grupos.get(k) ?? { cantidad: 0, total: 0, sinValor: 0 };
    g.cantidad += l.cantidad;
    if (l.valor_unitario != null) g.total += l.cantidad * Number(l.valor_unitario); else g.sinValor += l.cantidad;
    grupos.set(k, g);
  }
  const avisos: string[] = [];
  if (!lineasComida.length) avisos.push('No hay comidas cargadas para este evento.');
  const lineas = [...grupos.entries()].map(([concepto, g]) => {
    if (g.sinValor) avisos.push(`${concepto}: ${g.sinValor} menú(s) sin valor unitario.`);
    return { concepto, cantidad: g.cantidad, valor_unitario: g.cantidad ? r2(g.total / g.cantidad) : 0, total: r2(g.total) };
  });
  return { lineas, avisos };
}

// Mismo criterio que Movimiento diario: camionetas/vans = personal, el resto = material
const RE_CAMIONETA = /CAMIONETA|PICK ?UP|VAN|UTILITARIO|SPRINTER/i;

async function desdeCombustible(eventoId: number, empresaId: number) {
  const camionSel = { select: { id: true, codigo: true, descripcion: true, patente: true, tipo: true, tipo_vehiculo: true } } as const;
  const [cargas, viajes] = await Promise.all([
    prisma.cargaCombustible.findMany({
      where:  { evento_id: eventoId, deleted_at: null, ...withTenant(empresaId) },
      select: { litros: true, monto_total: true, camion: camionSel },
    }),
    prisma.bitacoraViaje.findMany({
      where:  { evento_id: eventoId, origen: 'FLOTA', deleted_at: null, ...withTenant(empresaId), monto_combustible: { gt: 0 } },
      select: { litros_cargados_ruta: true, monto_combustible: true, patente_camion: true, camion: camionSel },
    }),
  ]);
  type Camion = NonNullable<(typeof cargas)[number]['camion']>;
  const grupos = new Map<string, { bloque: BloqueCostoReal; concepto: string; litros: number; total: number; origenes: Set<string> }>();
  const sumar = (camion: Camion | null, patente: string | null, litros: number, monto: number, origen: string) => {
    const tipo = camion?.tipo_vehiculo ?? camion?.tipo ?? camion?.descripcion ?? '';
    const bloque: BloqueCostoReal = RE_CAMIONETA.test(tipo) ? 'COMBUSTIBLE_PERSONAL' : 'COMBUSTIBLE_MATERIAL';
    const nombre = camion
      ? [camion.descripcion ?? camion.codigo, camion.patente].filter(Boolean).join(' ')
      : (patente ?? 'Sin vehículo');
    const k = `${bloque}|${nombre}`;
    const g = grupos.get(k) ?? { bloque, concepto: nombre, litros: 0, total: 0, origenes: new Set() };
    g.litros += litros; g.total += monto; g.origenes.add(origen);
    grupos.set(k, g);
  };
  for (const c of cargas) sumar(c.camion, null, Number(c.litros), Number(c.monto_total), 'cargas');
  for (const v of viajes) sumar(v.camion, v.patente_camion, Number(v.litros_cargados_ruta ?? 0), Number(v.monto_combustible), 'bitácora');

  const avisos: string[] = [];
  if (!cargas.length && !viajes.length) {
    avisos.push('No hay cargas de combustible ni viajes de la bitácora vinculados a este evento (se vinculan desde la pestaña Logística).');
  }
  const porBloque: Record<'COMBUSTIBLE_PERSONAL' | 'COMBUSTIBLE_MATERIAL', LineaDraft[]> = { COMBUSTIBLE_PERSONAL: [], COMBUSTIBLE_MATERIAL: [] };
  for (const g of grupos.values()) {
    porBloque[g.bloque as keyof typeof porBloque].push({
      concepto:       g.concepto,
      detalle:        `Desde ${[...g.origenes].join(' y ')}`,
      cantidad:       r2(g.litros),
      valor_unitario: g.litros ? r2(g.total / g.litros) : 0,
      total:          r2(g.total),
    });
  }
  return { porBloque, avisos };
}

// Presupuesto de referencia del evento: el más avanzado (aprobado > enviado >
// cerrado > borrador) y, dentro del mismo estado, la última versión.
const PRIORIDAD_ESTADO = { APROBADO: 0, ENVIADO: 1, CERRADO: 2, BORRADOR: 3 } as const;

export async function presupuestoDelEvento(eventoId: number, empresaId: number) {
  const presupuestos = await prisma.presupuestoEvento.findMany({
    where:   { evento_id: eventoId, deleted_at: null, ...withTenant(empresaId) },
    include: { lineas: { include: { material: true }, orderBy: [{ orden: 'asc' }, { id: 'asc' }] } },
  });
  presupuestos.sort((a, b) => PRIORIDAD_ESTADO[a.estado] - PRIORIDAD_ESTADO[b.estado] || b.version - a.version);
  return presupuestos[0] ?? null;
}

const porcentajeNAC = (p: { porcentaje_alquiler: string } | null) => {
  if (!p) return 4;
  if (p.porcentaje_alquiler === 'FULL') return 100;
  const n = Number(p.porcentaje_alquiler);
  return Number.isFinite(n) && n > 0 ? n : 4;
};

async function desdeRemitos(eventoId: number, empresaId: number) {
  const [remitos, materiales, presupuesto] = await Promise.all([
    prisma.remitoEvento.findMany({
      where:  { evento_id: eventoId, ...withTenant(empresaId), tipo: { not: 'PANOL' } },
      select: { tipo: true, estado: true, items: true },
    }),
    prisma.materialRental.findMany({ where: { activo: true, ...withTenant(empresaId) } }),
    presupuestoDelEvento(eventoId, empresaId),
  ]);
  const pctNac = porcentajeNAC(presupuesto);
  const avisos: string[] = [];
  const porBloque: Record<'RENTAL_NAC' | 'RENTAL_IMP', LineaDraft[]> = { RENTAL_NAC: [], RENTAL_IMP: [] };

  if (!remitos.length) {
    if (!presupuesto) {
      avisos.push('El evento no tiene remitos ni presupuesto cargado.');
      return { porBloque, avisos };
    }
    avisos.push(`Sin remitos cargados: se tomaron las cantidades del presupuesto "${presupuesto.nombre}" (v${presupuesto.version}).`);
    for (const l of presupuesto.lineas) {
      const bloque = l.material.origen === 'IMP' ? 'RENTAL_IMP' : 'RENTAL_NAC';
      porBloque[bloque].push({
        concepto:       l.material.detalle,
        detalle:        l.material.medida,
        codigo:         l.material.codigo_oficial,
        cantidad:       Number(l.cantidad),
        valor_unitario: Number(l.costo_unitario_snap),
        porcentaje:     Number(l.porcentaje_snap),
        total:          Number(l.valor_rental),
      });
    }
    return { porBloque, avisos };
  }

  const imp = new Map<string, (typeof materiales)[number]>();
  const porDetalle = new Map<string, (typeof materiales)[number]>();
  for (const m of materiales) {
    if (m.origen === 'IMP' && m.codigo_oficial) imp.set(normalizarCodigo(m.codigo_oficial), m);
    // NAC primero: si un detalle existe en las dos hojas, gana el nacional
    const k = normalizarTexto(m.detalle);
    if (!porDetalle.has(k) || m.origen === 'NAC') porDetalle.set(k, m);
  }

  const cantidades = new Map<number, number>();
  const sinMatch = new Map<string, number>();
  let borradores = 0;
  for (const r of remitos) {
    if (r.estado === 'BORRADOR') borradores++;
    for (const it of (r.items as { codigo?: string; descripcion: string; cantidad: number }[]) ?? []) {
      const m = (it.codigo ? imp.get(normalizarCodigo(it.codigo)) : undefined) ?? porDetalle.get(normalizarTexto(it.descripcion));
      if (!m) { sinMatch.set(it.descripcion, (sinMatch.get(it.descripcion) ?? 0) + Number(it.cantidad)); continue; }
      cantidades.set(m.id, (cantidades.get(m.id) ?? 0) + Number(it.cantidad));
    }
  }
  if (borradores) avisos.push(`Incluye ${borradores} remito(s) todavía en borrador.`);
  if (sinMatch.size) {
    const lista = [...sinMatch.entries()].slice(0, 8).map(([d, c]) => `${d} (${c})`).join(', ');
    avisos.push(`${sinMatch.size} ítem(s) de remito sin precio en la matriz de rental: ${lista}${sinMatch.size > 8 ? '…' : ''}.`);
  }
  const porId = new Map(materiales.map(m => [m.id, m]));
  let sinPrecio = 0;
  for (const [id, cantidad] of cantidades) {
    const m = porId.get(id)!;
    const valor = Number(m.costo_unitario_ars ?? 0);
    if (!valor) sinPrecio++;
    const bloque = m.origen === 'IMP' ? 'RENTAL_IMP' : 'RENTAL_NAC';
    const porcentaje = m.origen === 'IMP' ? 4 : pctNac;
    porBloque[bloque].push({
      concepto: m.detalle, detalle: m.medida, codigo: m.codigo_oficial,
      cantidad, valor_unitario: valor, porcentaje, total: calcularTotal(cantidad, valor, porcentaje),
    });
  }
  if (sinPrecio) avisos.push(`${sinPrecio} material(es) sin costo unitario en la matriz (quedan en $0).`);
  avisos.push(`Rental nacional al ${pctNac}%${presupuesto ? ` (del presupuesto "${presupuesto.nombre}")` : ' (default de la matriz)'}; importado al 4%.`);
  return { porBloque, avisos };
}

async function desdePanol(eventoId: number, empresaId: number) {
  const movs = await prisma.movimientoPanol.findMany({
    where:  { evento_id: eventoId, cantidad_faltante: { gt: 0 }, ...withTenant(empresaId) },
    select: { cantidad_faltante: true, panol_item: { select: { id: true, nombre: true, valor: true } } },
  });
  const grupos = new Map<number, { nombre: string; cantidad: number; valor: number }>();
  for (const m of movs) {
    const g = grupos.get(m.panol_item.id) ?? { nombre: m.panol_item.nombre, cantidad: 0, valor: Number(m.panol_item.valor ?? 0) };
    g.cantidad += m.cantidad_faltante ?? 0;
    grupos.set(m.panol_item.id, g);
  }
  const avisos: string[] = [];
  if (!movs.length) avisos.push('El pañol no registra faltantes para este evento.');
  const sinValor = [...grupos.values()].filter(g => !g.valor).length;
  if (sinValor) avisos.push(`${sinValor} herramienta(s) sin valor cargado en el pañol (quedan en $0).`);
  const lineas = [...grupos.values()].map(g => ({
    concepto: g.nombre, cantidad: g.cantidad, valor_unitario: g.valor, porcentaje: 10,
    total: calcularTotal(g.cantidad, g.valor, 10),
  }));
  return { lineas, avisos };
}

// Bloques que se resuelven juntos (una sola consulta llena los dos)
export const GRUPO_SINCRONIZACION: Partial<Record<BloqueCostoReal, BloqueCostoReal[]>> = {
  COMBUSTIBLE_PERSONAL: ['COMBUSTIBLE_PERSONAL', 'COMBUSTIBLE_MATERIAL'],
  COMBUSTIBLE_MATERIAL: ['COMBUSTIBLE_PERSONAL', 'COMBUSTIBLE_MATERIAL'],
  RENTAL_NAC:           ['RENTAL_NAC', 'RENTAL_IMP'],
  RENTAL_IMP:           ['RENTAL_NAC', 'RENTAL_IMP'],
};

export async function calcularDesdeSistema(
  bloque: BloqueCostoReal, eventoId: number, empresaId: number,
): Promise<{ porBloque: Partial<Record<BloqueCostoReal, LineaDraft[]>>; avisos: string[] } | null> {
  switch (bloque) {
    case 'STAFF':    { const r = await desdeJornadas(eventoId, empresaId); return { porBloque: { STAFF: r.lineas }, avisos: r.avisos }; }
    case 'COMIDAS':  { const r = await desdeComidas(eventoId, empresaId);  return { porBloque: { COMIDAS: r.lineas }, avisos: r.avisos }; }
    case 'PERDIDAS': { const r = await desdePanol(eventoId, empresaId);    return { porBloque: { PERDIDAS: r.lineas }, avisos: r.avisos }; }
    case 'COMBUSTIBLE_PERSONAL':
    case 'COMBUSTIBLE_MATERIAL': return desdeCombustible(eventoId, empresaId);
    case 'RENTAL_NAC':
    case 'RENTAL_IMP':           return desdeRemitos(eventoId, empresaId);
    default:                     return null;
  }
}

// Reemplaza las líneas de un origen (PLANILLA o SISTEMA) en los bloques dados.
// Las líneas MANUAL nunca se tocan. Si el sistema no trae valor para un concepto
// (ej. empleado sin valor de jornada) se conserva el valor unitario que el
// usuario había cargado a mano en la línea anterior del mismo concepto.
export async function reemplazarLineas(
  tx: Prisma.TransactionClient,
  p: { eventoId: number; empresaId: number; userId: number; origen: OrigenLineaCostoReal;
       porBloque: Partial<Record<BloqueCostoReal, LineaDraft[]>> },
): Promise<{ creadas: number; reemplazadas: number }> {
  const bloques = Object.keys(p.porBloque) as BloqueCostoReal[];
  const anteriores = await tx.lineaCostoReal.findMany({
    where: { evento_id: p.eventoId, origen: p.origen, bloque: { in: bloques }, deleted_at: null },
  });
  const valorPrevio = new Map(anteriores.filter(l => Number(l.valor_unitario) > 0).map(l => [`${l.bloque}|${l.concepto}`, l]));
  if (anteriores.length) {
    await tx.lineaCostoReal.updateMany({
      where: { id: { in: anteriores.map(l => l.id) } },
      data:  { deleted_at: new Date(), updated_by: p.userId },
    });
  }
  let creadas = 0;
  for (const bloque of bloques) {
    const lineas = p.porBloque[bloque] ?? [];
    if (!lineas.length) continue;
    await tx.lineaCostoReal.createMany({
      data: lineas.map((l, i) => {
        let { valor_unitario, total } = l;
        const prev = p.origen === 'SISTEMA' && !valor_unitario ? valorPrevio.get(`${bloque}|${l.concepto}`) : undefined;
        if (prev) {
          valor_unitario = Number(prev.valor_unitario);
          total = calcularTotal(l.cantidad, valor_unitario, l.porcentaje ?? null);
        }
        return {
          empresa_id: p.empresaId, evento_id: p.eventoId, bloque, origen: p.origen, orden: i,
          concepto: l.concepto.slice(0, 300), detalle: l.detalle ?? null, codigo: l.codigo ?? null,
          cantidad: l.cantidad, valor_unitario, porcentaje: l.porcentaje ?? null, total,
          fecha_desde: l.fecha_desde ?? null, fecha_hasta: l.fecha_hasta ?? null,
          created_by: p.userId, updated_by: p.userId,
        };
      }),
    });
    creadas += lineas.length;
  }
  return { creadas, reemplazadas: anteriores.length };
}
