import type { ModalidadEvento } from '@/types';
import { EMPRESAS } from './empresasConstants';

// Modalidades de evento por empresa — espejo de MODALIDADES_POR_EMPRESA en
// backend/src/controllers/eventos.controller.ts. La primera es el default.
export interface OpcionModalidad { value: ModalidadEvento; label: string; corto: string; detalle: string }

const FLUJO_CAJA: OpcionModalidad = {
  value: 'FLUJO_CAJA', label: 'Flujo de caja completo', corto: 'Flujo de caja completo',
  detalle: 'Egresos, ingresos, caja, echeqs y conciliatoria.',
};

export const MODALIDADES_POR_EMPRESA: Record<number, OpcionModalidad[]> = {
  [EMPRESAS.ENJOY]: [
    { value: 'CENTRO_COSTOS', label: 'Centro de costos (eventos chicos/medianos)', corto: 'Centro de costos',
      detalle: 'Costos, RRHH y Extras, sin caja ni ingresos. Para la mayoría de los eventos.' },
    { ...FLUJO_CAJA, label: 'Flujo de caja completo (TC, Lecap, Monster)', detalle: `${FLUJO_CAJA.detalle} Para los eventos grandes (TC, Lecap, Monster).` },
  ],
  [EMPRESAS.DOS57]: [
    { value: 'OPERATIVA', label: 'Operativa (costo real)', corto: 'Operativa (costo real)',
      detalle: 'La matriz de costo real (personal, alojamiento, comidas, combustible, rental, pérdidas) con Caja, Facturas y A cobrar; sin ingresos, conciliatoria ni echeqs.' },
    FLUJO_CAJA,
  ],
};

/** null = la empresa no elige (siempre flujo de caja) */
export function modalidadesDe(empresaId: number | null | undefined): OpcionModalidad[] | null {
  return (empresaId != null && MODALIDADES_POR_EMPRESA[empresaId]) || null;
}
