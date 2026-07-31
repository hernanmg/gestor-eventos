import 'dotenv/config';
import bcrypt from 'bcryptjs';
import {
  CategoriaEmpleado,
  EstadoActivo,
  EstadoAsignacion,
  EstadoEcheq,
  EstadoEvento,
  EstadoJornada,
  EstadoLiquidacion,
  EstadoMovimiento,
  EstadoPanolItem,
  Moneda,
  OrigenTransfer,
  Rol,
  TipoAnticipo,
  TipoCuenta,
  Tipo,
  TipoMovPanol,
  TipoPanolItem,
  UbicacionStock,
} from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { calcularHoras, round2 } from '../src/controllers/rrhh.controller';

// ── Helpers de fecha ──────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function monthsAgo(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}

// ── Helpers de saldo corrido ───────────────────────────────────────────────────

function nextSaldo(prev: number, debe: number, haber: number): number {
  return prev + haber - debe;
}

// Datos de demo — siempre van a Enjoy Producciones (empresa sembrada con id=1
// en la migración de multitenancy / prisma/seed.ts).
const EMPRESA_ID = 1;
// DOS57 Estructuras — empresa sembrada con id=2 en prisma/seed.ts. Usada para
// el módulo de stock refactorizado (camiones, catálogo Layher, cunas, pañol, activos).
const EMPRESA_ID_DOS57 = 2;

// ── Helpers idempotentes ──────────────────────────────────────────────────────

