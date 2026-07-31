import { describe, expect, it } from 'vitest';
import { buildMatrix, QrCapacityError } from '../src/qr-engine';

describe('buildMatrix', () => {
  it('produce una matriz cuadrada con el tamaño declarado', () => {
    const m = buildMatrix('https://ccastillo.dev', 'M');
    expect(m.size).toBeGreaterThan(0);
    expect(m.version).toBeGreaterThanOrEqual(1);
    expect(m.ecc).toBe('M');
  });

  it('devuelve booleanos en get()', () => {
    const m = buildMatrix('hola', 'M');
    expect(typeof m.get(0, 0)).toBe('boolean');
  });

  it('marca en negro la esquina superior izquierda (patrón de localización)', () => {
    const m = buildMatrix('hola', 'M');
    expect(m.get(0, 0)).toBe(true);
    expect(m.get(0, 6)).toBe(true);
    expect(m.get(1, 1)).toBe(false);
  });

  it('un nivel de corrección más alto no reduce el tamaño de la matriz', () => {
    const l = buildMatrix('https://ccastillo.dev/una/ruta/larga', 'L');
    const h = buildMatrix('https://ccastillo.dev/una/ruta/larga', 'H');
    expect(h.size).toBeGreaterThanOrEqual(l.size);
  });

  it('lanza QrCapacityError cuando el contenido no cabe', () => {
    expect(() => buildMatrix('x'.repeat(5000), 'H')).toThrow(QrCapacityError);
  });

  it('lanza QrCapacityError con texto vacío', () => {
    expect(() => buildMatrix('', 'M')).toThrow(QrCapacityError);
  });
});
