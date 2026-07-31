import { ECC_LEVELS, ECC_TOLERANCE, type EccLevel } from '../qr-engine';
import {
  BODY_SHAPES,
  EYE_SHAPES,
  type BodyShape,
  type EyeShape,
} from '../geometry';
import type { Store } from '../state';

/** Controles de salida y apariencia. Cada uno se monta en su contenedor y solo
 *  habla con el store: no conoce el canvas ni el motor. */

export const SIZES = [256, 512, 1024, 2048] as const;

const ECC_HINT =
  'Un nivel más alto resiste mejor la suciedad, los dobleces o un logo encima, ' +
  'a cambio de un patrón más denso.';

export interface EccControl {
  /** Fija el nivel en H y bloquea el selector, explicando por qué. */
  setLocked(locked: boolean, reason: string): void;
}

export function mountEccControl(host: HTMLElement, store: Store): EccControl {
  host.innerHTML = `
    <label for="ecc">Nivel de corrección de errores</label>
    <select id="ecc">
      ${ECC_LEVELS.map(
        (level) =>
          `<option value="${level}">${level} — recupera hasta ${ECC_TOLERANCE[level]}% del código</option>`,
      ).join('')}
    </select>
    <p class="hint" id="ecc-hint">${ECC_HINT}</p>
  `;

  const select = host.querySelector<HTMLSelectElement>('#ecc')!;
  const hint = host.querySelector<HTMLElement>('#ecc-hint')!;

  select.value = store.get().ecc;
  select.addEventListener('change', () => store.patch({ ecc: select.value as EccLevel }));

  return {
    setLocked(locked, reason) {
      select.disabled = locked;
      if (locked) {
        select.value = 'H';
        store.patch({ ecc: 'H' });
        hint.textContent = reason;
      } else {
        hint.textContent = ECC_HINT;
      }
    },
  };
}

export function mountSizeControl(host: HTMLElement, store: Store): void {
  host.innerHTML = `
    <label for="size">Tamaño del PNG</label>
    <select id="size">
      ${SIZES.map((size) => `<option value="${size}">${size} × ${size} px</option>`).join('')}
    </select>
    <p class="hint">El SVG no depende de este valor: es vectorial y escala sin perder nitidez.</p>
  `;

  const select = host.querySelector<HTMLSelectElement>('#size')!;
  select.value = String(store.get().sizePx);
  select.addEventListener('change', () => store.patch({ sizePx: Number(select.value) }));
}

export function mountColorControl(host: HTMLElement, store: Store): void {
  const state = store.get();
  host.innerHTML = `
    <div class="colors">
      <div class="color">
        <label for="fg">Frente</label>
        <input type="color" id="fg" value="${state.foreground}" />
        <code class="color__hex" id="fg-hex">${state.foreground}</code>
      </div>
      <div class="color">
        <label for="bg">Fondo</label>
        <input type="color" id="bg" value="${state.background}" />
        <code class="color__hex" id="bg-hex">${state.background}</code>
      </div>
      <button type="button" class="btn btn--quiet" id="swap">Invertir</button>
    </div>
  `;

  const fg = host.querySelector<HTMLInputElement>('#fg')!;
  const bg = host.querySelector<HTMLInputElement>('#bg')!;
  const fgHex = host.querySelector<HTMLElement>('#fg-hex')!;
  const bgHex = host.querySelector<HTMLElement>('#bg-hex')!;

  fg.addEventListener('input', () => {
    fgHex.textContent = fg.value;
    store.patch({ foreground: fg.value });
  });

  bg.addEventListener('input', () => {
    bgHex.textContent = bg.value;
    store.patch({ background: bg.value });
  });

  host.querySelector<HTMLButtonElement>('#swap')!.addEventListener('click', () => {
    const current = store.get();
    fg.value = current.background;
    bg.value = current.foreground;
    fgHex.textContent = fg.value;
    bgHex.textContent = bg.value;
    store.patch({ foreground: current.background, background: current.foreground });
  });
}

/**
 * Muestras de las formas. Se dibujan a mano en vez de reutilizar `buildGeometry`
 * porque aquí no hay una matriz que representar: se quiere enseñar el rasgo de
 * cada forma —el redondeo, la separación, la fusión— en tres módulos.
 */
const BODY_SAMPLE: Record<BodyShape, string> = {
  square: '<rect x="1" y="1" width="4" height="4"/><rect x="7" y="1" width="4" height="4"/><rect x="1" y="7" width="4" height="4"/>',
  rounded:
    '<rect x="1" y="1" width="4" height="4" rx="1.2"/><rect x="7" y="1" width="4" height="4" rx="1.2"/><rect x="1" y="7" width="4" height="4" rx="1.2"/>',
  dot: '<circle cx="3" cy="3" r="2"/><circle cx="9" cy="3" r="2"/><circle cx="3" cy="9" r="2"/>',
  fluid:
    '<path d="M1 3a2 2 0 0 1 2-2h6a2 2 0 0 1 0 4H5v4a2 2 0 0 1-4 0z"/>',
};

