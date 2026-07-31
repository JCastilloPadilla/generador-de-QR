import type { QrMatrix } from './qr-engine';
import { QUIET_ZONE } from './renderer';

/**
 * Única descripción de la forma del código, en coordenadas de módulo.
 *
 * El canvas la rellena con `Path2D` y el SVG la incrusta tal cual, así que ambos
 * salen idénticos por construcción. Antes había dos implementaciones de la misma
 * geometría —píxeles para el canvas, `path` para el SVG— y con formas variables
 * habrían divergido a la primera.
 */

export type BodyShape = 'square' | 'rounded' | 'dot' | 'fluid';
export type EyeShape = 'square' | 'rounded' | 'circle' | 'leaf';

export interface ShapeStyle {
  body: BodyShape;
  eye: EyeShape;
}

export interface Geometry {
  /** Trazado de los módulos de datos. */
  body: string;
  /** Trazado de los tres patrones de localización. Regla de relleno `evenodd`. */
  eyes: string;
}

export const BODY_SHAPES: readonly { id: BodyShape; label: string }[] = [
  { id: 'square', label: 'Cuadrado' },
  { id: 'rounded', label: 'Redondeado' },
  { id: 'dot', label: 'Punto' },
  { id: 'fluid', label: 'Fluido' },
] as const;

export const EYE_SHAPES: readonly { id: EyeShape; label: string }[] = [
  { id: 'square', label: 'Cuadrado' },
  { id: 'rounded', label: 'Redondeado' },
  { id: 'circle', label: 'Círculo' },
  { id: 'leaf', label: 'Hoja' },
] as const;

/** Lado de un patrón de localización, en módulos. Lo fija la especificación. */
const FINDER = 7;

/** Redondeo a 3 decimales: suficiente para el ojo y mantiene el archivo pequeño. */
function n(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

/**
 * Los tres patrones de localización ocupan posiciones fijas: las esquinas
 * superior izquierda, superior derecha e inferior izquierda. La cuarta no lleva.
 */
export function isFinderModule(matrix: QrMatrix, row: number, col: number): boolean {
  const last = matrix.size - FINDER;
  const enBloque = (r0: number, c0: number): boolean =>
    row >= r0 && row < r0 + FINDER && col >= c0 && col < c0 + FINDER;
  return enBloque(0, 0) || enBloque(0, last) || enBloque(last, 0);
}

// --- Trazados elementales -------------------------------------------------

/** Rectángulo con un radio por esquina, en orden [sup.izq, sup.der, inf.der, inf.izq]. */
function roundedRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: [number, number, number, number],
): string {
  const [tl, tr, br, bl] = r;
  if (tl === 0 && tr === 0 && br === 0 && bl === 0) {
    return `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}z`;
  }
  const arc = (radius: number, dx: number, dy: number): string =>
    radius > 0 ? `a${n(radius)} ${n(radius)} 0 0 1 ${n(dx)} ${n(dy)}` : '';

  return (
    `M${n(x + tl)} ${n(y)}` +
    `h${n(w - tl - tr)}` +
    arc(tr, tr, tr) +
    `v${n(h - tr - br)}` +
    arc(br, -br, br) +
    `h${n(-(w - br - bl))}` +
    arc(bl, -bl, -bl) +
    `v${n(-(h - bl - tl))}` +
    arc(tl, tl, -tl) +
    'z'
  );
}

function circle(cx: number, cy: number, r: number): string {
  return (
    `M${n(cx - r)} ${n(cy)}` +
    `a${n(r)} ${n(r)} 0 1 0 ${n(r * 2)} 0` +
    `a${n(r)} ${n(r)} 0 1 0 ${n(-r * 2)} 0z`
  );
}

// --- Cuerpo ---------------------------------------------------------------

/** Radio de las esquinas en la forma redondeada, en fracción de módulo. */
const ROUNDED_RADIUS = 0.28;

/** Radio del punto. Por debajo de 0.5 para que los módulos queden separados. */
const DOT_RADIUS = 0.42;

