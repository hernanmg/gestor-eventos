import { useSyncExternalStore } from 'react';

// Tema claro/oscuro — por navegador, en localStorage. Se aplica como clase
// "dark" en <html> (tailwind.config: darkMode 'class'); las variables de
// index.css (.dark) y los overrides de grises/pasteles hacen el resto.

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'erp-theme';
const listeners = new Set<() => void>();

export function getStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light'; // localStorage bloqueado (modo privado estricto, etc.)
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function setTheme(theme: Theme): void {
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* sin persistencia, igual se aplica */ }
  applyTheme(theme);
  listeners.forEach(l => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function useTheme(): [Theme, () => void] {
  const theme = useSyncExternalStore(subscribe, getSnapshot);
  return [theme, () => setTheme(theme === 'dark' ? 'light' : 'dark')];
}
