import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import { buildMatrix, type EccLevel } from '../src/qr-engine';
import { renderToPixels } from '../src/renderer';
import { getContentType } from '../src/content-types';

/**
 * La prueba que de verdad importa: que lo renderizado se pueda volver a leer.
 * Un QR puede generarse sin errores y aun así no escanear — por una zona
 * silenciosa ausente, por bordes borrosos o por un escapado mal hecho.
 * Aquí se renderiza a píxeles y se decodifica con un lector independiente.
 */

const NEGRO_SOBRE_BLANCO = { foreground: '#000000', background: '#FFFFFF' };

function roundTrip(
  text: string,
  ecc: EccLevel = 'M',
  style = NEGRO_SOBRE_BLANCO,
  sizePx = 512,
): string | null {
  const pixels = renderToPixels(buildMatrix(text, ecc), sizePx, style);
  const result = jsQR(pixels.data, pixels.width, pixels.height);
  return result ? result.data : null;
}

describe('lo renderizado se puede volver a leer', () => {
  it('decodifica una URL al texto exacto', () => {
    const url = 'https://ccastillo.dev/una/ruta?con=parametros&y=mas';
    expect(roundTrip(url)).toBe(url);
  });

  it('decodifica en los cuatro niveles de corrección', () => {
    const url = 'https://qr.ccastillo.dev';
    for (const ecc of ['L', 'M', 'Q', 'H'] as const) {
      expect(roundTrip(url, ecc), `falla en el nivel ${ecc}`).toBe(url);
    }
  });

  it('decodifica en los cuatro tamaños de salida', () => {
    const url = 'https://ccastillo.dev';
    for (const size of [256, 512, 1024, 2048]) {
      expect(roundTrip(url, 'M', NEGRO_SOBRE_BLANCO, size), `falla a ${size}px`).toBe(url);
    }
  });

  it('decodifica con los colores invertidos', () => {
    const url = 'https://ccastillo.dev';
    expect(roundTrip(url, 'M', { foreground: '#FFFFFF', background: '#15171C' })).toBe(url);
  });

  it('decodifica con colores personalizados de contraste suficiente', () => {
    const url = 'https://ccastillo.dev';
    expect(roundTrip(url, 'M', { foreground: '#1F3BE0', background: '#F6F7F9' })).toBe(url);
  });

  it('decodifica un WiFi con caracteres reservados, escapados incluidos', () => {
    const payload = getContentType('wifi').serialize({
      ssid: 'Red;Casa',
      password: 'a;b,c:d"e',
      security: 'WPA',
    });
    expect(roundTrip(payload)).toBe(payload);
    expect(roundTrip(payload)).toContain('S:Red\\;Casa');
  });

  it('decodifica una vCard completa', () => {
    const payload = getContentType('vcard').serialize({
      name: 'Carlos Castillo',
      org: 'ccastillo.dev',
      phone: '+52 55 1234 5678',
      email: 'hola@ccastillo.dev',
    });
    expect(roundTrip(payload, 'M', NEGRO_SOBRE_BLANCO, 1024)).toBe(payload);
  });

  it('decodifica texto con acentos y emoji', () => {
    const texto = 'Café en la esquina — ¿nos vemos? ☕';
    expect(roundTrip(texto)).toBe(texto);
  });
});
