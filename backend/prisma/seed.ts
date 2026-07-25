import 'dotenv/config';
import { PrismaClient, Tipo, TipoRubro } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ── Rubros base por empresa (Módulo Egresos/Ingresos configurables) ──────────
// codigo se usa para lógica de negocio estable (subcategoría impuestos,
// echeqs sólo desde EG-EXTRA, liquidaciones de RRHH) independiente del nombre,
// que el admin puede renombrar libremente.
const RUBROS_ENJOY: { tipo: TipoRubro; orden: number; nombre: string; codigo?: string }[] = [
  { tipo: TipoRubro.EGRESO, orden: 1,  nombre: 'Producción General' },
  { tipo: TipoRubro.EGRESO, orden: 2,  nombre: 'Sonido' },
  { tipo: TipoRubro.EGRESO, orden: 3,  nombre: 'Iluminación' },
  { tipo: TipoRubro.EGRESO, orden: 4,  nombre: 'Escenografía' },
  { tipo: TipoRubro.EGRESO, orden: 5,  nombre: 'Seguridad' },
  { tipo: TipoRubro.EGRESO, orden: 6,  nombre: 'Catering y Gastronomía' },
  { tipo: TipoRubro.EGRESO, orden: 7,  nombre: 'Transporte y Logística' },
  { tipo: TipoRubro.EGRESO, orden: 8,  nombre: 'Impuestos',              codigo: 'EG-IMP' },
  { tipo: TipoRubro.EGRESO, orden: 9,  nombre: 'Préstamos' },
  { tipo: TipoRubro.EGRESO, orden: 10, nombre: 'Gastos Extraordinarios', codigo: 'EG-EXTRA' },
  { tipo: TipoRubro.EGRESO, orden: 11, nombre: 'RRHH',                   codigo: 'RRHH' },
  { tipo: TipoRubro.INGRESO, orden: 1, nombre: 'Tickets' },
  { tipo: TipoRubro.INGRESO, orden: 2, nombre: 'Sponsors' },
  { tipo: TipoRubro.INGRESO, orden: 3, nombre: 'Corporativo' },
  { tipo: TipoRubro.INGRESO, orden: 4, nombre: 'Gastronomía' },
  { tipo: TipoRubro.INGRESO, orden: 5, nombre: 'Service Charge' },
];

const RUBROS_DOS57: { tipo: TipoRubro; orden: number; nombre: string; codigo?: string }[] = [
  { tipo: TipoRubro.EGRESO, orden: 1, nombre: 'Materiales Layher' },
  { tipo: TipoRubro.EGRESO, orden: 2, nombre: 'Transporte y Logística' },
  { tipo: TipoRubro.EGRESO, orden: 3, nombre: 'RRHH',                  codigo: 'RRHH' },
  { tipo: TipoRubro.EGRESO, orden: 4, nombre: 'Combustible' },
  { tipo: TipoRubro.EGRESO, orden: 5, nombre: 'Mantenimiento de Equipos' },
  { tipo: TipoRubro.EGRESO, orden: 6, nombre: 'Impuestos',             codigo: 'EG-IMP' },
  { tipo: TipoRubro.EGRESO, orden: 7, nombre: 'Gastos Generales' },
  { tipo: TipoRubro.EGRESO, orden: 8, nombre: 'Préstamos' },
  { tipo: TipoRubro.INGRESO, orden: 1, nombre: 'Alquiler de Estructuras' },
  { tipo: TipoRubro.INGRESO, orden: 2, nombre: 'Mano de Obra' },
  { tipo: TipoRubro.INGRESO, orden: 3, nombre: 'Transporte' },
  { tipo: TipoRubro.INGRESO, orden: 4, nombre: 'Otros Ingresos' },
];

const TABS = [
  // Egresos — códigos fijos usados por el importer Excel
  { tipo: Tipo.EGRESO,  numero: 1, orden: 1, nombre: 'EG-TC',           codigo: 'EG-TC',           es_sistema: true, activo: true },
  { tipo: Tipo.EGRESO,  numero: 2, orden: 2, nombre: 'EG-RET SOC',      codigo: 'EG-RET-SOC',      es_sistema: true, activo: true },
  { tipo: Tipo.EGRESO,  numero: 3, orden: 3, nombre: 'EG-EXTRA',        codigo: 'EG-EXTRA',        es_sistema: true, activo: true },
  { tipo: Tipo.EGRESO,  numero: 4, orden: 4, nombre: 'EG-IMP',          codigo: 'EG-IMP',          es_sistema: true, activo: true },
  { tipo: Tipo.EGRESO,  numero: 5, orden: 5, nombre: 'EG-PREST',        codigo: 'EG-PREST',        es_sistema: true, activo: true },
  // Ingresos
  { tipo: Tipo.INGRESO, numero: 1, orden: 1, nombre: 'ING TICKETS',     codigo: 'ING-TICKETS',     es_sistema: true, activo: true },
  { tipo: Tipo.INGRESO, numero: 2, orden: 2, nombre: 'ING SPON',        codigo: 'ING-SPON',        es_sistema: true, activo: true },
  { tipo: Tipo.INGRESO, numero: 3, orden: 3, nombre: 'ING CORP',        codigo: 'ING-CORP',        es_sistema: true, activo: true },
  { tipo: Tipo.INGRESO, numero: 4, orden: 4, nombre: 'ING GASTRO',      codigo: 'ING-GASTRO',      es_sistema: true, activo: true },
  { tipo: Tipo.INGRESO, numero: 5, orden: 5, nombre: 'ING SERV CHARGE', codigo: 'ING-SERV-CHARGE', es_sistema: true, activo: true },
];