function bodyModulePath(
  matrix: QrMatrix,
  shape: BodyShape,
  row: number,
  col: number,
): string {
  const x = col + QUIET_ZONE;
  const y = row + QUIET_ZONE;

  if (shape === 'square') return roundedRect(x, y, 1, 1, [0, 0, 0, 0]);

  if (shape === 'rounded') {
    const r = ROUNDED_RADIUS;
    return roundedRect(x, y, 1, 1, [r, r, r, r]);
  }

  if (shape === 'dot') return circle(x + 0.5, y + 0.5, DOT_RADIUS);

  // Fluido: una esquina se redondea solo si los dos vecinos que la forman están
  // vacíos. Así los módulos contiguos se funden en una figura continua.
  const dark = (r: number, c: number): boolean =>
    r >= 0 && c >= 0 && r < matrix.size && c < matrix.size && matrix.get(r, c);

  const arriba = dark(row - 1, col);
  const abajo = dark(row + 1, col);
  const izq = dark(row, col - 1);
  const der = dark(row, col + 1);
  const r = 0.5;

  return roundedRect(x, y, 1, 1, [
    !arriba && !izq ? r : 0,
    !arriba && !der ? r : 0,
    !abajo && !der ? r : 0,
    !abajo && !izq ? r : 0,
  ]);
}

// --- Ojos -----------------------------------------------------------------

/**
 * Los ojos se dibujan como figura propia, no a partir de la matriz. La
 * proporción 1:1:3:1:1 de sus líneas es lo que el escáner busca para orientarse,
 * así que ningún estilo debe poder alterarla: los estilos cambian el borde,
 * nunca esa relación. Anillo exterior de 7×7 con hueco de 5×5, y centro de 3×3.
 */
function eyePath(shape: EyeShape, x: number, y: number, esquina: 'tl' | 'tr' | 'bl'): string {
  if (shape === 'circle') {
    return (
      circle(x + 3.5, y + 3.5, 3.5) +
      circle(x + 3.5, y + 3.5, 2.5) +
      circle(x + 3.5, y + 3.5, 1.5)
    );
  }

  let fuera: [number, number, number, number];
  let dentro: [number, number, number, number];
  let centro: [number, number, number, number];

  if (shape === 'square') {
    fuera = [0, 0, 0, 0];
    dentro = [0, 0, 0, 0];
    centro = [0, 0, 0, 0];
  } else if (shape === 'rounded') {
    fuera = [1.75, 1.75, 1.75, 1.75];
    dentro = [1.25, 1.25, 1.25, 1.25];
    centro = [0.75, 0.75, 0.75, 0.75];
  } else {
    // Hoja: se deja en punta la esquina que mira al exterior del código y la
    // opuesta, de modo que los tres ojos apuntan hacia afuera y el conjunto
    // sigue leyéndose como una orientación.
    const punta: Record<'tl' | 'tr' | 'bl', [number, number, number, number]> = {
      tl: [0, 3.5, 0, 3.5],
      tr: [3.5, 0, 3.5, 0],
      bl: [3.5, 0, 3.5, 0],
    };
    const [a, b, c, d] = punta[esquina];
    fuera = [a, b, c, d];
    dentro = [a * 0.71, b * 0.71, c * 0.71, d * 0.71];
    centro = [a * 0.43, b * 0.43, c * 0.43, d * 0.43];
  }

  return (
    roundedRect(x, y, 7, 7, fuera) +
    roundedRect(x + 1, y + 1, 5, 5, dentro) +
    roundedRect(x + 2, y + 2, 3, 3, centro)
  );
}

export function buildGeometry(matrix: QrMatrix, shape: ShapeStyle): Geometry {
  let body = '';
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (!matrix.get(row, col) || isFinderModule(matrix, row, col)) continue;
      body += bodyModulePath(matrix, shape.body, row, col);
    }
  }

  const last = matrix.size - FINDER + QUIET_ZONE;
  const eyes =
    eyePath(shape.eye, QUIET_ZONE, QUIET_ZONE, 'tl') +
    eyePath(shape.eye, last, QUIET_ZONE, 'tr') +
    eyePath(shape.eye, QUIET_ZONE, last, 'bl');

  return { body, eyes };
}
