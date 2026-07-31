import { describe, expect, it } from 'vitest';
import { getContentType, CONTENT_TYPES } from '../src/content-types';

describe('catálogo', () => {
  it('ofrece los cuatro tipos', () => {
    expect(CONTENT_TYPES.map((t) => t.id)).toEqual(['url', 'text', 'wifi', 'vcard']);
  });

  it('getContentType devuelve url para un id desconocido', () => {
    expect(getContentType('inexistente').id).toBe('url');
  });
});

describe('url', () => {
  const type = getContentType('url');

  it('codifica la dirección tal cual, sin acortarla ni envolverla', () => {
    expect(type.serialize({ url: 'https://ccastillo.dev/a?b=c' })).toBe(
      'https://ccastillo.dev/a?b=c',
    );
  });

  it('antepone https:// cuando falta el esquema', () => {
    expect(type.serialize({ url: 'ccastillo.dev' })).toBe('https://ccastillo.dev');
  });

  it('respeta otros esquemas', () => {
    expect(type.serialize({ url: 'mailto:hola@ccastillo.dev' })).toBe(
      'mailto:hola@ccastillo.dev',
    );
  });

  it('devuelve cadena vacía si no hay nada escrito', () => {
    expect(type.serialize({ url: '   ' })).toBe('');
  });
});

describe('wifi', () => {
  const type = getContentType('wifi');

  it('usa el formato estándar', () => {
    expect(type.serialize({ ssid: 'CafeCentral', password: 'secreto', security: 'WPA' })).toBe(
      'WIFI:T:WPA;S:CafeCentral;P:secreto;;',
    );
  });

  it('escapa los caracteres reservados en el SSID', () => {
    expect(type.serialize({ ssid: 'Red;Casa', password: 'x', security: 'WPA' })).toBe(
      'WIFI:T:WPA;S:Red\\;Casa;P:x;;',
    );
  });

  it('escapa punto y coma, coma, dos puntos, comilla y barra en la contraseña', () => {
    expect(type.serialize({ ssid: 'Red', password: 'a;b,c:d"e\\f', security: 'WPA' })).toBe(
      'WIFI:T:WPA;S:Red;P:a\\;b\\,c\\:d\\"e\\\\f;;',
    );
  });

  it('omite la contraseña en redes abiertas', () => {
    expect(type.serialize({ ssid: 'Libre', password: '', security: 'nopass' })).toBe(
      'WIFI:T:nopass;S:Libre;;',
    );
  });

  it('devuelve cadena vacía sin SSID', () => {
    expect(type.serialize({ ssid: '', password: 'x', security: 'WPA' })).toBe('');
  });
});

describe('vcard', () => {
  const type = getContentType('vcard');
  const values = {
    name: 'Carlos Castillo',
    org: 'ccastillo.dev',
    phone: '+52 55 1234 5678',
    email: 'hola@ccastillo.dev',
  };

  it('abre y cierra la tarjeta en versión 3.0', () => {
    const card = type.serialize(values);
    expect(card.startsWith('BEGIN:VCARD\nVERSION:3.0\n')).toBe(true);
    expect(card.endsWith('\nEND:VCARD')).toBe(true);
  });

  it('incluye N y FN a partir del nombre', () => {
    const card = type.serialize(values);
    expect(card).toContain('N:Castillo;Carlos;;;');
    expect(card).toContain('FN:Carlos Castillo');
  });

  it('incluye teléfono, correo y empresa', () => {
    const card = type.serialize(values);
    expect(card).toContain('TEL;TYPE=CELL:+52 55 1234 5678');
    expect(card).toContain('EMAIL:hola@ccastillo.dev');
    expect(card).toContain('ORG:ccastillo.dev');
  });

  it('omite las líneas de los campos vacíos', () => {
    const card = type.serialize({ name: 'Ana', org: '', phone: '', email: '' });
    expect(card).not.toContain('TEL');
    expect(card).not.toContain('EMAIL');
    expect(card).not.toContain('ORG');
  });

  it('devuelve cadena vacía sin nombre', () => {
    expect(type.serialize({ name: '', org: 'x', phone: '', email: '' })).toBe('');
  });
});

describe('text', () => {
  it('devuelve el texto sin tocarlo', () => {
    expect(getContentType('text').serialize({ text: '  hola\nmundo  ' })).toBe('  hola\nmundo  ');
  });
});
