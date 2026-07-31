import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import { buildMatrix, type EccLevel } from '../src/qr-engine';
import { getContentType } from '../src/content-types';
import { rasterize } from './helpers/rasterize';

/**
 * Verifica el extremo de la codificación: que lo que se serializa vuelve
 * exactamente como entró después de pasar por un QR real y un lector
 * independiente. Es donde viven los errores silenciosos —escapados, juegos de
 * caracteres— que no dan ningún síntoma hasta que alguien intenta escanear.
 *
 * Usa un rasterizador propio, no el de `src`, para no heredar sus errores. La
 * geometría del dibujado se comprueba en `tests/geometry.test.ts`, y el
 * renderizado completo con formas y logo lo verifica la propia app en vivo.
 */

const NEGRO_SOBRE_BLANCO = { foreground: '#000000', background: '#FFFFFF' };

function roundTrip(
  text: string,
  ecc: EccLevel = 'M',
  style = NEGRO_SOBRE_BLANCO,
  sizePx = 512,
): string | null {
  const pixels = rasterize(buildMatrix(text, ecc), sizePx, style);
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

  it('decodifica un evento con comas y saltos de línea escapados', () => {
    const payload = getContentType('event').serialize({
      summary: 'Cena, copas y más',
      start: '2026-08-01T19:00',
      end: '2026-08-01T23:30',
      location: 'Calle 5; piso 3',
      description: 'Primera línea\nSegunda línea',
    });
    expect(roundTrip(payload, 'M', NEGRO_SOBRE_BLANCO, 1024)).toBe(payload);
    expect(payload).toContain('SUMMARY:Cena\\, copas y más');
    expect(payload).toContain('LOCATION:Calle 5\\; piso 3');
  });

  it('decodifica un correo con asunto y cuerpo codificados', () => {
    const payload = getContentType('email').serialize({
      to: 'hola@ccastillo.dev',
      subject: 'Presupuesto & plazos',
      body: '¿Nos vemos el martes?',
    });
    expect(roundTrip(payload, 'M', NEGRO_SOBRE_BLANCO, 1024)).toBe(payload);
  });

  it('decodifica los tipos cortos: llamada, SMS y ubicación', () => {
    const casos = [
      getContentType('tel').serialize({ phone: '+52 55 1234 5678' }),
      getContentType('sms').serialize({ phone: '+525512345678', message: 'Hola, ¿qué tal?' }),
      getContentType('geo').serialize({ lat: '19.4326', lon: '-99.1332' }),
    ];
    for (const payload of casos) {
      expect(roundTrip(payload), `falla con ${payload}`).toBe(payload);
    }
  });
});
