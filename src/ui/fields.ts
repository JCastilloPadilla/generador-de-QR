import { CONTENT_TYPES, getContentType, type FieldDef } from '../content-types';
import type { Store } from '../state';

/** Construye el formulario a partir de la declaración del tipo de contenido.
 *  Separado de `content-types` a propósito: allí vive el dato, aquí el DOM. */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Iconos discretos para identificar el contenido antes de leer la etiqueta. */
const TYPE_ICONS: Record<string, string> = {
  url: '<path d="M10.5 13.5 13.5 10.5m-6.7 5.2-1.1 1.1a3 3 0 0 1-4.2-4.2l3-3a3 3 0 0 1 4.2 0M17.2 8.3l1.1-1.1a3 3 0 1 0-4.2-4.2l-3 3a3 3 0 0 0 0 4.2" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.7"/>',
  text: '<path d="M4 4h12M10 4v12M6.5 16h7" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.7"/>',
  email: '<rect x="2.5" y="4.5" width="15" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m3.5 6 6.5 5 6.5-5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.7"/>',
  phone: '<path d="M6 2.8 8.2 5 6.7 7.3a12.6 12.6 0 0 0 6 6l2.3-1.5 2.2 2.2-1.4 2.2c-.5.8-1.5 1.2-2.4.9C7.6 15.6 4.4 12.4 2.7 6.6c-.3-.9.1-1.9.9-2.4L6 2.8Z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.7"/>',
  wifi: '<path d="M2.5 7.2a11 11 0 0 1 15 0M5.2 10a7 7 0 0 1 9.6 0M8 12.8a3 3 0 0 1 4 0M10 16h.01" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.7"/>',
  vcard: '<rect x="2.5" y="3.5" width="15" height="13" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="7" cy="8" r="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4.7 13c.7-1.3 3-1.3 3.7 0M11 7h4M11 10h4M11 13h2.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"/>',
  tel: '<path d="M6 2.8 8.2 5 6.7 7.3a12.6 12.6 0 0 0 6 6l2.3-1.5 2.2 2.2-1.4 2.2c-.5.8-1.5 1.2-2.4.9C7.6 15.6 4.4 12.4 2.7 6.6c-.3-.9.1-1.9.9-2.4L6 2.8Z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.7"/>',
  sms: '<path d="M3 4.5h14v9H8l-4 3v-3H3v-9Z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.7"/><path d="M6.5 8h7M6.5 10.5h4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"/>',
  geo: '<path d="M10 17s5-5.4 5-9A5 5 0 1 0 5 8c0 3.6 5 9 5 9Z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.7"/><circle cx="10" cy="8" r="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  event: '<rect x="3" y="4.5" width="14" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M6.5 2.8v3.4M13.5 2.8v3.4M3 8h14M6.5 11h2M11.5 11h2M6.5 14h2" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"/>',
};

export function mountTypePicker(host: HTMLElement, store: Store): void {
  host.innerHTML = CONTENT_TYPES.map(
    (type) => `
    <label class="type">
      <input type="radio" name="content-type" value="${type.id}"
             ${type.id === store.get().type ? 'checked' : ''} />
      <span><svg class="type__icon" viewBox="0 0 20 20" aria-hidden="true">${TYPE_ICONS[type.id] ?? TYPE_ICONS.text}</svg>${type.label}</span>
    </label>`,
  ).join('');

  host.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement;
    if (target.name !== 'content-type') return;
    store.patch({ type: target.value, values: defaultValues(target.value) });
  });
}

/** Valores iniciales de un tipo, para que la vista previa sea correcta antes de
 *  que el usuario toque nada (los `select` ya tienen una opción elegida). */
export function defaultValues(typeId: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of getContentType(typeId).fields) {
    values[field.name] = field.type === 'select' ? (field.options?.[0]?.value ?? '') : '';
  }
  return values;
}

/** Tipos de campo que el navegador dibuja como un `input` corriente. */
const INPUT_TYPES = new Set([
  'text',
  'url',
  'password',
  'tel',
  'email',
  'number',
  'datetime-local',
]);

function fieldMarkup(field: FieldDef, value: string): string {
  const id = `field-${field.name}`;
  const hint = field.hint ? `<p class="hint">${field.hint}</p>` : '';
  const placeholder = escapeHtml(field.placeholder ?? '');

  if (field.type === 'textarea') {
    return `<div class="field">
      <label for="${id}">${field.label}</label>
      <textarea id="${id}" data-field="${field.name}" placeholder="${placeholder}">${escapeHtml(value)}</textarea>
      ${hint}
    </div>`;
  }

  if (field.type === 'select') {
    const options = (field.options ?? [])
      .map(
        (option) =>
          `<option value="${option.value}"${option.value === value ? ' selected' : ''}>${option.label}</option>`,
      )
      .join('');
    return `<div class="field">
      <label for="${id}">${field.label}</label>
      <select id="${id}" data-field="${field.name}">${options}</select>
      ${hint}
    </div>`;
  }

  const inputType = INPUT_TYPES.has(field.type) ? field.type : 'text';
  return `<div class="field">
    <label for="${id}">${field.label}</label>
    <input type="${inputType}" id="${id}" data-field="${field.name}"
           value="${escapeHtml(value)}" placeholder="${placeholder}" />
    ${hint}
  </div>`;
}

/**
 * Se llama una sola vez. La delegación de eventos vive en el contenedor, que
 * nunca se reemplaza, de modo que redibujar los campos no duplica los oyentes.
 */
export function mountFields(host: HTMLElement, store: Store): void {
  const handle = (event: Event): void => {
    const target = event.target as HTMLElement;
    const name = target.dataset.field;
    if (!name) return;
    const value = (target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
    store.patch({ values: { ...store.get().values, [name]: value } });
  };

  host.addEventListener('input', handle);
  host.addEventListener('change', handle);

  renderFields(host, store);
}

/** Redibuja los campos del tipo activo. Llamar al cambiar de tipo. */
export function renderFields(host: HTMLElement, store: Store): void {
  const state = store.get();
  host.innerHTML = getContentType(state.type)
    .fields.map((field) => fieldMarkup(field, state.values[field.name] ?? ''))
    .join('');
}
