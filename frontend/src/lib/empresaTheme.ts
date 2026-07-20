const DEFAULT_PRIMARIO   = '#1E3A5F';
const DEFAULT_SECUNDARIO = '#2E6DA4';

// Aplica los colores de marca de la empresa activa como CSS variables en :root.
// Llamar al login, al refrescar /auth/me y al cambiar de empresa.
export function applyEmpresaTheme(colorPrimario?: string | null, colorSecundario?: string | null): void {
  const root = document.documentElement;
  root.style.setProperty('--color-empresa',             colorPrimario   || DEFAULT_PRIMARIO);
  root.style.setProperty('--color-empresa-secundario',  colorSecundario || DEFAULT_SECUNDARIO);
}
