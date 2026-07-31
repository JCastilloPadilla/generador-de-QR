import { describe, expect, it } from 'vitest';
import { buildMatrix } from '../src/qr-engine';
import { modulePixelSize, QUIET_ZONE } from '../src/renderer';

/**
 * La zona silenciosa y la forma de los módulos se comprueban en
 * `geometry.test.ts`, sobre el trazado. Aquí queda solo el reparto de píxeles,
 * que es lo propio del renderizador.
 */

describe('QUIET_ZONE', () => {
  it('son 4 módulos, el mínimo que exige la especificación', () => {
    expect(QUIET_ZONE).toBe(4);
  });
});

describe('modulePixelSize', () => {
  it('reparte el tamaño pedido entre la matriz más las dos zonas silenciosas', () => {
    const matrix = buildMatrix('hola', 'M');
    const total = matrix.size + QUIET_ZONE * 2;
    expect(modulePixelSize(matrix, 512)).toBe(Math.floor(512 / total));
  });

  it('nunca devuelve menos de 1 píxel por módulo', () => {
    const matrix = buildMatrix('hola', 'M');
    expect(modulePixelSize(matrix, 4)).toBe(1);
  });

  it('devuelve un entero: un módulo fraccionario produce bordes borrosos', () => {
    const matrix = buildMatrix('https://ccastillo.dev/ruta/larga', 'H');
    for (const size of [256, 512, 1024, 2048]) {
      expect(Number.isInteger(modulePixelSize(matrix, size))).toBe(true);
    }
  });
});
