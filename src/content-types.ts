/**
 * Cada tipo de contenido se declara como dato: sus campos y cómo se serializa.
 * La interfaz construye el formulario a partir de esta tabla, así que añadir un
 * tipo nuevo es añadir una entrada, no ramificar la UI.
 */

export type FieldType = 'text' | 'url' | 'password' | 'tel' | 'email' | 'textarea' | 'select';

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
];

export function getContentType(id: string): ContentType {
  return CONTENT_TYPES.find((type) => type.id === id) ?? CONTENT_TYPES[0]!;
}
