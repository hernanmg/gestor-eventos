import api from '@/lib/api';

const DEFAULT_PRIMARIO   = '#1E3A5F';
const DEFAULT_SECUNDARIO = '#2E6DA4';

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

// Luminancia relativa WCAG de un #RRGGBB (0 = negro, 1 = blanco).
function luminancia(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Texto legible sobre el color de marca: negro sobre colores claros
// (#C8FF00 DOS57), blanco sobre oscuros (#E31E24 Enjoy). Se calcula en vez de
// guardarse en Empresa para no requerir migración y seguir al color que
// configure el ADMIN.
function colorTexto(fondo: string): string {
  return luminancia(fondo) > 0.4 ? '#000000' : '#FFFFFF';
}

// ── Fondos por empresa ───────────────────────────────────────────────────────
// Cada fondo es una pila de background (image/size/repeat/position) que se
// vuelca en CSS variables y aplica index.css sobre .app-main.
interface Fondo { image: string; size: string; repeat: string; position: string }

const rgba = (rgb: [number, number, number], a: number) => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;

// Base del tema claro: gris suave apenas teñido hacia el color de marca
// (DOS57 → #EFF1EA cálido-verdoso, Enjoy → #F0EBEB rosado).
function fondoClaroBase(color: string): string {
  const [r, g, b] = hexToRgb(color) ?? [240, 239, 236];
  const mix = (base: number, v: number) => Math.round(base * 0.975 + v * 0.025);
  return `rgb(${mix(240, r)}, ${mix(240, g)}, ${mix(237, b)})`;
}

// Claro "estructura" (modo foto, DOS57): cruzado de líneas finas, una
// diagonal en gris cálido y la otra en el color de marca. Un amarillo-verde
// casi no contrasta sobre gris claro: necesita más alfa que un rojo.
function cruzadoClaro(color: string): Fondo {
  const marca = hexToRgb(color) ?? [0, 0, 0];
  const alfaMarca = luminancia(color) > 0.4 ? 0.22 : 0.08;
  return {
    image:
      `repeating-linear-gradient(45deg, transparent 0 8px, rgba(150, 150, 140, 0.18) 8px 9px), ` +
      `repeating-linear-gradient(-45deg, transparent 0 8px, ${rgba(marca, alfaMarca)} 8px 9px)`,
    size: 'auto, auto', repeat: 'repeat, repeat', position: '0 0, 0 0',
  };
}

// Ruido fractal (feTurbulence) en blanco con un toque del color de marca:
// fondo oscuro mientras carga el logo, o si la empresa no tiene logo.
function ruidoOscuro(color: string): Fondo {
  const [r, g, b] = (hexToRgb(color) ?? [255, 255, 255]).map(v => ((255 * 0.6 + v * 0.4) / 255).toFixed(3));
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>` +
    `<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/>` +
    `<feColorMatrix values='0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  0 0 0 0.09 0'/></filter>` +
    `<rect width='300' height='300' filter='url(%23n)'/></svg>`;
  return { image: `url("data:image/svg+xml,${svg}")`, size: 'auto', repeat: 'repeat', position: '0 0' };
}

// ── Fondos sacados del logo ──────────────────────────────────────────────────
// Los dos logos reales son una foto oscura (Enjoy: tela/papel gastado; DOS57:
// andamio) con la marca a la derecha/centro. Se recorta la esquina superior
// izquierda (30% × 25%, sólo textura en ambos) y se espeja en 2×2 para que el
// mosaico no tenga costuras. Después un pasa-altos: cada píxel se compara con
// su entorno desenfocado y sólo queda la diferencia (el grano, las motas, las
// fibras); las formas grandes — degradés, caños — se cancelan (si quedaran,
// el espejado las convierte en rombos/franjas repetidos muy visibles).
//
// Según cuánto grano tenga el recorte la empresa queda en uno de dos modos,
// el mismo para claro y oscuro:
// - "textura" (≥ 2% de motas marcadas — Enjoy da 5,7%, tela gastada de
//   verdad): mosaico de motas. Oscuro: motas claras. Claro: las mismas motas
//   en gris oscuro con un toque del color de marca, más un resplandor muy
//   suave del color de marca abajo a la izquierda.
// - "foto" (DOS57 da 0,7%: foto lisa con caños): oscuro = la foto entera sin
//   la marca (ver fotoSinMarca), anclada arriba a la izquierda y oscurecida al
//   82% con un degradé en la misma pila — sin capa ::before, así el contenido
//   no necesita z-index; claro = cruzado de líneas finas (cruzadoClaro).
interface FondosLogo { claro: Fondo; oscuro: Fondo }
const fondoCache = new Map<string, FondosLogo>();

// Saca de la foto del logo el texto y las flechas (píxeles muy saturados —
// el amarillo-verde de marca — o casi blancos) y los rellena con el fondo de
// alrededor: se arma una copia donde esos píxeles valen el promedio oscuro de
// la foto, se desenfoca fuerte, y se usa esa copia sólo donde había marca
// (máscara también desenfocada para que no queden bordes). Quedan los caños.
function fotoSinMarca(bitmap: ImageBitmap): HTMLCanvasElement {
  const W = bitmap.width, H = bitmap.height;
  const base = document.createElement('canvas');
  base.width = W; base.height = H;
  const bctx = base.getContext('2d', { willReadFrequently: true })!;
  bctx.drawImage(bitmap, 0, 0);
  const img = bctx.getImageData(0, 0, W, H);
  const px = img.data;

  const esMarca = (i: number) => {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    return (max > 70 && (max - min) / max > 0.5) || min > 125;
  };
  const mask = new Uint8ClampedArray(W * H * 4);
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (esMarca(i)) { mask[i + 3] = 255; continue; }
    sr += px[i]; sg += px[i + 1]; sb += px[i + 2]; n++;
  }
  const [mr, mg, mb] = n ? [sr / n, sg / n, sb / n] : [10, 10, 10];

  // Copia "sin marca" muy desenfocada → relleno
  const relleno = new ImageData(new Uint8ClampedArray(px), W, H);
  for (let i = 0; i < px.length; i += 4) {
    if (mask[i + 3]) { relleno.data[i] = mr; relleno.data[i + 1] = mg; relleno.data[i + 2] = mb; }
  }
  const rCanvas = document.createElement('canvas');
  rCanvas.width = W; rCanvas.height = H;
  rCanvas.getContext('2d')!.putImageData(relleno, 0, 0);
  const rBlur = document.createElement('canvas');
  rBlur.width = W; rBlur.height = H;
  const rbctx = rBlur.getContext('2d', { willReadFrequently: true })!;
  rbctx.filter = 'blur(14px)';
  rbctx.drawImage(rCanvas, 0, 0);
  const rel = rbctx.getImageData(0, 0, W, H).data;

  // Máscara dilatada/suavizada
  const mCanvas = document.createElement('canvas');
  mCanvas.width = W; mCanvas.height = H;
  mCanvas.getContext('2d')!.putImageData(new ImageData(mask, W, H), 0, 0);
  const mBlur = document.createElement('canvas');
  mBlur.width = W; mBlur.height = H;
  const mbctx = mBlur.getContext('2d', { willReadFrequently: true })!;
  mbctx.filter = 'blur(4px)';
  mbctx.drawImage(mCanvas, 0, 0);
  mbctx.drawImage(mCanvas, 0, 0); // doble pasada = máscara un poco más gorda
  const m = mbctx.getImageData(0, 0, W, H).data;

  for (let i = 0; i < px.length; i += 4) {
    const a = Math.min(1, (m[i + 3] / 255) * 2.5);
    px[i]     = px[i]     * (1 - a) + rel[i]     * a;
    px[i + 1] = px[i + 1] * (1 - a) + rel[i + 1] * a;
    px[i + 2] = px[i + 2] * (1 - a) + rel[i + 2] * a;
  }
  bctx.putImageData(img, 0, 0);
  return base;
}

// version = Empresa.updated_at: al subir otro logo cambia y se regenera.
async function fondosDesdeLogo(empresaId: number, version: string, color: string): Promise<FondosLogo | null> {
  const key = `${empresaId}|${version}|${color}`;
  if (fondoCache.has(key)) return fondoCache.get(key)!;

  const res = await api.get(`/empresas/${empresaId}/logo`, { responseType: 'blob' });
  const bitmap = await createImageBitmap(res.data as Blob);
  try {
    const w = Math.round(bitmap.width * 0.30);
    const h = Math.round(bitmap.height * 0.25);
    if (w < 8 || h < 8) return null;

    const canvas = document.createElement('canvas');
    canvas.width = w * 2; canvas.height = h * 2;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      ctx.save();
      ctx.translate(sx === 1 ? 0 : w * 2, sy === 1 ? 0 : h * 2);
      ctx.scale(sx, sy);
      ctx.drawImage(bitmap, 0, 0, w, h, 0, 0, w, h);
      ctx.restore();
    }
    const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = canvas.width; blurCanvas.height = canvas.height;
    const bctx = blurCanvas.getContext('2d', { willReadFrequently: true });
    if (!bctx) return null;
    bctx.filter = 'blur(4px)';
    bctx.drawImage(canvas, 0, 0);
    const blur = bctx.getImageData(0, 0, canvas.width, canvas.height).data;

    // Intensidad de cada mota (0..1)
    const motas = new Float32Array(px.length / 4);
    let marcadas = 0;
    for (let i = 0, j = 0; i < px.length; i += 4, j++) {
      const l  = (px[i] + px[i + 1] + px[i + 2]) / 3;
      const lb = (blur[i] + blur[i + 1] + blur[i + 2]) / 3;
      motas[j] = Math.min(1, Math.max(0, (l - lb) / 50));
      if (motas[j] > 0.5) marcadas++;
    }

    const marca = hexToRgb(color) ?? [255, 255, 255];
    let fondos: FondosLogo;
    if (marcadas / motas.length >= 0.02) {
      const mosaico = (rgb: number[], alfa: number) => {
        const out = ctx.createImageData(canvas.width, canvas.height);
        for (let i = 0, j = 0; j < motas.length; i += 4, j++) {
          out.data[i] = rgb[0]; out.data[i + 1] = rgb[1]; out.data[i + 2] = rgb[2];
          out.data[i + 3] = Math.round(motas[j] * alfa * 255);
        }
        ctx.putImageData(out, 0, 0);
        return `url("${canvas.toDataURL('image/png')}")`;
      };
      const claroRgb = [0, 1, 2].map(k => 70 * 0.7 + marca[k] * 0.3);
      const oscuroRgb = [0, 1, 2].map(k => 255 * 0.7 + marca[k] * 0.3);
      fondos = {
        claro: {
          image:    `${mosaico(claroRgb, 0.12)}, radial-gradient(ellipse at 20% 80%, ${rgba(marca, 0.07)} 0%, transparent 60%)`,
          size:     'auto, 100% 100%',
          repeat:   'repeat, no-repeat',
          position: '0 0, 0 0',
        },
        oscuro: { image: mosaico(oscuroRgb, 0.10), size: 'auto', repeat: 'repeat', position: '0 0' },
      };
    } else {
      const foto = fotoSinMarca(bitmap);
      const velo = 'linear-gradient(rgba(10, 10, 10, 0.82), rgba(10, 10, 10, 0.82))';
      fondos = {
        claro: cruzadoClaro(color),
        oscuro: {
          image:    `${velo}, url("${foto.toDataURL('image/jpeg', 0.85)}")`,
          size:     'auto, cover',
          repeat:   'no-repeat, no-repeat',
          position: '0 0, top left',
        },
      };
    }
    fondoCache.set(key, fondos);
    return fondos;
  } finally {
    bitmap.close();
  }
}

const SIN_FONDO: Fondo = { image: 'none', size: 'auto', repeat: 'repeat', position: '0 0' };

function setFondo(root: HTMLElement, tema: 'light' | 'dark', f: Fondo): void {
  root.style.setProperty(`--empresa-pattern-${tema}`,          f.image);
  root.style.setProperty(`--empresa-pattern-${tema}-size`,     f.size);
  root.style.setProperty(`--empresa-pattern-${tema}-repeat`,   f.repeat);
  root.style.setProperty(`--empresa-pattern-${tema}-position`, f.position);
}

// Aplica los colores de marca de la empresa activa como CSS variables en :root.
// Llamar al login, al refrescar /auth/me y al cambiar de empresa.
// Sin empresa activa el fondo queda neutro, sin patrón. `logo` (empresa con
// logo cargado) habilita los fondos sacados del logo; hasta que se analiza
// (una vez por sesión, después queda en caché) el claro va liso y el oscuro
// con ruido genérico.
export function applyEmpresaTheme(
  colorPrimario?: string | null,
  colorSecundario?: string | null,
  logo?: { empresaId: number; version: string } | null,
): void {
  const root     = document.documentElement;
  const primario = colorPrimario || DEFAULT_PRIMARIO;

  root.style.setProperty('--color-empresa',             primario);
  root.style.setProperty('--color-empresa-text',        colorTexto(primario));
  root.style.setProperty('--color-empresa-secundario',  colorSecundario || DEFAULT_SECUNDARIO);
  root.style.setProperty('--empresa-bg-light', colorPrimario ? fondoClaroBase(primario) : 'var(--bg-primary)');
  setFondo(root, 'light', SIN_FONDO);
  setFondo(root, 'dark',  colorPrimario ? ruidoOscuro(primario) : SIN_FONDO);

  if (colorPrimario && !logo) setFondo(root, 'light', cruzadoClaro(primario));
  if (colorPrimario && logo) {
    fondosDesdeLogo(logo.empresaId, logo.version, primario)
      .then(fondos => {
        // Si mientras cargaba se cambió de empresa, no pisar la nueva.
        if (!fondos || root.style.getPropertyValue('--color-empresa') !== primario) return;
        setFondo(root, 'light', fondos.claro);
        setFondo(root, 'dark',  fondos.oscuro);
      })
      .catch(() => { setFondo(root, 'light', cruzadoClaro(primario)); });
  }
}
