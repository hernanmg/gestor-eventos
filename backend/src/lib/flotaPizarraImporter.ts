import { EstadoSeguro } from '@prisma/client';
import { prisma } from './prisma';
import { normalizarPatente } from './normalizarPatente';

// ── Datos de la pizarra física de DOS57 (transcripción de la foto — ver
// docs/dos57/lorena/pizarra_seguros.jpeg) ────────────────────────────────────
// `codigo` es nuestra clave de import, no viene de la pizarra: la pizarra
// numera los autoelevadores 1-4 sin patente, y dos acoplados comparten dominio
// con su camioneta/camión tractor (HLW156, WNO918) — Camion.codigo es único
// por empresa, así que se desambigua con un sufijo. `patente` sí guarda el
// dominio tal cual está en la pizarra (puede repetirse entre tractor y
// acoplado, eso es real).
export interface VehiculoPizarra {
  codigo:                string;
  patente:               string | null;
  descripcion:           string; // modelo/color, columna VEHÍCULO
  titular:               string;
  tipo_vehiculo:         'CAMIONETA' | 'CAMION' | 'TRAILER' | 'AUTOELEVADOR';
  vencimiento_tecnica:   string | null; // texto crudo de la columna ITU/RTO, ej. "RTO 27/9/2026"
  aseguradora:           string | null; // "X" en la pizarra = sin dato → null
  vencimiento_seguro:    string | null; // dd/mm/yy(yy), null si "X"
  capacidad_combustible: string | null;
}

