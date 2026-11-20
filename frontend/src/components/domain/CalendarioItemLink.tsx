import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getDetailLink } from '@/lib/calendarioItems';
import type { CalendarioItem } from '@/types';

// Link al detalle de un ítem del calendario. El calendario y la Macro muestran
// las dos empresas al admin global, pero las pantallas de destino (Flota,
// Caja, Cheques…) leen la empresa activa de la sesión: si el ítem es de la otra
// empresa, primero se cambia la empresa activa y después se navega. Si no, el
// link abre un vehículo/caja que "no existe" (404) en la empresa equivocada.
export default function CalendarioItemLink({ item, className, children }: {
  item: CalendarioItem; className?: string; children: ReactNode;
}) {
  const { user, switchEmpresa, isSwitchingEmpresa } = useAuth();
  const to = getDetailLink(item);
  const otraEmpresa = !!user?.puedeCambiarEmpresa && !!item.empresa_id && item.empresa_id !== user.empresaId;

  if (!otraEmpresa) return <Link to={to} className={className}>{children}</Link>;

  return (
    <a
      href={to}
      className={className}
      title={`Cambia la empresa activa a ${item.empresa_nombre}`}
      aria-disabled={isSwitchingEmpresa}
      onClick={e => {
        e.preventDefault();
        if (!isSwitchingEmpresa) switchEmpresa({ empresaId: item.empresa_id, to });
      }}
    >
      {children}
    </a>
  );
}
