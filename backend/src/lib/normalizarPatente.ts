// Clave canónica de patente en todo el sistema — sin espacios, mayúsculas.
// "HLW 156" / "hlw 156" / "HLW156" deben resolver siempre al mismo vehículo
// (ver fix de duplicados Camion: el importador de combustible y el de la
// pizarra de Lorena creaban cada uno su propio formato para el mismo
// dominio). Se usa tanto para matching (buscar antes de crear) como para lo
// que efectivamente se persiste en Camion.patente — el formato "lindo" con
// espacio es sólo cosa de UI (ver formatearPatente en el frontend).
export function normalizarPatente(patente: string | null | undefined): string | null {
  if (!patente) return null;
  const normalizada = patente.toString().toUpperCase().replace(/\s+/g, '').trim();
  return normalizada || null;
}