export const PIZARRA_DOS57: VehiculoPizarra[] = [
  // ── Camionetas / pickups ──────────────────────────────────────────────────
  { codigo: 'AG337MY', patente: 'AG 337 MY', descripcion: 'Ranger Pollo',    titular: 'DOS57', tipo_vehiculo: 'CAMIONETA', vencimiento_tecnica: 'ITV 16/07/27',   aseguradora: 'Fed.Patronal',  vencimiento_seguro: '12/12/26', capacidad_combustible: '75 lts' },
  { codigo: 'AA183PK', patente: 'AA 183 PK', descripcion: 'Toyota',         titular: 'DOS57', tipo_vehiculo: 'CAMIONETA', vencimiento_tecnica: 'RTO 27/9/2026',  aseguradora: 'Experta',       vencimiento_seguro: '27/11/26', capacidad_combustible: '60/65 lts' },
  { codigo: 'HLW156',  patente: 'HLW 156',   descripcion: 'Ranger',         titular: 'DOS57', tipo_vehiculo: 'CAMIONETA', vencimiento_tecnica: null,             aseguradora: 'Experta',       vencimiento_seguro: '07/9/26',  capacidad_combustible: '60/65 lts' },
  { codigo: 'KJR926',  patente: 'KJR 926',   descripcion: 'Toyota Plateada',titular: 'DOS57', tipo_vehiculo: 'CAMIONETA', vencimiento_tecnica: 'RTO 25/9/2026', aseguradora: 'Experta',       vencimiento_seguro: '30/09/26', capacidad_combustible: '60/65 lts' },
  { codigo: 'LVX455',  patente: 'LVX 455',   descripcion: 'Toyota',         titular: 'DOS57', tipo_vehiculo: 'CAMIONETA', vencimiento_tecnica: 'RTO 23/7/2027', aseguradora: 'Experta',       vencimiento_seguro: '27/11/26', capacidad_combustible: '60/65 lts' },
  { codigo: 'AE919JA', patente: 'AE 919 JA', descripcion: 'Toyota Roja',    titular: 'DOS57', tipo_vehiculo: 'CAMIONETA', vencimiento_tecnica: 'RTO 19/05/28', aseguradora: 'Experta',       vencimiento_seguro: '27/11/26', capacidad_combustible: '60/65 lts' },
  { codigo: 'KEX251',  patente: 'KEX 251',   descripcion: 'Toyota',         titular: 'DOS57', tipo_vehiculo: 'CAMIONETA', vencimiento_tecnica: 'RTO 20/02/27', aseguradora: 'San Cristobal', vencimiento_seguro: '12/08/27', capacidad_combustible: '60/65 lts' },
  { codigo: 'PFG964',  patente: 'PFG 964',   descripcion: 'Ranger',         titular: 'DOS57', tipo_vehiculo: 'CAMIONETA', vencimiento_tecnica: 'RTO 22/07/2027', aseguradora: 'Experta',       vencimiento_seguro: '27/11/26', capacidad_combustible: '60/65 lts' },
  { codigo: 'AF728AT', patente: 'AF 728 AT', descripcion: 'Sprinter',       titular: 'DOS57', tipo_vehiculo: 'CAMIONETA', vencimiento_tecnica: 'ITV 16/11/2026', aseguradora: 'San Cristobal', vencimiento_seguro: '16/07/27', capacidad_combustible: '71/75 lts (100ltr/100km)' },

  // ── Trailers / acoplados ──────────────────────────────────────────────────
  { codigo: 'HLW156-ACOPLADO', patente: 'HLW 156', descripcion: 'Trailer',          titular: 'DOS57', tipo_vehiculo: 'TRAILER', vencimiento_tecnica: null, aseguradora: 'Rivadavia', vencimiento_seguro: '07/09/26', capacidad_combustible: null },
  { codigo: 'KJR926-ACOPLADO', patente: 'KJR 926', descripcion: 'Trailer',          titular: 'DOS57', tipo_vehiculo: 'TRAILER', vencimiento_tecnica: null, aseguradora: 'Rivadavia', vencimiento_seguro: '02/10/26', capacidad_combustible: null },
  { codigo: 'WNO918-ACOPLADO', patente: 'WNO 918', descripcion: 'Trailer Amarillo', titular: 'DOS57', tipo_vehiculo: 'TRAILER', vencimiento_tecnica: null, aseguradora: 'Rivadavia', vencimiento_seguro: '02/10/26', capacidad_combustible: null },

  // ── Camiones ──────────────────────────────────────────────────────────────
  { codigo: 'AG768OI', patente: 'AG 768 OI', descripcion: 'Mercedes Bco',  titular: 'DOS57', tipo_vehiculo: 'CAMION', vencimiento_tecnica: 'RTO 05/08/27', aseguradora: 'Allianz',       vencimiento_seguro: '31/07/27', capacidad_combustible: '315 lts + 35 UREA' },
  { codigo: 'AD737FN', patente: 'AD 737 FN', descripcion: 'Semi Negro',   titular: 'DOS57', tipo_vehiculo: 'CAMION', vencimiento_tecnica: 'RTO 31/08/27', aseguradora: 'Experta',       vencimiento_seguro: '27/11/26', capacidad_combustible: null },
  { codigo: 'FTL303',  patente: 'FTL 303',   descripcion: 'Volvo',        titular: 'DOS57', tipo_vehiculo: 'CAMION', vencimiento_tecnica: 'RTO 31/08/27', aseguradora: 'San Cristobal', vencimiento_seguro: '30/11/26', capacidad_combustible: null },
  { codigo: 'AA830GU', patente: 'AA 830 GU', descripcion: 'Semi Bco',     titular: 'DOS57', tipo_vehiculo: 'CAMION', vencimiento_tecnica: 'RTO 17/07/27', aseguradora: 'Experta',       vencimiento_seguro: '27/11/26', capacidad_combustible: '610 lts (2 tanques)' },
  { codigo: 'HKQ258',  patente: 'HKQ 258',   descripcion: 'Camion Negro', titular: 'DOS57', tipo_vehiculo: 'CAMION', vencimiento_tecnica: 'RTO 05/8/27',  aseguradora: 'Experta',       vencimiento_seguro: '27/11/26', capacidad_combustible: null },
  { codigo: 'IBO355',  patente: 'IBO 355',   descripcion: 'Semi Naranja', titular: 'DOS57', tipo_vehiculo: 'CAMION', vencimiento_tecnica: 'RTO 11/02/27', aseguradora: 'San Cristobal', vencimiento_seguro: '04/12/26', capacidad_combustible: '500 lts' },
  { codigo: 'AG958JV', patente: 'AG 958 JV', descripcion: 'Plancha',      titular: 'DOS57', tipo_vehiculo: 'CAMION', vencimiento_tecnica: 'RTO 04/08/27', aseguradora: 'San Cristobal', vencimiento_seguro: '01/12/26', capacidad_combustible: null },
  // Vencimiento de seguro "61/7/26" en la pizarra — fecha inexistente (día 61),
  // Lorena la marcó como dudosa. Se guarda el vehículo igual, pero no se crea
  // SeguroVehiculo por esta fila (ver importarSiniestros: el import reporta el
  // problema en `errores` para que se confirme con Lorena/el productor).
  { codigo: 'WNO918',  patente: 'WNO 918',   descripcion: 'Mercedes',     titular: 'DOS57', tipo_vehiculo: 'CAMION', vencimiento_tecnica: null, aseguradora: 'Federacion', vencimiento_seguro: '61/7/26', capacidad_combustible: '210 lts + 35 UREA' },

  // ── Autoelevadores (sin patente — equipo interno, numerado 1-4) ──────────────
  { codigo: 'AUTOELEV-1', patente: null, descripcion: 'Polo (ex Ranvl)', titular: 'DOS57', tipo_vehiculo: 'AUTOELEVADOR', vencimiento_tecnica: null, aseguradora: 'Sancor', vencimiento_seguro: '16/02/27', capacidad_combustible: null },
  { codigo: 'AUTOELEV-2', patente: null, descripcion: 'Polo',           titular: 'DOS57', tipo_vehiculo: 'AUTOELEVADOR', vencimiento_tecnica: null, aseguradora: null,     vencimiento_seguro: null,       capacidad_combustible: null },
  { codigo: 'AUTOELEV-3', patente: null, descripcion: 'Kempes',         titular: 'DOS57', tipo_vehiculo: 'AUTOELEVADOR', vencimiento_tecnica: null, aseguradora: null,     vencimiento_seguro: null,       capacidad_combustible: null },
  { codigo: 'AUTOELEV-4', patente: null, descripcion: '4x4',            titular: 'DOS57', tipo_vehiculo: 'AUTOELEVADOR', vencimiento_tecnica: null, aseguradora: null,     vencimiento_seguro: null,       capacidad_combustible: null },
];

