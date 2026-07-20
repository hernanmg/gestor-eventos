import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getApiErrorMessage(error: unknown): string {
  if (!error) return 'Error inesperado';
  const e = error as { response?: { data?: { error?: string } } };
  if (e?.response?.data?.error) return e.response.data.error;
  if (error instanceof Error) return error.message;
  return 'Error inesperado';
}

// Extrae los errores por campo de una respuesta 400 de Zod
// (`{ error, detail: { campo: ['mensaje', ...] } }`), para mostrarlos debajo
// del input correspondiente en vez de un mensaje genérico. Devuelve null si
// la respuesta no trae errores por campo (ej. un 404, o un error de negocio
// sin `detail`).
export function getApiFieldErrors(error: unknown): Record<string, string> | null {
  const e = error as { response?: { data?: { detail?: Record<string, string[] | undefined> } } };
  const detail = e?.response?.data?.detail;
  if (!detail) return null;
  const fieldErrors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(detail)) {
    if (messages && messages.length > 0) fieldErrors[field] = messages[0];
  }
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : null;
}
