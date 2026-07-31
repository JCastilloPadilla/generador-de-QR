import type { QrMatrix } from './qr-engine';
import { buildGeometry, QUIET_ZONE, type ShapeStyle } from './geometry';

/**
 * Canvas y SVG se dibujan a partir de la misma geometría, de modo que el PNG y
 * el SVG exportados son idénticos por construcción y la lógica de color, zona
 * silenciosa y logo vive en un solo sitio.
 */

export { QUIET_ZONE };

/** Proporción del lado del QR que puede ocupar el logo. */
export const LOGO_RATIO = 0.22;

export interface RenderStyle {
  foreground: string;
  background: string;
  shape: ShapeStyle;
  /** Color propio de los patrones de localización. null = el del cuerpo. */
  eyeColor?: string | null;
  logo?: HTMLImageElement | null;
}

/**
 * Píxeles por módulo, redondeado a entero. Un módulo de tamaño fraccionario
 * produce bordes borrosos por antialiasing, y los bordes borrosos son una de las
 * causas más comunes de códigos que no escanean.
 */
export function modulePixelSize(matrix: QrMatrix, sizePx: number): number {
  const total = matrix.size + QUIET_ZONE * 2;
  return Math.max(1, Math.floor(sizePx / total));
}

/** Escala y desplazamiento para centrar el código en un lienzo cuadrado. */
function layout(matrix: QrMatrix, sizePx: number): { scale: number; offset: number } {
  const scale = modulePixelSize(matrix, sizePx);
  const drawn = (matrix.size + QUIET_ZONE * 2) * scale;
  return { scale, offset: Math.floor((sizePx - drawn) / 2) };
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

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = style.background;
  ctx.fillRect(0, 0, sizePx, sizePx);

  const { scale, offset } = layout(matrix, sizePx);
  const geometry = buildGeometry(matrix, style.shape);

  // Se trabaja en coordenadas de módulo y se deja que el canvas escale: así el
  // trazado dibujado es exactamente el mismo que se incrusta en el SVG.
  ctx.setTransform(scale, 0, 0, scale, offset, offset);

  ctx.fillStyle = style.foreground;
  ctx.fill(new Path2D(geometry.body));

  ctx.fillStyle = style.eyeColor ?? style.foreground;
  ctx.fill(new Path2D(geometry.eyes), 'evenodd');

  ctx.setTransform(1, 0, 0, 1, 0, 0);

  if (style.logo) {
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
 * SVG con coordenadas en módulos: el archivo queda pequeño y escala sin pérdida.
 * `shape-rendering="crispEdges"` solo se declara con la forma cuadrada; en
 * cuanto hay bordes curvos hace falta el suavizado.
 */
export function renderToSvg(
  matrix: QrMatrix,
  sizePx: number,
  style: RenderStyle,
  logoHref?: string | null,
): string {
  const total = matrix.size + QUIET_ZONE * 2;
  const geometry = buildGeometry(matrix, style.shape);
  const nitido = style.shape.body === 'square' && style.shape.eye === 'square';
  const logo = logoHref ? logoMarkup(matrix.size, logoHref, style.background) : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${total} ${total}"${
    nitido ? ' shape-rendering="crispEdges"' : ''
  }>
<rect width="${total}" height="${total}" fill="${style.background}"/>
<path d="${geometry.body}" fill="${style.foreground}"/>
<path d="${geometry.eyes}" fill="${style.eyeColor ?? style.foreground}" fill-rule="evenodd"/>${logo}
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
