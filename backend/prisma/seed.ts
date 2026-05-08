import 'dotenv/config';
import { PrismaClient, Tipo } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TABS = [
  // Egresos — códigos fijos usados por el importer Excel
  { tipo: Tipo.EGRESO,  numero: 1, nombre: 'EG-TC',           codigo: 'EG-TC' },
  { tipo: Tipo.EGRESO,  numero: 2, nombre: 'EG-RET SOC',      codigo: 'EG-RET-SOC' },
  { tipo: Tipo.EGRESO,  numero: 3, nombre: 'EG-EXTRA',        codigo: 'EG-EXTRA' },
  { tipo: Tipo.EGRESO,  numero: 4, nombre: 'EG-IMP',          codigo: 'EG-IMP' },
  { tipo: Tipo.EGRESO,  numero: 5, nombre: 'EG-PREST',        codigo: 'EG-PREST' },
  // Ingresos
  { tipo: Tipo.INGRESO, numero: 1, nombre: 'ING TICKETS',     codigo: 'ING-TICKETS' },
  { tipo: Tipo.INGRESO, numero: 2, nombre: 'ING SPON',        codigo: 'ING-SPON' },
  { tipo: Tipo.INGRESO, numero: 3, nombre: 'ING CORP',        codigo: 'ING-CORP' },
  { tipo: Tipo.INGRESO, numero: 4, nombre: 'ING GASTRO',      codigo: 'ING-GASTRO' },
  { tipo: Tipo.INGRESO, numero: 5, nombre: 'ING SERV CHARGE', codigo: 'ING-SERV-CHARGE' },
];

async function main() {
  // ── TabConfig ─────────────────────────────────────────────────────────────
  for (const tab of TABS) {
    await prisma.tabConfig.upsert({
      where: { codigo: tab.codigo },
      update: { nombre: tab.nombre },
      create: tab,
    });
  }
  console.log(`✓ TabConfig: ${TABS.length} tabs cargadas`);

  // ── Usuario admin ─────────────────────────────────────────────────────────
  const adminEmail    = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error('ADMIN_EMAIL y ADMIN_PASSWORD deben estar definidos en .env');
  }

  const hash = await bcrypt.hash(adminPassword, 10);

  await prisma.usuario.upsert({
    where:  { email: adminEmail },
    update: {},
    create: {
      email:         adminEmail,
      nombre:        'Administrador',
      password_hash: hash,
      rol:           'ADMIN',
    },
  });

  console.log(`✓ Usuario admin creado: ${adminEmail}`);
}

main()
  .catch((e) => {
    console.error('Error en seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
