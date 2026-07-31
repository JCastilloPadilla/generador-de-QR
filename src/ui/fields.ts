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

export function mountTypePicker(host: HTMLElement, store: Store): void {
  host.innerHTML = CONTENT_TYPES.map(
    (type) => `
    <label class="type">
      <input type="radio" name="content-type" value="${type.id}"
             ${type.id === store.get().type ? 'checked' : ''} />
      <span>${type.label}</span>
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
