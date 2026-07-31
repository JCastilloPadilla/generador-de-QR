import './styles.css';
import { buildMatrix, QrCapacityError } from './qr-engine';
import { drawToCanvas, renderToSvg } from './renderer';
import { downloadPng, downloadSvg } from './export';
import { createStore, type AppState } from './state';

const canvas = document.querySelector<HTMLCanvasElement>('#preview')!;
const payloadEl = document.querySelector<HTMLElement>('#payload')!;
const readoutEl = document.querySelector<HTMLElement>('#readout')!;
const alertEl = document.querySelector<HTMLElement>('#alert')!;
const fieldsEl = document.querySelector<HTMLElement>('#fields')!;
const pngBtn = document.querySelector<HTMLButtonElement>('#download-png')!;
const svgBtn = document.querySelector<HTMLButtonElement>('#download-svg')!;

const initial: AppState = {
  type: 'url',
  values: { url: 'https://ccastillo.dev' },
  ecc: 'M',
  sizePx: 512,
  foreground: '#15171C',
  background: '#FFFFFF',
  logo: null,
};

const store = createStore(initial, () => schedule());

// Campo provisional: la Task 10 lo sustituye por el formulario dinámico.
fieldsEl.innerHTML = `
  <div class="field">
    <label for="field-url">Dirección web</label>
    <input type="url" id="field-url" placeholder="https://ejemplo.com" />
    <p class="hint">Se codifica esta dirección exacta. No se acorta ni se redirige.</p>
  </div>
`;
const input = document.querySelector<HTMLInputElement>('#field-url')!;
input.value = initial.values.url ?? '';
input.addEventListener('input', () => store.patch({ values: { url: input.value } }));

function currentPayload(): string {
  return store.get().values.url ?? '';
}

let timer: number | undefined;
function schedule(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(render, 150);
}

function render(): void {
  const state = store.get();
  const text = currentPayload();
  payloadEl.textContent = text || '—';

  try {
    const matrix = buildMatrix(text, state.ecc);
    drawToCanvas(canvas, matrix, state.sizePx, {
      foreground: state.foreground,
      background: state.background,
      logo: state.logo,
    });
    readoutEl.textContent =
      `v${matrix.version} · ${matrix.size}×${matrix.size} módulos · ECC ${matrix.ecc} · ` +
      `${new TextEncoder().encode(text).length} bytes`;
    setAlert(null);
    setDownloadable(true);
  } catch (error) {
    const message =
      error instanceof QrCapacityError ? error.message : 'No se pudo generar el código.';
    clearCanvas();
    readoutEl.textContent = '';
    setAlert(text ? message : null);
    setDownloadable(false);
  }
}

function clearCanvas(): void {
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function setAlert(message: string | null): void {
  alertEl.hidden = message === null;
  alertEl.textContent = message ?? '';
}

function setDownloadable(enabled: boolean): void {
  pngBtn.disabled = !enabled;
  svgBtn.disabled = !enabled;
}

pngBtn.addEventListener('click', () => downloadPng(canvas, 'codigo-qr.png'));

svgBtn.addEventListener('click', () => {
  const state = store.get();
  const matrix = buildMatrix(currentPayload(), state.ecc);
  downloadSvg(
    renderToSvg(matrix, state.sizePx, {
      foreground: state.foreground,
      background: state.background,
    }),
    'codigo-qr.svg',
  );
});

render();
