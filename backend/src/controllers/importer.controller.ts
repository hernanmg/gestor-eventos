import type { Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { EstadoEvento, Tipo, Moneda } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { parseExcelFile } from '../lib/excelParser';
import { recalcularSaldos } from '../lib/recalcularSaldos';

// ── Multer ────────────────────────────────────────────────────────────────────

export const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isXlsx =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.originalname.toLowerCase().endsWith('.xlsx');
    if (isXlsx) cb(null, true);
    else cb(new Error('Solo se aceptan archivos .xlsx'));
  },
});

// ── Preview ───────────────────────────────────────────────────────────────────

export async function preview(req: Request, res: Response) {
  if (!req.file) {
    res.status(400).json({ error: 'Se requiere un archivo .xlsx' }); return;
  }
  try {
    const result = parseExcelFile(req.file.buffer, req.file.originalname);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: 'Error al procesar el archivo', detail: err.message });
  }
}

// ── Confirmar schema ──────────────────────────────────────────────────────────

const movimientoSchema = z.object({
  fila_excel:            z.number(),
  fecha:                 z.string().nullable(),
  concepto:              z.string().nullable(),
  descripcion:           z.string().nullable(),
  debe:                  z.number(),
  haber:                 z.number(),
  impuesto_subcategoria: z.string().nullable().optional(),
  errores:               z.array(z.string()),
});

const echeqPreviewSchema = z.object({
  fila_excel:           z.number(),
  numero:               z.string(),
  razon_social:         z.string(),
  detalle:              z.string().nullable(),
  importe:              z.number(),
  fecha_emision:        z.string().nullable(),
  fecha_cobro_estimada: z.string().nullable(),
});

const hojaSchema = z.object({
  codigo:      z.string(),
  tipo:        z.enum(['EGRESO', 'INGRESO']),
  tab_numero:  z.number(),
  movimientos: z.array(movimientoSchema),
  echeqs:      z.array(echeqPreviewSchema).optional(),
});

const confirmarSchema = z.object({
  evento: z.object({
    nombre:       z.string().min(1),
    fecha_inicio: z.string().nullable().optional(),
    fecha_fin:    z.string().nullable().optional(),
    moneda_base:  z.enum(['ARS', 'USD']).default('ARS'),
    socios:       z.array(z.object({
      nombre:     z.string(),
      porcentaje: z.number(),
    })).default([]),
  }),
  hojas: z.array(hojaSchema),
});

// ── Confirmar ─────────────────────────────────────────────────────────────────

export async function confirmar(req: Request, res: Response) {
  const parsed = confirmarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten() }); return;
  }

  const { evento: eventoData, hojas } = parsed.data;

  let movimientosCreados = 0;
  let echeqsCreados      = 0;
  let filasOmitidas      = 0;

  const eventoId = await prisma.$transaction(async tx => {
    const evento = await tx.evento.create({
      data: {
        nombre:       eventoData.nombre,
        estado:       EstadoEvento.IMPORTADO,
        moneda_base:  eventoData.moneda_base as Moneda,
        socios:       eventoData.socios,
        fecha_inicio: eventoData.fecha_inicio ? new Date(eventoData.fecha_inicio) : null,
        fecha_fin:    eventoData.fecha_fin    ? new Date(eventoData.fecha_fin)    : null,
        created_by:   req.user!.id,
        updated_by:   req.user!.id,
      },
    });

    for (const hoja of hojas) {
      const importables = hoja.movimientos.filter(m => m.errores.length === 0);
      filasOmitidas += hoja.movimientos.filter(m => m.errores.length > 0).length;

      for (let idx = 0; idx < importables.length; idx++) {
        const m = importables[idx];
        await tx.movimiento.create({
          data: {
            evento_id:             evento.id,
            tipo:                  hoja.tipo as Tipo,
            tab_numero:            hoja.tab_numero,
            fecha:                 m.fecha       ? new Date(m.fecha)       : null,
            concepto:              m.concepto,
            descripcion:           m.descripcion,
            debe:                  m.debe,
            haber:                 m.haber,
            moneda:                eventoData.moneda_base as Moneda,
            orden:                 idx + 1,
            saldo:                 0,
            impuesto_subcategoria: m.impuesto_subcategoria ?? null,
            created_by:            req.user!.id,
            updated_by:            req.user!.id,
          },
        });
        movimientosCreados++;
      }

      if (importables.length > 0) {
        await recalcularSaldos(evento.id, hoja.tipo as Tipo, hoja.tab_numero, tx);
      }
    }

    const egExtra = hojas.find(h => h.codigo === 'EG-EXTRA');
    if (egExtra?.echeqs) {
      for (const echeq of egExtra.echeqs) {
        await tx.echeq.create({
          data: {
            evento_id:            evento.id,
            numero:               echeq.numero,
            razon_social:         echeq.razon_social,
            detalle:              echeq.detalle,
            importe:              echeq.importe,
            moneda:               eventoData.moneda_base as Moneda,
            fecha_emision:        echeq.fecha_emision        ? new Date(echeq.fecha_emision)        : null,
            fecha_cobro_estimada: echeq.fecha_cobro_estimada ? new Date(echeq.fecha_cobro_estimada) : null,
            created_by:           req.user!.id,
            updated_by:           req.user!.id,
          },
        });
        echeqsCreados++;
      }
    }

    return evento.id;
  });

  res.status(201).json({
    evento_id: eventoId,
    stats: {
      movimientos_creados: movimientosCreados,
      echeqs_creados:      echeqsCreados,
      filas_omitidas:      filasOmitidas,
    },
  });
}
