import './styles.css';
import { buildMatrix, QrCapacityError } from './qr-engine';
import { drawToCanvas, renderToSvg } from './renderer';
import { downloadPng, downloadSvg } from './export';
import { realWorldCaution } from './contrast';
import { createVerifier, type Verification } from './verify';
import { getContentType } from './content-types';
import { createStore, type AppState } from './state';
import {
  mountEccControl,
  mountSizeControl,
  mountColorControl,
  mountShapeControl,
  mountLogoControl,
} from './ui/controls';
import { mountTypePicker, mountFields, renderFields, defaultValues } from './ui/fields';

const canvas = document.querySelector<HTMLCanvasElement>('#preview')!;
const payloadEl = document.querySelector<HTMLElement>('#payload')!;
const readoutEl = document.querySelector<HTMLElement>('#readout')!;
const alertEl = document.querySelector<HTMLElement>('#alert')!;
const verifyEl = document.querySelector<HTMLElement>('#verify')!;
const fieldsEl = document.querySelector<HTMLElement>('#fields')!;
const typesEl = document.querySelector<HTMLElement>('#types')!;
const pngBtn = document.querySelector<HTMLButtonElement>('#download-png')!;
const svgBtn = document.querySelector<HTMLButtonElement>('#download-svg')!;

const initial: AppState = {
  type: 'url',
  values: { url: 'https://ccastillo.dev' },
  ecc: 'M',
  sizePx: 512,
  foreground: '#15171C',
  background: '#FFFFFF',
  eyeColor: null,
  shape: { body: 'square', eye: 'square' },
  logo: null,
};

/** El logo se guarda además como data URI para poder incrustarlo en el SVG. */
let logoDataUrl: string | null = null;

const verifier = createVerifier();

let lastType = initial.type;

const store = createStore(initial, () => {
  const type = store.get().type;
  if (type !== lastType) {
    lastType = type;
    renderFields(fieldsEl, store);
  }
  schedule();
});

mountTypePicker(typesEl, store);
mountFields(fieldsEl, store);

const eccControl = mountEccControl(document.querySelector<HTMLElement>('#ecc-row')!, store);
mountSizeControl(document.querySelector<HTMLElement>('#size-row')!, store);
mountShapeControl(document.querySelector<HTMLElement>('#shape-row')!, store);
mountColorControl(document.querySelector<HTMLElement>('#color-row')!, store);
mountLogoControl(document.querySelector<HTMLElement>('#logo-row')!, store, (dataUrl) => {
  logoDataUrl = dataUrl;
  eccControl.setLocked(
    dataUrl !== null,
    'Con un logo encima el nivel queda fijo en H: es el único que recupera el 30% del ' +
      'código y compensa la parte que el logo tapa.',
  );
});

function currentPayload(): string {
  const state = store.get();
  return getContentType(state.type).serialize(state.values);
}

/** Redibujar cuesta menos de un milisegundo, pero agrupar las pulsaciones evita
 *  trabajo inútil mientras se escribe. */
let timer: number | undefined;
function schedule(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(render, 150);
}

function render(): void {
  const state = store.get();
  const text = currentPayload();
  payloadEl.textContent = text || '—';

  if (!text) {
    clearCanvas();
    readoutEl.textContent = '';
    setVerification(null);
    setAlert(null);
    setDownloadable(false);
    return;
  }

  try {
    const matrix = buildMatrix(text, state.ecc);
    const style = {
      foreground: state.foreground,
      background: state.background,
      shape: state.shape,
      eyeColor: state.eyeColor,
      logo: state.logo,
    };
    drawToCanvas(canvas, matrix, state.sizePx, style);
    readoutEl.textContent =
      `v${matrix.version} · ${matrix.size}×${matrix.size} módulos · ECC ${matrix.ecc} · ` +
      `${new TextEncoder().encode(text).length} bytes`;

    // Dos capas con significados distintos. La verificación decodifica el
    // código y prueba que se lee; el aviso de contraste advierte de que leerse
    // en pantalla no garantiza leerse impreso y con poca luz.
    const verification = verifier(matrix, style, text);
    setVerification(verification);
    setAlert(
      verification.state === 'ok'
        ? realWorldCaution(state.foreground, state.background)
        : null,
    );
    setDownloadable(true);
  } catch (error) {
    const message =
      error instanceof QrCapacityError ? error.message : 'No se pudo generar el código.';
    clearCanvas();
    readoutEl.textContent = '';
    setVerification(null);
    setAlert(message);
    setDownloadable(false);
  }
}

function clearCanvas(): void {
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function setVerification(result: Verification | null): void {
  if (!result) {
    verifyEl.removeAttribute('data-state');
    verifyEl.textContent = '';
    return;
  }

  verifyEl.dataset.state = result.state;
  if (result.state === 'ok') {
    verifyEl.textContent = 'verificado · se lee y devuelve exactamente esto';
  } else if (result.state === 'difiere') {
    verifyEl.textContent = `se lee, pero devuelve otra cosa: ${result.decoded}`;
  } else {
    verifyEl.textContent = `no se lee · ${result.reason}`;
  }
}

function setAlert(message: string | null): void {
  alertEl.hidden = message === null;
  alertEl.textContent = message ?? '';
}

function setDownloadable(enabled: boolean): void {
  pngBtn.disabled = !enabled;
  svgBtn.disabled = !enabled;
}

function filename(extension: string): string {
  return `codigo-qr-${store.get().type}.${extension}`;
}

pngBtn.addEventListener('click', () => downloadPng(canvas, filename('png')));

svgBtn.addEventListener('click', () => {
  const state = store.get();
  const matrix = buildMatrix(currentPayload(), state.ecc);
  downloadSvg(
    renderToSvg(
      matrix,
      state.sizePx,
      {
        foreground: state.foreground,
        background: state.background,
        shape: state.shape,
        eyeColor: state.eyeColor,
      },
      logoDataUrl,
    ),
    filename('svg'),
  );
});

// El estado inicial trae solo el enlace de ejemplo; se completa con los valores
// por defecto del tipo para que ningún campo quede sin sembrar.
store.patch({ values: { ...defaultValues(initial.type), ...initial.values } });
render();
