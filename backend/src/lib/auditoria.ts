import type { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

// Both PrismaClient and TransactionClient satisfy this interface
type AuditTx = PrismaClient | Prisma.TransactionClient;

export interface AuditoriaParams {
  usuarioId:     number | null;
  accion:        string;
  entidad:       string;
  entidadId?:    number;
  eventoId?:     number;
  descripcion:   string;
  datosAntes?:   object;
  datosDespues?: object;
  ip?:           string;
  tx:            AuditTx;
}

export async function registrarAuditoria(p: AuditoriaParams): Promise<void> {
  try {
    await (p.tx as any).auditoriaLog.create({
      data: {
        usuario_id:    p.usuarioId,
        accion:        p.accion,
        entidad:       p.entidad,
        entidad_id:    p.entidadId    ?? null,
        evento_id:     p.eventoId     ?? null,
        descripcion:   p.descripcion,
        datos_antes:   (p.datosAntes   as any) ?? undefined,
        datos_despues: (p.datosDespues as any) ?? undefined,
        ip:            p.ip           ?? null,
      },
    });
  } catch {
    // Audit log failure must not break the main operation
  }
}