// dd/mm/yy o dd/mm/yyyy — devuelve null si el día/mes no son válidos (ej. la
// fecha dudosa "61/7/26" de la pizarra, día 61 inexistente).
function parseFechaPizarra(s: string | null): Date | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  let anio  = Number(m[3]);
  if (anio < 100) anio += 2000;
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCMonth() !== mes - 1) return null; // ej. 31/04 → se corrige solo a mayo, se rechaza
  return fecha;
}

const MS_DIA = 86_400_000;

function computeEstadoSeguro(fechaVencimiento: Date): EstadoSeguro {
  const hoy = new Date();
  if (fechaVencimiento < hoy) return EstadoSeguro.VENCIDO;
  if (fechaVencimiento.getTime() < hoy.getTime() + 30 * MS_DIA) return EstadoSeguro.POR_VENCER;
  return EstadoSeguro.VIGENTE;
}

export interface ImportPizarraResultado {
  vehiculos_creados:    string[];
  vehiculos_actualizados: string[];
  seguros_creados:      string[];
  seguros_omitidos:     number; // ya existía uno con la misma aseguradora/vencimiento
  errores:              string[];
}

export async function importarPizarraFlota(
  empresaId: number,
  usuarioId: number,
  vehiculos: VehiculoPizarra[] = PIZARRA_DOS57,
): Promise<ImportPizarraResultado> {
  const resultado: ImportPizarraResultado = {
    vehiculos_creados: [], vehiculos_actualizados: [], seguros_creados: [], seguros_omitidos: 0, errores: [],
  };

  // Se trae una sola vez y se matchea en memoria — Postgres no tiene acá una
  // función "normalizar" indexable sin extensión, y con ~60 vehículos por
  // empresa esto es más simple y sigue siendo instantáneo.
  const existentes = await prisma.camion.findMany({ where: { empresa_id: empresaId, deleted_at: null } });

  for (const v of vehiculos) {
    const notaTecnica = v.vencimiento_tecnica; // ya viene con su propia etiqueta ("RTO 27/9/2026", "ITV 16/07/27")
    const patenteNorm = normalizarPatente(v.patente);

    // Los trailers/acoplados comparten dominio con su tractor a propósito
    // (ver PIZARRA_DOS57) — para ellos el match sigue siendo por `codigo`.
    // Para el resto, matchear por patente normalizada evita crear un
    // duplicado si el vehículo ya existe con otro formato (ej. lo creó el
    // importador de combustible como "HLW 156" con espacio) — ver fix de
    // duplicados Camion.
    const existente = patenteNorm && v.tipo_vehiculo !== 'TRAILER'
      ? existentes.find(c => normalizarPatente(c.patente) === patenteNorm) ?? null
      : existentes.find(c => c.codigo === v.codigo) ?? null;

    if (existente) {
      await prisma.camion.update({
        where: { id: existente.id },
        data: {
          descripcion:            existente.descripcion ?? v.descripcion,
          patente:                existente.patente ?? patenteNorm,
          tipo:                   existente.tipo ?? v.tipo_vehiculo,
          titular:                existente.titular ?? v.titular,
          tipo_vehiculo:          existente.tipo_vehiculo ?? v.tipo_vehiculo,
          capacidad_combustible:  existente.capacidad_combustible ?? v.capacidad_combustible,
          notas:                  existente.notas ?? notaTecnica,
        },
      });
      resultado.vehiculos_actualizados.push(existente.codigo);
      await importarSeguroVehiculo(existente.id, v, empresaId, usuarioId, resultado);
      continue;
    }

    const nuevo = await prisma.camion.create({
      data: {
        empresa_id:             empresaId,
        codigo:                 (patenteNorm && v.tipo_vehiculo !== 'TRAILER') ? patenteNorm : v.codigo,
        patente:                patenteNorm,
        descripcion:            v.descripcion,
        tipo:                   v.tipo_vehiculo,
        tipo_vehiculo:          v.tipo_vehiculo,
        titular:                v.titular,
        capacidad_combustible:  v.capacidad_combustible,
        notas:                  notaTecnica,
        en_servicio:            true,
      },
    });
    resultado.vehiculos_creados.push(nuevo.codigo);
    await importarSeguroVehiculo(nuevo.id, v, empresaId, usuarioId, resultado);
  }

  return resultado;
}

