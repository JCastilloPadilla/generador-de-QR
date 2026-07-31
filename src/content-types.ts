/**
 * Cada tipo de contenido se declara como dato: sus campos y cómo se serializa.
 * La interfaz construye el formulario a partir de esta tabla, así que añadir un
 * tipo nuevo es añadir una entrada, no ramificar la UI.
 */

export type FieldType =
  | 'text'
  | 'url'
  | 'password'
  | 'tel'
  | 'email'
  | 'number'
  | 'datetime-local'
  | 'textarea'
  | 'select';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: FieldOption[];
  hint?: string;
}

export interface ContentType {
  id: string;
  label: string;
  fields: FieldDef[];
  serialize(values: Record<string, string>): string;
}

/**
 * Escapa los caracteres reservados del formato WIFI:. Sin esto, una contraseña
 * con «;» o «:» genera un código que parece correcto y falla al escanear, sin
 * ningún aviso por el camino.
 */
function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1');
}

function vcardLine(prefix: string, value: string): string {
  return value.trim() ? `\n${prefix}${value.trim()}` : '';
}

/**
 * Escapa un valor de propiedad iCalendar (RFC 5545).
 *
 * Igual de silencioso que el escapado de WiFi: sin él, una coma en el título
 * hace que el calendario importe el evento partido, o directamente lo rechace,
 * y en ningún momento aparece un error.
 */
function escapeIcal(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function icalLine(prefix: string, value: string): string {
  return value.trim() ? `\n${prefix}${escapeIcal(value.trim())}` : '';
}

/** `2026-08-01T19:00` del formulario → `20260801T190000` del calendario. */
function icalDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) return '';
  const [, y, mo, d, h, mi] = match;
  return `${y}${mo}${d}T${h}${mi}00`;
}

