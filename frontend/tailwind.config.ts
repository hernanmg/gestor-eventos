import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';
import twColors from 'tailwindcss/colors';

// ── Modo oscuro sobre clases de color fijas ───────────────────────────────────
// La mayoría de la UI usa tokens (bg-background, text-foreground…) que ya
// cambian con .dark, pero quedan ~250 bg-white/bg-gray-* y ~500 pasteles de
// estado (bg-red-50 text-red-700…) escritos a mano en las pantallas. En vez de
// agregar dark:… en cada archivo, se reasignan acá una sola vez bajo .dark:
//   - blancos/grises → la escala neutra de index.css (--bg-card, etc.)
//   - pasteles -50/-100/-200 → el -500 del mismo color con alfa bajo (tinte)
//   - textos -600…-900 → el -300/-400 (legibles sobre negro)
// `.dark .x` (0,2,0) le gana a `.x` (0,1,0) sin importar el orden del CSS.
const PASTELES = ['red', 'green', 'blue', 'yellow', 'amber', 'orange', 'emerald', 'purple',
  'indigo', 'sky', 'teal', 'rose', 'violet', 'lime', 'pink', 'cyan', 'fuchsia'] as const;

function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const darkOverrides = plugin(({ addBase }) => {
  const rules: Record<string, Record<string, string>> = {
    '.dark .bg-white':                     { 'background-color': 'var(--bg-card)' },
    '.dark .bg-gray-50':                   { 'background-color': 'var(--bg-secondary)' },
    '.dark .bg-gray-50\\/50':              { 'background-color': 'rgba(255, 255, 255, 0.02)' },
    '.dark .bg-gray-50\\/70':              { 'background-color': 'rgba(255, 255, 255, 0.03)' },
    '.dark .bg-gray-100':                  { 'background-color': '#222222' },
    '.dark .bg-gray-200':                  { 'background-color': '#2D2D2D' },
    '.dark .bg-gray-300':                  { 'background-color': '#3A3A3A' },
    '.dark .hover\\:bg-gray-50:hover':     { 'background-color': 'var(--bg-hover)' },
    '.dark .hover\\:bg-gray-100:hover':    { 'background-color': '#2A2A2A' },
    '.dark .hover\\:bg-white\\/50:hover':  { 'background-color': 'rgba(255, 255, 255, 0.05)' },
    '.dark .text-gray-500':                { color: '#9CA3AF' },
    '.dark .text-gray-600':                { color: '#9CA3AF' },
    '.dark .text-gray-700':                { color: '#D1D5DB' },
    '.dark .text-gray-800':                { color: '#E5E7EB' },
    '.dark .text-gray-900':                { color: '#F3F4F6' },
    '.dark .border-gray-100':              { 'border-color': 'var(--border-color)' },
    '.dark .border-gray-200':              { 'border-color': 'var(--border-color)' },
    '.dark .border-gray-300':              { 'border-color': '#3A3A3A' },
  };
  for (const c of PASTELES) {
    const p = twColors[c] as Record<string, string>;
    rules[`.dark .bg-${c}-50`]                  = { 'background-color': rgba(p['500'], 0.10) };
    rules[`.dark .bg-${c}-100`]                 = { 'background-color': rgba(p['500'], 0.16) };
    rules[`.dark .bg-${c}-200`]                 = { 'background-color': rgba(p['500'], 0.24) };
    rules[`.dark .hover\\:bg-${c}-50:hover`]    = { 'background-color': rgba(p['500'], 0.14) };
    rules[`.dark .hover\\:bg-${c}-100:hover`]   = { 'background-color': rgba(p['500'], 0.20) };
    rules[`.dark .text-${c}-600`]               = { color: p['400'] };
    rules[`.dark .text-${c}-700`]               = { color: p['300'] };
    rules[`.dark .text-${c}-800`]               = { color: p['300'] };
    rules[`.dark .text-${c}-900`]               = { color: p['200'] };
    rules[`.dark .border-${c}-100`]             = { 'border-color': rgba(p['500'], 0.25) };
    rules[`.dark .border-${c}-200`]             = { 'border-color': rgba(p['500'], 0.35) };
    rules[`.dark .border-${c}-300`]             = { 'border-color': rgba(p['500'], 0.45) };
  }
  addBase(rules);
});

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  prefix: '',
  theme: {
    container: {
      center:  true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border:      'hsl(var(--border))',
        input:       'hsl(var(--input))',
        ring:        'hsl(var(--ring))',
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Color de marca de la empresa activa (Empresa.color_primario, ver
        // lib/empresaTheme.ts) — bg-empresa text-empresa-text.
        empresa: {
          DEFAULT: 'var(--color-empresa)',
          text:    'var(--color-empresa-text)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate'), darkOverrides],
};

export default config;
