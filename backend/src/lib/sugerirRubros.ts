import { prisma } from './prisma';
import { EMPRESAS } from './empresasConstants';
import type { Prisma } from '@prisma/client';

export interface RubroSugerido {
  rubro_id:    number;
  rubro_nombre: string;
  razon:       string | null; // null = no sugerido, el usuario lo activa a mano
  seleccionado: boolean;
}

// Subconjunto de campos de PreMacro que la lógica de sugerencia necesita.
export interface PreMacroParaSugerencia {
  tipo_evento?:             string | null;
  lleva_empleados?:         boolean | null;
  requiere_hospedaje?:      boolean | null;
  requiere_comidas?:        boolean | null;
  requiere_traslado?:       boolean | null;
  dias_montaje?:            number | null;
  presupuesto_total?:       Prisma.Decimal | number | string | null;
}

const RAZON_SIEMPRE = 'Requerido para todo evento';

// ── Enjoy (empresa_id=1) — reglas basadas en el catálogo de 84 rubros ────────

const SIEMPRE = [
  'Directorio', 'Seguridad privada', 'Limpieza en evento', 'Limpieza pre y post',
  'Generador', 'Distribución de energía', 'Branding/Imprenta', 'Ambulancias',
  'Policía', 'Seguro RC',
];

const POR_EMPLEADOS = [
  'Personal de cargas', 'Choferes', 'Pañolero', 'Handyeman', 'Riggers', 'Op. Sonido', 'Op. Luces',
];

const POR_HOSPEDAJE = ['Hotelería Party A', 'Hotelería Party B', 'Colectivo'];

const POR_COMIDAS = ['Viandas', 'Dispenser con bidones', 'Hielo'];

const POR_MONTAJE = ['Estructuras', 'Cerramiento', 'Vallas', 'Panelería', 'Módulo de Escenario'];

const POR_TRASLADO = ['Camiones/Logística', 'Transportación'];

const POR_PRESUPUESTO_GRANDE = ['Conectividad Starlink', 'Conectividad distribución', 'Drone', 'Domo'];

const POR_TIPO: Record<string, string[]> = {
  Festival: [
    'Sonido', 'Luces', 'Pantalla', 'FX', 'Backline', 'DJ', 'Host de redes',
    'Transmisión/Streaming', 'Drone', 'Barras', 'Inflables', 'Activaciones/Juegos',
    'Promotoras', 'Ticketera', 'Personal de boletería', 'Personal acomodadores',
    'Personal estacionamiento', 'Entelado/Aforo',
  ],
  Corporativo: [
    'Sonido', 'Luces', 'Pantalla', 'Equipo Audiovisual', 'Catering', 'Mobiliario',
    'Carpas', 'Beduinas', 'Ambientación',
  ],
  Deportivo: [
    'Sonido', 'Pantalla', 'CCTV', 'Cámaras de seguridad', 'Puesto Sanitario',
    'Rescatistas', 'Sillas plásticas', 'Personal estacionamiento', 'Adicionales de policía',
  ],
};

const PRESUPUESTO_GRANDE_UMBRAL = 5_000_000;

function construirRazonesEnjoy(p: PreMacroParaSugerencia): Map<string, string> {
  const razones = new Map<string, string>();
  const add = (nombres: string[], razon: string) => {
    for (const n of nombres) if (!razones.has(n)) razones.set(n, razon);
  };

  add(SIEMPRE, RAZON_SIEMPRE);

  if (p.lleva_empleados) add(POR_EMPLEADOS, 'Indicado porque el evento lleva empleados propios');
  if (p.requiere_hospedaje) add(POR_HOSPEDAJE, 'Indicado porque requiere hospedaje');
  if (p.requiere_comidas) add(POR_COMIDAS, 'Indicado porque requiere comidas para el staff');
  if ((p.dias_montaje ?? 0) > 0) add(POR_MONTAJE, 'Indicado por días de montaje');
  if (p.requiere_traslado) add(POR_TRASLADO, 'Indicado porque requiere traslado de material');

  if (p.tipo_evento && POR_TIPO[p.tipo_evento]) {
    add(POR_TIPO[p.tipo_evento], `Indicado por tipo de evento: ${p.tipo_evento}`);
  }

  const presupuesto = p.presupuesto_total != null ? Number(p.presupuesto_total) : 0;
  if (presupuesto > PRESUPUESTO_GRANDE_UMBRAL) {
    add(POR_PRESUPUESTO_GRANDE, 'Indicado por presupuesto elevado (> $5.000.000)');
  }

  return razones;
}

async function sugerirRubrosEnjoy(p: PreMacroParaSugerencia, empresaId: number): Promise<RubroSugerido[]> {
  const razones = construirRazonesEnjoy(p);

  const todos = await prisma.rubro.findMany({
    where: { empresa_id: empresaId, tipo: 'EGRESO', activo: true, deleted_at: null },
    select: { id: true, nombre: true },
  });

  return todos.map(r => {
    const razon = razones.get(r.nombre) ?? null;
    return {
      rubro_id:     r.id,
      rubro_nombre: r.nombre,
      razon,
      seleccionado: razon !== null,
    };
  });
}

// ── DOS57 (empresa_id=2) ──────────────────────────────────────────────────────
// TODO: lógica de sugerencia específica para DOS57
// pendiente de relevamiento con Pollo y Vicky
// Por ahora: se sugieren TODOS los rubros activos de DOS57, preseleccionados.

async function sugerirRubrosDos57(empresaId: number): Promise<RubroSugerido[]> {
  const todos = await prisma.rubro.findMany({
    where: { empresa_id: empresaId, tipo: 'EGRESO', activo: true, deleted_at: null },
    select: { id: true, nombre: true },
  });

  return todos.map(r => ({
    rubro_id:     r.id,
    rubro_nombre: r.nombre,
    razon:        'Sugerido por defecto para DOS57',
    seleccionado: true,
  }));
}

export async function sugerirRubros(preMacro: PreMacroParaSugerencia, empresaId: number): Promise<RubroSugerido[]> {
  if (empresaId === EMPRESAS.ENJOY) return sugerirRubrosEnjoy(preMacro, empresaId);
  return sugerirRubrosDos57(empresaId);
}
