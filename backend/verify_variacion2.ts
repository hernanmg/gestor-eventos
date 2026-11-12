import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const anio = 2026;
  const cargas = await prisma.cargaCombustible.findMany({
    where: { fecha: { gte: new Date(Date.UTC(anio,0,1)), lt: new Date(Date.UTC(anio+1,0,1)) }, deleted_at: null },
    select: { fecha: true, litros: true, monto_total: true },
  });
  const litrosPorMes = new Array(12).fill(0);
  const montoPorMes = new Array(12).fill(0);
  for (const c of cargas) {
    const m = c.fecha.getUTCMonth();
    litrosPorMes[m] += Number(c.litros);
    montoPorMes[m] += Number(c.monto_total);
  }
  console.log('--- LITROS ---');
  for (let i = 0; i < 12; i++) {
    const hayAnteriorValido = i > 0 && litrosPorMes[i-1] > 0 && litrosPorMes[i] > 0;
    const variacion = hayAnteriorValido ? (((litrosPorMes[i] - litrosPorMes[i-1]) / litrosPorMes[i-1]) * 100).toFixed(2) : null;
    console.log(`Mes ${i+1}: litros=${litrosPorMes[i].toFixed(3)} variacion=${variacion}`);
  }
  console.log('--- MONTO (PESOS) ---');
  for (let i = 0; i < 12; i++) {
    const hayAnteriorValido = i > 0 && montoPorMes[i-1] > 0 && montoPorMes[i] > 0;
    const variacion = hayAnteriorValido ? (((montoPorMes[i] - montoPorMes[i-1]) / montoPorMes[i-1]) * 100).toFixed(2) : null;
    console.log(`Mes ${i+1}: monto=${montoPorMes[i].toFixed(2)} variacion=${variacion}`);
  }
  await prisma.$disconnect();
}
main();
