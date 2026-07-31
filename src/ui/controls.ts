import { ECC_LEVELS, ECC_TOLERANCE, type EccLevel } from '../qr-engine';
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
