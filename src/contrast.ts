/**
 * Un escáner distingue los módulos por diferencia de luminancia, no de tono.
 * Dos colores muy distintos al ojo pueden tener luminancias casi iguales y
 * producir un código ilegible, así que se mide y se avisa.
 *
 * Se avisa, nunca se impide: la decisión es del usuario.
 */

/** Umbral por debajo del cual el código es poco fiable. */
const LOW = 4.5;

/** Umbral por debajo del cual, en la práctica, no se lee. */
const CRITICAL = 3;

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

/** Luminancia relativa según WCAG 2.1. */
function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const [light, dark] = a > b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
}

/** Aviso legible si la combinación compromete el escaneo, o null si está bien. */
export function scanabilityWarning(foreground: string, background: string): string | null {
  const ratio = contrastRatio(foreground, background);
  const shown = ratio.toFixed(1);

  if (ratio < CRITICAL) {
    return `Contraste ${shown}:1 — este código no va a escanear. Oscurece el frente o aclara el fondo.`;
  }
  if (ratio < LOW) {
    return `Contraste ${shown}:1 — bajo. Puede fallar con poca luz o con cámaras modestas.`;
  }
  return null;
}
