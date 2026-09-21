import 'dotenv/config';
import { PrismaClient, Tipo, TipoRubro, TipoCuenta, Moneda } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { RUBROS_SISTEMA } from '../src/lib/rubrosConstants';

const prisma = new PrismaClient();

// ── Rubros base por empresa (Módulo Egresos/Ingresos configurables) ──────────
// codigo se usa para lógica de negocio estable (subcategoría impuestos,
// echeqs sólo desde EG-EXTRA, liquidaciones de RRHH) independiente del nombre,
// que el admin puede renombrar libremente.
// Rubros operativos reales de Enjoy (1-90, agrupados según docs/enjoy/rubro
// por evento.xlsx — grupo "RECURSOS HUMANOS - ENJOY" del Excel son nombres de
// personas del staff, no categorías de gasto, y no se cargan como Rubro)
// + 3 rubros técnicos del sistema (91-93) de los que depende lógica de negocio
// por su `codigo` estable: impuesto_subcategoria (EG-IMP) y echeqs (EG-EXTRA).
const RUBROS_ENJOY: { tipo: TipoRubro; orden: number; nombre: string; codigo?: string; descripcion?: string; grupo?: string }[] = [
  // Sin grupo claro en el Excel de referencia (gasto de directorio/overhead)
  { tipo: TipoRubro.EGRESO, orden: 1,  nombre: 'Directorio' },
  // INFRAESTRUCTURA Y MONTAJE
  { tipo: TipoRubro.EGRESO, orden: 2,  nombre: 'Estructuras',         grupo: 'INFRAESTRUCTURA Y MONTAJE' },
  { tipo: TipoRubro.EGRESO, orden: 3,  nombre: 'Cerramiento',         grupo: 'INFRAESTRUCTURA Y MONTAJE' },
  { tipo: TipoRubro.EGRESO, orden: 4,  nombre: 'Vallas',              grupo: 'INFRAESTRUCTURA Y MONTAJE' },
  { tipo: TipoRubro.EGRESO, orden: 5,  nombre: 'Free standing',       grupo: 'INFRAESTRUCTURA Y MONTAJE' },
  { tipo: TipoRubro.EGRESO, orden: 6,  nombre: 'Carpa Beduinas',      grupo: 'INFRAESTRUCTURA Y MONTAJE' },
  { tipo: TipoRubro.EGRESO, orden: 7,  nombre: 'Carpas Estructural',  grupo: 'INFRAESTRUCTURA Y MONTAJE' },
  { tipo: TipoRubro.EGRESO, orden: 8,  nombre: 'Carpa Gazebo',        grupo: 'INFRAESTRUCTURA Y MONTAJE' },
  { tipo: TipoRubro.EGRESO, orden: 9,  nombre: 'Carpas',              grupo: 'INFRAESTRUCTURA Y MONTAJE' },
  { tipo: TipoRubro.EGRESO, orden: 10, nombre: 'Beduinas',            grupo: 'INFRAESTRUCTURA Y MONTAJE' },
  { tipo: TipoRubro.EGRESO, orden: 11, nombre: 'Mobiliario',          grupo: 'INFRAESTRUCTURA Y MONTAJE' },
  { tipo: TipoRubro.EGRESO, orden: 12, nombre: 'Contenedor Oficina',  grupo: 'INFRAESTRUCTURA Y MONTAJE' },
  { tipo: TipoRubro.EGRESO, orden: 13, nombre: 'Sillas plásticas',    grupo: 'INFRAESTRUCTURA Y MONTAJE' },
  { tipo: TipoRubro.EGRESO, orden: 14, nombre: 'Tablones con bancos', grupo: 'INFRAESTRUCTURA Y MONTAJE' },
  { tipo: TipoRubro.EGRESO, orden: 15, nombre: 'Inflables',           grupo: 'INFRAESTRUCTURA Y MONTAJE' },
  { tipo: TipoRubro.EGRESO, orden: 16, nombre: 'Panelería',           grupo: 'INFRAESTRUCTURA Y MONTAJE' },
  { tipo: TipoRubro.EGRESO, orden: 17, nombre: 'Domo',                grupo: 'INFRAESTRUCTURA Y MONTAJE' },
  { tipo: TipoRubro.EGRESO, orden: 18, nombre: 'Ambientación',        grupo: 'INFRAESTRUCTURA Y MONTAJE' },
  // TÉCNICA Y AUDIOVISUAL
  { tipo: TipoRubro.EGRESO, orden: 19, nombre: 'Sonido',                 grupo: 'TÉCNICA Y AUDIOVISUAL' },
  { tipo: TipoRubro.EGRESO, orden: 20, nombre: 'Luces',                  grupo: 'TÉCNICA Y AUDIOVISUAL' },
  { tipo: TipoRubro.EGRESO, orden: 21, nombre: 'Pantalla',               grupo: 'TÉCNICA Y AUDIOVISUAL' },
  { tipo: TipoRubro.EGRESO, orden: 22, nombre: 'FX',                     grupo: 'TÉCNICA Y AUDIOVISUAL' },
  { tipo: TipoRubro.EGRESO, orden: 23, nombre: 'CCTV',                   grupo: 'TÉCNICA Y AUDIOVISUAL' },
  { tipo: TipoRubro.EGRESO, orden: 24, nombre: 'Cámaras de seguridad',   grupo: 'TÉCNICA Y AUDIOVISUAL' },
  { tipo: TipoRubro.EGRESO, orden: 25, nombre: 'Conectividad distribución', grupo: 'TÉCNICA Y AUDIOVISUAL' },
  { tipo: TipoRubro.EGRESO, orden: 26, nombre: 'Conectividad',           grupo: 'TÉCNICA Y AUDIOVISUAL' },
  { tipo: TipoRubro.EGRESO, orden: 27, nombre: 'Conectividad Starlink',  grupo: 'TÉCNICA Y AUDIOVISUAL' },
  { tipo: TipoRubro.EGRESO, orden: 28, nombre: 'Equipo Audiovisual',     grupo: 'TÉCNICA Y AUDIOVISUAL' },
  { tipo: TipoRubro.EGRESO, orden: 29, nombre: 'Drone',                  grupo: 'TÉCNICA Y AUDIOVISUAL' },
  { tipo: TipoRubro.EGRESO, orden: 30, nombre: 'Backline',               grupo: 'TÉCNICA Y AUDIOVISUAL' },
  { tipo: TipoRubro.EGRESO, orden: 31, nombre: 'Túnel / Tubos led',      grupo: 'TÉCNICA Y AUDIOVISUAL' },
  { tipo: TipoRubro.EGRESO, orden: 32, nombre: 'Laser',                  grupo: 'TÉCNICA Y AUDIOVISUAL' },
  { tipo: TipoRubro.EGRESO, orden: 33, nombre: 'Transmisión/Streaming',  grupo: 'TÉCNICA Y AUDIOVISUAL' },
  { tipo: TipoRubro.EGRESO, orden: 34, nombre: 'Mapping',                grupo: 'TÉCNICA Y AUDIOVISUAL' },
  { tipo: TipoRubro.EGRESO, orden: 35, nombre: 'Fuegos Artificiales',    grupo: 'TÉCNICA Y AUDIOVISUAL' },
  // ENERGÍA Y SERVICIOS TÉCNICOS
  { tipo: TipoRubro.EGRESO, orden: 36, nombre: 'Generador',                grupo: 'ENERGÍA Y SERVICIOS TÉCNICOS' },
  { tipo: TipoRubro.EGRESO, orden: 37, nombre: 'Distribución de energía',  grupo: 'ENERGÍA Y SERVICIOS TÉCNICOS' },
  { tipo: TipoRubro.EGRESO, orden: 38, nombre: 'Agua para contrapeso',     grupo: 'ENERGÍA Y SERVICIOS TÉCNICOS' },
  { tipo: TipoRubro.EGRESO, orden: 39, nombre: 'Dispenser con bidones',    grupo: 'ENERGÍA Y SERVICIOS TÉCNICOS' },
  { tipo: TipoRubro.EGRESO, orden: 40, nombre: 'Chinitos/Calefactores',    grupo: 'ENERGÍA Y SERVICIOS TÉCNICOS' },
  { tipo: TipoRubro.EGRESO, orden: 41, nombre: 'Climatización de carpas',  grupo: 'ENERGÍA Y SERVICIOS TÉCNICOS' },
  // SEGURIDAD, EMERGENCIAS Y CONTROL
  { tipo: TipoRubro.EGRESO, orden: 42, nombre: 'Seguridad privada',    grupo: 'SEGURIDAD, EMERGENCIAS Y CONTROL' },
  { tipo: TipoRubro.EGRESO, orden: 43, nombre: 'Sereno',                grupo: 'SEGURIDAD, EMERGENCIAS Y CONTROL' },
  { tipo: TipoRubro.EGRESO, orden: 44, nombre: 'Jefe de seguridad',     grupo: 'SEGURIDAD, EMERGENCIAS Y CONTROL' },
  { tipo: TipoRubro.EGRESO, orden: 45, nombre: 'Policía',               grupo: 'SEGURIDAD, EMERGENCIAS Y CONTROL' },
  { tipo: TipoRubro.EGRESO, orden: 46, nombre: 'Adicionales de policía', grupo: 'SEGURIDAD, EMERGENCIAS Y CONTROL' },
  { tipo: TipoRubro.EGRESO, orden: 47, nombre: 'Ambulancias',           grupo: 'SEGURIDAD, EMERGENCIAS Y CONTROL' },
  { tipo: TipoRubro.EGRESO, orden: 48, nombre: 'Puesto Sanitario',      grupo: 'SEGURIDAD, EMERGENCIAS Y CONTROL' },
  { tipo: TipoRubro.EGRESO, orden: 49, nombre: 'Rescatistas',           grupo: 'SEGURIDAD, EMERGENCIAS Y CONTROL' },
  { tipo: TipoRubro.EGRESO, orden: 50, nombre: 'Entelado/Aforo',        grupo: 'SEGURIDAD, EMERGENCIAS Y CONTROL' },
  { tipo: TipoRubro.EGRESO, orden: 51, nombre: 'Seguro RC',             grupo: 'SEGURIDAD, EMERGENCIAS Y CONTROL' },
  // LOGÍSTICA Y TRANSPORTE
  { tipo: TipoRubro.EGRESO, orden: 52, nombre: 'Camiones/Logística',  grupo: 'LOGÍSTICA Y TRANSPORTE' },
  { tipo: TipoRubro.EGRESO, orden: 53, nombre: 'Transportación',      grupo: 'LOGÍSTICA Y TRANSPORTE' },
  { tipo: TipoRubro.EGRESO, orden: 54, nombre: 'Colectivo',            grupo: 'LOGÍSTICA Y TRANSPORTE' },
  { tipo: TipoRubro.EGRESO, orden: 55, nombre: 'Choferes',             grupo: 'LOGÍSTICA Y TRANSPORTE' },
  { tipo: TipoRubro.EGRESO, orden: 56, nombre: 'Personal de cargas',   grupo: 'LOGÍSTICA Y TRANSPORTE' },
  { tipo: TipoRubro.EGRESO, orden: 57, nombre: 'Camión de caudales',   grupo: 'LOGÍSTICA Y TRANSPORTE' },
  { tipo: TipoRubro.EGRESO, orden: 58, nombre: 'Transporte interno',   grupo: 'LOGÍSTICA Y TRANSPORTE' },
  // GASTRONOMÍA Y HOSPITALITY
  { tipo: TipoRubro.EGRESO, orden: 59, nombre: 'Catering',              grupo: 'GASTRONOMÍA Y HOSPITALITY' },
  { tipo: TipoRubro.EGRESO, orden: 60, nombre: 'Barras',                grupo: 'GASTRONOMÍA Y HOSPITALITY' },
  { tipo: TipoRubro.EGRESO, orden: 61, nombre: 'Puesto de hidratación', grupo: 'GASTRONOMÍA Y HOSPITALITY' },
  { tipo: TipoRubro.EGRESO, orden: 62, nombre: 'Viandas',               grupo: 'GASTRONOMÍA Y HOSPITALITY' },
  { tipo: TipoRubro.EGRESO, orden: 63, nombre: 'Hielo',                 grupo: 'GASTRONOMÍA Y HOSPITALITY' },
  { tipo: TipoRubro.EGRESO, orden: 64, nombre: 'Hotelería Party A',     grupo: 'GASTRONOMÍA Y HOSPITALITY' },
  { tipo: TipoRubro.EGRESO, orden: 65, nombre: 'Hotelería Party B',     grupo: 'GASTRONOMÍA Y HOSPITALITY' },
  { tipo: TipoRubro.EGRESO, orden: 66, nombre: 'Hotelería Party C',     grupo: 'GASTRONOMÍA Y HOSPITALITY' },
  { tipo: TipoRubro.EGRESO, orden: 67, nombre: 'Zamping',               grupo: 'GASTRONOMÍA Y HOSPITALITY' },
  // SANITARIOS Y LIMPIEZA
  { tipo: TipoRubro.EGRESO, orden: 68, nombre: 'Baños químicos',           grupo: 'SANITARIOS Y LIMPIEZA' },
  { tipo: TipoRubro.EGRESO, orden: 69, nombre: 'Baños VIP',                grupo: 'SANITARIOS Y LIMPIEZA' },
  { tipo: TipoRubro.EGRESO, orden: 70, nombre: 'Limpieza en evento',       grupo: 'SANITARIOS Y LIMPIEZA' },
  { tipo: TipoRubro.EGRESO, orden: 71, nombre: 'Limpieza pre y post',      grupo: 'SANITARIOS Y LIMPIEZA' },
  { tipo: TipoRubro.EGRESO, orden: 72, nombre: 'Limpieza baños químicos',  grupo: 'SANITARIOS Y LIMPIEZA' },
  { tipo: TipoRubro.EGRESO, orden: 73, nombre: 'Desagote baños químicos',  grupo: 'SANITARIOS Y LIMPIEZA' },
  // COMUNICACIÓN, BRANDING Y EXPERIENCIA
  { tipo: TipoRubro.EGRESO, orden: 74, nombre: 'Host de redes',         grupo: 'COMUNICACIÓN, BRANDING Y EXPERIENCIA' },
  { tipo: TipoRubro.EGRESO, orden: 75, nombre: 'Branding/Imprenta',     grupo: 'COMUNICACIÓN, BRANDING Y EXPERIENCIA' },
  { tipo: TipoRubro.EGRESO, orden: 76, nombre: 'Publicidad Vía pública', grupo: 'COMUNICACIÓN, BRANDING Y EXPERIENCIA' },
  { tipo: TipoRubro.EGRESO, orden: 77, nombre: 'Activaciones/Juegos',   grupo: 'COMUNICACIÓN, BRANDING Y EXPERIENCIA' },
  { tipo: TipoRubro.EGRESO, orden: 78, nombre: 'Promotoras',            grupo: 'COMUNICACIÓN, BRANDING Y EXPERIENCIA' },
  { tipo: TipoRubro.EGRESO, orden: 79, nombre: 'Amidas',                grupo: 'COMUNICACIÓN, BRANDING Y EXPERIENCIA' },
  // OPERACIÓN Y PERSONAL
  { tipo: TipoRubro.EGRESO, orden: 80, nombre: 'Ticketera',                grupo: 'OPERACIÓN Y PERSONAL' },
  { tipo: TipoRubro.EGRESO, orden: 81, nombre: 'Personal de boletería',    grupo: 'OPERACIÓN Y PERSONAL' },
  { tipo: TipoRubro.EGRESO, orden: 82, nombre: 'Personal acomodadores',    grupo: 'OPERACIÓN Y PERSONAL' },
  { tipo: TipoRubro.EGRESO, orden: 83, nombre: 'Personal estacionamiento', grupo: 'OPERACIÓN Y PERSONAL' },
  { tipo: TipoRubro.EGRESO, orden: 84, nombre: 'Riggers',                  grupo: 'OPERACIÓN Y PERSONAL' },
  { tipo: TipoRubro.EGRESO, orden: 85, nombre: 'Op. Sonido',               grupo: 'OPERACIÓN Y PERSONAL' },
  { tipo: TipoRubro.EGRESO, orden: 86, nombre: 'Op. Luces',                grupo: 'OPERACIÓN Y PERSONAL' },
  { tipo: TipoRubro.EGRESO, orden: 87, nombre: 'Op. Pantalla',             grupo: 'OPERACIÓN Y PERSONAL' },
  { tipo: TipoRubro.EGRESO, orden: 88, nombre: 'DJ',                       grupo: 'OPERACIÓN Y PERSONAL' },
  { tipo: TipoRubro.EGRESO, orden: 89, nombre: 'Pañolero',                 grupo: 'OPERACIÓN Y PERSONAL' },
  { tipo: TipoRubro.EGRESO, orden: 90, nombre: 'Handyeman',                grupo: 'OPERACIÓN Y PERSONAL' },
  // Rubros técnicos del sistema — no borrables (es_sistema=true), requeridos
  // por lógica de negocio propia (liquidaciones RRHH, impuesto_subcategoria,
  // echeqs). Van al final del orden para no mezclarse con los operativos.
  { tipo: TipoRubro.EGRESO, orden: 91, nombre: 'RRHH',                   codigo: RUBROS_SISTEMA.RRHH },
  { tipo: TipoRubro.EGRESO, orden: 92, nombre: 'Impuestos',              codigo: RUBROS_SISTEMA.IMPUESTOS },
  { tipo: TipoRubro.EGRESO, orden: 93, nombre: 'Gastos Extraordinarios', codigo: RUBROS_SISTEMA.GASTOS_EXTRA },
  { tipo: TipoRubro.INGRESO, orden: 1, nombre: 'Tickets' },
  { tipo: TipoRubro.INGRESO, orden: 2, nombre: 'Sponsors' },
  { tipo: TipoRubro.INGRESO, orden: 3, nombre: 'Corporativo' },
  { tipo: TipoRubro.INGRESO, orden: 4, nombre: 'Gastronomía' },
  { tipo: TipoRubro.INGRESO, orden: 5, nombre: 'Service Charge' },
];

