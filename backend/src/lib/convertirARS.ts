import { Moneda } from '@prisma/client';

// Convierte un monto a su equivalente en ARS. Para ARS devuelve el monto sin
// tocar (no requiere tasa_cambio). Para USD/EUR requiere tasa_cambio — si no
// se cargó todavía, devuelve null (no hay forma de convertir).
export function convertirARS(monto: number, moneda: Moneda, tasaCambio?: number | null): number | null {
  if (moneda === Moneda.ARS) return monto;
  if (tasaCambio === null || tasaCambio === undefined) return null;
  return parseFloat((monto * tasaCambio).toFixed(2));
}
