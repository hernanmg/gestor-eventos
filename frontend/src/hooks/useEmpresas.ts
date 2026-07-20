import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Empresa, EmpresaActual, EmpresaUpdatePayload } from '@/types';

const KEY        = ['empresas'];
const ACTUAL_KEY = ['empresa', 'actual'];

// ── Cross-tenant (admin global) ───────────────────────────────────────────────

export function useEmpresas() {
  return useQuery<Empresa[]>({
    queryKey: KEY,
    queryFn:  () => api.get('/empresas').then(r => r.data),
  });
}

export function useEmpresa(id: number | null) {
  return useQuery<Empresa>({
    queryKey: [...KEY, id],
    queryFn:  () => api.get(`/empresas/${id}`).then(r => r.data),
    enabled:  id !== null,
  });
}

export function useUpdateEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: EmpresaUpdatePayload }) =>
      api.put<Empresa>(`/empresas/${id}`, data).then(r => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, vars.id] });
      qc.invalidateQueries({ queryKey: ACTUAL_KEY });
    },
  });
}

export function useUploadLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => {
      const formData = new FormData();
      formData.append('logo', file);
      return api.put(`/empresas/${id}/logo`, formData).then(r => r.data);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, vars.id] });
      qc.invalidateQueries({ queryKey: ACTUAL_KEY });
    },
  });
}

export function logoUrl(empresaId: number): string {
  const base = api.defaults.baseURL ?? '';
  return `${base}/empresas/${empresaId}/logo`;
}

// Fetch con blob — mismo patrón que el PDF de facturas. Devuelve una object
// URL que se revoca automáticamente al desmontar o al cambiar de empresa/logo.
export function useLogoBlobUrl(empresaId: number | null | undefined, hasLogo: boolean): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!empresaId || !hasLogo) { setUrl(null); return; }
    let objectUrl: string | null = null;
    let cancelled = false;

    api.get(`/empresas/${empresaId}/logo`, { responseType: 'blob' }).then(res => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(res.data);
      setUrl(objectUrl);
    }).catch(() => { if (!cancelled) setUrl(null); });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [empresaId, hasLogo]);

  return url;
}

// ── Tenant activo ──────────────────────────────────────────────────────────────

export function useEmpresaActual(enabled = true) {
  return useQuery<EmpresaActual>({
    queryKey:  ACTUAL_KEY,
    queryFn:   () => api.get('/empresa/actual').then(r => r.data),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}