const RUBROS_DOS57: { tipo: TipoRubro; orden: number; nombre: string; codigo?: string; descripcion?: string; grupo?: string }[] = [
  // Rubros operativos reales de DOS57, confirmados por Jazmín — reemplazan
  // el set genérico inicial (Materiales Layher, Transporte y Logística,
  // Combustible, Mantenimiento de Equipos, Gastos Generales, Préstamos).
  { tipo: TipoRubro.EGRESO, orden: 1, nombre: 'Layher',  codigo: 'LAYHER' },
  { tipo: TipoRubro.EGRESO, orden: 2, nombre: 'Vallado', codigo: 'VALLADO' },
  { tipo: TipoRubro.EGRESO, orden: 3, nombre: 'Varios',  codigo: 'VARIOS', descripcion: 'Aforo, Sillas, Tablones' },
  // Rubros técnicos del sistema — no borrables (es_sistema=true), requeridos
  // por lógica de negocio propia (liquidaciones RRHH, impuesto_subcategoria).
  // Van al final del orden para no mezclarse con los operativos (mismo patrón
  // que los técnicos de Enjoy, orden 85-87).
  { tipo: TipoRubro.EGRESO, orden: 4, nombre: 'RRHH',      codigo: RUBROS_SISTEMA.RRHH },
  { tipo: TipoRubro.EGRESO, orden: 5, nombre: 'Impuestos', codigo: RUBROS_SISTEMA.IMPUESTOS },
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
        where: { empresa_id_tipo_nombre: { empresa_id: empresa.id, tipo: r.tipo, nombre: r.nombre } },
        update: {
          orden: r.orden, codigo: r.codigo ?? null, grupo: r.grupo ?? null, es_sistema: true, activo: true,
          // Sólo se pisa si el seed trae un valor — así no se borra una
          // descripción cargada a mano desde Configuración para otros rubros.
          ...(r.descripcion !== undefined && { descripcion: r.descripcion }),
        },
        create: {
          empresa_id:  empresa.id,
          tipo:        r.tipo,
          nombre:      r.nombre,
          codigo:      r.codigo ?? null,
          descripcion: r.descripcion ?? null,
          grupo:       r.grupo ?? null,
          orden:       r.orden,
          es_sistema:  true,
          activo:      true,
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

  // ── Limpieza: rubros EGRESO genéricos de DOS57 reemplazados por los 3 reales
  // confirmados por Jazmín. Mismo patrón que Enjoy: soft-delete, no hard
  // delete, para no romper movimientos históricos que ya los referencian.
  const NOMBRES_DOS57_VIGENTES = RUBROS_DOS57
    .filter(r => r.tipo === TipoRubro.EGRESO)
    .map(r => r.nombre);

  const { count: rubrosObsoletosDos57 } = await prisma.rubro.updateMany({
    where: {
      empresa_id: dos57.id,
      tipo:       TipoRubro.EGRESO,
      nombre:     { notIn: NOMBRES_DOS57_VIGENTES },
      deleted_at: null,
    },
    data: { deleted_at: new Date(), activo: false },
  });
  if (rubrosObsoletosDos57 > 0) {
    console.log(`✓ Rubros EGRESO genéricos obsoletos de DOS57 desactivados: ${rubrosObsoletosDos57}`);
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

  // ── Usuarios reales del sistema ──────────────────────────────────────────────
  // empresa_id = empresa "hogar" (activa por defecto en su primer login).
  // accesoExtra = filas adicionales de UsuarioEmpresaAcceso (usuarios multi-empresa).
  const PASSWORD_INICIAL = 'Enjoy2026!';

  type UsuarioSeed = {
    nombre:      string;
    email:       string;
    telefono?:   string;
    rol:         'ADMIN' | 'OPERADOR';
    empresa_id:  number | null;
    accesoExtra?: { empresa_id: number; rol: 'ADMIN' | 'OPERADOR' | 'VIEWER' }[];
    // Vista Macro restringida por área (ver Usuario.puede_ver_macro/areas_macro).
    puedeVerMacro?: boolean;
    areasMacro?:    string[];
    // Pantalla principal al loguearse (ver Usuario.home_route / resolveHomeRoute
    // en el frontend). Sin este campo, usa el default por rol.
    homeRoute?: string;
  };

  const USUARIOS_REALES: UsuarioSeed[] = [
    // ── Admin global ────────────────────────────────────────────────────────────
    { nombre: 'Matías Lorenzati', email: 'matiaslorenzati@gmail.com', rol: 'ADMIN', empresa_id: null },

    // ── DOS57 — admins ──────────────────────────────────────────────────────────
    { nombre: 'Sergio Bibiloni (Pollo)',    email: 'pollobibiloni@gmail.com',           telefono: '351 295-6442', rol: 'ADMIN', empresa_id: dos57.id },
    { nombre: 'Verónica Salerno (Veck)',    email: 'veckisalerno.dos57@gmail.com',      telefono: '351 259-6633', rol: 'ADMIN', empresa_id: dos57.id },
    { nombre: 'Andrea Olivetto (Andre)',    email: 'administracion@grupodos57.com.ar',  telefono: '351 221-3138', rol: 'ADMIN', empresa_id: dos57.id, homeRoute: '/gastos-operativos' },
    {
      nombre: 'Mayra Ontivero', email: 'mayra.dos57@gmail.com', telefono: '351 706-2733', rol: 'ADMIN', empresa_id: dos57.id,
      accesoExtra: [{ empresa_id: enjoy.id, rol: 'ADMIN' }],
      // Gerente Administrativa DOS57 + Enjoy — Macro cross-empresa restringida
      // a Finanzas/Admin/RRHH/Stock (sin Logística).
      puedeVerMacro: true,
      areasMacro:    ['FINANZAS', 'ADMIN', 'RRHH', 'STOCK'],
    },

    // ── DOS57 — operadores ──────────────────────────────────────────────────────
    { nombre: 'Jazmín Valdivia (Jaz)', email: 'jazminvaldivia.dos57@gmail.com', telefono: '351 594-6637', rol: 'OPERADOR', empresa_id: dos57.id, homeRoute: '/parte-diario' },
    // Apellido "Herrera" y CUIL 27-30474212-2 confirmados en
    // docs/dos57/lorena/Datos DOS57_Datos Personales.xlsx (fila 13, apodo
    // "Lore"). Email PLACEHOLDER — no hay uno real en ninguna planilla ni
    // transcripción relevada; confirmar antes de dar de alta en producción.
    { nombre: 'Lorena Herrera (Lore)', email: 'lorena.dos57@gmail.com', rol: 'OPERADOR', empresa_id: dos57.id, homeRoute: '/presentismo' },
    // Florencia, Santiago y Nicolás: relevados en docs/dos57/florencia y
    // docs/dos57/santi-nico, pero NINGUNA planilla ni transcripción trae su
    // apellido, CUIL o email real (no están en el legajo "DOS57 FIJOS" —
    // altas más recientes que esa planilla). nombre y email acá son
    // PLACEHOLDERS — confirmar los datos reales antes de producción.
    // Florencia: home_route pendiente de definir (queda null → default por rol).
    { nombre: 'Florencia',           email: 'florencia.dos57@gmail.com', rol: 'OPERADOR', empresa_id: dos57.id },
    { nombre: 'Santiago (Santi)',    email: 'santiago.dos57@gmail.com',  rol: 'OPERADOR', empresa_id: dos57.id, homeRoute: '/combustible' },
    { nombre: 'Nicolás (Nico)',      email: 'nicolas.dos57@gmail.com',   rol: 'OPERADOR', empresa_id: dos57.id, homeRoute: '/combustible' },

    // ── Enjoy — admins ──────────────────────────────────────────────────────────
    { nombre: 'Christian Xinos (Chino)',        email: 'christianxinos@gmail.com',            telefono: '351 800-5952', rol: 'ADMIN', empresa_id: enjoy.id },
    { nombre: 'Malena Perez Estevez',           email: 'envios.enjoyproducciones@gmail.com',  telefono: '351 386-3241', rol: 'ADMIN', empresa_id: enjoy.id },

    // ── Enjoy — operadores ──────────────────────────────────────────────────────
    { nombre: 'Victoria Almada',   email: 'victoriaalmada@gmail.com',   telefono: '351 208-1470', rol: 'OPERADOR', empresa_id: enjoy.id },
    { nombre: 'Daniel Yanello',    email: 'danielyanello93@gmail.com',  telefono: '351 398-0601', rol: 'OPERADOR', empresa_id: enjoy.id },
  ];

  const passwordHashInicial = await bcrypt.hash(PASSWORD_INICIAL, 10);

  for (const u of USUARIOS_REALES) {
    const usuario = await prisma.usuario.upsert({
      where:  { email: u.email },
      update: {
        nombre: u.nombre, telefono: u.telefono ?? null, rol: u.rol, empresa_id: u.empresa_id, activo: true,
        puede_ver_macro: u.puedeVerMacro ?? false, areas_macro: u.areasMacro ?? [],
        home_route: u.homeRoute ?? null,
      },
      create: {
        email:         u.email,
        nombre:        u.nombre,
        telefono:      u.telefono ?? null,
        password_hash: passwordHashInicial,
        rol:           u.rol,
        empresa_id:    u.empresa_id,
        puede_ver_macro: u.puedeVerMacro ?? false,
        areas_macro:     u.areasMacro ?? [],
        home_route:      u.homeRoute ?? null,
      },
    });

    if (u.empresa_id !== null) {
      await prisma.usuarioEmpresaAcceso.upsert({
        where:  { usuario_id_empresa_id: { usuario_id: usuario.id, empresa_id: u.empresa_id } },
        update: {},
        create: { usuario_id: usuario.id, empresa_id: u.empresa_id },
      });
    }

    for (const extra of u.accesoExtra ?? []) {
      await prisma.usuarioEmpresaAcceso.upsert({
        where:  { usuario_id_empresa_id: { usuario_id: usuario.id, empresa_id: extra.empresa_id } },
        update: {},
        create: { usuario_id: usuario.id, empresa_id: extra.empresa_id },
      });
    }

    console.log(`✓ Usuario "${u.nombre}" (${u.email}) — ${u.rol}${u.empresa_id === null ? ' [global]' : ''}`);
  }

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

  // ── Cuentas de empresa DOS57 (sin evento — caja general/reserva/personal) ──
  const CUENTAS_DOS57: { nombre: string; tipo: TipoCuenta; moneda: Moneda; saldo_inicial: number }[] = [
    { nombre: 'Caja General DOS57', tipo: TipoCuenta.EFECTIVO, moneda: Moneda.ARS, saldo_inicial: 0 },
    { nombre: 'Caja Reserva',       tipo: TipoCuenta.EFECTIVO, moneda: Moneda.ARS, saldo_inicial: 0 },
    { nombre: 'Caja Pollo',         tipo: TipoCuenta.EFECTIVO, moneda: Moneda.ARS, saldo_inicial: 0 },
    { nombre: 'Caja Jazmín',        tipo: TipoCuenta.EFECTIVO, moneda: Moneda.ARS, saldo_inicial: 0 },
    // Vista de Andrea (Caja del mes) — resto de las hojas de CAJAS_JULIO-2026.xlsx.
    { nombre: 'Caja Guardada',   tipo: TipoCuenta.EFECTIVO, moneda: Moneda.ARS, saldo_inicial: 0 },
    { nombre: 'Adelantos DOS57', tipo: TipoCuenta.EFECTIVO, moneda: Moneda.ARS, saldo_inicial: 0 },
    { nombre: 'Caja Miguel',     tipo: TipoCuenta.EFECTIVO, moneda: Moneda.ARS, saldo_inicial: 0 },
    { nombre: 'Caja David',      tipo: TipoCuenta.EFECTIVO, moneda: Moneda.ARS, saldo_inicial: 0 },
    // Fondo de inversión — se comporta como cualquier CuentaBancaria para
    // movimientos y saldos, sólo se distingue con un badge en Caja Global.
    { nombre: 'FIMA — Galicia',  tipo: TipoCuenta.FIMA,     moneda: Moneda.ARS, saldo_inicial: 0 },
  ];

  for (const cuenta of CUENTAS_DOS57) {
    await prisma.cuentaBancaria.upsert({
      where: { nombre_empresa_id: { nombre: cuenta.nombre, empresa_id: dos57.id } },
      update: {},
      create: {
        ...cuenta,
        empresa_id: dos57.id,
        evento_id:  null, // cuenta de empresa, sin evento
      },
    });
  }
  console.log(`✓ Cuentas de empresa DOS57: ${CUENTAS_DOS57.length} cargadas`);

  // ── Escalafones administrativos DOS57 (valores julio 2026, Excel real) ─────
  const ESCALAFONES_DOS57: {
    nombre: string; orden: number; viatico: number | null; premio_presentismo: number | null; telefono: number | null; premio_incentivo: number | null;
    premio_viaje_provincial?: number | null; premio_viaje_nacional?: number | null; premio_viaje_nacional_1000?: number | null;
  }[] = [
    { nombre: 'ADM 1', orden: 1, viatico: 87734.72,  premio_presentismo: 154806.63, telefono: 43867.37, premio_incentivo: null },
    { nombre: 'ADM 2', orden: 2, viatico: 236219.85, premio_presentismo: 127587.89, telefono: null,      premio_incentivo: 67983.24 },
    { nombre: 'ADM 3', orden: 3, viatico: 106774.16, premio_presentismo: 122484.36, telefono: null,      premio_incentivo: 47455.17 },
    // Escalafón de choferes con bitácora de viajes — pre-carga el Paso 3 del
    // wizard de AcuerdoSueldo (sección "Premios por Viajes") cuando el acuerdo
    // es categoria_acuerdo=CHOFER.
    {
      nombre: 'CHOFER', orden: 4, viatico: null, premio_presentismo: null, telefono: null, premio_incentivo: null,
      premio_viaje_provincial: 51750, premio_viaje_nacional: 86250, premio_viaje_nacional_1000: 115000,
    },
  ];

  for (const esc of ESCALAFONES_DOS57) {
    await prisma.escalafonAdmin.upsert({
      where:  { empresa_id_nombre: { empresa_id: dos57.id, nombre: esc.nombre } },
      update: {
        orden: esc.orden, viatico: esc.viatico, premio_presentismo: esc.premio_presentismo,
        telefono: esc.telefono, premio_incentivo: esc.premio_incentivo,
        premio_viaje_provincial: esc.premio_viaje_provincial ?? null,
        premio_viaje_nacional: esc.premio_viaje_nacional ?? null,
        premio_viaje_nacional_1000: esc.premio_viaje_nacional_1000 ?? null,
      },
      create: {
        nombre: esc.nombre, orden: esc.orden, viatico: esc.viatico, premio_presentismo: esc.premio_presentismo,
        telefono: esc.telefono, premio_incentivo: esc.premio_incentivo,
        premio_viaje_provincial: esc.premio_viaje_provincial ?? null,
        premio_viaje_nacional: esc.premio_viaje_nacional ?? null,
        premio_viaje_nacional_1000: esc.premio_viaje_nacional_1000 ?? null,
        empresa_id: dos57.id,
      },
    });
  }
  console.log(`✓ Escalafones administrativos DOS57: ${ESCALAFONES_DOS57.length} cargados`);

  // ── Espacios compartidos DOS57 ──────────────────────────────────────────────
  // Nave 15 cierra en noviembre 2026 — Nave nueva la continúa con las mismas
  // partes (DOS57/Jiménez 50/50). Nave 7 queda sin partes cargadas: el % de
  // reparto y el tipo de gasto fijo están pendientes de confirmar con Mayra
  // (admin los completa desde Configuración del espacio).
  const nave15 = await prisma.espacioCompartido.upsert({
    where:  { empresa_id_nombre: { empresa_id: dos57.id, nombre: 'Nave 15' } },
    update: {},
    create: {
      empresa_id: dos57.id, nombre: 'Nave 15', dia_generacion: 1, activo: true,
      descripcion: 'Cierra en noviembre 2026 — continúa como "Nave nueva".',
    },
  });
  await prisma.parteEspacio.upsert({
    where:  { espacio_id_nombre: { espacio_id: nave15.id, nombre: 'DOS57' } },
    update: {},
    create: { espacio_id: nave15.id, nombre: 'DOS57', porcentaje: 50, empresa_id: dos57.id },
  });
  await prisma.parteEspacio.upsert({
    where:  { espacio_id_nombre: { espacio_id: nave15.id, nombre: 'Jiménez' } },
    update: {},
    create: { espacio_id: nave15.id, nombre: 'Jiménez', porcentaje: 50 },
  });

  const naveNueva = await prisma.espacioCompartido.upsert({
    where:  { empresa_id_nombre: { empresa_id: dos57.id, nombre: 'Nave nueva' } },
    update: {},
    create: { empresa_id: dos57.id, nombre: 'Nave nueva', dia_generacion: 1, activo: true },
  });
  await prisma.parteEspacio.upsert({
    where:  { espacio_id_nombre: { espacio_id: naveNueva.id, nombre: 'DOS57' } },
    update: {},
    create: { espacio_id: naveNueva.id, nombre: 'DOS57', porcentaje: 50, empresa_id: dos57.id },
  });
  await prisma.parteEspacio.upsert({
    where:  { espacio_id_nombre: { espacio_id: naveNueva.id, nombre: 'Jiménez' } },
    update: {},
    create: { espacio_id: naveNueva.id, nombre: 'Jiménez', porcentaje: 50 },
  });

  await prisma.espacioCompartido.upsert({
    where:  { empresa_id_nombre: { empresa_id: dos57.id, nombre: 'Nave 7' } },
    update: {},
    create: {
      empresa_id: dos57.id, nombre: 'Nave 7', dia_generacion: 1, activo: true,
      descripcion: 'Partes y tipo de gasto fijo pendientes de confirmar con Mayra.',
    },
  });

  console.log('✓ Espacios compartidos DOS57: Nave 15, Nave nueva, Nave 7');

  // ── Cuentas corrientes personales de socios (FIX 6) ─────────────────────────
  // empresa_id es obligatorio en el schema — Matías (admin global) no tiene
  // empresa "hogar" propia, así que se la archiva en DOS57 (mismo criterio que
  // Pollo, explícito en el pedido). La visibilidad real no depende de esto:
  // tipo_tercero=SOCIO se filtra cross-empresa para admin global + admins
  // DOS57 en cuentasCorrientes.controller.ts, así que el empresa_id acá es
  // sólo dónde queda archivada la fila, no quién puede verla. Confirmar con
  // el usuario si prefiere Enjoy (id 1) en cambio — quedó marcado como
  // "a decidir" en el pedido original.
  const CUENTAS_PERSONALES: { nombre: string; tercero_nombre: string; moneda?: 'ARS' | 'USD'; descripcion?: string }[] = [
    { nombre: 'Matías Personal', tercero_nombre: 'Matías Lorenzati' },
    { nombre: 'Pollo Personal',  tercero_nombre: 'Sergio Bibiloni' },
    // Blueteam — razón social del personal de Matías, no un nombre interno.
    // Influye a las empresas pero la conciliación mensual (líneas, cargas
    // sociales, sueldos, transferencias) es entre Matías y Gabriel Bursztyn —
    // se valoriza en USD y termina en un saldo a favor de Matías.
    {
      nombre: 'Blueteam', tercero_nombre: 'Blueteam — Gabriel Bursztyn', moneda: 'USD',
      descripcion: 'Conciliación mensual Matías-Gabriel. Personal de Matías pero afecta a las empresas.',
    },
  ];

  for (const c of CUENTAS_PERSONALES) {
    const existente = await prisma.cuentaCorriente.findFirst({ where: { nombre: c.nombre, empresa_id: dos57.id, deleted_at: null } });
    if (!existente) {
      await prisma.cuentaCorriente.create({
        data: {
          empresa_id:     dos57.id,
          nombre:         c.nombre,
          tipo_tercero:   'SOCIO',
          tercero_nombre: c.tercero_nombre,
          moneda:         c.moneda ?? 'ARS',
          descripcion:    c.descripcion ?? 'Gastos personales del socio',
        },
      });
    }
  }
  console.log(`✓ Cuentas corrientes personales de socios: ${CUENTAS_PERSONALES.length} cargadas`);

  // ── Proveedor comisionista "Polaco" (DOS57) ─────────────────────────────────
  // Intermediario en la facturación de Talleres/ENP — porcentaje_comision
  // queda sin definir (a confirmar con Mayra); es_comisionista=true ya
  // habilita el badge y el filtro, el cálculo automático del reparto en
  // facturas emitidas no hace nada hasta que se cargue el %.
  const polaco = await prisma.proveedor.findFirst({ where: { nombre: 'Polaco', empresa_id: dos57.id, deleted_at: null } });
  if (!polaco) {
    await prisma.proveedor.create({
      data: {
        empresa_id: dos57.id,
        nombre: 'Polaco',
        es_comisionista: true,
        porcentaje_comision: null,
        notas: 'Comisionista en la facturación de Talleres/ENP — % pendiente de confirmar con Mayra.',
      },
    });
    console.log('✓ Proveedor "Polaco" (comisionista) cargado — falta confirmar porcentaje_comision');
  }
}

main()
  .catch((e) => {
    console.error('Error en seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