async function main() {
  // ── Empresas ──────────────────────────────────────────────────────────────
  const enjoy = await prisma.empresa.upsert({
    where:  { id: 1 },
    update: {},
    create: {
      id:             1,
      nombre:         'Enjoy Producciones',
      nombre_corto:   'Enjoy',
      color_primario: '#1E3A5F',
      activo:         true,
    },
  });

  const dos57 = await prisma.empresa.upsert({
    where:  { id: 2 },
    update: {},
    create: {
      id:             2,
      nombre:         'DOS57 Estructuras',
      nombre_corto:   'DOS57',
      color_primario: '#065F46',
      activo:         true,
    },
  });

  console.log('✓ Empresas: Enjoy Producciones (id=1), DOS57 Estructuras (id=2)');

  // ── TabConfig — cada empresa tiene su propio set de 10 tabs ────────────────
  for (const empresa of [enjoy, dos57]) {
    for (const tab of TABS) {
      await prisma.tabConfig.upsert({
        where:  { codigo_empresa_id: { codigo: tab.codigo, empresa_id: empresa.id } },
        update: { nombre: tab.nombre, orden: tab.orden, es_sistema: tab.es_sistema, activo: tab.activo },
        create: { ...tab, empresa_id: empresa.id },
      });
    }
  }
  console.log(`✓ TabConfig: ${TABS.length} tabs x 2 empresas cargadas`);

  // ── Rubros — set base por empresa (configurable desde Configuración) ───────
  for (const [empresa, rubros] of [[enjoy, RUBROS_ENJOY], [dos57, RUBROS_DOS57]] as const) {
    for (const r of rubros) {
      await prisma.rubro.upsert({
        where:  { empresa_id_tipo_nombre: { empresa_id: empresa.id, tipo: r.tipo, nombre: r.nombre } },
        update: { orden: r.orden, codigo: r.codigo ?? null, es_sistema: true, activo: true },
        create: {
          empresa_id: empresa.id,
          tipo:       r.tipo,
          nombre:     r.nombre,
          codigo:     r.codigo ?? null,
          orden:      r.orden,
          es_sistema: true,
          activo:     true,
        },
      });
    }
  }
  console.log(`✓ Rubros: ${RUBROS_ENJOY.length} para Enjoy, ${RUBROS_DOS57.length} para DOS57`);

  // ── Usuario admin global ────────────────────────────────────────────────────
  // empresa_id queda null: es el admin global, puede cambiar de empresa
  // libremente desde el sidebar sin necesitar fila en UsuarioEmpresaAcceso.
  const adminEmail    = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error('ADMIN_EMAIL y ADMIN_PASSWORD deben estar definidos en .env');
  }

  const hash = await bcrypt.hash(adminPassword, 10);

  await prisma.usuario.upsert({
    where:  { email: adminEmail },
    update: { empresa_id: null },
    create: {
      email:         adminEmail,
      nombre:        'Administrador',
      password_hash: hash,
      rol:           'ADMIN',
      empresa_id:    null,
    },
  });

  console.log(`✓ Usuario admin global creado: ${adminEmail}`);

  // ── Backfill: usuarios no-admin sin UsuarioEmpresaAcceso ────────────────────
  // Cubre usuarios que ya existían en la base antes de la migración a
  // multitenancy y quedaron sin ninguna empresa asignada (no podían loguearse).
  const usuariosSinEmpresa = await prisma.usuario.findMany({
    where: {
      rol: { not: 'ADMIN' },
      empresaAccesos: { none: {} },
    },
  });

  for (const usuario of usuariosSinEmpresa) {
    await prisma.usuarioEmpresaAcceso.upsert({
      where:  { usuario_id_empresa_id: { usuario_id: usuario.id, empresa_id: enjoy.id } },
      update: {},
      create: { usuario_id: usuario.id, empresa_id: enjoy.id },
    });
    console.log(`✓ Usuario huérfano "${usuario.email}" asignado a Enjoy Producciones`);
  }
}

main()
  .catch((e) => {
    console.error('Error en seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
