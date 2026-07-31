import { describe, expect, it } from 'vitest';
import { getContentType, CONTENT_TYPES } from '../src/content-types';

describe('catálogo', () => {
  it('ofrece los nueve tipos', () => {
    expect(CONTENT_TYPES.map((t) => t.id)).toEqual([
      'url',
      'text',
      'wifi',
      'vcard',
      'tel',
      'sms',
      'email',
      'geo',
      'event',
    ]);
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

describe('tel', () => {
  const type = getContentType('tel');

  it('usa el esquema tel:', () => {
    expect(type.serialize({ phone: '+525512345678' })).toBe('tel:+525512345678');
  });

  it('quita los espacios, que algunos teléfonos no toleran en tel:', () => {
    expect(type.serialize({ phone: '+52 55 1234 5678' })).toBe('tel:+525512345678');
  });

  it('conserva los guiones y paréntesis, que sí son válidos', () => {
    expect(type.serialize({ phone: '+52 (55) 1234-5678' })).toBe('tel:+52(55)1234-5678');
  });

  it('devuelve cadena vacía sin número', () => {
    expect(type.serialize({ phone: '  ' })).toBe('');
  });
});

describe('sms', () => {
  const type = getContentType('sms');

  it('usa el formato SMSTO, el más compatible entre lectores', () => {
    expect(type.serialize({ phone: '+525512345678', message: 'Hola' })).toBe(
      'SMSTO:+525512345678:Hola',
    );
  });

  it('funciona sin mensaje', () => {
    expect(type.serialize({ phone: '+525512345678', message: '' })).toBe(
      'SMSTO:+525512345678:',
    );
  });

  it('devuelve cadena vacía sin número', () => {
    expect(type.serialize({ phone: '', message: 'Hola' })).toBe('');
  });
});

describe('email', () => {
  const type = getContentType('email');

  it('codifica dirección, asunto y cuerpo', () => {
    expect(
      type.serialize({ to: 'hola@ccastillo.dev', subject: 'Hola', body: 'Qué tal' }),
    ).toBe('mailto:hola@ccastillo.dev?subject=Hola&body=Qu%C3%A9%20tal');
  });

  it('escapa los caracteres que romperían la consulta', () => {
    const out = type.serialize({
      to: 'hola@ccastillo.dev',
      subject: 'Presupuesto & plazos',
      body: 'a=b&c=d',
    });
    expect(out).toContain('subject=Presupuesto%20%26%20plazos');
    expect(out).toContain('body=a%3Db%26c%3Dd');
  });

  it('omite la consulta cuando no hay asunto ni cuerpo', () => {
    expect(type.serialize({ to: 'hola@ccastillo.dev', subject: '', body: '' })).toBe(
      'mailto:hola@ccastillo.dev',
    );
  });

  it('devuelve cadena vacía sin destinatario', () => {
    expect(type.serialize({ to: '', subject: 'x', body: '' })).toBe('');
  });
});

describe('geo', () => {
  const type = getContentType('geo');

  it('usa el esquema geo: con latitud y longitud', () => {
    expect(type.serialize({ lat: '19.4326', lon: '-99.1332' })).toBe('geo:19.4326,-99.1332');
  });

  it('acepta coma decimal y la normaliza a punto', () => {
    expect(type.serialize({ lat: '19,4326', lon: '-99,1332' })).toBe('geo:19.4326,-99.1332');
  });

  it('devuelve cadena vacía si falta una coordenada', () => {
    expect(type.serialize({ lat: '19.4326', lon: '' })).toBe('');
    expect(type.serialize({ lat: '', lon: '-99.1332' })).toBe('');
  });

  it('devuelve cadena vacía si las coordenadas no son números', () => {
    expect(type.serialize({ lat: 'norte', lon: 'sur' })).toBe('');
  });
});

describe('event', () => {
  const type = getContentType('event');
  const base = {
    summary: 'Reunión de equipo',
    start: '2026-08-01T19:00',
    end: '2026-08-01T20:30',
    location: 'Oficina',
    description: '',
  };

  it('abre y cierra el evento', () => {
    const out = type.serialize(base);
    expect(out.startsWith('BEGIN:VEVENT')).toBe(true);
    expect(out.endsWith('END:VEVENT')).toBe(true);
  });

  it('convierte la fecha del formulario al formato del calendario', () => {
    expect(type.serialize(base)).toContain('DTSTART:20260801T190000');
    expect(type.serialize(base)).toContain('DTEND:20260801T203000');
  });

  /**
   * El escapado de RFC 5545 es tan silencioso como el de WiFi: sin él el
   * calendario importa el evento partido o lo rechaza, sin ningún aviso.
   */
  it('escapa las comas, que separarían valores', () => {
    const out = type.serialize({ ...base, summary: 'Cena, copas y más' });
    expect(out).toContain('SUMMARY:Cena\\, copas y más');
  });

  it('escapa los puntos y coma', () => {
    const out = type.serialize({ ...base, location: 'Calle 5; piso 3' });
    expect(out).toContain('LOCATION:Calle 5\\; piso 3');
  });

  it('escapa las barras invertidas', () => {
    const out = type.serialize({ ...base, summary: 'Ruta C:\\datos' });
    expect(out).toContain('SUMMARY:Ruta C:\\\\datos');
  });

  it('convierte los saltos de línea en la secuencia literal', () => {
    const out = type.serialize({ ...base, description: 'Primera\nSegunda' });
    expect(out).toContain('DESCRIPTION:Primera\\nSegunda');
    // El salto real solo separa propiedades, nunca aparece dentro de un valor.
    const lineas = out.split('\n');
    expect(lineas.every((l) => l.length > 0)).toBe(true);
  });

  it('omite las propiedades vacías', () => {
    const out = type.serialize({ ...base, location: '', description: '' });
    expect(out).not.toContain('LOCATION');
    expect(out).not.toContain('DESCRIPTION');
  });

  it('omite DTEND si no se indica fin', () => {
    expect(type.serialize({ ...base, end: '' })).not.toContain('DTEND');
  });

  it('devuelve cadena vacía sin título o sin fecha de inicio', () => {
    expect(type.serialize({ ...base, summary: '' })).toBe('');
    expect(type.serialize({ ...base, start: '' })).toBe('');
  });
});
