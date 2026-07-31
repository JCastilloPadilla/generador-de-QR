import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import { inversionMode } from '../src/verify';
import { buildMatrix } from '../src/qr-engine';
import { rasterize } from './helpers/rasterize';

const NEGRO_SOBRE_BLANCO = { foreground: '#15171C', background: '#FFFFFF' };
const BLANCO_SOBRE_NEGRO = { foreground: '#FFFFFF', background: '#15171C' };

describe('inversionMode', () => {
  it('no invierte cuando el frente es más oscuro que el fondo', () => {
    expect(inversionMode('#15171C', '#FFFFFF')).toBe('dontInvert');
  });

  it('invierte primero cuando el frente es más claro que el fondo', () => {
    expect(inversionMode('#FFFFFF', '#15171C')).toBe('invertFirst');
  });

  it('decide por luminancia, no por tono', () => {
    // Amarillo sobre azul: el amarillo es mucho más luminoso.
    expect(inversionMode('#FFEB3B', '#1F3BE0')).toBe('invertFirst');
    expect(inversionMode('#1F3BE0', '#FFEB3B')).toBe('dontInvert');
  });

  /**
   * `onlyInvert` sería lo más directo, pero en jsqr 1.4.0 lanza una excepción
   * en vez de devolver null cuando no encuentra código. Este test fija la
   * decisión para que nadie la «optimice» de vuelta.
   */
  it('nunca devuelve onlyInvert, que en jsqr 1.4.0 lanza excepción', () => {
    const modos = [
      inversionMode('#000000', '#FFFFFF'),
      inversionMode('#FFFFFF', '#000000'),
    ];
    expect(modos).not.toContain('onlyInvert');
  });

  it('el modo descartado sigue lanzando: la razón del test anterior es real', () => {
    const blanco = rasterize(buildMatrix('x', 'M'), 64, NEGRO_SOBRE_BLANCO);
    expect(() =>
      jsQR(blanco.data, blanco.width, blanco.height, { inversionAttempts: 'onlyInvert' }),
    ).toThrow();
  });
});

describe('el modo elegido decodifica de verdad', () => {
  const texto = 'https://ccastillo.dev/verificacion';

  it('decodifica un código normal', () => {
    const r = rasterize(buildMatrix(texto, 'M'), 512, NEGRO_SOBRE_BLANCO);
    const out = jsQR(r.data, r.width, r.height, {
      inversionAttempts: inversionMode(NEGRO_SOBRE_BLANCO.foreground, NEGRO_SOBRE_BLANCO.background),
    });
    expect(out?.data).toBe(texto);
  });

  it('decodifica un código invertido', () => {
    const r = rasterize(buildMatrix(texto, 'M'), 512, BLANCO_SOBRE_NEGRO);
    const out = jsQR(r.data, r.width, r.height, {
      inversionAttempts: inversionMode(BLANCO_SOBRE_NEGRO.foreground, BLANCO_SOBRE_NEGRO.background),
    });
    expect(out?.data).toBe(texto);
  });

  it('devuelve null, sin lanzar, ante una imagen sin código', () => {
    const vacio = {
      data: new Uint8ClampedArray(new ArrayBuffer(300 * 300 * 4)).fill(255),
      width: 300,
      height: 300,
    };
    for (const modo of ['dontInvert', 'invertFirst'] as const) {
      expect(() => jsQR(vacio.data, 300, 300, { inversionAttempts: modo })).not.toThrow();
      expect(jsQR(vacio.data, 300, 300, { inversionAttempts: modo })).toBeNull();
    }
  });
});
