import type { Request, Response } from 'express';
import { generateExcel } from '../lib/excelExporter';
import { generatePDF }   from '../lib/pdfExporter';
import { registrarAuditoria } from '../lib/auditoria';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';

export async function exportarExcel(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const tab      = typeof req.query.tab === 'string' ? req.query.tab : undefined;

  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const { buffer, filename } = await generateExcel(eventoId, tab);

  await registrarAuditoria({
    usuarioId:    req.user!.id,
    empresaId:    req.empresaId,
    accion:       'EXPORT',
    entidad:      'Evento',
    entidadId:    eventoId,
    eventoId,
    descripcion:  `Exportó Excel del evento #${eventoId}${tab ? ` (tab: ${tab})` : ''}`,
    datosDespues: { formato: 'excel', tab: tab ?? null },
    ip:           req.ip,
    tx:           prisma as any,
  });

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

  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const { buffer, filename } = await generatePDF(eventoId, seccion);

  await registrarAuditoria({
    usuarioId:    req.user!.id,
    empresaId:    req.empresaId,
    accion:       'EXPORT',
    entidad:      'Evento',
    entidadId:    eventoId,
    eventoId,
    descripcion:  `Exportó PDF del evento #${eventoId}${seccion ? ` (sección: ${seccion})` : ''}`,
    datosDespues: { formato: 'pdf', seccion: seccion ?? null },
    ip:           req.ip,
    tx:           prisma as any,
  });

  res.set({
    'Content-Type':        'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length':      String(buffer.length),
  });
  res.end(buffer);
}
