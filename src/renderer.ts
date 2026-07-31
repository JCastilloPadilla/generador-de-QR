import type { QrMatrix } from './qr-engine';

/**
 * Canvas y SVG se dibujan aquí, a partir de la misma matriz, para que el PNG y
 * el SVG exportados sean idénticos y la lógica de color, zona silenciosa y logo
 * viva en un solo sitio.
 */

/** Módulos de margen obligatorio alrededor del código. */
export const QUIET_ZONE = 4;

/** Proporción del lado del QR que puede ocupar el logo. */
export const LOGO_RATIO = 0.22;

export interface RenderStyle {
  foreground: string;
  background: string;
  logo?: HTMLImageElement | null;
}

/**
 * Píxeles por módulo, redondeado a entero. Un módulo de tamaño fraccionario
 * produce bordes borrosos por antialiasing, y los bordes borrosos son la
 * segunda causa de códigos que no escanean.
 */
export function modulePixelSize(matrix: QrMatrix, sizePx: number): number {
  const total = matrix.size + QUIET_ZONE * 2;
  return Math.max(1, Math.floor(sizePx / total));
}

function parseHex(hex: string): [number, number, number] {
  let value = hex.replace('#', '').trim();
  if (value.length === 3) {
    value = value
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const int = Number.parseInt(value, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

/**
 * Píxeles del código, sin logo. Es la verdad de lo que se dibuja, y al ser una
 * función pura se puede decodificar en un test sin necesidad de un navegador.
 */
export function renderToPixels(
  matrix: QrMatrix,
  sizePx: number,
  style: RenderStyle,
): { data: Uint8ClampedArray<ArrayBuffer>; width: number; height: number } {
  const scale = modulePixelSize(matrix, sizePx);
  const drawn = (matrix.size + QUIET_ZONE * 2) * scale;
  const offset = Math.floor((sizePx - drawn) / 2);

  const [br, bg, bb] = parseHex(style.background);
  const [fr, fg, fb] = parseHex(style.foreground);

  const data = new Uint8ClampedArray(new ArrayBuffer(sizePx * sizePx * 4));
  for (let i = 0; i < data.length; i += 4) {
    data[i] = br;
    data[i + 1] = bg;
    data[i + 2] = bb;
    data[i + 3] = 255;
  }

  const paint = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= sizePx || y >= sizePx) return;
    const i = (y * sizePx + x) * 4;
    data[i] = fr;
    data[i + 1] = fg;
    data[i + 2] = fb;
  };

  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (!matrix.get(row, col)) continue;
      const left = offset + (col + QUIET_ZONE) * scale;
      const top = offset + (row + QUIET_ZONE) * scale;
      for (let y = 0; y < scale; y++) {
        for (let x = 0; x < scale; x++) paint(left + x, top + y);
      }
    }
  }

  return { data, width: sizePx, height: sizePx };
}

export function drawToCanvas(
  canvas: HTMLCanvasElement,
  matrix: QrMatrix,
  sizePx: number,
  style: RenderStyle,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no permitió dibujar en el canvas.');

  canvas.width = sizePx;
  canvas.height = sizePx;

  const pixels = renderToPixels(matrix, sizePx, style);
  ctx.putImageData(new ImageData(pixels.data, pixels.width, pixels.height), 0, 0);

  if (style.logo) {
    const scale = modulePixelSize(matrix, sizePx);
    const drawn = (matrix.size + QUIET_ZONE * 2) * scale;
    const offset = Math.floor((sizePx - drawn) / 2);
    drawLogo(ctx, style, matrix.size * scale, offset + QUIET_ZONE * scale);
  }
}

function drawLogo(
  ctx: CanvasRenderingContext2D,
  style: RenderStyle,
  qrPx: number,
  qrOffset: number,
): void {
  const logo = style.logo;
  if (!logo) return;

  const box = Math.round(qrPx * LOGO_RATIO);
  const pad = Math.round(box * 0.12);
  const center = qrOffset + qrPx / 2;
  const left = Math.round(center - box / 2);
  const top = Math.round(center - box / 2);

  // Un respaldo del color de fondo evita que los módulos asomen bajo un logo
  // con transparencia y le da al escáner un borde limpio donde apoyarse.
  ctx.fillStyle = style.background;
  ctx.fillRect(left - pad, top - pad, box + pad * 2, box + pad * 2);

  const ratio = logo.naturalWidth / logo.naturalHeight || 1;
  const w = ratio >= 1 ? box : box * ratio;
  const h = ratio >= 1 ? box / ratio : box;
  ctx.drawImage(logo, center - w / 2, center - h / 2, w, h);
}

/**
 * SVG con coordenadas en módulos (viewBox = módulos totales) y un único `path`
 * para todos los módulos oscuros: el archivo queda pequeño y escala sin pérdida.
 */
export function renderToSvg(
  matrix: QrMatrix,
  sizePx: number,
  style: RenderStyle,
  logoHref?: string | null,
): string {
  const total = matrix.size + QUIET_ZONE * 2;

  let path = '';
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (matrix.get(row, col)) {
        path += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
      }
    }
  }

  const logo = logoHref ? logoMarkup(matrix.size, logoHref, style.background) : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">
<rect width="${total}" height="${total}" fill="${style.background}"/>
<path d="${path}" fill="${style.foreground}"/>${logo}
</svg>`;
}

function logoMarkup(qrModules: number, href: string, background: string): string {
  const box = qrModules * LOGO_RATIO;
  const pad = box * 0.12;
  const center = QUIET_ZONE + qrModules / 2;
  const left = center - box / 2;

  return `
<rect x="${left - pad}" y="${left - pad}" width="${box + pad * 2}" height="${box + pad * 2}" fill="${background}"/>
<image x="${left}" y="${left}" width="${box}" height="${box}" href="${href}" preserveAspectRatio="xMidYMid meet"/>`;
}
