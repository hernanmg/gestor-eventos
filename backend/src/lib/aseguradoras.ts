// Clave para comparar aseguradoras escritas de distinta forma en las planillas:
// "Federación Patronal" / "FEDERAL PATRONAL (AP)" / "Fed.Patronal" → "feder".
// Alcanza para distinguir las reales (Sancor, San Cristóbal, Experta, Berkley,
// Rivadavia, Allianz). Ojo: Sancor y San Cristóbal comparten "san".
const ABREVIATURAS: [RegExp, string][] = [
  [/^fed/, 'feder'],          // Fed. Patronal, Federal Patronal, Federación Patronal
  [/^sanc?crist/, 'sancr'],   // San Cristóbal, S. Cristobal
  [/^scrist/, 'sancr'],
];

export function claveAseguradora(s: string | null | undefined): string {
  const base = (s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\b(art|ap|seguros?|cia|compania)\b/g, '')
    .replace(/[^a-z]/g, '');
  for (const [re, clave] of ABREVIATURAS) if (re.test(base)) return clave;
  return base.slice(0, 5);
}
