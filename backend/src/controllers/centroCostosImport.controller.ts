import type { Request, Response } from 'express';
import { EstadoMovimiento, Prisma, Tipo, TipoRubro } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';
import { RUBROS_SISTEMA } from '../lib/rubrosConstants';
import { recalcularSaldosRubro } from '../lib/recalcularSaldos';
import { sincronizarMovimientoExtra } from '../lib/extrasEvento';
import { matchRubro } from '../lib/pedidosMaterialImporter';
import { parseCentroCostosKM, type FilaKM } from '../lib/centroCostosImporter';
import { buscarProveedorPorNombre } from './fichaEvento.controller';

// POST /api/eventos/:id/centro-costos/importar?preview=true|false
// Body (multipart): archivo + asignaciones (JSON opcional { [clave]: rubro_id | 0 })
// + rubro_defecto (id opcional para las líneas de Costos sin rubro detectado).
// 0 = no importar esa línea.
//
// Reglas:
// - Costos → egresos del evento, con el rubro detectado por la descripción (mismo
//   criterio que el importador de pedidos). RRHH → rubro RRHH. Extras → Extras
//   del centro de costos (a cargo del cliente, no suman al costo).
// - Reimportar no duplica: cada línea queda con su import_key y se actualiza.
// - Si la Ficha ya generó la línea vacía de ese rubro (sin monto, sin importar),
//   se completa esa línea en vez de crear otra.
// - PAGADO es irreversible en el sistema: una línea que ya estaba pagada sigue
//   pagada aunque la planilla diga otra cosa.
// - Las señas (falta pagar menor que el total) entran como pago parcial con la
//   nota "Planilla KM"; al reimportar se reemplaza sólo ese pago.

const NOTA_PAGO_KM = 'Planilla KM';
const CODIGOS_TECNICOS: string[] = Object.values(RUBROS_SISTEMA);

type Accion = 'CREAR' | 'ACTUALIZAR' | 'COMPLETAR_FICHA' | 'SIN_RUBRO' | 'OMITIDO';

interface FilaResuelta extends FilaKM {
  accion:            Accion;
  rubro_id:          number | null;
  rubro_nombre:      string | null;
  rubro_automatico:  boolean;
  proveedor_id:      number | null;
  proveedor_nombre:  string | null;
  existente_id:      number | null;
}

function textoNotas(f: FilaKM, conResponsable: boolean): string | null {
  const partes = [...f.notas];
  if (conResponsable && f.responsable) partes.unshift(`Responsable en la planilla: ${f.responsable}`);
  return partes.length ? partes.join(' · ') : null;
}

