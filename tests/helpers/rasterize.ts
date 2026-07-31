import type { QrMatrix } from '../../src/qr-engine';

/**
 * Rasterizador de referencia, propio de los tests.
 *
 * Es una implementación independiente y deliberadamente ingenua: módulos
 * cuadrados, sin formas ni logo. Al no reutilizar `src/renderer.ts`, el test de
 * round-trip no puede heredar un error del renderizador que está comprobando.
 *
 * Verifica la codificación —que un SSID con `;` o un texto con acentos vuelven
 * como entraron—, no la geometría del dibujado. De eso se encarga
 * `tests/geometry.test.ts`, y en tiempo de uso la verificación en vivo de la app.
 */

/** Los mismos 4 módulos de margen que exige la especificación. */
const QUIET_ZONE = 4;

export interface Raster {
  data: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
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

export function rasterize(
  matrix: QrMatrix,
  sizePx: number,
  style: { foreground: string; background: string },
): Raster {
  const total = matrix.size + QUIET_ZONE * 2;
  const scale = Math.max(1, Math.floor(sizePx / total));
  const offset = Math.floor((sizePx - total * scale) / 2);

  const [br, bg, bb] = parseHex(style.background);
  const [fr, fg, fb] = parseHex(style.foreground);

  const data = new Uint8ClampedArray(new ArrayBuffer(sizePx * sizePx * 4));
  for (let i = 0; i < data.length; i += 4) {
    data[i] = br;
    data[i + 1] = bg;
    data[i + 2] = bb;
    data[i + 3] = 255;
  }

  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (!matrix.get(row, col)) continue;
      const left = offset + (col + QUIET_ZONE) * scale;
      const top = offset + (row + QUIET_ZONE) * scale;
      for (let y = top; y < top + scale; y++) {
        for (let x = left; x < left + scale; x++) {
          if (x < 0 || y < 0 || x >= sizePx || y >= sizePx) continue;
          const i = (y * sizePx + x) * 4;
          data[i] = fr;
          data[i + 1] = fg;
          data[i + 2] = fb;
        }
      }
    }
  }

  return { data, width: sizePx, height: sizePx };
}
