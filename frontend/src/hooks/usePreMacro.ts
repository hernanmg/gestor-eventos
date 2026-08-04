import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import type { PreMacro, PreMacroPayload, PreMacroBorrador, RubroConfirmado } from '@/types';

export const preMacroKey = (id: number) => ['pre-macro', id] as const;
export const PRE_MACRO_BORRADOR_KEY = ['pre-macro', 'borrador'] as const;

export function usePreMacro(id: number) {
  return useQuery<PreMacro>({
    queryKey: preMacroKey(id),
    queryFn:  () => api.get(`/pre-macro/${id}`).then(r => r.data),
    enabled:  !!id,
  });
}

export function usePreMacroBorrador(enabled = true) {
  return useQuery<PreMacroBorrador | null>({
    queryKey: PRE_MACRO_BORRADOR_KEY,
    queryFn:  () => api.get('/pre-macro/borrador').then(r => r.data),
    enabled,
  });
}

export function useCreatePreMacro() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return useMutation<PreMacro, Error, { nombre_evento?: string } | void>({
    mutationFn: (data) => api.post('/pre-macro', data ?? {}).then(r => r.data),
    onSuccess: (preMacro) => {
      qc.invalidateQueries({ queryKey: PRE_MACRO_BORRADOR_KEY });
      navigate(`/pre-macro/${preMacro.id}`);
    },
  });
}

export function useUpdatePreMacro(id: number) {
  const qc = useQueryClient();
  return useMutation<PreMacro, Error, PreMacroPayload>({
    mutationFn: (data) => api.put(`/pre-macro/${id}`, data).then(r => r.data),
    onSuccess: (preMacro) => {
      qc.setQueryData(preMacroKey(id), preMacro);
      qc.invalidateQueries({ queryKey: PRE_MACRO_BORRADOR_KEY });
    },
  });
}

export function useUpdateRubros(id: number) {
  const qc = useQueryClient();
  return useMutation<PreMacro, Error, RubroConfirmado[]>({
    mutationFn: (rubros) => api.put(`/pre-macro/${id}/rubros`, { rubros }).then(r => r.data),
    onSuccess: (preMacro) => qc.setQueryData(preMacroKey(id), preMacro),
  });
}

export function useDiscardPreMacro() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, number>({
    mutationFn: (id) => api.delete(`/pre-macro/${id}`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: PRE_MACRO_BORRADOR_KEY }),
  });
}

export function useConfirmarPreMacro(id: number) {
  const qc = useQueryClient();
  return useMutation<{ evento_id: number }, Error, void>({
    mutationFn: () => api.post(`/pre-macro/${id}/confirmar`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eventos'] });
      qc.invalidateQueries({ queryKey: PRE_MACRO_BORRADOR_KEY });
    },
  });
}
