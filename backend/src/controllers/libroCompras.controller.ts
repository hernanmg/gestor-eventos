import type { Request, Response } from 'express';
import type { Prisma, Moneda } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';
import { convertirARS } from '../lib/convertirARS';
import {
  parseLibroCompras, esNotaCredito, formatCuit,
  type FilaLibroCompras, type ErrorFilaLibro,
} from '../lib/libroComprasImporter';

// Umbral de la hoja "Faltantes más de $500.000" — también lo usa la notificación
// "Factura sin PDF" (notificaciones.controller.ts).
export const UMBRAL_FACTURA_SIN_PDF = 500_000;

const esTrue = (s: string | null) => !!s && ['si', 'sí', 'x', 'true', 'verdadero', '1'].includes(s.trim().toLowerCase());

// El unique de Proveedor.cuit es global (no por empresa) y las cargas manuales
// lo guardan con guiones (XX-XXXXXXXX-X) — se busca en ambos formatos.
const variantesCuit = (digitos: string) => [digitos, formatCuit(digitos)];

interface FacturaResumen {
  proveedor:  string;
  total:      number;
  moneda:     string;
  tiene_pdf:  boolean;
}

// POST /api/facturas/importar-libro-compras?preview=true|false
// preview=true (default): procesa todo sin escribir. preview=false: aplica.
export async function importarLibroCompras(req: Request, res: Response) {
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo .xlsx' }); return; }
  const dryRun    = req.query.preview !== 'false';
  const empresaId = req.empresaId!;
  const userId    = req.user!.id;

  let filas: FilaLibroCompras[];
  let errores: ErrorFilaLibro[];
  try {
    ({ filas, errores } = parseLibroCompras(req.file.buffer));
  } catch (err: any) {
    res.status(400).json({ error: 'Error al procesar el archivo', detail: err.message }); return;
  }

  // ── Datos de referencia (lectura, fuera de la transacción) ──────────────────
  const cuits = [...new Set(filas.map(f => f.proveedor_cuit).filter((c): c is string => !!c))];
  const proveedoresDB = cuits.length
    ? await prisma.proveedor.findMany({
        where:  { cuit: { in: cuits.flatMap(variantesCuit) } },
        select: { id: true, cuit: true, empresa_id: true, deleted_at: true },
      })
    : [];
  const proveedorPorCuit = new Map(proveedoresDB.map(p => [p.cuit!.replace(/\D/g, ''), p]));

  const textosEvento = [...new Set(filas.map(f => f.evento_texto).filter((t): t is string => !!t))];
  const eventosPorTexto = new Map<string, { id: number; nombre: string }[]>();
  for (const texto of textosEvento) {
    eventosPorTexto.set(texto, await prisma.evento.findMany({
      where:  { ...withTenant(empresaId), deleted_at: null, nombre: { contains: texto, mode: 'insensitive' } },
      select: { id: true, nombre: true },
    }));
  }

  // ── Resultado ───────────────────────────────────────────────────────────────
  let creadas = 0, actualizadas = 0, duplicadas_en_archivo = 0, vinculadas_a_evento = 0, faltantes_marcadas = 0, sin_texto_evento = 0;
  const proveedores_creados: { nombre: string; cuit: string }[] = [];
  const sin_evento: { proveedor: string; total: number; texto_evento: string }[] = [];
  const resumenPorFactura = new Map<string, FacturaResumen>();
  // Cache de la corrida: id real, o null si el proveedor se crearía (preview) / no se pudo vincular.
  const proveedorPorCuitCorrida = new Map<string, { id: number | null; nuevo: boolean; aviso: string | null }>();

  const procesar = async (db: Prisma.TransactionClient) => {
    for (const f of filas) {
      const errFila = (motivo: string) => errores.push({ hoja: f.hoja, fila_excel: f.fila_excel, motivo });
      const notas: string[] = [];

      // ── Proveedor: por CUIT; si no existe se crea con nombre y CUIT del Excel ──
      let proveedorId: number | null = null;
      let proveedorNuevoEnPreview = false;
      if (!f.proveedor_cuit) {
        notas.push(`Vendedor sin CUIT válido en el libro: ${f.proveedor_nombre}`);
      } else {
        let entrada = proveedorPorCuitCorrida.get(f.proveedor_cuit);
        if (!entrada) {
          const existenteProv = proveedorPorCuit.get(f.proveedor_cuit);
          if (existenteProv && existenteProv.empresa_id === empresaId && !existenteProv.deleted_at) {
            entrada = { id: existenteProv.id, nuevo: false, aviso: null };
          } else if (existenteProv) {
            const aviso = `El CUIT ${formatCuit(f.proveedor_cuit)} ya está registrado como proveedor ${existenteProv.deleted_at ? 'eliminado' : 'de otra empresa'}; la factura queda sin proveedor`;
            entrada = { id: null, nuevo: false, aviso };
          } else {
            proveedores_creados.push({ nombre: f.proveedor_nombre, cuit: formatCuit(f.proveedor_cuit) });
            let id: number | null = null;
            if (!dryRun) {
              id = (await db.proveedor.create({
                data: {
                  ...withTenant(empresaId),
                  nombre: f.proveedor_nombre,
                  cuit:   formatCuit(f.proveedor_cuit),
                  created_by: userId, updated_by: userId,
                },
              })).id;
            }
            entrada = { id, nuevo: true, aviso: null };
          }
          proveedorPorCuitCorrida.set(f.proveedor_cuit, entrada);
        }
        proveedorId = entrada.id;
        proveedorNuevoEnPreview = dryRun && entrada.nuevo;
        if (entrada.aviso) {
          errFila(entrada.aviso);
          notas.push(`Proveedor Excel: ${f.proveedor_nombre} (${formatCuit(f.proveedor_cuit)}) — no se pudo vincular`);
        }
      }

      // ── Evento: nombre que contenga el texto de la columna EVENTO ───────────
      let eventoId: number | null = null;
      if (f.evento_texto) {
        const candidatos = eventosPorTexto.get(f.evento_texto) ?? [];
        if (candidatos.length === 1) {
          eventoId = candidatos[0].id;
        } else {
          const motivo = candidatos.length === 0 ? 'sin coincidencia' : `${candidatos.length} coincidencias`;
          notas.push(`Evento (Excel): "${f.evento_texto}" — ${motivo}, vincular manualmente`);
          sin_evento.push({ proveedor: f.proveedor_nombre, total: f.total, texto_evento: f.evento_texto });
        }
      } else if (f.hoja === 'PRINCIPAL') {
        sin_texto_evento++;
      }

      // ── Comprobante / PDF ───────────────────────────────────────────────────
      const esPdf = !!f.pdf_texto && /\.pdf$/i.test(f.pdf_texto.trim());
      if (f.pdf_texto && !esPdf) notas.push(`Detalle AFIP: ${f.pdf_texto}`);
      if (f.comprobantes_pago) notas.push(`Comprobantes de pago: ${f.comprobantes_pago}`);

      const esFaltante = f.hoja === 'FALTANTES';
      const tipoClave  = f.tipo_comprobante ?? f.tipo_factura;
      const claveFactura = `${f.proveedor_cuit ?? f.proveedor_nombre}|${f.numero_factura}|${f.fecha.toISOString().slice(0, 10)}|${tipoClave}`;

      // Mismo comprobante repetido dentro del archivo (AFIP a veces lo lista dos veces).
      const previa = resumenPorFactura.get(claveFactura);
      if (previa && !esFaltante) { duplicadas_en_archivo++; continue; }

      // ── Factura existente (dedupe contra la DB) ─────────────────────────────
      const existente = proveedorNuevoEnPreview
        ? null // preview: el proveedor todavía no existe, no puede haber factura previa en la DB
        : await db.factura.findFirst({
            where: {
              ...withTenant(empresaId), deleted_at: null,
              numero_factura: f.numero_factura,
              fecha_emision:  f.fecha,
              proveedor_id:   proveedorId,
              tipo_comprobante: f.tipo_comprobante,
              ...(f.tipo_comprobante === null && { tipo_factura: f.tipo_factura }),
            },
          });

      const tasa   = f.moneda === 'ARS' ? null : f.tipo_cambio;
      const montos = {
        neto_gravado: f.neto_gravado, no_gravado: f.no_gravado, exento: f.exento, iva_importe: f.iva,
      };

      if (esFaltante && (existente || previa)) {
        // Ya viene de la hoja principal: sólo se marca como comprobante faltante.
        faltantes_marcadas++;
        if (existente && !dryRun) {
          await db.factura.update({
            where: { id: existente.id },
            data: {
              tiene_comprobante_fisico: false,
              ...(existente.pdf_data ? {} : { tiene_pdf: false }),
              updated_by: userId,
            },
          });
        }
        resumenPorFactura.set(claveFactura, { ...(previa ?? { proveedor: f.proveedor_nombre, total: f.total, moneda: f.moneda, tiene_pdf: false }), tiene_pdf: !!existente?.pdf_data });
        continue;
      }

      if (existente) {
        actualizadas++;
        const nuevoEvento = existente.evento_id === null && eventoId !== null;
        if (nuevoEvento) vinculadas_a_evento++;
        if (!dryRun) {
          await db.factura.update({
            where: { id: existente.id },
            data: {
              ...montos,
              tipo_factura: f.tipo_factura, tipo_comprobante: f.tipo_comprobante,
              tiene_pdf:       existente.pdf_data ? true : esPdf,
              pdf_nombre_afip: esPdf ? f.pdf_texto!.trim() : existente.pdf_nombre_afip,
              tiene_comprobante_fisico: existente.tiene_comprobante_fisico || esTrue(f.fisica),
              origen_import:   existente.origen_import ?? 'AFIP',
              // No se pisa lo cargado a mano: sólo se completan proveedor/evento/notas vacíos.
              ...(existente.proveedor_id === null && proveedorId !== null && { proveedor_id: proveedorId }),
              ...(nuevoEvento && { evento_id: eventoId }),
              ...(existente.notas === null && notas.length > 0 && { notas: notas.join(' | ') }),
              updated_by: userId,
            },
          });
        }
        resumenPorFactura.set(claveFactura, { proveedor: f.proveedor_nombre, total: f.total, moneda: f.moneda, tiene_pdf: !!existente.pdf_data || esPdf });
        continue;
      }

      if (esFaltante) notas.push('Importada desde la hoja "Faltantes" (sin desglose de IVA ni moneda; se asumió ARS)');
      creadas++;
      if (eventoId !== null) vinculadas_a_evento++;
      if (!dryRun) {
        await db.factura.create({
          data: {
            ...withTenant(empresaId),
            numero_factura:   f.numero_factura,
            tipo_factura:     f.tipo_factura,
            tipo_comprobante: f.tipo_comprobante,
            fecha_emision:    f.fecha,
            proveedor_id:     proveedorId,
            evento_id:        eventoId,
            importe_total:    f.total,
            // Una nota de crédito no es deuda: nace sin saldo pendiente.
            importe_pendiente: esNotaCredito(f.tipo_comprobante) ? 0 : f.total,
            moneda:           f.moneda as Moneda,
            tasa_cambio:      tasa,
            monto_ars:        convertirARS(f.total, f.moneda as Moneda, tasa),
            ...montos,
            tiene_pdf:        esPdf,
            pdf_nombre_afip:  esPdf ? f.pdf_texto!.trim() : null,
            tiene_comprobante_fisico: !esFaltante && esTrue(f.fisica),
            origen_import:    'AFIP',
            notas:            notas.length ? notas.join(' | ') : null,
            created_by: userId, updated_by: userId,
          },
        });
      }
      resumenPorFactura.set(claveFactura, { proveedor: f.proveedor_nombre, total: f.total, moneda: f.moneda, tiene_pdf: esPdf });
    }
  };

  try {
    if (dryRun) {
      await procesar(prisma as unknown as Prisma.TransactionClient);
    } else {
      await prisma.$transaction(async tx => {
        await procesar(tx);
        await registrarAuditoria({
          usuarioId: userId, empresaId, accion: 'CREATE', entidad: 'Factura',
          descripcion: `Importó el libro de compras AFIP — ${creadas} creadas, ${actualizadas} actualizadas, ${proveedores_creados.length} proveedores nuevos`,
          ip: req.ip, tx: tx as any,
        });
      }, { timeout: 120_000, maxWait: 10_000 });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Error al importar el libro de compras', detail: err.message }); return;
  }

  const sin_pdf = [...resumenPorFactura.values()]
    .filter(r => !r.tiene_pdf)
    .map(r => ({ proveedor: r.proveedor, total: r.total }));

  res.json({
    preview: dryRun,
    total_filas: filas.length,
    creadas, actualizadas, duplicadas_en_archivo, vinculadas_a_evento, faltantes_marcadas, sin_texto_evento,
    proveedores_creados, sin_evento, sin_pdf, errores,
  });
}
