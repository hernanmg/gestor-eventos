import 'dotenv/config';
import bcrypt from 'bcryptjs';
import {
  EstadoAsignacion,
  EstadoEcheq,
  EstadoEvento,
  Moneda,
  OrigenTransfer,
  Rol,
  TipoCuenta,
  Tipo,
  UbicacionStock,
} from '@prisma/client';
import { prisma } from '../src/lib/prisma';

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

// ── Helpers idempotentes ──────────────────────────────────────────────────────

async function upsertProveedor(data: {
  nombre: string;
  alias?: string;
  cuit?: string;
  categoria: string;
}) {
  if (data.cuit) {
    return prisma.proveedor.upsert({
      where:  { cuit: data.cuit },
      update: {},
      create: data,
    });
  }
  const existing = await prisma.proveedor.findFirst({ where: { nombre: data.nombre } });
  return existing ?? prisma.proveedor.create({ data });
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
    update: {},
    create: {
      email:         'operador@demo.com',
      nombre:        'Laura Gómez',
      password_hash: demoHash,
      rol:           Rol.OPERADOR,
    },
  });

  const viewer = await prisma.usuario.upsert({
    where:  { email: 'viewer@demo.com' },
    update: {},
    create: {
      email:         'viewer@demo.com',
      nombre:        'Martín Sosa',
      password_hash: demoHash,
      rol:           Rol.VIEWER,
    },
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

  const catAudio     = await prisma.categoriaStock.upsert({ where: { nombre: 'Audio'       }, update: {}, create: { nombre: 'Audio',       color: '#3B82F6' } });
  const catIlum      = await prisma.categoriaStock.upsert({ where: { nombre: 'Iluminación' }, update: {}, create: { nombre: 'Iluminación', color: '#F59E0B' } });
  const catEsc       = await prisma.categoriaStock.upsert({ where: { nombre: 'Escenario'   }, update: {}, create: { nombre: 'Escenario',   color: '#8B5CF6' } });
  const catMob       = await prisma.categoriaStock.upsert({ where: { nombre: 'Mobiliario'  }, update: {}, create: { nombre: 'Mobiliario',  color: '#10B981' } });
  const catEnergia   = await prisma.categoriaStock.upsert({ where: { nombre: 'Energía'     }, update: {}, create: { nombre: 'Energía',     color: '#EF4444' } });
  const catSegur     = await prisma.categoriaStock.upsert({ where: { nombre: 'Seguridad'   }, update: {}, create: { nombre: 'Seguridad',   color: '#6B7280' } });

  console.log('✓ Categorías: 6 creadas');

  // ── 4. PRODUCTOS DE STOCK ────────────────────────────────────────────────────
  console.log('Creando productos de stock...');

  const prodParlante  = await prisma.producto.upsert({ where: { codigo: 'PAR-001'     }, update: {}, create: { nombre: 'Parlante JBL Line Array',   codigo: 'PAR-001',     stock_total: 20,  stock_minimo: 4,  categoria_id: catAudio.id   } });
  const prodSub       = await prisma.producto.upsert({ where: { codigo: 'SUB-001'     }, update: {}, create: { nombre: 'Subwoofer DBX 18"',          codigo: 'SUB-001',     stock_total: 12,  stock_minimo: 2,  categoria_id: catAudio.id   } });
  const prodMovHead   = await prisma.producto.upsert({ where: { codigo: 'MOV-001'     }, update: {}, create: { nombre: 'Moving Head LED 200W',       codigo: 'MOV-001',     stock_total: 30,  stock_minimo: 6,  categoria_id: catIlum.id    } });
  const prodConsola   = await prisma.producto.upsert({ where: { codigo: 'CON-ILU-001' }, update: {}, create: { nombre: 'Consola de Iluminación MA2', codigo: 'CON-ILU-001', stock_total: 3,   stock_minimo: 1,  categoria_id: catIlum.id    } });
  const prodEscMod    = await prisma.producto.upsert({ where: { codigo: 'ESC-001'     }, update: {}, create: { nombre: 'Módulo de Escenario 2x1m',  codigo: 'ESC-001',     stock_total: 50,  stock_minimo: 10, categoria_id: catEsc.id     } });
  const prodGenerador = await prisma.producto.upsert({ where: { codigo: 'GEN-001'     }, update: {}, create: { nombre: 'Generador 100kva',           codigo: 'GEN-001',     stock_total: 4,   stock_minimo: 1,  categoria_id: catEnergia.id } });
  const prodSilla     = await prisma.producto.upsert({ where: { codigo: 'SIL-001'     }, update: {}, create: { nombre: 'Silla Plástica Blanca',      codigo: 'SIL-001',     stock_total: 200, stock_minimo: 20, categoria_id: catMob.id     } });
  const prodMolinete  = await prisma.producto.upsert({ where: { codigo: 'MOL-001'     }, update: {}, create: { nombre: 'Molinete Torniquete',        codigo: 'MOL-001',     stock_total: 8,   stock_minimo: 2,  categoria_id: catSegur.id   } });

  // Suprimir warnings de vars no usadas (quedan disponibles si se extiende el seed)
  void prodSub; void prodConsola; void prodSilla; void prodMolinete;

  console.log('✓ Productos: 8 creados');

  // ─────────────────────────────────────────────────────────────────────────────
  // EVENTO 1 — CERRADO (evento pasado con datos completos)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\nCreando Evento 1: Cosquín Rock 2024...');

  const existeE1 = await prisma.evento.findFirst({ where: { nombre: 'Cosquín Rock 2024' } });

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
            tab_numero:   1,
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
            tab_numero:            4,
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

      // ── EG-PREST (tab 5) ────────────────────────────────────────────────────
      await tx.movimiento.create({
        data: {
          evento_id:   e1.id,
          tipo:        Tipo.EGRESO,
          tab_numero:  5,
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

      // ── ING TICKETS (tab 1) ─────────────────────────────────────────────────
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
            tab_numero:  1,
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

      // ── ING SPON (tab 2) ────────────────────────────────────────────────────
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
            tab_numero:  2,
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

      // ── ING GASTRO (tab 4) ──────────────────────────────────────────────────
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
            tab_numero:  4,
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
          evento_id:     e1.id,
          nombre:        'Banco Galicia Cta Cte',
          tipo:          TipoCuenta.BANCO,
          moneda:        Moneda.ARS,
          saldo_inicial: 200_000,
        },
      });

      const ctaEfectivo = await tx.cuentaBancaria.create({
        data: {
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

  const existeE2 = await prisma.evento.findFirst({ where: { nombre: 'Festival de la Ciudad 2025' } });

  if (existeE2) {
    console.log('  (ya existe, omitiendo)');
  } else {
    const e2Inicio = daysFromNow(15);

    await prisma.$transaction(async (tx) => {
      const e2 = await tx.evento.create({
        data: {
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

      // ── EG-TC ───────────────────────────────────────────────────────────────
      let s = 0;
      const rows = [
        { concepto: 'Sonido Total S.A.', descripcion: 'Sistema de sonido',     debe: 920_000, pid: pSonido.id },
        { concepto: 'Iluminación',       descripcion: 'Iluminación escenario', debe: 540_000, pid: null       },
        { concepto: 'Seguridad',         descripcion: 'Personal de seguridad', debe: 320_000, pid: pSegur.id  },
      ];
      let movSonidoE2Id = 0;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        s = nextSaldo(s, r.debe, 0);
        const m = await tx.movimiento.create({
          data: {
            evento_id:    e2.id,
            tipo:         Tipo.EGRESO,
            tab_numero:   1,
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

      // ── EG-IMP ──────────────────────────────────────────────────────────────
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
            tab_numero:            4,
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
          tab_numero:  1,
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
          tab_numero:  2,
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

  const existeE3 = await prisma.evento.findFirst({ where: { nombre: 'Córdoba Beat Festival' } });

  if (existeE3) {
    console.log('  (ya existe, omitiendo)');
  } else {
    await prisma.$transaction(async (tx) => {
      const e3 = await tx.evento.create({
        data: {
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

      // ── EG-TC — etapa inicial ────────────────────────────────────────────────
      await tx.movimiento.create({
        data: {
          evento_id:   e3.id,
          tipo:        Tipo.EGRESO,
          tab_numero:  1,
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
          tab_numero:  1,
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