export const CONTENT_TYPES: ContentType[] = [
  {
    id: 'url',
    label: 'Enlace',
    fields: [
      {
        name: 'url',
        label: 'Dirección web',
        type: 'url',
        placeholder: 'https://ejemplo.com',
        hint: 'Se codifica esta dirección exacta. No se acorta ni se redirige.',
      },
    ],
    serialize({ url }) {
      const value = (url ?? '').trim();
      if (!value) return '';
      return /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
    },
  },
  {
    id: 'text',
    label: 'Texto',
    fields: [
      { name: 'text', label: 'Texto', type: 'textarea', placeholder: 'Cualquier texto' },
    ],
    serialize({ text }) {
      return text ?? '';
    },
  },
  {
    id: 'wifi',
    label: 'WiFi',
    fields: [
      { name: 'ssid', label: 'Nombre de la red (SSID)', type: 'text', placeholder: 'MiRed' },
      { name: 'password', label: 'Contraseña', type: 'password' },
      {
        name: 'security',
        label: 'Seguridad',
        type: 'select',
        options: [
          { value: 'WPA', label: 'WPA / WPA2 / WPA3' },
          { value: 'WEP', label: 'WEP' },
          { value: 'nopass', label: 'Red abierta' },
        ],
        hint: 'La contraseña se codifica en el propio código, en claro. Quien lo escanee la tiene.',
      },
    ],
    serialize({ ssid, password, security }) {
      const name = (ssid ?? '').trim();
      if (!name) return '';
      const type = security || 'WPA';
      const credential = type === 'nopass' || !password ? '' : `P:${escapeWifi(password)};`;
      return `WIFI:T:${type};S:${escapeWifi(name)};${credential};`;
    },
  },
  {
    id: 'vcard',
    label: 'Contacto',
    fields: [
      { name: 'name', label: 'Nombre completo', type: 'text', placeholder: 'Ana Ruiz' },
      { name: 'org', label: 'Empresa', type: 'text' },
      { name: 'phone', label: 'Teléfono', type: 'tel' },
      { name: 'email', label: 'Correo', type: 'email' },
    ],
    serialize({ name, org, phone, email }) {
      const full = (name ?? '').trim();
      if (!full) return '';
      const parts = full.split(/\s+/);
      const last = parts.length > 1 ? (parts[parts.length - 1] ?? '') : '';
      const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : full;

      return (
        'BEGIN:VCARD\nVERSION:3.0' +
        `\nN:${last};${first};;;` +
        `\nFN:${full}` +
        vcardLine('ORG:', org ?? '') +
        vcardLine('TEL;TYPE=CELL:', phone ?? '') +
        vcardLine('EMAIL:', email ?? '') +
        '\nEND:VCARD'
      );
    },
  },
  {
    id: 'tel',
    label: 'Llamada',
    fields: [
      {
        name: 'phone',
        label: 'Número de teléfono',
        type: 'tel',
        placeholder: '+52 55 1234 5678',
        hint: 'Al escanear, el teléfono ofrece marcar. No llama solo.',
      },
    ],
    serialize({ phone }) {
      // Los espacios no son válidos en tel: y algunos lectores se atragantan.
      // Los guiones y paréntesis sí lo son, y ayudan a leer el número.
      const value = (phone ?? '').replace(/\s+/g, '');
      return value ? `tel:${value}` : '';
    },
  },
  {
    id: 'sms',
    label: 'SMS',
    fields: [
      { name: 'phone', label: 'Número de teléfono', type: 'tel', placeholder: '+52 55 1234 5678' },
      { name: 'message', label: 'Mensaje', type: 'textarea', placeholder: 'Texto ya escrito' },
    ],
    serialize({ phone, message }) {
      const value = (phone ?? '').replace(/\s+/g, '');
      if (!value) return '';
      // SMSTO es el formato que más lectores entienden, por delante de sms:
      return `SMSTO:${value}:${message ?? ''}`;
    },
  },
  {
    id: 'email',
    label: 'Correo',
    fields: [
      { name: 'to', label: 'Destinatario', type: 'email', placeholder: 'hola@ejemplo.com' },
      { name: 'subject', label: 'Asunto', type: 'text' },
      { name: 'body', label: 'Mensaje', type: 'textarea' },
    ],
    serialize({ to, subject, body }) {
      const dir = (to ?? '').trim();
      if (!dir) return '';

      const params: string[] = [];
      if (subject?.trim()) params.push(`subject=${encodeURIComponent(subject.trim())}`);
      if (body?.trim()) params.push(`body=${encodeURIComponent(body.trim())}`);

      return params.length ? `mailto:${dir}?${params.join('&')}` : `mailto:${dir}`;
    },
  },
  {
    id: 'geo',
    label: 'Ubicación',
    fields: [
      { name: 'lat', label: 'Latitud', type: 'text', placeholder: '19.4326' },
      {
        name: 'lon',
        label: 'Longitud',
        type: 'text',
        placeholder: '-99.1332',
        hint: 'Las copias del mapa del teléfono: mantén pulsado un punto y aparecen.',
      },
    ],
    serialize({ lat, lon }) {
      // Se acepta coma decimal porque es lo que escribe media Latinoamérica y
      // toda Europa, pero el esquema geo: exige punto.
      const norm = (v: string): string => (v ?? '').trim().replace(',', '.');
      const a = norm(lat ?? '');
      const b = norm(lon ?? '');
      if (!a || !b) return '';
      if (!Number.isFinite(Number(a)) || !Number.isFinite(Number(b))) return '';
      return `geo:${a},${b}`;
    },
  },
  {
    id: 'event',
    label: 'Evento',
    fields: [
      { name: 'summary', label: 'Título', type: 'text', placeholder: 'Reunión de equipo' },
      { name: 'start', label: 'Comienza', type: 'datetime-local' },
      { name: 'end', label: 'Termina', type: 'datetime-local' },
      { name: 'location', label: 'Lugar', type: 'text' },
      {
        name: 'description',
        label: 'Descripción',
        type: 'textarea',
        hint: 'La hora se guarda sin zona horaria: se interpreta como la local de quien escanea.',
      },
    ],
    serialize({ summary, start, end, location, description }) {
      const titulo = (summary ?? '').trim();
      const inicio = icalDate(start ?? '');
      if (!titulo || !inicio) return '';

      const fin = icalDate(end ?? '');
      return (
        'BEGIN:VEVENT' +
        icalLine('SUMMARY:', titulo) +
        `\nDTSTART:${inicio}` +
        (fin ? `\nDTEND:${fin}` : '') +
        icalLine('LOCATION:', location ?? '') +
        icalLine('DESCRIPTION:', description ?? '') +
        '\nEND:VEVENT'
      );
    },
  },
];

export function getContentType(id: string): ContentType {
  return CONTENT_TYPES.find((type) => type.id === id) ?? CONTENT_TYPES[0]!;
}
