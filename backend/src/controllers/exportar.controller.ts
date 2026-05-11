import type { Request, Response } from 'express';
import { generateExcel } from '../lib/excelExporter';
import { generatePDF }   from '../lib/pdfExporter';

export async function exportarExcel(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const tab      = typeof req.query.tab === 'string' ? req.query.tab : undefined;

  const { buffer, filename } = await generateExcel(eventoId, tab);

  res.set({
    'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length':      String(buffer.length),
  });
  res.end(buffer);
}

export async function exportarPDF(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const seccion  = typeof req.query.seccion === 'string' ? req.query.seccion : undefined;

  const { buffer, filename } = await generatePDF(eventoId, seccion);

  res.set({
    'Content-Type':        'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length':      String(buffer.length),
  });
  res.end(buffer);
}