const EYE_SAMPLE: Record<EyeShape, string> = {
  square: '<path d="M1 1h10v10H1z M2.5 2.5h7v7h-7z" fill-rule="evenodd"/><rect x="4" y="4" width="4" height="4"/>',
  rounded:
    '<path d="M1 1h10v10H1z M2.5 2.5h7v7h-7z" fill-rule="evenodd" rx="2"/><rect x="1" y="1" width="10" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="4" y="4" width="4" height="4" rx="1.2"/>',
  circle:
    '<circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="6" cy="6" r="2"/>',
  leaf: '<path d="M1 6a5 5 0 0 1 5-5h5v5a5 5 0 0 1-5 5H1z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4 6a2 2 0 0 1 2-2h2v2a2 2 0 0 1-2 2H4z"/>',
};

function shapeButtons(
  name: string,
  options: readonly { id: string; label: string }[],
  samples: Record<string, string>,
  selected: string,
): string {
  return options
    .map(
      (option) => `
      <label class="shape">
        <input type="radio" name="${name}" value="${option.id}"
               ${option.id === selected ? 'checked' : ''} />
        <span class="shape__box">
          <svg viewBox="0 0 12 12" aria-hidden="true" fill="currentColor">${samples[option.id]}</svg>
          <span class="shape__label">${option.label}</span>
        </span>
      </label>`,
    )
    .join('');
}

export function mountShapeControl(host: HTMLElement, store: Store): void {
  const state = store.get();
  host.innerHTML = `
    <div class="shapes">
      <span class="shapes__title">Módulos</span>
      <div class="shapes__row" role="radiogroup" aria-label="Forma de los módulos">
        ${shapeButtons('body-shape', BODY_SHAPES, BODY_SAMPLE, state.shape.body)}
      </div>
    </div>
    <div class="shapes">
      <span class="shapes__title">Esquinas</span>
      <div class="shapes__row" role="radiogroup" aria-label="Forma de los patrones de esquina">
        ${shapeButtons('eye-shape', EYE_SHAPES, EYE_SAMPLE, state.shape.eye)}
      </div>
    </div>
    <div class="eye-color">
      <label class="eye-color__toggle">
        <input type="checkbox" id="eye-color-on" ${state.eyeColor ? 'checked' : ''} />
        <span>Color propio para las esquinas</span>
      </label>
      <input type="color" id="eye-color" value="${state.eyeColor ?? state.foreground}"
             ${state.eyeColor ? '' : 'disabled'} />
      <code class="color__hex" id="eye-color-hex">${state.eyeColor ?? '—'}</code>
    </div>
    <p class="hint">
      Las esquinas conservan siempre la proporción que el escáner busca para orientarse;
      los estilos solo cambian su borde.
    </p>
  `;

  host.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement;

    if (target.name === 'body-shape') {
      store.patch({ shape: { ...store.get().shape, body: target.value as BodyShape } });
      return;
    }
    if (target.name === 'eye-shape') {
      store.patch({ shape: { ...store.get().shape, eye: target.value as EyeShape } });
      return;
    }
    if (target.id === 'eye-color-on') {
      picker.disabled = !target.checked;
      const value = target.checked ? picker.value : null;
      hex.textContent = value ?? '—';
      store.patch({ eyeColor: value });
    }
  });

  const picker = host.querySelector<HTMLInputElement>('#eye-color')!;
  const hex = host.querySelector<HTMLElement>('#eye-color-hex')!;

  picker.addEventListener('input', () => {
    hex.textContent = picker.value;
    store.patch({ eyeColor: picker.value });
  });
}

export function mountLogoControl(
  host: HTMLElement,
  store: Store,
  onLogo: (dataUrl: string | null) => void,
): void {
  host.innerHTML = `
    <label for="logo">Logo en el centro</label>
    <input type="file" id="logo" accept="image/png,image/jpeg,image/svg+xml,image/webp" />
    <button type="button" class="btn btn--quiet" id="logo-clear" hidden>Quitar logo</button>
    <p class="hint">
      La imagen se lee en tu dispositivo y no se envía a ninguna parte. Ocupa como máximo
      el 22% del código, sobre un margen del color de fondo.
    </p>
  `;

  const input = host.querySelector<HTMLInputElement>('#logo')!;
  const clear = host.querySelector<HTMLButtonElement>('#logo-clear')!;

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const dataUrl = String(reader.result);
      const image = new Image();
      image.addEventListener('load', () => {
        store.patch({ logo: image });
        onLogo(dataUrl);
        clear.hidden = false;
      });
      image.src = dataUrl;
    });
    reader.readAsDataURL(file);
  });

  clear.addEventListener('click', () => {
    input.value = '';
    clear.hidden = true;
    store.patch({ logo: null });
    onLogo(null);
  });
}
