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