const fechaUTC = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00.000Z`) : null);

export async function importarCentroCostosKM(req: Request, res: Response) {
  const evento = await prisma.evento.findFirst({
    where:  { id: Number(req.params.id), deleted_at: null, ...withTenant(req.empresaId!) },
    select: { id: true, nombre: true, moneda_base: true, empresa_id: true },
  });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo .xlsx' }); return; }

  const esPreview = req.query.preview !== 'false';
  let asignaciones: Record<string, number> = {};
  try {
    const raw = req.body?.asignaciones;
    if (raw) asignaciones = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    res.status(400).json({ error: 'asignaciones no es un JSON válido' }); return;
  }
  const rubroDefecto = req.body?.rubro_defecto ? Number(req.body.rubro_defecto) : null;

  let parsed;
  try {
    parsed = await parseCentroCostosKM(req.file.buffer);
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? 'Error al procesar el archivo' }); return;
  }

  const [rubrosTodos, proveedores, movsEvento, extrasImportados] = await Promise.all([
    prisma.rubro.findMany({
      where:   { empresa_id: req.empresaId!, tipo: TipoRubro.EGRESO, deleted_at: null },
      select:  { id: true, nombre: true, codigo: true, activo: true },
      orderBy: { orden: 'asc' },
    }),
    prisma.proveedor.findMany({
      where:  { ...withTenant(req.empresaId!), deleted_at: null },
      select: { id: true, nombre: true, alias: true },
    }),
    prisma.movimiento.findMany({
      where:  { evento_id: evento.id, tipo: Tipo.EGRESO, deleted_at: null },
      select: { id: true, import_key: true, rubro_id: true, rubro_evento_id: true, debe: true, haber: true, estado_movimiento: true },
    }),
    prisma.extraEvento.findMany({
      where:  { evento_id: evento.id, deleted_at: null, import_key: { not: null } },
      select: { id: true, import_key: true },
    }),
  ]);

  const rubrosCosto = rubrosTodos.filter(r => r.activo && !(r.codigo && CODIGOS_TECNICOS.includes(r.codigo)));
  const rubroRRHH   = rubrosTodos.find(r => r.codigo === RUBROS_SISTEMA.RRHH) ?? null;
  const rubroPorId  = new Map(rubrosCosto.map(r => [r.id, r]));
  const defecto     = rubroDefecto ? rubroPorId.get(rubroDefecto) ?? null : null;

  const movPorClave   = new Map(movsEvento.filter(m => m.import_key).map(m => [m.import_key!, m]));
  const extraPorClave = new Map(extrasImportados.map(e => [e.import_key!, e]));
  // Líneas vacías que generó la Ficha, por rubro (sólo si hay una, para no adivinar)
  const fichaPorRubro = new Map<number, typeof movsEvento[number]>();
  const fichaRepetida = new Set<number>();
  for (const m of movsEvento) {
    if (!m.rubro_evento_id || m.import_key || m.rubro_id === null) continue;
    if (Number(m.debe) !== 0 || Number(m.haber) !== 0 || m.estado_movimiento === EstadoMovimiento.CANCELADO) continue;
    if (fichaPorRubro.has(m.rubro_id)) fichaRepetida.add(m.rubro_id);
    fichaPorRubro.set(m.rubro_id, m);
  }
  const fichaUsada = new Set<number>();

  const filas: FilaResuelta[] = parsed.filas.map(f => {
    const manual   = asignaciones[f.clave];
    const omitido  = manual === 0;
    const proveedor = f.hoja === 'EXTRAS' ? null : buscarProveedorPorNombre(f.responsable, proveedores);
    const base = {
      ...f,
      proveedor_id: proveedor?.id ?? null, proveedor_nombre: proveedor?.nombre ?? null,
      existente_id: null as number | null, rubro_automatico: manual === undefined,
    };
    if (omitido) return { ...base, accion: 'OMITIDO' as Accion, rubro_id: null, rubro_nombre: null };

    if (f.hoja === 'EXTRAS') {
      const ex = extraPorClave.get(f.clave);
      return { ...base, accion: (ex ? 'ACTUALIZAR' : 'CREAR') as Accion, existente_id: ex?.id ?? null, rubro_id: null, rubro_nombre: null };
    }

    let rubro: { id: number; nombre: string } | null;
    if (f.hoja === 'RRHH') rubro = rubroRRHH;
    else if (manual !== undefined) rubro = rubroPorId.get(Number(manual)) ?? null;
    else rubro = matchRubro([f.descripcion], rubrosCosto) ?? defecto;
    const automatico = manual === undefined && f.hoja === 'COSTOS' && rubro !== null && rubro !== defecto;

    const existente = movPorClave.get(f.clave);
    if (existente) {
      return { ...base, accion: 'ACTUALIZAR' as Accion, existente_id: existente.id, rubro_id: rubro?.id ?? existente.rubro_id, rubro_nombre: rubro?.nombre ?? null, rubro_automatico: automatico };
    }
    if (!rubro) return { ...base, accion: 'SIN_RUBRO' as Accion, rubro_id: null, rubro_nombre: null, rubro_automatico: false };

    const ficha = fichaPorRubro.get(rubro.id);
    if (ficha && !fichaRepetida.has(rubro.id) && !fichaUsada.has(ficha.id)) {
      fichaUsada.add(ficha.id);
      return { ...base, accion: 'COMPLETAR_FICHA' as Accion, existente_id: ficha.id, rubro_id: rubro.id, rubro_nombre: rubro.nombre, rubro_automatico: automatico };
    }
    return { ...base, accion: 'CREAR' as Accion, rubro_id: rubro.id, rubro_nombre: rubro.nombre, rubro_automatico: automatico };
  });

  const contar = (a: Accion) => filas.filter(f => f.accion === a).length;
  const resumen = {
    crear:           contar('CREAR'),
    actualizar:      contar('ACTUALIZAR'),
    completar_ficha: contar('COMPLETAR_FICHA'),
    sin_rubro:       contar('SIN_RUBRO'),
    omitidas:        contar('OMITIDO'),
    sin_proveedor:   filas.filter(f => f.hoja !== 'EXTRAS' && f.accion !== 'OMITIDO' && f.responsable && !f.proveedor_id).length,
    con_advertencias: filas.filter(f => f.advertencias.length > 0).length,
  };

  const respuesta = {
    evento_planilla: parsed.evento_planilla,
    hojas:           parsed.hojas,
    filas,
    resumen,
    rubros:          rubrosCosto.map(r => ({ id: r.id, nombre: r.nombre })),
    falta_rubro_rrhh: !rubroRRHH && filas.some(f => f.hoja === 'RRHH'),
  };
  if (esPreview) { res.json(respuesta); return; }

  if (resumen.sin_rubro > 0) {
    res.status(400).json({ error: `Hay ${resumen.sin_rubro} línea(s) sin rubro: elegí uno o marcalas para no importar`, ...respuesta });
    return;
  }

  const userId = req.user!.id;
  const rubrosTocados = new Set<number>();

  await prisma.$transaction(async tx => {
    const ordenPorRubro = new Map<number, number>();
    const siguienteOrden = async (rubroId: number) => {
      if (!ordenPorRubro.has(rubroId)) {
        const last = await tx.movimiento.findFirst({
          where: { evento_id: evento.id, tipo: Tipo.EGRESO, rubro_id: rubroId, deleted_at: null },
          orderBy: { orden: 'desc' }, select: { orden: true },
        });
        ordenPorRubro.set(rubroId, last?.orden ?? 0);
      }
      const n = ordenPorRubro.get(rubroId)! + 1;
      ordenPorRubro.set(rubroId, n);
      return n;
    };
    let ordenExtra = (await tx.extraEvento.findFirst({
      where: { evento_id: evento.id, deleted_at: null }, orderBy: { orden: 'desc' }, select: { orden: true },
    }))?.orden ?? 0;

    for (const f of filas) {
      if (f.accion === 'OMITIDO' || f.accion === 'SIN_RUBRO') continue;

      // ── Extras ────────────────────────────────────────────────────────────
      if (f.hoja === 'EXTRAS') {
        const notas = [...f.notas, ...(f.comprobante ? [`Comprobante en la planilla: ${f.comprobante}`] : [])].join(' · ') || null;
        const data = {
          descripcion:  f.descripcion,
          responsable:  f.responsable,
          neto:         f.neto,
          iva:          f.iva,
          pagado:       f.pagado,
          plazo_pago:   f.plazo_pago,
          datos_cuenta: f.datos_cuenta,
          factura:      f.factura,
          notas,
          updated_by:   userId,
        };
        let extraId: number;
        if (f.existente_id) {
          await tx.extraEvento.update({ where: { id: f.existente_id }, data });
          extraId = f.existente_id;
        } else {
          const created = await tx.extraEvento.create({
            data: {
              ...data,
              empresa_id: evento.empresa_id, evento_id: evento.id, orden: ++ordenExtra,
              moneda: evento.moneda_base, a_cargo_cliente: true, import_key: f.clave, created_by: userId,
            },
          });
          extraId = created.id;
        }
        await sincronizarMovimientoExtra(tx, extraId, userId);
        continue;
      }

      // ── Costos y RRHH ─────────────────────────────────────────────────────
      const rubroId = f.rubro_id!;
      const actual = f.existente_id
        ? await tx.movimiento.findUnique({ where: { id: f.existente_id }, select: { estado_movimiento: true, rubro_id: true, proveedor_id: true } })
        : null;
      const yaPagado = actual?.estado_movimiento === EstadoMovimiento.PAGADO;
      const estado = yaPagado || f.pagado ? EstadoMovimiento.PAGADO : EstadoMovimiento.CONFIRMADO;
      const data = {
        concepto:          f.descripcion,
        descripcion:       textoNotas(f, !f.proveedor_id),
        debe:              f.total,
        haber:             0,
        iva:               f.iva > 0 ? f.iva : null,
        monto_ars:         evento.moneda_base === 'ARS' ? f.total : null,
        estado_movimiento: estado,
        plazo_pago:        f.plazo_pago,
        fecha_pago:        fechaUTC(f.fecha_pago),
        avisado_proveedor: f.avisado,
        import_key:        f.clave,
        updated_by:        userId,
      };

      let movId: number;
      if (actual) {
        await tx.movimiento.update({
          where: { id: f.existente_id! },
          data: {
            ...data,
            // El proveedor que ya se eligió a mano no se pisa con uno sin detectar
            proveedor_id: f.proveedor_id ?? actual.proveedor_id,
            rubro_id:     rubroId,
          },
        });
        movId = f.existente_id!;
        if (actual.rubro_id && actual.rubro_id !== rubroId) rubrosTocados.add(actual.rubro_id);
      } else {
        const created = await tx.movimiento.create({
          data: {
            ...data,
            evento_id:    evento.id,
            tipo:         Tipo.EGRESO,
            rubro_id:     rubroId,
            proveedor_id: f.proveedor_id,
            moneda:       evento.moneda_base,
            orden:        await siguienteOrden(rubroId),
            created_by:   userId,
          },
        });
        movId = created.id;
      }
      rubrosTocados.add(rubroId);

      // Seña de la planilla: se reemplaza el pago parcial importado antes
      if (!yaPagado) {
        await tx.pagoParcialMovimiento.updateMany({
          where: { movimiento_id: movId, deleted_at: null, nota: NOTA_PAGO_KM },
          data:  { deleted_at: new Date() },
        });
        if (estado !== EstadoMovimiento.PAGADO && f.pagado_parcial > 0) {
          await tx.pagoParcialMovimiento.create({
            data: { movimiento_id: movId, fecha: fechaUTC(f.fecha_pago) ?? new Date(), monto: f.pagado_parcial, nota: NOTA_PAGO_KM, created_by: userId },
          });
        }
      }
    }

    for (const rubroId of rubrosTocados) await recalcularSaldosRubro(evento.id, Tipo.EGRESO, rubroId, tx);

    await registrarAuditoria({
      usuarioId:   userId,
      empresaId:   req.empresaId,
      accion:      'IMPORT',
      entidad:     'Evento',
      entidadId:   evento.id,
      eventoId:    evento.id,
      descripcion: `Importó el centro de costos "${req.file!.originalname}": ${resumen.crear} líneas nuevas, ${resumen.actualizar} actualizadas, ${resumen.completar_ficha} completadas desde la Ficha${resumen.omitidas ? `, ${resumen.omitidas} sin importar` : ''}`,
      tx:          tx as Prisma.TransactionClient,
    });
  }, { timeout: 120_000 });

  res.json({ ...respuesta, importado: true });
}
