import 'dotenv/config';
import { PrismaClient, Tipo, TipoRubro } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { RUBROS_SISTEMA } from '../src/lib/rubrosConstants';

const prisma = new PrismaClient();

// ── Rubros base por empresa (Módulo Egresos/Ingresos configurables) ──────────
// codigo se usa para lógica de negocio estable (subcategoría impuestos,
// echeqs sólo desde EG-EXTRA, liquidaciones de RRHH) independiente del nombre,
// que el admin puede renombrar libremente.
// Rubros operativos reales de Enjoy (1-84, ver docs/Control de Rubros Enjoy.xlsx)
// + 3 rubros técnicos del sistema (85-87) de los que depende lógica de negocio
// por su `codigo` estable: impuesto_subcategoria (EG-IMP) y echeqs (EG-EXTRA).
const RUBROS_ENJOY: { tipo: TipoRubro; orden: number; nombre: string; codigo?: string }[] = [
  { tipo: TipoRubro.EGRESO, orden: 1,  nombre: 'Directorio' },
  { tipo: TipoRubro.EGRESO, orden: 2,  nombre: 'Estructuras' },
  { tipo: TipoRubro.EGRESO, orden: 3,  nombre: 'Cerramiento' },
  { tipo: TipoRubro.EGRESO, orden: 4,  nombre: 'Vallas' },
  { tipo: TipoRubro.EGRESO, orden: 5,  nombre: 'Sonido' },
  { tipo: TipoRubro.EGRESO, orden: 6,  nombre: 'Luces' },
  { tipo: TipoRubro.EGRESO, orden: 7,  nombre: 'Pantalla' },
  { tipo: TipoRubro.EGRESO, orden: 8,  nombre: 'FX' },
  { tipo: TipoRubro.EGRESO, orden: 9,  nombre: 'CCTV' },
  { tipo: TipoRubro.EGRESO, orden: 10, nombre: 'Baños químicos' },
  { tipo: TipoRubro.EGRESO, orden: 11, nombre: 'Contenedor Oficina' },
  { tipo: TipoRubro.EGRESO, orden: 12, nombre: 'Baños VIP' },
  { tipo: TipoRubro.EGRESO, orden: 13, nombre: 'Backline' },
  { tipo: TipoRubro.EGRESO, orden: 14, nombre: 'Mobiliario' },
  { tipo: TipoRubro.EGRESO, orden: 15, nombre: 'Catering' },
  { tipo: TipoRubro.EGRESO, orden: 16, nombre: 'Carpas' },
  { tipo: TipoRubro.EGRESO, orden: 17, nombre: 'Puesto de hidratación' },
  { tipo: TipoRubro.EGRESO, orden: 18, nombre: 'Seguridad privada' },
  { tipo: TipoRubro.EGRESO, orden: 19, nombre: 'Sereno' },
  { tipo: TipoRubro.EGRESO, orden: 20, nombre: 'Jefe de seguridad' },
  { tipo: TipoRubro.EGRESO, orden: 21, nombre: 'Generador' },
  { tipo: TipoRubro.EGRESO, orden: 22, nombre: 'Distribución de energía' },
  { tipo: TipoRubro.EGRESO, orden: 23, nombre: 'Camiones/Logística' },
  { tipo: TipoRubro.EGRESO, orden: 24, nombre: 'Transportación' },
  { tipo: TipoRubro.EGRESO, orden: 25, nombre: 'Sillas plásticas' },
  { tipo: TipoRubro.EGRESO, orden: 26, nombre: 'Conectividad distribución' },
  { tipo: TipoRubro.EGRESO, orden: 27, nombre: 'Cámaras de seguridad' },
  { tipo: TipoRubro.EGRESO, orden: 28, nombre: 'Conectividad Starlink' },
  { tipo: TipoRubro.EGRESO, orden: 29, nombre: 'Equipo Audiovisual' },
  { tipo: TipoRubro.EGRESO, orden: 30, nombre: 'Drone' },
  { tipo: TipoRubro.EGRESO, orden: 31, nombre: 'Viandas' },
  { tipo: TipoRubro.EGRESO, orden: 32, nombre: 'Hielo' },
  { tipo: TipoRubro.EGRESO, orden: 33, nombre: 'Dispenser con bidones' },
  { tipo: TipoRubro.EGRESO, orden: 34, nombre: 'Agua para contrapeso' },
  { tipo: TipoRubro.EGRESO, orden: 35, nombre: 'Ambulancias' },
  { tipo: TipoRubro.EGRESO, orden: 36, nombre: 'Barras' },
  { tipo: TipoRubro.EGRESO, orden: 37, nombre: 'Tablones con bancos' },
  { tipo: TipoRubro.EGRESO, orden: 38, nombre: 'Inflables' },
  { tipo: TipoRubro.EGRESO, orden: 39, nombre: 'Beduinas' },
  { tipo: TipoRubro.EGRESO, orden: 40, nombre: 'Colectivo' },
  { tipo: TipoRubro.EGRESO, orden: 41, nombre: 'Puesto Sanitario' },
  { tipo: TipoRubro.EGRESO, orden: 42, nombre: 'Ambientación' },
  { tipo: TipoRubro.EGRESO, orden: 43, nombre: 'Hotelería Party A' },
  { tipo: TipoRubro.EGRESO, orden: 44, nombre: 'Hotelería Party B' },
  { tipo: TipoRubro.EGRESO, orden: 45, nombre: 'Hotelería Party C' },
  { tipo: TipoRubro.EGRESO, orden: 46, nombre: 'Zamping' },
  { tipo: TipoRubro.EGRESO, orden: 47, nombre: 'Ticketera' },
  { tipo: TipoRubro.EGRESO, orden: 48, nombre: 'Limpieza en evento' },
  { tipo: TipoRubro.EGRESO, orden: 49, nombre: 'Limpieza pre y post' },
  { tipo: TipoRubro.EGRESO, orden: 50, nombre: 'Limpieza baños químicos' },
  { tipo: TipoRubro.EGRESO, orden: 51, nombre: 'Desagote baños químicos' },
  { tipo: TipoRubro.EGRESO, orden: 52, nombre: 'Seguro RC' },
  { tipo: TipoRubro.EGRESO, orden: 53, nombre: 'Panelería' },
  { tipo: TipoRubro.EGRESO, orden: 54, nombre: 'Personal de cargas' },
  { tipo: TipoRubro.EGRESO, orden: 55, nombre: 'Personal de boletería' },
  { tipo: TipoRubro.EGRESO, orden: 56, nombre: 'Personal acomodadores' },
  { tipo: TipoRubro.EGRESO, orden: 57, nombre: 'Personal estacionamiento' },
  { tipo: TipoRubro.EGRESO, orden: 58, nombre: 'Policía' },
  { tipo: TipoRubro.EGRESO, orden: 59, nombre: 'Adicionales de policía' },
  { tipo: TipoRubro.EGRESO, orden: 60, nombre: 'Riggers' },
  { tipo: TipoRubro.EGRESO, orden: 61, nombre: 'Entelado/Aforo' },
  { tipo: TipoRubro.EGRESO, orden: 62, nombre: 'Op. Sonido' },
  { tipo: TipoRubro.EGRESO, orden: 63, nombre: 'Op. Luces' },
  { tipo: TipoRubro.EGRESO, orden: 64, nombre: 'Op. Pantalla' },
  { tipo: TipoRubro.EGRESO, orden: 65, nombre: 'DJ' },
  { tipo: TipoRubro.EGRESO, orden: 66, nombre: 'Host de redes' },
  { tipo: TipoRubro.EGRESO, orden: 67, nombre: 'Choferes' },
  { tipo: TipoRubro.EGRESO, orden: 68, nombre: 'Branding/Imprenta' },
  { tipo: TipoRubro.EGRESO, orden: 69, nombre: 'Pañolero' },
  { tipo: TipoRubro.EGRESO, orden: 70, nombre: 'Publicidad Vía pública' },
  { tipo: TipoRubro.EGRESO, orden: 71, nombre: 'Activaciones/Juegos' },
  { tipo: TipoRubro.EGRESO, orden: 72, nombre: 'Promotoras' },
  { tipo: TipoRubro.EGRESO, orden: 73, nombre: 'Túnel / Tubos led' },
  { tipo: TipoRubro.EGRESO, orden: 74, nombre: 'Laser' },
  { tipo: TipoRubro.EGRESO, orden: 75, nombre: 'Fuegos Artificiales' },
  { tipo: TipoRubro.EGRESO, orden: 76, nombre: 'Transmisión/Streaming' },
  { tipo: TipoRubro.EGRESO, orden: 77, nombre: 'Rescatistas' },
  { tipo: TipoRubro.EGRESO, orden: 78, nombre: 'Domo' },
  { tipo: TipoRubro.EGRESO, orden: 79, nombre: 'Chinitos/Calefactores' },
  { tipo: TipoRubro.EGRESO, orden: 80, nombre: 'Climatización de carpas' },
  { tipo: TipoRubro.EGRESO, orden: 81, nombre: 'Mapping' },
  { tipo: TipoRubro.EGRESO, orden: 82, nombre: 'Amidas' },
  { tipo: TipoRubro.EGRESO, orden: 83, nombre: 'Camión de caudales' },
  { tipo: TipoRubro.EGRESO, orden: 84, nombre: 'Handyeman' },
  // Rubros técnicos del sistema — no borrables (es_sistema=true), requeridos
  // por lógica de negocio propia (liquidaciones RRHH, impuesto_subcategoria,
  // echeqs). Van al final del orden para no mezclarse con los operativos.
  { tipo: TipoRubro.EGRESO, orden: 85, nombre: 'RRHH',                   codigo: RUBROS_SISTEMA.RRHH },
  { tipo: TipoRubro.EGRESO, orden: 86, nombre: 'Impuestos',              codigo: RUBROS_SISTEMA.IMPUESTOS },
  { tipo: TipoRubro.EGRESO, orden: 87, nombre: 'Gastos Extraordinarios', codigo: RUBROS_SISTEMA.GASTOS_EXTRA },
  { tipo: TipoRubro.INGRESO, orden: 1, nombre: 'Tickets' },
  { tipo: TipoRubro.INGRESO, orden: 2, nombre: 'Sponsors' },
  { tipo: TipoRubro.INGRESO, orden: 3, nombre: 'Corporativo' },
  { tipo: TipoRubro.INGRESO, orden: 4, nombre: 'Gastronomía' },
  { tipo: TipoRubro.INGRESO, orden: 5, nombre: 'Service Charge' },
];