async function importarSeguroVehiculo(
  camionId: number,
  v: VehiculoPizarra,
  empresaId: number,
  usuarioId: number,
  resultado: ImportPizarraResultado,
): Promise<void> {
  if (!v.aseguradora || !v.vencimiento_seguro) return;

  const fechaVencimiento = parseFechaPizarra(v.vencimiento_seguro);
  if (!fechaVencimiento) {
    resultado.errores.push(`${v.codigo}: vencimiento de seguro inválido en la pizarra ("${v.vencimiento_seguro}") — se omitió el seguro, confirmar con Lorena`);
    return;
  }

  const yaExiste = await prisma.seguroVehiculo.findFirst({
    where: { camion_id: camionId, empresa_id: empresaId, aseguradora: v.aseguradora, fecha_vencimiento: fechaVencimiento, deleted_at: null },
  });
  if (yaExiste) { resultado.seguros_omitidos++; return; }

  // La pizarra sólo registra el vencimiento, no el inicio de vigencia — se
  // asume una póliza anual (estándar del rubro) y se aproxima un año atrás;
  // se puede corregir a mano desde Flota una vez que Lorena confirme la
  // fecha real con el productor de seguros.
  const fechaInicioAprox = new Date(Date.UTC(fechaVencimiento.getUTCFullYear() - 1, fechaVencimiento.getUTCMonth(), fechaVencimiento.getUTCDate()));

  await prisma.seguroVehiculo.create({
    data: {
      camion_id:         camionId,
      empresa_id:        empresaId,
      aseguradora:       v.aseguradora,
      fecha_inicio:      fechaInicioAprox,
      fecha_vencimiento: fechaVencimiento,
      estado:            computeEstadoSeguro(fechaVencimiento),
      notas:             'Importado desde la pizarra física de DOS57',
      created_by:        usuarioId,
    },
  });
  resultado.seguros_creados.push(`${v.codigo} (${v.aseguradora})`);
}
