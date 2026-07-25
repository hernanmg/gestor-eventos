import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { MacroFiltros, MacroResponse } from '@/types';
import type { MovimientoUpdatePayload } from '@/hooks/useMovimientos';

const MACRO_KEY = ['macro', 'movimientos'] as const;

function toParams(filtros: MacroFiltros): Record<string, string> {
  const params: Record<string, string> = {};
  if (filtros.empresa_id        !== undefined) params.empresa_id        = String(filtros.empresa_id);
  if (filtros.evento_id         !== undefined) params.evento_id         = String(filtros.evento_id);
  if (filtros.rubro_id          !== undefined) params.rubro_id          = String(filtros.rubro_id);
  if (filtros.tipo              !== undefined) params.tipo              = filtros.tipo;
  if (filtros.estado            !== undefined) params.estado            = filtros.estado;
  if (filtros.responsable_id    !== undefined) params.responsable_id    = String(filtros.responsable_id);
  if (filtros.proveedor_id      !== undefined) params.proveedor_id      = String(filtros.proveedor_id);
  if (filtros.desde)                           params.desde             = filtros.desde;
  if (filtros.hasta)                           params.hasta             = filtros.hasta;
  if (filtros.con_presupuesto)                 params.con_presupuesto   = 'true';
  if (filtros.avisado_proveedor)                params.avisado_proveedor = 'true';
  if (filtros.page               !== undefined) params.page             = String(filtros.page);
  if (filtros.limit              !== undefined) params.limit            = String(filtros.limit);
  if (filtros.sort               !== undefined) params.sort             = filtros.sort;
  if (filtros.order              !== undefined) params.order            = filtros.order;
  return params;
}

export function useMacroMovimientos(filtros: MacroFiltros) {
  return useQuery<MacroResponse>({
    queryKey:  [...MACRO_KEY, filtros],
    queryFn:   () => api.get('/movimientos', { params: toParams(filtros) }).then(r => r.data),
    staleTime: 2 * 60 * 1000,
  });
}

export function useUpdateMovimientoMacro() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, { id: number; data: MovimientoUpdatePayload }>({
    mutationFn: ({ id, data }) => api.put(`/movimientos/${id}`, data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: MACRO_KEY }),
  });
}

export function useExportarMacro() {
  const [isExporting, setIsExporting] = useState(false);

  const exportar = useCallback(async (filtros: MacroFiltros) => {
    setIsExporting(true);
    try {
      const { page: _page, limit: _limit, ...filtrosSinPaginar } = filtros;
      const response = await api.get('/movimientos/exportar', {
        params:      toParams(filtrosSinPaginar),
        responseType: 'blob',
      });
      const cd       = (response.headers['content-disposition'] as string | undefined) ?? '';
      const filename = cd.match(/filename="([^"]+)"/)?.[1] ?? 'macro.xlsx';
      const url      = URL.createObjectURL(new Blob([response.data as BlobPart]));
      const a        = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportar, isExporting };
}