const RUBROS_DOS57: { tipo: TipoRubro; orden: number; nombre: string; codigo?: string }[] = [
  { tipo: TipoRubro.EGRESO, orden: 1, nombre: 'Materiales Layher' },
  { tipo: TipoRubro.EGRESO, orden: 2, nombre: 'Transporte y Logística' },
  { tipo: TipoRubro.EGRESO, orden: 3, nombre: 'RRHH',                  codigo: RUBROS_SISTEMA.RRHH },
  { tipo: TipoRubro.EGRESO, orden: 4, nombre: 'Combustible' },
  { tipo: TipoRubro.EGRESO, orden: 5, nombre: 'Mantenimiento de Equipos' },
  { tipo: TipoRubro.EGRESO, orden: 6, nombre: 'Impuestos',             codigo: RUBROS_SISTEMA.IMPUESTOS },
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

  // ── Limpieza: rubros EGRESO genéricos de Enjoy reemplazados por los 84 reales
  // Soft-delete (no hard delete) para no romper movimientos históricos que ya
  // los referencian por rubro_id — sólo dejan de aparecer en listados/altas nuevas.
  const NOMBRES_ENJOY_VIGENTES = RUBROS_ENJOY
    .filter(r => r.tipo === TipoRubro.EGRESO)
    .map(r => r.nombre);

  const { count: rubrosObsoletos } = await prisma.rubro.updateMany({
    where: {
      empresa_id: enjoy.id,
      tipo:       TipoRubro.EGRESO,
      nombre:     { notIn: NOMBRES_ENJOY_VIGENTES },
      deleted_at: null,
    },
    data: { deleted_at: new Date(), activo: false },
  });
  if (rubrosObsoletos > 0) {
    console.log(`✓ Rubros EGRESO genéricos obsoletos de Enjoy desactivados: ${rubrosObsoletos}`);
  }

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
