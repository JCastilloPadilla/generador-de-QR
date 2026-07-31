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
export function relativeLuminance(hex: string): number {
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

/**
 * Advertencia complementaria a la verificación de escaneo.
 *
 * La verificación decodifica una imagen limpia de 512 px, y un decodificador en
 * esas condiciones es mucho más indulgente que la cámara de un teléfono sobre
 * papel impreso con poca luz. Por eso un código puede quedar «verificado» y aun
 * así ser frágil fuera de la pantalla: eso es lo que avisa esta función.
 *
 * Devuelve null cuando el contraste no compromete nada.
 */
export function realWorldCaution(foreground: string, background: string): string | null {
  const ratio = contrastRatio(foreground, background);
  const shown = ratio.toFixed(1);

  if (ratio < CRITICAL) {
    return `Contraste ${shown}:1. Se lee en pantalla, pero impreso o con poca luz es muy probable que falle.`;
  }
  if (ratio < LOW) {
    return `Contraste ${shown}:1, algo justo. Funciona en pantalla; para imprimir, oscurece el frente o aclara el fondo.`;
  }
  return null;
}
