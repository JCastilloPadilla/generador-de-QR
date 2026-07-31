import { describe, expect, it } from 'vitest';
import { buildMatrix } from '../src/qr-engine';
import { modulePixelSize, QUIET_ZONE, renderToPixels } from '../src/renderer';

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
});

describe('renderToPixels', () => {
  const style = { foreground: '#000000', background: '#FFFFFF' };

  /**
   * Un decodificador tolera la falta de zona silenciosa, así que el test de
   * round-trip no la protege. Hay que comprobarla sobre los píxeles.
   */
  it('deja un margen de fondo de al menos 4 módulos por los cuatro lados', () => {
    const matrix = buildMatrix('https://ccastillo.dev', 'M');
    const size = 512;
    const { data } = renderToPixels(matrix, size, style);
    const scale = modulePixelSize(matrix, size);
    // 4 literal, no QUIET_ZONE: el test debe fallar si alguien baja la constante.
    const margen = 4 * scale;

    const esFondo = (x: number, y: number): boolean => data[(y * size + x) * 4] === 255;

    for (let i = 0; i < size; i++) {
      for (let d = 0; d < margen; d++) {
        expect(esFondo(i, d), `pixel oscuro en el borde superior (${i}, ${d})`).toBe(true);
        expect(esFondo(i, size - 1 - d), `borde inferior (${i}, ${size - 1 - d})`).toBe(true);
        expect(esFondo(d, i), `borde izquierdo (${d}, ${i})`).toBe(true);
        expect(esFondo(size - 1 - d, i), `borde derecho (${size - 1 - d}, ${i})`).toBe(true);
      }
    }
  });

  it('pinta el módulo (0,0) desplazado exactamente por la zona silenciosa', () => {
    const matrix = buildMatrix('hola', 'M');
    const size = 512;
    const { data } = renderToPixels(matrix, size, style);
    const scale = modulePixelSize(matrix, size);
    const offset = Math.floor((size - (matrix.size + QUIET_ZONE * 2) * scale) / 2);

    // El patrón de localización empieza en (0,0) y es oscuro.
    const x = offset + QUIET_ZONE * scale;
    const oscuro = data[(x * size + x) * 4];
    expect(matrix.get(0, 0)).toBe(true);
    expect(oscuro).toBe(0);

    // El píxel justo antes sigue siendo fondo.
    const antes = data[((x - 1) * size + (x - 1)) * 4];
    expect(antes).toBe(255);
  });

  it('usa los colores indicados en fondo y módulos', () => {
    const matrix = buildMatrix('hola', 'M');
    const { data } = renderToPixels(matrix, 256, {
      foreground: '#1F3BE0',
      background: '#F6F7F9',
    });
    expect([data[0], data[1], data[2]]).toEqual([0xf6, 0xf7, 0xf9]);
  });
});
