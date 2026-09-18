// ═══════════════════════════════════════════════════════════════════════════
// Fusiona vehículos (Camion) duplicados por diferencias de formato en la
// patente — ej. "HLW 156" (creado por el importador de combustible) vs
// "HLW156" (creado por el importador de la pizarra de Lorena). Desde el fix,
// ambos importadores y el alta manual normalizan la patente antes de guardar
// (ver lib/normalizarPatente.ts), así que esto sólo hace falta una vez para
// limpiar los duplicados que ya existían en la base.
//
// Por cada grupo de Camion con la misma patente normalizada (misma empresa):
//   1. Elige un "ganador" — el que tiene seguro asociado (si sólo uno lo
//      tiene) o, si no, el que tiene más campos completos; empate → el más
//      antiguo (id menor).
//   2. Reasigna al ganador todo lo que cuelga del/de los perdedor(es):
//      CargaCombustible, SeguroVehiculo, AsignacionStock, GastoPeaje,
//      Jornada, AsignacionDiaria, ServicioTaller, PatenteVehiculo.
//   3. Completa en el ganador los campos que le faltan con los del perdedor.
//   4. Deja la patente del ganador en formato normalizado (sin espacios).
//   5. Soft-delete del perdedor (deleted_at = ahora, activo = false).
//
// Run: npx ts-node --files scripts/dedupCamionesPatente.ts
// ═══════════════════════════════════════════════════════════════════════════

import 'dotenv/config';
import { PrismaClient, type Camion } from '@prisma/client';
import { normalizarPatente } from '../src/lib/normalizarPatente';

const prisma = new PrismaClient();

// Campos "de contenido" — para decidir cuál de los duplicados está más
// completo. No incluye codigo/patente/activo/en_servicio/timestamps.
const CAMPOS_COMPLETITUD = [
  'descripcion', 'tipo', 'marca', 'modelo', 'anio', 'color', 'titular',
  'numero_telepase', 'capacidad_combustible', 'tipo_vehiculo', 'notas',
  'km_actual', 'limite_mensual_combustible',
] as const;

function puntajeCompletitud(c: Camion): number {
  return CAMPOS_COMPLETITUD.reduce((acc, campo) => acc + ((c as any)[campo] != null && (c as any)[campo] !== '' ? 1 : 0), 0);
}

async function elegirGanador(grupo: Camion[]): Promise<Camion> {
  const segurosPorCamion = await Promise.all(
    grupo.map(c => prisma.seguroVehiculo.count({ where: { camion_id: c.id, deleted_at: null } })),
  );
  const conSeguro = grupo.filter((_, i) => segurosPorCamion[i] > 0);
  if (conSeguro.length === 1) return conSeguro[0];

  const candidatos = conSeguro.length > 1 ? conSeguro : grupo;
  return candidatos.reduce((mejor, actual) => {
    const scoreActual = puntajeCompletitud(actual);
    const scoreMejor  = puntajeCompletitud(mejor);
    if (scoreActual > scoreMejor) return actual;
    if (scoreActual === scoreMejor && actual.id < mejor.id) return actual;
    return mejor;
  }, candidatos[0]);
}

async function fusionarGrupo(grupo: Camion[], patenteNorm: string): Promise<{ ganador: string; perdedores: string[] }> {
  const ganador = await elegirGanador(grupo);
  const perdedores = grupo.filter(c => c.id !== ganador.id);

  await prisma.$transaction(async tx => {
    for (const perdedor of perdedores) {
      await tx.cargaCombustible.updateMany({ where: { camion_id: perdedor.id }, data: { camion_id: ganador.id } });
      await tx.seguroVehiculo.updateMany({ where: { camion_id: perdedor.id }, data: { camion_id: ganador.id } });
      await tx.asignacionStock.updateMany({ where: { camion_id: perdedor.id }, data: { camion_id: ganador.id } });
      await tx.gastoPeaje.updateMany({ where: { camion_id: perdedor.id }, data: { camion_id: ganador.id } });
      await tx.jornada.updateMany({ where: { camion_id: perdedor.id }, data: { camion_id: ganador.id } });
      await tx.asignacionDiaria.updateMany({ where: { camion_id: perdedor.id }, data: { camion_id: ganador.id } });
      await tx.servicioTaller.updateMany({ where: { camion_id: perdedor.id }, data: { camion_id: ganador.id } });
      await tx.patenteVehiculo.updateMany({ where: { camion_id: perdedor.id }, data: { camion_id: ganador.id } });
    }

    // Merge de campos — el ganador conserva lo suyo, sólo completa lo que le falta.
    const mergeData: Record<string, unknown> = { patente: patenteNorm };
    for (const campo of CAMPOS_COMPLETITUD) {
      const valorGanador = (ganador as any)[campo];
      if (valorGanador != null && valorGanador !== '') continue;
      const donante = perdedores.find(p => (p as any)[campo] != null && (p as any)[campo] !== '');
      if (donante) mergeData[campo] = (donante as any)[campo];
    }
    await tx.camion.update({ where: { id: ganador.id }, data: mergeData });

    for (const perdedor of perdedores) {
      await tx.camion.update({ where: { id: perdedor.id }, data: { deleted_at: new Date(), activo: false } });
    }
  });

  return { ganador: `${ganador.codigo} (id ${ganador.id})`, perdedores: perdedores.map(p => `${p.codigo} (id ${p.id})`) };
}

async function main() {
  // Los trailers/acoplados comparten patente con su tractor a propósito (ver
  // flotaPizarraImporter.ts — HLW156-ACOPLADO, KJR926-ACOPLADO, WNO918-ACOPLADO)
  // — eso NO es un duplicado por formato, es un vehículo distinto. Se excluyen
  // de la agrupación para no fusionar un acoplado con su tractor.
  const todos = await prisma.camion.findMany({ where: { deleted_at: null, patente: { not: null } } });
  const camiones = todos.filter(c => c.tipo_vehiculo !== 'TRAILER');

  const grupos = new Map<string, Camion[]>();
  for (const c of camiones) {
    const norm = normalizarPatente(c.patente);
    if (!norm) continue;
    const key = `${c.empresa_id}|${norm}`;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(c);
  }

  const duplicados = Array.from(grupos.entries()).filter(([, g]) => g.length > 1);
  console.log(`Patentes con duplicados encontradas: ${duplicados.length}`);

  let totalFusionados = 0;
  for (const [key, grupo] of duplicados) {
    const [, patenteNorm] = key.split('|');
    const { ganador, perdedores } = await fusionarGrupo(grupo, patenteNorm);
    totalFusionados += perdedores.length;
    console.log(`  ${patenteNorm}: ganador ${ganador} <- fusionados [${perdedores.join(', ')}]`);
  }

  console.log(`\nTotal de grupos fusionados: ${duplicados.length}`);
  console.log(`Total de registros duplicados dados de baja: ${totalFusionados}`);

  // Deja en formato canónico (sin espacios) cualquier patente que haya
  // quedado con el formato viejo y no participó de una fusión — ej. los
  // acoplados (excluidos a propósito de la agrupación de arriba).
  const sinNormalizar = (await prisma.camion.findMany({ where: { deleted_at: null, patente: { not: null } } }))
    .filter(c => c.patente !== normalizarPatente(c.patente));
  for (const c of sinNormalizar) {
    await prisma.camion.update({ where: { id: c.id }, data: { patente: normalizarPatente(c.patente) } });
  }
  if (sinNormalizar.length > 0) {
    console.log(`Patentes con formato viejo normalizadas (sin fusión, ej. acoplados): ${sinNormalizar.length}`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