async function upsertProveedor(data: {
  nombre: string;
  alias?: string;
  cuit?: string;
  categoria: string;
}) {
  const payload = { ...data, empresa_id: EMPRESA_ID };
  if (data.cuit) {
    return prisma.proveedor.upsert({
      where:  { cuit: data.cuit },
      update: {},
      create: payload,
    });
  }
  const existing = await prisma.proveedor.findFirst({ where: { nombre: data.nombre, empresa_id: EMPRESA_ID } });
  return existing ?? prisma.proveedor.create({ data: payload });
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Iniciando seed de demo...\n');

  let totalEventos      = 0;
  let totalMovimientos  = 0;
  let totalEcheqs       = 0;
  let totalAsignaciones = 0;

  // ── 1. USUARIOS ──────────────────────────────────────────────────────────────
  console.log('Creando usuarios demo...');
  const demoHash = await bcrypt.hash('Demo2024!', 10);

  const operador = await prisma.usuario.upsert({
    where:  { email: 'operador@demo.com' },
    update: { empresa_id: EMPRESA_ID },
    create: {
      email:         'operador@demo.com',
      nombre:        'Laura Gómez',
      password_hash: demoHash,
      rol:           Rol.OPERADOR,
      empresa_id:    EMPRESA_ID,
    },
  });

  const viewer = await prisma.usuario.upsert({
    where:  { email: 'viewer@demo.com' },
    update: { empresa_id: EMPRESA_ID },
    create: {
      email:         'viewer@demo.com',
      nombre:        'Martín Sosa',
      password_hash: demoHash,
      rol:           Rol.VIEWER,
      empresa_id:    EMPRESA_ID,
    },
  });

  // Acceso a la empresa — necesario para resolver empresaId en el login
  // (usuarios no-admin se autorizan vía UsuarioEmpresaAcceso, no por
  // Usuario.empresa_id directo, que es solo la "empresa activa" de la sesión).
  await prisma.usuarioEmpresaAcceso.upsert({
    where:  { usuario_id_empresa_id: { usuario_id: operador.id, empresa_id: EMPRESA_ID } },
    update: {},
    create: { usuario_id: operador.id, empresa_id: EMPRESA_ID },
  });
  await prisma.usuarioEmpresaAcceso.upsert({
    where:  { usuario_id_empresa_id: { usuario_id: viewer.id, empresa_id: EMPRESA_ID } },
    update: {},
    create: { usuario_id: viewer.id, empresa_id: EMPRESA_ID },
  });

  console.log('✓ Usuarios: operador@demo.com (OPERADOR), viewer@demo.com (VIEWER)');

  // ── 2. PROVEEDORES ───────────────────────────────────────────────────────────
  console.log('Creando proveedores...');

  const pSonido    = await upsertProveedor({ nombre: 'Sonido Total S.A.',       alias: 'Sonido Total', cuit: '30-71234567-8', categoria: 'Audio'       });
  const pIlum      = await upsertProveedor({ nombre: 'Iluminación Escénica SRL', alias: 'IluEsc',                            categoria: 'Iluminación' });
  const pTransp    = await upsertProveedor({ nombre: 'Transporte Rápido SA',                                                  categoria: 'Transporte'  });
  const pCatering  = await upsertProveedor({ nombre: 'Catering Del Sur',                                                       categoria: 'Gastronomía' });
  const pSegur     = await upsertProveedor({ nombre: 'Seguridad Eventos SRL',                                                  categoria: 'Seguridad'   });
  const pMunicipal = await upsertProveedor({ nombre: 'Municipalidad de Córdoba',                                               categoria: 'Impuestos'   });
  await               upsertProveedor({ nombre: 'AFIP',                                                                       categoria: 'Impuestos'   });
  await               upsertProveedor({ nombre: 'Génesis Producciones',         alias: 'Génesis',                             categoria: 'Producción'  });

  console.log('✓ Proveedores: 8 creados');

  // ── 3. CATEGORÍAS DE STOCK ───────────────────────────────────────────────────
  console.log('Creando categorías de stock...');

  const catAudio     = await prisma.categoriaStock.upsert({ where: { nombre_empresa_id: { nombre: 'Audio',       empresa_id: EMPRESA_ID } }, update: {}, create: { nombre: 'Audio',       color: '#3B82F6', empresa_id: EMPRESA_ID } });
  const catIlum      = await prisma.categoriaStock.upsert({ where: { nombre_empresa_id: { nombre: 'Iluminación', empresa_id: EMPRESA_ID } }, update: {}, create: { nombre: 'Iluminación', color: '#F59E0B', empresa_id: EMPRESA_ID } });
  const catEsc       = await prisma.categoriaStock.upsert({ where: { nombre_empresa_id: { nombre: 'Escenario',   empresa_id: EMPRESA_ID } }, update: {}, create: { nombre: 'Escenario',   color: '#8B5CF6', empresa_id: EMPRESA_ID } });
  const catMob       = await prisma.categoriaStock.upsert({ where: { nombre_empresa_id: { nombre: 'Mobiliario',  empresa_id: EMPRESA_ID } }, update: {}, create: { nombre: 'Mobiliario',  color: '#10B981', empresa_id: EMPRESA_ID } });
  const catEnergia   = await prisma.categoriaStock.upsert({ where: { nombre_empresa_id: { nombre: 'Energía',     empresa_id: EMPRESA_ID } }, update: {}, create: { nombre: 'Energía',     color: '#EF4444', empresa_id: EMPRESA_ID } });
  const catSegur     = await prisma.categoriaStock.upsert({ where: { nombre_empresa_id: { nombre: 'Seguridad',   empresa_id: EMPRESA_ID } }, update: {}, create: { nombre: 'Seguridad',   color: '#6B7280', empresa_id: EMPRESA_ID } });

  console.log('✓ Categorías: 6 creadas');

  // ── 4. PRODUCTOS DE STOCK ────────────────────────────────────────────────────
  console.log('Creando productos de stock...');

  const prodParlante  = await prisma.producto.upsert({ where: { codigo_interno_empresa_id: { codigo_interno: 'PAR-001', empresa_id: EMPRESA_ID } }, update: {}, create: { nombre: 'Parlante JBL Line Array', codigo_interno: 'PAR-001',     stock_total: 20,  stock_minimo: 4,  categoria_id: catAudio.id,   empresa_id: EMPRESA_ID } });
  const prodSub       = await prisma.producto.upsert({ where: { codigo_interno_empresa_id: { codigo_interno: 'SUB-001', empresa_id: EMPRESA_ID } }, update: {}, create: { nombre: 'Subwoofer DBX 18"', codigo_interno: 'SUB-001',     stock_total: 12,  stock_minimo: 2,  categoria_id: catAudio.id,   empresa_id: EMPRESA_ID } });
  const prodMovHead   = await prisma.producto.upsert({ where: { codigo_interno_empresa_id: { codigo_interno: 'MOV-001', empresa_id: EMPRESA_ID } }, update: {}, create: { nombre: 'Moving Head LED 200W', codigo_interno: 'MOV-001',     stock_total: 30,  stock_minimo: 6,  categoria_id: catIlum.id,    empresa_id: EMPRESA_ID } });
  const prodConsola   = await prisma.producto.upsert({ where: { codigo_interno_empresa_id: { codigo_interno: 'CON-ILU-001', empresa_id: EMPRESA_ID } }, update: {}, create: { nombre: 'Consola de Iluminación MA2', codigo_interno: 'CON-ILU-001', stock_total: 3,   stock_minimo: 1,  categoria_id: catIlum.id,    empresa_id: EMPRESA_ID } });
  const prodEscMod    = await prisma.producto.upsert({ where: { codigo_interno_empresa_id: { codigo_interno: 'ESC-001', empresa_id: EMPRESA_ID } }, update: {}, create: { nombre: 'Módulo de Escenario 2x1m', codigo_interno: 'ESC-001',     stock_total: 50,  stock_minimo: 10, categoria_id: catEsc.id,     empresa_id: EMPRESA_ID } });
  const prodGenerador = await prisma.producto.upsert({ where: { codigo_interno_empresa_id: { codigo_interno: 'GEN-001', empresa_id: EMPRESA_ID } }, update: {}, create: { nombre: 'Generador 100kva', codigo_interno: 'GEN-001',     stock_total: 4,   stock_minimo: 1,  categoria_id: catEnergia.id, empresa_id: EMPRESA_ID } });
  const prodSilla     = await prisma.producto.upsert({ where: { codigo_interno_empresa_id: { codigo_interno: 'SIL-001', empresa_id: EMPRESA_ID } }, update: {}, create: { nombre: 'Silla Plástica Blanca', codigo_interno: 'SIL-001',     stock_total: 200, stock_minimo: 20, categoria_id: catMob.id,     empresa_id: EMPRESA_ID } });
  const prodMolinete  = await prisma.producto.upsert({ where: { codigo_interno_empresa_id: { codigo_interno: 'MOL-001', empresa_id: EMPRESA_ID } }, update: {}, create: { nombre: 'Molinete Torniquete', codigo_interno: 'MOL-001',     stock_total: 8,   stock_minimo: 2,  categoria_id: catSegur.id,   empresa_id: EMPRESA_ID } });

  // Suprimir warnings de vars no usadas (quedan disponibles si se extiende el seed)
  void prodSub; void prodConsola; void prodSilla; void prodMolinete;

  console.log('✓ Productos: 8 creados');

  // ── RUBROS — lookup por empresa (sembrados en prisma/seed.ts) ───────────────
  const rubrosEnjoyDB = await prisma.rubro.findMany({ where: { empresa_id: EMPRESA_ID } });
  const rubroEnjoy = (tipo: 'EGRESO' | 'INGRESO', nombre: string): number => {
    const r = rubrosEnjoyDB.find(x => x.tipo === tipo && x.nombre === nombre);
    if (!r) throw new Error(`Rubro no encontrado para Enjoy: ${tipo}/${nombre} — corré prisma/seed.ts primero`);
    return r.id;
  };

  const rubrosDos57DB = await prisma.rubro.findMany({ where: { empresa_id: EMPRESA_ID_DOS57 } });
  const rubroDos57 = (tipo: 'EGRESO' | 'INGRESO', nombre: string): number => {
    const r = rubrosDos57DB.find(x => x.tipo === tipo && x.nombre === nombre);
    if (!r) throw new Error(`Rubro no encontrado para DOS57: ${tipo}/${nombre} — corré prisma/seed.ts primero`);
    return r.id;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // EVENTO 1 — CERRADO (evento pasado con datos completos)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\nCreando Evento 1: Cosquín Rock 2024...');

  const existeE1 = await prisma.evento.findFirst({ where: { nombre: 'Cosquín Rock 2024', empresa_id: EMPRESA_ID } });

  if (existeE1) {
    console.log('  (ya existe, omitiendo)');
  } else {
    const e1Inicio = monthsAgo(3);
    const e1Fin    = new Date(e1Inicio.getTime() + 2 * 86_400_000);
    const e1D1     = new Date(e1Inicio.getTime() + 1 * 86_400_000);
    const e1D2     = new Date(e1Inicio.getTime() + 2 * 86_400_000);

    await prisma.$transaction(async (tx) => {
      const e1 = await tx.evento.create({
        data: {
          empresa_id:   EMPRESA_ID,
          nombre:       'Cosquín Rock 2024',
          fecha_inicio: e1Inicio,
          fecha_fin:    e1Fin,
          estado:       EstadoEvento.CERRADO,
          moneda_base:  Moneda.ARS,
          socios: [
            { nombre: 'Carlos Pérez',    porcentaje: 60 },
            { nombre: 'Ana Rodríguez',   porcentaje: 40 },
          ],
        },
      });

      // ── EG-TC (tab 1) ───────────────────────────────────────────────────────
      let s = 0;
      const egTCDef = [
        { fecha: e1Inicio, concepto: 'Sonido Total S.A.',      descripcion: 'Sistema de sonido line array',   debe: 850_000, proveedor_id: pSonido.id   },
        { fecha: e1D1,     concepto: 'Iluminación Escénica SRL', descripcion: 'Iluminación escenario principal', debe: 620_000, proveedor_id: pIlum.id     },
        { fecha: e1D1,     concepto: 'Escenario',               descripcion: 'Armado y desarmado de escenario', debe: 480_000, proveedor_id: null         },
        { fecha: e1D2,     concepto: 'Transporte',              descripcion: 'Flete equipo sonido',             debe:  95_000, proveedor_id: pTransp.id   },
        { fecha: e1D2,     concepto: 'Catering',                descripcion: 'Catering staff artístico',        debe: 180_000, proveedor_id: pCatering.id },
      ];
      const movEGTC: { id: number }[] = [];
      for (let i = 0; i < egTCDef.length; i++) {
        const r = egTCDef[i];
        s = nextSaldo(s, r.debe, 0);
        const m = await tx.movimiento.create({
          data: {
            evento_id:    e1.id,
            tipo:         Tipo.EGRESO,
            rubro_id:     rubroEnjoy('EGRESO', 'Producción General'),
            estado_movimiento: EstadoMovimiento.PAGADO,
            fecha:        r.fecha,
            concepto:     r.concepto,
            descripcion:  r.descripcion,
            debe:         r.debe,
            haber:        0,
            saldo:        s,
            moneda:       Moneda.ARS,
            orden:        i + 1,
            proveedor_id: r.proveedor_id ?? null,
          },
        });
        movEGTC.push(m);
      }

      // ── EG-IMP (tab 4) ──────────────────────────────────────────────────────
      s = 0;
      const egIMPDef = [
        { concepto: 'PAYWAY',       sub: 'PAYWAY',       debe: 145_000, proveedor_id: null           },
        { concepto: 'IIBB',         sub: 'IIBB',         debe:  89_000, proveedor_id: null           },
        { concepto: 'Municipalidad', sub: 'MUNICIPALIDAD', debe:  65_000, proveedor_id: pMunicipal.id },
        { concepto: 'IVA',          sub: 'IVA',          debe: 210_000, proveedor_id: null           },
      ];
      for (let i = 0; i < egIMPDef.length; i++) {
        const r = egIMPDef[i];
        s = nextSaldo(s, r.debe, 0);
        await tx.movimiento.create({
          data: {
            evento_id:             e1.id,
            tipo:                  Tipo.EGRESO,
            rubro_id:              rubroEnjoy('EGRESO', 'Impuestos'),
            estado_movimiento:     EstadoMovimiento.PAGADO,
            fecha:                 e1Inicio,
            concepto:              r.concepto,
            debe:                  r.debe,
            haber:                 0,
            saldo:                 s,
            moneda:                Moneda.ARS,
            orden:                 i + 1,
            impuesto_subcategoria: r.sub,
            proveedor_id:          r.proveedor_id,
          },
        });
      }

      // ── EG-PREST — Préstamos ────────────────────────────────────────────────
      await tx.movimiento.create({
        data: {
          evento_id:   e1.id,
          tipo:        Tipo.EGRESO,
          rubro_id:    rubroEnjoy('EGRESO', 'Préstamos'),
          estado_movimiento: EstadoMovimiento.PAGADO,
          fecha:       e1Inicio,
          concepto:    'Préstamo bancario',
          descripcion: 'Adelanto para producción',
          debe:        500_000,
          haber:       0,
          saldo:       -500_000,
          moneda:      Moneda.ARS,
          orden:       1,
        },
      });

      // ── ING TICKETS ─────────────────────────────────────────────────────────
      s = 0;
      const ingTickets = [
        { concepto: 'Venta anticipada', descripcion: 'Plataforma Ticketek', haber: 2_100_000 },
        { concepto: 'Venta en puerta',  descripcion: 'Boletería día 1',     haber:   380_000 },
        { concepto: 'Venta en puerta',  descripcion: 'Boletería día 2',     haber:   290_000 },
      ];
      for (let i = 0; i < ingTickets.length; i++) {
        const r = ingTickets[i];
        s = nextSaldo(s, 0, r.haber);
        await tx.movimiento.create({
          data: {
            evento_id:   e1.id,
            tipo:        Tipo.INGRESO,
            rubro_id:    rubroEnjoy('INGRESO', 'Tickets'),
            estado_movimiento: EstadoMovimiento.PAGADO,
            fecha:       e1Inicio,
            concepto:    r.concepto,
            descripcion: r.descripcion,
            debe:        0,
            haber:       r.haber,
            saldo:       s,
            moneda:      Moneda.ARS,
            orden:       i + 1,
          },
        });
      }

      // ── ING SPON ────────────────────────────────────────────────────────────
      s = 0;
      const ingSpon = [
        { concepto: 'Sponsor principal', descripcion: 'Banco Galicia — logo escenario', haber: 800_000 },
        { concepto: 'Sponsor bebidas',   descripcion: 'Cerveza Córdoba',                haber: 350_000 },
      ];
      for (let i = 0; i < ingSpon.length; i++) {
        const r = ingSpon[i];
        s = nextSaldo(s, 0, r.haber);
        await tx.movimiento.create({
          data: {
            evento_id:   e1.id,
            tipo:        Tipo.INGRESO,
            rubro_id:    rubroEnjoy('INGRESO', 'Sponsors'),
            estado_movimiento: EstadoMovimiento.PAGADO,
            fecha:       e1Inicio,
            concepto:    r.concepto,
            descripcion: r.descripcion,
            debe:        0,
            haber:       r.haber,
            saldo:       s,
            moneda:      Moneda.ARS,
            orden:       i + 1,
          },
        });
      }

      // ── ING GASTRO ──────────────────────────────────────────────────────────
      s = 0;
      const ingGastro = [
        { concepto: 'Porcentaje gastronómico', descripcion: '20% ventas food trucks', haber: 420_000 },
        { concepto: 'Bar principal',           descripcion: 'Recaudación bar VIP',    haber: 285_000 },
      ];
      for (let i = 0; i < ingGastro.length; i++) {
        const r = ingGastro[i];
        s = nextSaldo(s, 0, r.haber);
        await tx.movimiento.create({
          data: {
            evento_id:   e1.id,
            tipo:        Tipo.INGRESO,
            rubro_id:    rubroEnjoy('INGRESO', 'Gastronomía'),
            estado_movimiento: EstadoMovimiento.PAGADO,
            fecha:       e1Inicio,
            concepto:    r.concepto,
            descripcion: r.descripcion,
            debe:        0,
            haber:       r.haber,
            saldo:       s,
            moneda:      Moneda.ARS,
            orden:       i + 1,
          },
        });
      }

      // ── CUENTAS BANCARIAS ───────────────────────────────────────────────────
      const ctaGalicia = await tx.cuentaBancaria.create({
        data: {
          empresa_id:    EMPRESA_ID,
          evento_id:     e1.id,
          nombre:        'Banco Galicia Cta Cte',
          tipo:          TipoCuenta.BANCO,
          moneda:        Moneda.ARS,
          saldo_inicial: 200_000,
        },
      });

      const ctaEfectivo = await tx.cuentaBancaria.create({
        data: {
          empresa_id:    EMPRESA_ID,
          evento_id:     e1.id,
          nombre:        'Efectivo Caja',
          tipo:          TipoCuenta.EFECTIVO,
          moneda:        Moneda.ARS,
          saldo_inicial: 50_000,
        },
      });

      // ── MOVIMIENTOS CAJA — Banco Galicia ────────────────────────────────────
      const cajGaliciaDef = [
        { descripcion: 'Cobro Ticketek — venta anticipada',  debe:       0, haber: 2_100_000 },
        { descripcion: 'Pago echeq Sonido Total S.A.',        debe: 425_000, haber:         0 },
        { descripcion: 'Pago echeq Iluminación Escénica SRL', debe: 310_000, haber:         0 },
        { descripcion: 'Cobro sponsor Banco Galicia',         debe:       0, haber:   800_000 },
      ];
      let sc = 200_000;
      const cajGalicia: { id: number }[] = [];
      for (let i = 0; i < cajGaliciaDef.length; i++) {
        const r = cajGaliciaDef[i];
        sc = nextSaldo(sc, r.debe, r.haber);
        const mc = await tx.movimientoCaja.create({
          data: {
            cuenta_id:       ctaGalicia.id,
            fecha:           e1Inicio,
            descripcion:     r.descripcion,
            debe:            r.debe,
            haber:           r.haber,
            saldo_corriente: sc,
            orden:           i + 1,
          },
        });
        cajGalicia.push(mc);
      }

      // ── MOVIMIENTOS CAJA — Efectivo ─────────────────────────────────────────
      const cajEfectivoDef = [
        { descripcion: 'Cobro boletería día 1',    debe:       0, haber: 380_000 },
        { descripcion: 'Cobro boletería día 2',    debe:       0, haber: 290_000 },
        { descripcion: 'Pago Catering Del Sur',     debe: 180_000, haber:       0 },
        { descripcion: 'Pago Transporte Rápido SA', debe:  95_000, haber:       0 },
      ];
      sc = 50_000;
      for (let i = 0; i < cajEfectivoDef.length; i++) {
        const r = cajEfectivoDef[i];
        sc = nextSaldo(sc, r.debe, r.haber);
        await tx.movimientoCaja.create({
          data: {
            cuenta_id:       ctaEfectivo.id,
            fecha:           e1Inicio,
            descripcion:     r.descripcion,
            debe:            r.debe,
            haber:           r.haber,
            saldo_corriente: sc,
            orden:           i + 1,
          },
        });
      }

      // ── ECHEQS ──────────────────────────────────────────────────────────────
      // 0001234 — Sonido Total, vinculado a movEGTC[0] y liquidado en cajGalicia[1]
      await tx.echeq.create({
        data: {
          evento_id:          e1.id,
          movimiento_id:      movEGTC[0].id,
          movimiento_caja_id: cajGalicia[1].id,
          proveedor_id:       pSonido.id,
          numero:             '0001234',
          razon_social:       'Sonido Total S.A.',
          importe:            425_000,
          moneda:             Moneda.ARS,
          estado:             EstadoEcheq.COBRADO,
          fecha_emision:      e1Inicio,
          fecha_cobro_real:   new Date(e1Inicio.getTime() + 5 * 86_400_000),
        },
      });

      // 0001235 — Iluminación, liquidado en cajGalicia[2]
      await tx.echeq.create({
        data: {
          evento_id:          e1.id,
          movimiento_caja_id: cajGalicia[2].id,
          proveedor_id:       pIlum.id,
          numero:             '0001235',
          razon_social:       'Iluminación Escénica SRL',
          importe:            310_000,
          moneda:             Moneda.ARS,
          estado:             EstadoEcheq.COBRADO,
          fecha_emision:      e1Inicio,
          fecha_cobro_real:   new Date(e1Inicio.getTime() + 3 * 86_400_000),
        },
      });

      // ── ACCESOS ─────────────────────────────────────────────────────────────
      await tx.eventoAcceso.upsert({
        where:  { usuario_id_evento_id: { usuario_id: operador.id, evento_id: e1.id } },
        update: {},
        create: { usuario_id: operador.id, evento_id: e1.id, rol: Rol.OPERADOR },
      });
      await tx.eventoAcceso.upsert({
        where:  { usuario_id_evento_id: { usuario_id: viewer.id, evento_id: e1.id } },
        update: {},
        create: { usuario_id: viewer.id, evento_id: e1.id, rol: Rol.VIEWER },
      });
    });

    totalEventos++;
    totalMovimientos  += 5 + 4 + 1 + 3 + 2 + 2; // EG-TC + EG-IMP + EG-PREST + ING-TICKETS + ING-SPON + ING-GASTRO
    totalEcheqs       += 2;
    console.log('✓ Evento 1 creado (17 movimientos, 8 mov. caja, 2 echeqs)');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EVENTO 2 — ACTIVO (próximo, en preparación)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\nCreando Evento 2: Festival de la Ciudad 2025...');

  const existeE2 = await prisma.evento.findFirst({ where: { nombre: 'Festival de la Ciudad 2025', empresa_id: EMPRESA_ID } });

  if (existeE2) {
    console.log('  (ya existe, omitiendo)');
  } else {
    const e2Inicio = daysFromNow(15);

    await prisma.$transaction(async (tx) => {
      const e2 = await tx.evento.create({
        data: {
          empresa_id:   EMPRESA_ID,
          nombre:       'Festival de la Ciudad 2025',
          fecha_inicio: e2Inicio,
          fecha_fin:    daysFromNow(17),
          estado:       EstadoEvento.ACTIVO,
          moneda_base:  Moneda.ARS,
          socios: [
            { nombre: 'Carlos Pérez',  porcentaje: 50 },
            { nombre: 'Ana Rodríguez', porcentaje: 50 },
          ],
        },
      });

      // ── EG-TC — Producción General ──────────────────────────────────────────
      let s = 0;
      const rows = [
        { concepto: 'Sonido Total S.A.', descripcion: 'Sistema de sonido',     debe: 920_000, pid: pSonido.id, estado: EstadoMovimiento.CONFIRMADO },
        { concepto: 'Iluminación',       descripcion: 'Iluminación escenario', debe: 540_000, pid: null,       estado: EstadoMovimiento.PENDIENTE  },
        { concepto: 'Seguridad',         descripcion: 'Personal de seguridad', debe: 320_000, pid: pSegur.id,  estado: EstadoMovimiento.CONFIRMADO },
      ];
      let movSonidoE2Id = 0;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        s = nextSaldo(s, r.debe, 0);
        const m = await tx.movimiento.create({
          data: {
            evento_id:    e2.id,
            tipo:         Tipo.EGRESO,
            rubro_id:     rubroEnjoy('EGRESO', 'Producción General'),
            estado_movimiento: r.estado,
            presupuesto:  r.debe,
            fecha:        new Date(),
            concepto:     r.concepto,
            descripcion:  r.descripcion,
            debe:         r.debe,
            haber:        0,
            saldo:        s,
            moneda:       Moneda.ARS,
            orden:        i + 1,
            proveedor_id: r.pid,
          },
        });
        if (i === 0) movSonidoE2Id = m.id;
      }

      // ── EG-IMP — Impuestos ──────────────────────────────────────────────────
      s = 0;
      const impRows = [
        { concepto: 'PAYWAY', sub: 'PAYWAY', debe: 98_000 },
        { concepto: 'IIBB',   sub: 'IIBB',   debe: 67_000 },
      ];
      for (let i = 0; i < impRows.length; i++) {
        const r = impRows[i];
        s = nextSaldo(s, r.debe, 0);
        await tx.movimiento.create({
          data: {
            evento_id:             e2.id,
            tipo:                  Tipo.EGRESO,
            rubro_id:              rubroEnjoy('EGRESO', 'Impuestos'),
            estado_movimiento:     EstadoMovimiento.CONFIRMADO,
            fecha:                 new Date(),
            concepto:              r.concepto,
            debe:                  r.debe,
            haber:                 0,
            saldo:                 s,
            moneda:                Moneda.ARS,
            orden:                 i + 1,
            impuesto_subcategoria: r.sub,
          },
        });
      }

      // ── ING TICKETS ─────────────────────────────────────────────────────────
      await tx.movimiento.create({
        data: {
          evento_id:   e2.id,
          tipo:        Tipo.INGRESO,
          rubro_id:    rubroEnjoy('INGRESO', 'Tickets'),
          estado_movimiento: EstadoMovimiento.CONFIRMADO,
          fecha:       new Date(),
          concepto:    'Venta anticipada',
          descripcion: 'Plataforma Ticketek — primer lote',
          debe:        0,
          haber:       1_450_000,
          saldo:       1_450_000,
          moneda:      Moneda.ARS,
          orden:       1,
        },
      });

      // ── ING SPON ────────────────────────────────────────────────────────────
      await tx.movimiento.create({
        data: {
          evento_id:   e2.id,
          tipo:        Tipo.INGRESO,
          rubro_id:    rubroEnjoy('INGRESO', 'Sponsors'),
          estado_movimiento: EstadoMovimiento.CONFIRMADO,
          fecha:       new Date(),
          concepto:    'Sponsor principal',
          descripcion: 'Banco Nación — confirmado',
          debe:        0,
          haber:       600_000,
          saldo:       600_000,
          moneda:      Moneda.ARS,
          orden:       1,
        },
      });

      // ── CUENTA BANCARIA ─────────────────────────────────────────────────────
      await tx.cuentaBancaria.create({
        data: {
          empresa_id:    EMPRESA_ID,
          evento_id:     e2.id,
          nombre:        'Banco Nación Cta Cte',
          tipo:          TipoCuenta.BANCO,
          moneda:        Moneda.ARS,
          saldo_inicial: 0,
        },
      });

      // ── ECHEQ PENDIENTE ─────────────────────────────────────────────────────
      await tx.echeq.create({
        data: {
          evento_id:           e2.id,
          movimiento_id:       movSonidoE2Id,
          proveedor_id:        pSonido.id,
          numero:              '0001240',
          razon_social:        'Sonido Total S.A.',
          importe:             460_000,
          moneda:              Moneda.ARS,
          estado:              EstadoEcheq.PENDIENTE,
          fecha_emision:       new Date(),
          // fecha_inicio - 2 días → aparece en alertas de cobro próximo
          fecha_cobro_estimada: daysFromNow(13),
        },
      });

      // ── ASIGNACIONES DE STOCK ───────────────────────────────────────────────
      const salidaE2   = daysFromNow(14); // fecha_inicio - 1 día
      const salidaEscE2 = daysFromNow(13); // fecha_inicio - 2 días

      // Parlante JBL: 16 de 20 — quedan 4 en depósito
      const asig1 = await tx.asignacionStock.create({
        data: {
          producto_id:  prodParlante.id,
          evento_id:    e2.id,
          cantidad:     16,
          fecha_salida: salidaE2,
          ubicacion:    UbicacionStock.EN_EVENTO,
          estado:       EstadoAsignacion.ACTIVA,
          origen:       OrigenTransfer.DEPOSITO,
        },
      });
      await tx.movimientoStock.create({
        data: {
          producto_id:       prodParlante.id,
          asignacion_id:     asig1.id,
          tipo:              'SALIDA',
          cantidad:          16,
          evento_destino_id: e2.id,
          fecha:             salidaE2,
          descripcion:       'Asignación para Festival de la Ciudad 2025',
        },
      });

      // Moving Head: 24 de 30
      const asig2 = await tx.asignacionStock.create({
        data: {
          producto_id:  prodMovHead.id,
          evento_id:    e2.id,
          cantidad:     24,
          fecha_salida: salidaE2,
          ubicacion:    UbicacionStock.EN_EVENTO,
          estado:       EstadoAsignacion.ACTIVA,
          origen:       OrigenTransfer.DEPOSITO,
        },
      });
      await tx.movimientoStock.create({
        data: {
          producto_id:       prodMovHead.id,
          asignacion_id:     asig2.id,
          tipo:              'SALIDA',
          cantidad:          24,
          evento_destino_id: e2.id,
          fecha:             salidaE2,
          descripcion:       'Asignación para Festival de la Ciudad 2025',
        },
      });

      // Módulo escenario: 40 de 50
      const asig3 = await tx.asignacionStock.create({
        data: {
          producto_id:  prodEscMod.id,
          evento_id:    e2.id,
          cantidad:     40,
          fecha_salida: salidaEscE2,
          ubicacion:    UbicacionStock.EN_EVENTO,
          estado:       EstadoAsignacion.ACTIVA,
          origen:       OrigenTransfer.DEPOSITO,
        },
      });
      await tx.movimientoStock.create({
        data: {
          producto_id:       prodEscMod.id,
          asignacion_id:     asig3.id,
          tipo:              'SALIDA',
          cantidad:          40,
          evento_destino_id: e2.id,
          fecha:             salidaEscE2,
          descripcion:       'Asignación para Festival de la Ciudad 2025',
        },
      });

      // Generador: 3 de 4 — queda 1 en depósito (= stock_minimo) → ALERTA RIESGO
      const asig4 = await tx.asignacionStock.create({
        data: {
          producto_id:  prodGenerador.id,
          evento_id:    e2.id,
          cantidad:     3,
          fecha_salida: salidaE2,
          ubicacion:    UbicacionStock.EN_EVENTO,
          estado:       EstadoAsignacion.ACTIVA,
          origen:       OrigenTransfer.DEPOSITO,
          notas:        'ALERTA RIESGO: quedan 1 unidad en depósito, igual al stock mínimo configurado.',
        },
      });
      await tx.movimientoStock.create({
        data: {
          producto_id:       prodGenerador.id,
          asignacion_id:     asig4.id,
          tipo:              'SALIDA',
          cantidad:          3,
          evento_destino_id: e2.id,
          fecha:             salidaE2,
          descripcion:       'Asignación 3 de 4 — queda 1 unidad en depósito (stock mínimo)',
        },
      });

      // ── ACCESOS ─────────────────────────────────────────────────────────────
      await tx.eventoAcceso.upsert({
        where:  { usuario_id_evento_id: { usuario_id: operador.id, evento_id: e2.id } },
        update: {},
        create: { usuario_id: operador.id, evento_id: e2.id, rol: Rol.OPERADOR },
      });
    });

    totalEventos++;
    totalMovimientos  += 3 + 2 + 1 + 1; // 7
    totalEcheqs       += 1;
    totalAsignaciones += 4;
    console.log('✓ Evento 2 creado (7 movimientos, 1 echeq PENDIENTE, 4 asignaciones stock)');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EVENTO 3 — ACTIVO (solapado con Evento 2, muestra quiebre de stock)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\nCreando Evento 3: Córdoba Beat Festival...');

  const existeE3 = await prisma.evento.findFirst({ where: { nombre: 'Córdoba Beat Festival', empresa_id: EMPRESA_ID } });

  if (existeE3) {
    console.log('  (ya existe, omitiendo)');
  } else {
    await prisma.$transaction(async (tx) => {
      const e3 = await tx.evento.create({
        data: {
          empresa_id:   EMPRESA_ID,
          nombre:       'Córdoba Beat Festival',
          fecha_inicio: daysFromNow(16), // solapa 1 día con Evento 2
          fecha_fin:    daysFromNow(19),
          estado:       EstadoEvento.ACTIVO,
          moneda_base:  Moneda.ARS,
          socios: [
            { nombre: 'Carlos Pérez',  porcentaje: 70 },
            { nombre: 'Ana Rodríguez', porcentaje: 30 },
          ],
        },
      });

      // ── Etapa inicial ────────────────────────────────────────────────────────
      await tx.movimiento.create({
        data: {
          evento_id:   e3.id,
          tipo:        Tipo.EGRESO,
          rubro_id:    rubroEnjoy('EGRESO', 'Producción General'),
          estado_movimiento: EstadoMovimiento.PENDIENTE,
          presupuesto: 280_000,
          fecha:       new Date(),
          concepto:    'Producción general',
          debe:        280_000,
          haber:       0,
          saldo:       -280_000,
          moneda:      Moneda.ARS,
          orden:       1,
        },
      });
      await tx.movimiento.create({
        data: {
          evento_id:   e3.id,
          tipo:        Tipo.EGRESO,
          rubro_id:    rubroEnjoy('EGRESO', 'Transporte y Logística'),
          estado_movimiento: EstadoMovimiento.PENDIENTE,
          presupuesto: 95_000,
          fecha:       new Date(),
          concepto:    'Logística',
          debe:        95_000,
          haber:       0,
          saldo:       -375_000,
          moneda:      Moneda.ARS,
          orden:       2,
        },
      });

      // ── ASIGNACIÓN PARLANTE — QUIEBRE DE STOCK ──────────────────────────────
      // Evento 2 tiene 16 de 20 → solo quedan 4 en depósito.
      // Se piden 8 → quiebre de 4 unidades.
      // La asignación refleja las 8 pedidas para que el sistema muestre el conflicto
      // y sugiera transferencia desde Festival de la Ciudad 2025.
      const asig5 = await tx.asignacionStock.create({
        data: {
          producto_id:  prodParlante.id,
          evento_id:    e3.id,
          cantidad:     8,
          fecha_salida: daysFromNow(15),
          ubicacion:    UbicacionStock.EN_EVENTO,
          estado:       EstadoAsignacion.ACTIVA,
          origen:       OrigenTransfer.DEPOSITO,
          notas:        'QUIEBRE DE STOCK: se solicitan 8 unidades, solo 4 disponibles en depósito. Sugerencia: transferir 4 unidades desde Festival de la Ciudad 2025.',
        },
      });
      await tx.movimientoStock.create({
        data: {
          producto_id:       prodParlante.id,
          asignacion_id:     asig5.id,
          tipo:              'SALIDA',
          cantidad:          8,
          evento_destino_id: e3.id,
          fecha:             daysFromNow(15),
          descripcion:       'Asignación parcial — quiebre de stock (4 faltantes)',
        },
      });

      // ── ACCESOS ─────────────────────────────────────────────────────────────
      await tx.eventoAcceso.upsert({
        where:  { usuario_id_evento_id: { usuario_id: operador.id, evento_id: e3.id } },
        update: {},
        create: { usuario_id: operador.id, evento_id: e3.id, rol: Rol.OPERADOR },
      });
    });

    totalEventos++;
    totalMovimientos  += 2;
    totalAsignaciones += 1;
    console.log('✓ Evento 3 creado (2 movimientos, asignación con quiebre de stock)');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RRHH — empleados, jornadas, anticipos y una liquidación en borrador
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\nCreando datos de RRHH...');

  const eventoE1 = await prisma.evento.findFirst({ where: { nombre: 'Cosquín Rock 2024', empresa_id: EMPRESA_ID } });
  const eventoE2 = await prisma.evento.findFirst({ where: { nombre: 'Festival de la Ciudad 2025', empresa_id: EMPRESA_ID } });

  async function upsertEmpleado(data: {
    nombre: string; apellido: string; dni: string; categoria: CategoriaEmpleado;
    valor_hora: number; valor_hora_extra: number; cbu?: string; alias?: string; banco?: string;
  }) {
    const existente = await prisma.empleado.findFirst({ where: { dni: data.dni, empresa_id: EMPRESA_ID } });
    if (existente) return existente;
    return prisma.empleado.create({
      data: {
        empresa_id:       EMPRESA_ID,
        nombre:           data.nombre,
        apellido:         data.apellido,
        dni:              data.dni,
        categoria:        data.categoria,
        valor_hora:       data.valor_hora,
        valor_hora_extra: data.valor_hora_extra,
        cbu:              data.cbu ?? null,
        alias:            data.alias ?? null,
        banco:            data.banco ?? null,
      },
    });
  }

  const empCapitan = await upsertEmpleado({ nombre: 'Diego',  apellido: 'Rodríguez', dni: '30111222', categoria: CategoriaEmpleado.CAPITAN,        valor_hora: 5000, valor_hora_extra: 7500, banco: 'Banco Galicia',   alias: 'diego.rodriguez.mp' });
  const empArmador = await upsertEmpleado({ nombre: 'Pablo',  apellido: 'Fernández',  dni: '30222333', categoria: CategoriaEmpleado.ARMADOR,        valor_hora: 3500, valor_hora_extra: 5250, banco: 'Banco Nación',    alias: 'pablo.fernandez.mp' });
  const empChofer  = await upsertEmpleado({ nombre: 'Sergio', apellido: 'Gómez',      dni: '30333444', categoria: CategoriaEmpleado.CHOFER,         valor_hora: 3000, valor_hora_extra: 4500, banco: 'Banco Santander', alias: 'sergio.gomez.mp' });
  const empAdmin   = await upsertEmpleado({ nombre: 'Lucía',  apellido: 'Torres',     dni: '30444555', categoria: CategoriaEmpleado.ADMINISTRATIVO, valor_hora: 2800, valor_hora_extra: 4200, banco: 'Banco Galicia',   alias: 'lucia.torres.mp' });
  const empTecnico = await upsertEmpleado({ nombre: 'Ramiro', apellido: 'Medina',     dni: '30555666', categoria: CategoriaEmpleado.TECNICO,        valor_hora: 3200, valor_hora_extra: 4800, banco: 'Banco BBVA',      alias: 'ramiro.medina.mp' });

  console.log('✓ Empleados: 5 creados/existentes');

  function horaDe(fecha: Date, h: number, m = 0): Date {
    return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), h, m);
  }

  async function upsertJornada(data: {
    empleado_id: number; evento_id?: number | null; fecha: Date;
    ingreso?: number; egreso?: number; estado: EstadoJornada; descripcion?: string; motivo_rechazo?: string;
  }) {
    const existente = await prisma.jornada.findFirst({ where: { empleado_id: data.empleado_id, fecha: data.fecha } });
    if (existente) return existente;

    const horaIngreso = data.ingreso !== undefined ? horaDe(data.fecha, data.ingreso) : null;
    const horaEgreso  = data.egreso  !== undefined ? horaDe(data.fecha, data.egreso)  : null;
    const { horas_normales, horas_extras } = calcularHoras(horaIngreso, horaEgreso);

    return prisma.jornada.create({
      data: {
        empleado_id:    data.empleado_id,
        empresa_id:     EMPRESA_ID,
        evento_id:      data.evento_id ?? null,
        fecha:          data.fecha,
        hora_ingreso:   horaIngreso,
        hora_egreso:    horaEgreso,
        horas_normales,
        horas_extras,
        descripcion:    data.descripcion ?? null,
        estado:         data.estado,
        motivo_rechazo: data.motivo_rechazo ?? null,
        aprobado_por:   data.estado !== EstadoJornada.PENDIENTE ? operador.id : null,
        aprobado_at:    data.estado !== EstadoJornada.PENDIENTE ? new Date() : null,
      },
    });
  }

  const jornadasSeed = [
    { empleado_id: empCapitan.id, evento_id: eventoE1?.id ?? null, fecha: daysAgo(10), ingreso: 8,  egreso: 20, estado: EstadoJornada.APROBADA, descripcion: 'Armado y sonido — día 1' },
    { empleado_id: empCapitan.id, evento_id: eventoE1?.id ?? null, fecha: daysAgo(9),  ingreso: 8,  egreso: 18, estado: EstadoJornada.APROBADA, descripcion: 'Show — día 2' },
    { empleado_id: empArmador.id, evento_id: eventoE1?.id ?? null, fecha: daysAgo(10), ingreso: 7,  egreso: 19, estado: EstadoJornada.APROBADA, descripcion: 'Armado de escenario' },
    { empleado_id: empArmador.id, evento_id: eventoE2?.id ?? null, fecha: daysFromNow(14), ingreso: 9, egreso: 17, estado: EstadoJornada.PENDIENTE, descripcion: 'Armado previo al festival' },
    { empleado_id: empChofer.id,  evento_id: null,                 fecha: daysAgo(5),  ingreso: 6,  egreso: 14, estado: EstadoJornada.APROBADA, descripcion: 'Traslado de equipos a depósito' },
    { empleado_id: empChofer.id,  evento_id: eventoE2?.id ?? null, fecha: daysFromNow(14), ingreso: 5, egreso: 13, estado: EstadoJornada.PENDIENTE, descripcion: 'Flete equipo sonido' },
    { empleado_id: empAdmin.id,   evento_id: null,                 fecha: daysAgo(3),  ingreso: 9,  egreso: 18, estado: EstadoJornada.APROBADA, descripcion: 'Administración y facturación' },
    { empleado_id: empAdmin.id,   evento_id: null,                 fecha: daysAgo(2),  ingreso: 9,  egreso: 17, estado: EstadoJornada.PENDIENTE, descripcion: 'Cierre contable del mes' },
    { empleado_id: empTecnico.id, evento_id: eventoE1?.id ?? null, fecha: daysAgo(9),  ingreso: 10, egreso: 23, estado: EstadoJornada.APROBADA, descripcion: 'Soporte técnico de audio' },
    { empleado_id: empTecnico.id, evento_id: eventoE2?.id ?? null, fecha: daysFromNow(15), ingreso: 8, egreso: 16, estado: EstadoJornada.RECHAZADA, descripcion: 'Prueba de equipos', motivo_rechazo: 'Cargada con horario incorrecto, volver a cargar' },
  ];

  for (const j of jornadasSeed) {
    await upsertJornada(j);
  }
  console.log(`✓ Jornadas: ${jornadasSeed.length} creadas/existentes (7 APROBADA, 2 PENDIENTE, 1 RECHAZADA)`);

  async function upsertAnticipo(data: { empleado_id: number; tipo: TipoAnticipo; monto: number; fecha: Date; motivo: string }) {
    const existente = await prisma.anticipo.findFirst({ where: { empleado_id: data.empleado_id, motivo: data.motivo } });
    if (existente) return existente;
    return prisma.anticipo.create({
      data: {
        empleado_id: data.empleado_id,
        empresa_id:  EMPRESA_ID,
        tipo:        data.tipo,
        monto:       data.monto,
        fecha:       data.fecha,
        motivo:      data.motivo,
      },
    });
  }

  await upsertAnticipo({ empleado_id: empCapitan.id, tipo: TipoAnticipo.ADELANTO, monto: 30_000, fecha: daysAgo(8), motivo: 'Adelanto quincena — Cosquín Rock 2024' });
  await upsertAnticipo({ empleado_id: empArmador.id, tipo: TipoAnticipo.VALE,     monto: 8_000,  fecha: daysAgo(6), motivo: 'Vale combustible' });

  console.log('✓ Anticipos: 2 pendientes creados/existentes');

  // Liquidación BORRADOR — capitán, jornadas APROBADA de Cosquín Rock 2024
  const existeLiquidacion = await prisma.liquidacion.findFirst({
    where: { empleado_id: empCapitan.id, empresa_id: EMPRESA_ID, estado: EstadoLiquidacion.BORRADOR },
  });
  if (!existeLiquidacion) {
    const jornadasCapitan = await prisma.jornada.findMany({
      where: { empleado_id: empCapitan.id, estado: EstadoJornada.APROBADA, deleted_at: null },
    });
    const horasNormales = jornadasCapitan.reduce((s, j) => s + Number(j.horas_normales), 0);
    const horasExtras   = jornadasCapitan.reduce((s, j) => s + Number(j.horas_extras), 0);
    const valorHora      = Number(empCapitan.valor_hora);
    const valorHoraExtra = Number(empCapitan.valor_hora_extra);
    const subtotal       = round2(horasNormales * valorHora + horasExtras * valorHoraExtra);
    const totalAnticipos = 30_000; // el adelanto sembrado arriba, aún no descontado
    const totalACobrar   = round2(subtotal - totalAnticipos);

    await prisma.liquidacion.create({
      data: {
        empleado_id:      empCapitan.id,
        empresa_id:       EMPRESA_ID,
        evento_id:        eventoE1?.id ?? null,
        fecha_desde:      daysAgo(10),
        fecha_hasta:      daysAgo(9),
        horas_normales:   horasNormales,
        horas_extras:     horasExtras,
        valor_hora:       valorHora,
        valor_hora_extra: valorHoraExtra,
        subtotal_horas:   subtotal,
        total_anticipos:  totalAnticipos,
        total_descuentos: 0,
        total_a_cobrar:   totalACobrar,
        estado:           EstadoLiquidacion.BORRADOR,
      },
    });
    console.log('✓ Liquidación BORRADOR creada para Diego Rodríguez');
  } else {
    console.log('  (liquidación BORRADOR ya existe, omitiendo)');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DOS57 — CAMIONES, CATÁLOGO LAYHER, CUNAS, ASIGNACIÓN EN TRÁNSITO
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\nCreando datos de stock para DOS57 Estructuras...');

  const camC1 = await prisma.camion.upsert({ where: { codigo_empresa_id: { codigo: 'C1', empresa_id: EMPRESA_ID_DOS57 } }, update: {}, create: { codigo: 'C1', descripcion: 'Mercedes Sprinter', empresa_id: EMPRESA_ID_DOS57 } });
  await                prisma.camion.upsert({ where: { codigo_empresa_id: { codigo: 'C2', empresa_id: EMPRESA_ID_DOS57 } }, update: {}, create: { codigo: 'C2', descripcion: 'Camión Iveco',       empresa_id: EMPRESA_ID_DOS57 } });
  await                prisma.camion.upsert({ where: { codigo_empresa_id: { codigo: 'C3', empresa_id: EMPRESA_ID_DOS57 } }, update: {}, create: { codigo: 'C3', descripcion: 'Van Transit',         empresa_id: EMPRESA_ID_DOS57 } });
  console.log('✓ Camiones DOS57: 3 creados (C1, C2, C3)');

  // ── Cajas de empresa DOS57 (sin evento) ──────────────────────────────────────
  // DOS57 opera con caja chica por persona + caja general mensual, no atadas
  // a un evento puntual (a diferencia de Enjoy, 100% por evento).
  const cajasEmpresaDos57 = [
    { nombre: 'Caja General DOS57', saldo_inicial: 1_000_000 },
    { nombre: 'Caja Reserva',       saldo_inicial:   500_000 },
    { nombre: 'Caja Pollo',         saldo_inicial:         0 },
    { nombre: 'Caja Jazmín',        saldo_inicial:         0 },
  ];
  let cajasDos57Creadas = 0;
  for (const c of cajasEmpresaDos57) {
    const existe = await prisma.cuentaBancaria.findFirst({
      where: { nombre: c.nombre, empresa_id: EMPRESA_ID_DOS57, evento_id: null },
    });
    if (existe) continue;
    await prisma.cuentaBancaria.create({
      data: {
        empresa_id:    EMPRESA_ID_DOS57,
        evento_id:     null,
        nombre:        c.nombre,
        tipo:          TipoCuenta.EFECTIVO,
        moneda:        Moneda.ARS,
        saldo_inicial: c.saldo_inicial,
      },
    });
    cajasDos57Creadas++;
  }
  console.log(`✓ Cajas de empresa DOS57: ${cajasDos57Creadas} creadas/existentes (${cajasEmpresaDos57.map(c => c.nombre).join(', ')})`);

  const layherData = [
    { codigo_externo: 'L-2000', nombre_tecnico: 'Vertical 2.00m',      nombre_interno: 'Torre 2m',        stock_total: 200, es_critico: true  },
    { codigo_externo: 'L-1500', nombre_tecnico: 'Vertical 1.50m',      nombre_interno: 'Torre 1.5m',       stock_total: 150, es_critico: true  },
    { codigo_externo: 'L-1000', nombre_tecnico: 'Vertical 1.00m',      nombre_interno: 'Torre 1m',         stock_total: 180, es_critico: false },
    { codigo_externo: 'H-2500', nombre_tecnico: 'Horizontal 2.50m',    nombre_interno: 'Travesaño 2.5m',   stock_total: 220, es_critico: true  },
    { codigo_externo: 'H-1000', nombre_tecnico: 'Horizontal 1.00m',    nombre_interno: 'Travesaño 1m',     stock_total: 160, es_critico: false },
    { codigo_externo: 'D-2000', nombre_tecnico: 'Diagonal 2.00m',      nombre_interno: 'Diagonal 2m',      stock_total: 120, es_critico: true  },
    { codigo_externo: 'BASE-J', nombre_tecnico: 'Base Ajustable',      nombre_interno: 'Base regulable',   stock_total: 300, es_critico: true  },
    { codigo_externo: 'PLT-40', nombre_tecnico: 'Plataforma 0.40m',    nombre_interno: 'Piso 40cm',        stock_total: 250, es_critico: false },
    { codigo_externo: 'BAR-KL', nombre_tecnico: 'Barandilla Kliklock', nombre_interno: 'Baranda',          stock_total: 140, es_critico: false },
    { codigo_externo: 'ESC-LY', nombre_tecnico: 'Escalera Interior',   nombre_interno: 'Escalera',         stock_total: 40,  es_critico: false },
  ];

  const layherProductos = [];
  for (const d of layherData) {
    const p = await prisma.producto.upsert({
      where:  { codigo_externo_empresa_id: { codigo_externo: d.codigo_externo, empresa_id: EMPRESA_ID_DOS57 } },
      update: {},
      create: {
        empresa_id:      EMPRESA_ID_DOS57,
        nombre:          d.nombre_tecnico,
        nombre_tecnico:  d.nombre_tecnico,
        nombre_interno:  d.nombre_interno,
        codigo_externo:  d.codigo_externo,
        catalogo_origen: 'Layher',
        stock_total:     d.stock_total,
        stock_minimo:    Math.round(d.stock_total * 0.1),
        es_critico:      d.es_critico,
        unidad:          'unidad',
      },
    });
    layherProductos.push(p);
  }
  console.log(`✓ Productos Layher DOS57: ${layherProductos.length} creados`);

  const cunasData = [
    { codigo: 'C-001', descripcion: 'Cuna torre estándar',    productos: [0, 3, 6] },
    { codigo: 'C-002', descripcion: 'Cuna horizontal',        productos: [3, 4, 7] },
    { codigo: 'C-003', descripcion: 'Cuna diagonales y base', productos: [5, 6, 1] },
    { codigo: 'C-004', descripcion: 'Cuna plataformas',       productos: [7, 8, 2, 0] },
    { codigo: 'C-005', descripcion: 'Cuna accesos',           productos: [9, 8, 6] },
  ];

  for (const c of cunasData) {
    const cuna = await prisma.cuna.upsert({
      where:  { codigo_empresa_id: { codigo: c.codigo, empresa_id: EMPRESA_ID_DOS57 } },
      update: {},
      create: { codigo: c.codigo, descripcion: c.descripcion, empresa_id: EMPRESA_ID_DOS57 },
    });
    for (const idx of c.productos) {
      const producto = layherProductos[idx];
      await prisma.cunaProducto.upsert({
        where:  { cuna_id_producto_id: { cuna_id: cuna.id, producto_id: producto.id } },
        update: {},
        create: { cuna_id: cuna.id, producto_id: producto.id, cantidad: 10 },
      });
    }
  }
  console.log(`✓ Cunas DOS57: ${cunasData.length} creadas con contenido estandarizado`);

  // Evento demo DOS57 con una asignación en tránsito (firma de salida ya hecha)
  const existeEventoDos57 = await prisma.evento.findFirst({ where: { nombre: 'Montaje Escenario Techado — Predio Norte', empresa_id: EMPRESA_ID_DOS57 } });
  if (existeEventoDos57) {
    console.log('  (evento DOS57 ya existe, omitiendo)');
  } else {
    const eventoDos57 = await prisma.evento.create({
      data: {
        empresa_id:   EMPRESA_ID_DOS57,
        nombre:       'Montaje Escenario Techado — Predio Norte',
        fecha_inicio: daysFromNow(3),
        fecha_fin:    daysFromNow(7),
        estado:       EstadoEvento.ACTIVO,
        moneda_base:  Moneda.ARS,
      },
    });

    const asignacionDos57 = await prisma.asignacionStock.create({
      data: {
        producto_id:       layherProductos[0].id, // Vertical 2.00m
        evento_id:         eventoDos57.id,
        cantidad:           40,
        fecha_salida:       new Date(),
        ubicacion:          UbicacionStock.EN_TRANSITO,
        estado:             EstadoAsignacion.ACTIVA,
        origen:             OrigenTransfer.DEPOSITO,
        camion_id:          camC1.id,
        firmado_salida:     true,
        firmado_salida_at:  new Date(),
        notas:              'Camión C1 en tránsito hacia Predio Norte',
      },
    });
    void asignacionDos57;

    // ── Movimientos demo — rubros DOS57 ─────────────────────────────────────
    await prisma.movimiento.create({
      data: {
        evento_id:   eventoDos57.id,
        tipo:        Tipo.EGRESO,
        rubro_id:    rubroDos57('EGRESO', 'Materiales Layher'),
        estado_movimiento: EstadoMovimiento.CONFIRMADO,
        presupuesto: 350_000,
        fecha:       new Date(),
        concepto:    'Alquiler estructura Layher',
        descripcion: '40 unidades Vertical 2.00m — Predio Norte',
        debe:        350_000,
        haber:       0,
        saldo:       -350_000,
        moneda:      Moneda.ARS,
        orden:       1,
      },
    });
    await prisma.movimiento.create({
      data: {
        evento_id:   eventoDos57.id,
        tipo:        Tipo.INGRESO,
        rubro_id:    rubroDos57('INGRESO', 'Alquiler de Estructuras'),
        estado_movimiento: EstadoMovimiento.CONFIRMADO,
        fecha:       new Date(),
        concepto:    'Anticipo cliente',
        descripcion: 'Anticipo — Montaje Escenario Techado Predio Norte',
        debe:        0,
        haber:       500_000,
        saldo:       500_000,
        moneda:      Moneda.ARS,
        orden:       1,
      },
    });
    totalMovimientos += 2;

    totalEventos++;
    totalAsignaciones++;
    console.log('✓ Evento DOS57 creado con asignación en tránsito (firma de salida hecha) y 2 movimientos demo');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PAÑOL — 5 ítems + 2 movimientos por empresa (Enjoy y DOS57)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\nCreando pañol (herramientas y consumibles) para ambas empresas...');

  const panolItemsData = [
    { nombre: 'Taladro Bosch GSB 13 RE',   tipo: TipoPanolItem.HERRAMIENTA, stock_total: 6,  valor: 45000 },
    { nombre: 'Amoladora Angular 4.5"',    tipo: TipoPanolItem.HERRAMIENTA, stock_total: 5,  valor: 32000 },
    { nombre: 'Llave de impacto',          tipo: TipoPanolItem.HERRAMIENTA, stock_total: 4,  valor: 58000 },
    { nombre: 'Cinta aisladora (rollo)',   tipo: TipoPanolItem.CONSUMIBLE,  stock_total: 50, valor: 800   },
    { nombre: 'Precintos plásticos (caja)', tipo: TipoPanolItem.CONSUMIBLE, stock_total: 30, valor: 2500  },
  ];

  for (const empresaId of [EMPRESA_ID, EMPRESA_ID_DOS57]) {
    const evento = await prisma.evento.findFirst({ where: { empresa_id: empresaId, deleted_at: null }, orderBy: { id: 'asc' } });
    // Evento CERRADO, si existe — usado en el movimiento pendiente para que
    // GET /panol/alertas tenga datos reales que mostrar (ítem no devuelto de
    // un evento ya finalizado).
    const eventoCerrado = await prisma.evento.findFirst({ where: { empresa_id: empresaId, estado: EstadoEvento.CERRADO, deleted_at: null } });

    const items: Awaited<ReturnType<typeof prisma.panolItem.create>>[] = [];
    for (const d of panolItemsData) {
      const existing = await prisma.panolItem.findFirst({ where: { nombre: d.nombre, empresa_id: empresaId, deleted_at: null } });
      const item = existing ?? await prisma.panolItem.create({
        data: {
          empresa_id:       empresaId,
          nombre:           d.nombre,
          tipo:             d.tipo,
          stock_total:      d.stock_total,
          stock_disponible: d.stock_total,
          valor:            d.valor,
          estado:           EstadoPanolItem.DISPONIBLE,
        },
      });
      items.push(item);
    }

    // Movimiento 1 — salida con devolución completa
    const mov1Existente = await prisma.movimientoPanol.findFirst({ where: { panol_item_id: items[0].id, empresa_id: empresaId, descripcion: 'Demo — devolución completa' } });
    if (!mov1Existente) {
      await prisma.$transaction(async tx => {
        await tx.panolItem.update({ where: { id: items[0].id }, data: { stock_disponible: { decrement: 1 } } });
        const mov = await tx.movimientoPanol.create({
          data: {
            empresa_id: empresaId, panol_item_id: items[0].id, tipo: TipoMovPanol.SALIDA, cantidad: 1,
            evento_id: evento?.id ?? null, responsable_nombre: 'Equipo de armado', fecha: daysAgo(5),
            descripcion: 'Demo — devolución completa',
          },
        });
        await tx.panolItem.update({ where: { id: items[0].id }, data: { stock_disponible: { increment: 1 } } });
        await tx.movimientoPanol.update({ where: { id: mov.id }, data: { cantidad_devuelta: 1, cantidad_faltante: 0, devolucion_at: daysAgo(3) } });
      });
    }

    // Movimiento 2 — salida pendiente de devolución
    const mov2Existente = await prisma.movimientoPanol.findFirst({ where: { panol_item_id: items[1].id, empresa_id: empresaId, descripcion: 'Demo — pendiente de devolución' } });
    if (!mov2Existente) {
      await prisma.$transaction(async tx => {
        await tx.panolItem.update({ where: { id: items[1].id }, data: { stock_disponible: { decrement: 1 } } });
        await tx.movimientoPanol.create({
          data: {
            empresa_id: empresaId, panol_item_id: items[1].id, tipo: TipoMovPanol.SALIDA, cantidad: 1,
            evento_id: (eventoCerrado ?? evento)?.id ?? null, responsable_nombre: 'Equipo de armado', fecha: daysAgo(15),
            descripcion: 'Demo — pendiente de devolución',
          },
        });
      });
    }

    console.log(`✓ Pañol empresa #${empresaId}: 5 ítems, 2 movimientos`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ACTIVOS — 3 por empresa (Enjoy y DOS57)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\nCreando activos para ambas empresas...');

  const activosData = [
    { nombre: 'Notebook Dell Latitude',  categoria: 'Informático', estado: EstadoActivo.BUENO,   ubicacion: 'Oficina',          valor_compra: 850000 },
    { nombre: 'Escritorio de oficina',   categoria: 'Mobiliario',  estado: EstadoActivo.REGULAR, ubicacion: 'Oficina',          valor_compra: 120000 },
    { nombre: 'Camioneta Toro',          categoria: 'Vehículo',    estado: EstadoActivo.BUENO,   ubicacion: 'Depósito central', valor_compra: 12000000 },
  ];

  for (const empresaId of [EMPRESA_ID, EMPRESA_ID_DOS57]) {
    for (const d of activosData) {
      const existing = await prisma.activo.findFirst({ where: { nombre: d.nombre, empresa_id: empresaId, deleted_at: null } });
      if (!existing) {
        await prisma.activo.create({
          data: {
            empresa_id: empresaId, nombre: d.nombre, categoria: d.categoria,
            estado: d.estado, ubicacion: d.ubicacion, valor_compra: d.valor_compra,
          },
        });
      }
    }
    console.log(`✓ Activos empresa #${empresaId}: 3 creados`);
  }

  // ── RESUMEN ───────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════');
  console.log('  SEED DE DEMO COMPLETADO');
  console.log('══════════════════════════════════════════════════');
  console.log(`  Usuarios creados:           2  (operador + viewer)`);
  console.log(`  Proveedores creados:        8`);
  console.log(`  Categorías stock:           6`);
  console.log(`  Productos stock:            8`);
  console.log(`  Eventos creados:            ${totalEventos}`);
  console.log(`  Movimientos creados:        ~${totalMovimientos}`);
  console.log(`  Echeqs creados:             ${totalEcheqs}`);
  console.log(`  Asignaciones stock:         ${totalAsignaciones}`);
  console.log('══════════════════════════════════════════════════');
  console.log('\nCredenciales de demo:');
  console.log('  OPERADOR  operador@demo.com  /  Demo2024!');
  console.log('  VIEWER    viewer@demo.com    /  Demo2024!');
  console.log('');
}

main()
  .catch((e) => {
    console.error('\n❌ Error en seed-demo:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
