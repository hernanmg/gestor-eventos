// ═══════════════════════════════════════════════════════════════════════════
// Carga inicial de la identidad visual de las dos empresas: sube los logos
// reales de docs/ a Empresa.logo_data (mismo sistema que el upload desde
// Configuración → Empresa) y fija color_primario.
//
//   docs/enjoy/logo_enjoy.png → Empresa id=1 (Enjoy) · #E31E24
//   docs/dos57/logo_dos57.png → Empresa id=2 (DOS57) · #C8FF00
//
// El seed sólo pone estos colores al crear la empresa (update: {}), para no
// pisar lo que un ADMIN cambie después; en una base que ya existe hace falta
// correr esto una vez. Idempotente: volver a correrlo deja lo mismo.
//
// El color del texto sobre el color de marca (negro/blanco) no se guarda: lo
// calcula el frontend por luminancia (ver lib/empresaTheme.ts).
//
// Run: npx ts-node --files scripts/cargarBrandingEmpresas.ts
// ═══════════════════════════════════════════════════════════════════════════

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DOCS = path.resolve(__dirname, '../../docs');

const BRANDING = [
  { id: 1, nombre: 'Enjoy', logo: path.join(DOCS, 'enjoy/logo_enjoy.png'), color: '#E31E24' },
  { id: 2, nombre: 'DOS57', logo: path.join(DOCS, 'dos57/logo_dos57.png'), color: '#C8FF00' },
];

async function main() {
  for (const b of BRANDING) {
    const empresa = await prisma.empresa.findUnique({ where: { id: b.id }, select: { id: true } });
    if (!empresa) { console.warn(`✗ Empresa id=${b.id} (${b.nombre}) no existe — salteada`); continue; }
    if (!fs.existsSync(b.logo)) throw new Error(`No se encontró el logo ${b.logo}`);

    const buffer = fs.readFileSync(b.logo);
    await prisma.empresa.update({
      where: { id: b.id },
      data: {
        logo_data:      buffer,
        logo_nombre:    path.basename(b.logo),
        logo_mime:      'image/png',
        color_primario: b.color,
      },
    });
    console.log(`✓ ${b.nombre} (id=${b.id}): logo ${path.basename(b.logo)} (${(buffer.length / 1024).toFixed(0)} KB), color ${b.color}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
