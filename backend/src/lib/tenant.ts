// Helper para asegurar que siempre se filtra por empresa activa.
// Uso: prisma.evento.findMany({ where: { ...withTenant(req.empresaId!), deleted_at: null } })
export const withTenant = (empresaId: number) => ({ empresa_id: empresaId });
