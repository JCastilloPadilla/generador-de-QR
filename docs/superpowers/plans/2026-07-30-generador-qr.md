# Generador de QR — Plan de implementación (Fases 1–4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir un generador de códigos QR 100% del lado del cliente que codifica siempre el destino final directo, con exportación PNG/SVG, personalización de color y logo, y cuatro tipos de contenido.

**Architecture:** Pipeline unidireccional de cuatro etapas — `content-types` serializa el formulario a una cadena, `qr-engine` la convierte en matriz de módulos mediante la librería `qrcode`, `renderer` deriva canvas y SVG de esa misma matriz, y `export` los descarga. El renderizado es propio (a partir de `QRCode.create()`, no de `toCanvas()`) para que canvas y SVG salgan de una única fuente de verdad y admitan logo y color.

**Tech Stack:** TypeScript, Vite, `qrcode` (npm), Vitest. Sin framework, sin backend.

## Global Constraints

Estas reglas aplican a **todas** las tareas. Cualquier paso que las viole está mal ejecutado.

- **Sin peticiones de red en tiempo de ejecución.** Ni fuentes externas, ni CDN, ni APIs. Solo fuentes del sistema.
- **Sin QR dinámicos.** El QR codifica el contenido final directo. Nunca una URL propia que redirige.
- **Sin backend, sin analytics, sin cuentas, sin publicidad.**
- **Mobile-first.** Se diseña primero la columna única; el escritorio es la mejora.
- **Zona silenciosa de 4 módulos** en todo QR generado y exportado.
- **`base: './'`** en `vite.config.ts`, para servir igual en subdominio o subcarpeta.
- Idioma de la interfaz: **español**, en minúscula tipo oración (sentence case).
- Node 22, npm 11. El proyecto vive en la raíz del repositorio (no en un subdirectorio `qr-generator/`).

## Sistema de diseño (tokens fijos)

Toda decisión de color y tipo se deriva de aquí. No introducir valores fuera de esta lista.

```css
:root {
  /* color */
  --paper:   #F6F7F9;  /* fondo de página */
  --surface: #FFFFFF;  /* tarjetas y escenario de vista previa */
  --ink:     #15171C;  /* texto principal y frente por defecto del QR */
  --muted:   #697184;  /* texto secundario, lecturas técnicas */
  --line:    #E1E4EA;  /* filetes de 1px */
  --signal:  #1F3BE0;  /* cobalto: SOLO foco y estado activo */
  --warn:    #B4531A;  /* SOLO avisos de contraste */

  /* tipografía */
  --font-ui:   system-ui, -apple-system, "Segoe UI Variable Text", "Segoe UI", sans-serif;
  --font-mono: ui-monospace, "Cascadia Code", "Segoe UI Mono", Consolas, monospace;

  /* retícula: todo espaciado es múltiplo de un "módulo" */
  --mod: 8px;
}
```

**Regla tipográfica (es la firma del diseño, no un detalle):** la monoespaciada se usa
para *lo que leerá la máquina* — el payload codificado, la versión, el tamaño de matriz,
el nivel ECC, el contador de bytes, los valores hex. La sans se usa para *lo que lee la
persona* — prosa, etiquetas, botones. No mezclar los roles.

**El acento cobalto solo aparece en foco y estado activo.** La interfaz es monocroma a
propósito: el único color libre en pantalla debe ser el que el usuario elige para su QR.

**Movimiento:** ninguna animación en el redibujado del QR (se redibuja en cada pulsación
y animarlo lo haría sentir lento). Solo transiciones de 120 ms en foco y en el estado de
los botones. Respetar `prefers-reduced-motion`.

---

### Task 1: Andamiaje del proyecto y sistema de diseño

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `.gitignore`
- Create: `index.html`
- Create: `src/styles.css`
- Create: `src/main.ts`

**Interfaces:**
- Consumes: nada (primera tarea)
- Produces: proyecto que arranca con `npm run dev` y compila con `npm run build`; tokens CSS disponibles para todas las tareas posteriores.

- [ ] **Step 1: Instalar dependencias**

```bash
npm i qrcode
npm i -D vite typescript @types/qrcode vitest jsdom
```

- [ ] **Step 2: Escribir `package.json`**

```json
{
  "name": "generador-de-qr",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Conservar los bloques `dependencies` y `devDependencies` que escribió npm en el paso 1.

- [ ] **Step 3: Escribir `vite.config.ts`**

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2020' },
  test: { environment: 'jsdom' },
});
```

Si TypeScript se queja de la clave `test`, cambiar el import a
`import { defineConfig } from 'vitest/config';`.

- [ ] **Step 4: Escribir `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noUncheckedIndexedAccess": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "skipLibCheck": true,
    "noEmit": true,
    "isolatedModules": true
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

- [ ] **Step 5: Escribir `.gitignore`**

```
node_modules/
dist/
.DS_Store
*.local
```

- [ ] **Step 6: Escribir `index.html` (estructura completa de la app)**

Contiene ya todos los contenedores que las tareas siguientes irán llenando. El orden en
móvil es: cabecera, vista previa, controles.

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Generador de QR — sin servidor, sin rastreo</title>
  <meta name="description" content="Genera códigos QR en tu navegador. El contenido nunca sale de tu dispositivo y el código apunta siempre al destino real." />
  <link rel="stylesheet" href="/src/styles.css" />
</head>
<body>
  <header class="masthead">
    <svg class="mark" viewBox="0 0 7 7" aria-hidden="true">
      <path d="M0 0h7v7H0z" fill="none"/>
      <path d="M0 0h7v1H0zM0 6h7v1H0zM0 0h1v7H0zM6 0h1v7H6z" fill="currentColor"/>
      <path d="M2 2h3v3H2z" fill="currentColor"/>
    </svg>
    <h1>Generador de QR</h1>
    <p class="masthead__note">
      Todo ocurre en tu navegador. Tu contenido no se envía a ningún servidor y el
      código apunta al destino real, no a un redireccionamiento.
    </p>
  </header>

  <main class="layout">
    <section class="stage" aria-label="Vista previa">
      <div class="stage__frame">
        <canvas id="preview" width="512" height="512" role="img"
                aria-label="Vista previa del código QR"></canvas>
      </div>
      <p class="readout" id="readout"></p>
      <div class="payload">
        <span class="payload__label">se codifica exactamente esto</span>
        <code class="payload__value" id="payload"></code>
      </div>
      <p class="alert" id="alert" role="status" hidden></p>
      <div class="actions">
        <button type="button" id="download-png" class="btn btn--primary">Descargar PNG</button>
        <button type="button" id="download-svg" class="btn">Descargar SVG</button>
      </div>
    </section>

    <form class="controls" id="controls" autocomplete="off">
      <fieldset class="group">
        <legend class="group__title">Contenido</legend>
        <div class="types" id="types" role="radiogroup" aria-label="Tipo de contenido"></div>
        <div class="fields" id="fields"></div>
      </fieldset>

      <fieldset class="group">
        <legend class="group__title">Salida</legend>
        <div class="row" id="ecc-row"></div>
        <div class="row" id="size-row"></div>
      </fieldset>

      <fieldset class="group">
        <legend class="group__title">Apariencia</legend>
        <div class="row" id="color-row"></div>
        <div class="row" id="logo-row"></div>
      </fieldset>
    </form>
  </main>

  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 7: Escribir `src/styles.css` con los tokens y el layout base**

```css
:root {
  --paper: #F6F7F9;
  --surface: #FFFFFF;
  --ink: #15171C;
  --muted: #697184;
  --line: #E1E4EA;
  --signal: #1F3BE0;
  --warn: #B4531A;
  --font-ui: system-ui, -apple-system, "Segoe UI Variable Text", "Segoe UI", sans-serif;
  --font-mono: ui-monospace, "Cascadia Code", "Segoe UI Mono", Consolas, monospace;
  --mod: 8px;
}

*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  padding: calc(var(--mod) * 3) calc(var(--mod) * 2) calc(var(--mod) * 8);
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-ui);
  font-size: 16px;
  line-height: 1.5;
  -webkit-text-size-adjust: 100%;
}

/* cabecera ------------------------------------------------------------- */
.masthead { max-width: 68ch; margin: 0 auto calc(var(--mod) * 4); }
.mark { width: 28px; height: 28px; color: var(--ink); display: block; }
.masthead h1 {
  margin: calc(var(--mod) * 1.5) 0 var(--mod);
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}
.masthead__note { margin: 0; max-width: 52ch; color: var(--muted); font-size: 0.875rem; }

/* layout --------------------------------------------------------------- */
.layout {
  display: grid;
  gap: calc(var(--mod) * 4);
  max-width: 68ch;
  margin: 0 auto;
}

@media (min-width: 900px) {
  .layout {
    grid-template-columns: 1fr minmax(320px, 380px);
    align-items: start;
    max-width: 1080px;
  }
  .controls { order: -1; }
  .stage { position: sticky; top: calc(var(--mod) * 3); }
}

/* escenario ------------------------------------------------------------ */
.stage { display: grid; gap: calc(var(--mod) * 2); }
.stage__frame {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 2px;
  padding: calc(var(--mod) * 2);
}
#preview { display: block; width: 100%; height: auto; image-rendering: pixelated; }

/* lecturas técnicas: siempre monoespaciada ----------------------------- */
.readout {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--muted);
  letter-spacing: 0.02em;
}

.payload { display: grid; gap: calc(var(--mod) * 0.5); }
.payload__label {
  font-size: 0.6875rem;
  text-transform: lowercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}
.payload__value {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  line-height: 1.6;
  background: var(--surface);
  border: 1px solid var(--line);
  padding: var(--mod);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  max-height: 9em;
  overflow-y: auto;
}

.alert {
  margin: 0;
  padding: var(--mod) calc(var(--mod) * 1.5);
  border-left: 2px solid var(--warn);
  background: var(--surface);
  color: var(--warn);
  font-size: 0.8125rem;
}

/* controles ------------------------------------------------------------ */
.controls { display: grid; gap: calc(var(--mod) * 3); }
.group { border: 0; margin: 0; padding: 0; display: grid; gap: calc(var(--mod) * 2); }
.group__title {
  padding: 0;
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  /* el marcador reutiliza el patrón de localización: indica dónde empieza un grupo */
  display: flex;
  align-items: center;
  gap: var(--mod);
}
.group__title::before {
  content: "";
  width: 9px; height: 9px;
  border: 2px solid var(--ink);
  box-shadow: inset 0 0 0 1px var(--surface);
  flex: none;
}

.row { display: grid; gap: var(--mod); }
label { font-size: 0.8125rem; font-weight: 500; }

input[type="text"], input[type="url"], input[type="password"], input[type="tel"],
input[type="email"], textarea, select {
  width: 100%;
  font: inherit;
  font-size: 0.9375rem;
  padding: calc(var(--mod) * 1.25) calc(var(--mod) * 1.5);
  background: var(--surface);
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 2px;
}
textarea { min-height: 6em; resize: vertical; font-family: var(--font-mono); font-size: 0.875rem; }

:focus-visible { outline: 2px solid var(--signal); outline-offset: 2px; }

.btn {
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  padding: calc(var(--mod) * 1.5) calc(var(--mod) * 2);
  background: var(--surface);
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 2px;
  cursor: pointer;
  transition: border-color 120ms ease, background-color 120ms ease;
}
.btn:hover:not(:disabled) { border-color: var(--ink); }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn--primary { background: var(--ink); color: var(--surface); border-color: var(--ink); }
.btn--primary:hover:not(:disabled) { background: #000; }

.actions { display: flex; gap: var(--mod); flex-wrap: wrap; }
.actions .btn { flex: 1 1 auto; }

@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0ms !important; animation-duration: 0ms !important; }
}
```

- [ ] **Step 8: Escribir un `src/main.ts` mínimo**

```ts
import './styles.css';

console.info('Generador de QR — todo ocurre en este navegador.');
```

- [ ] **Step 9: Verificar que el proyecto arranca y compila**

```bash
npm run build
```

Esperado: `tsc --noEmit` sin errores y `vite build` escribiendo en `dist/`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: andamiaje Vite + TypeScript y sistema de diseño"
```

---

### Task 2: Motor de QR (`qr-engine.ts`)

Convierte una cadena en matriz de módulos. Es la única pieza que conoce la librería
`qrcode`; el resto de la app no la importa nunca.

**Files:**
- Create: `src/qr-engine.ts`
- Test: `tests/qr-engine.test.ts`

**Interfaces:**
- Consumes: la librería `qrcode` (`QRCode.create`).
- Produces:
  - `type EccLevel = 'L' | 'M' | 'Q' | 'H'`
  - `interface QrMatrix { size: number; get(row: number, col: number): boolean; version: number; ecc: EccLevel }`
  - `function buildMatrix(text: string, ecc: EccLevel): QrMatrix` — lanza `QrCapacityError` si el contenido no cabe.
  - `class QrCapacityError extends Error`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/qr-engine.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildMatrix, QrCapacityError } from '../src/qr-engine';

describe('buildMatrix', () => {
  it('produce una matriz cuadrada con el tamaño declarado', () => {
    const m = buildMatrix('https://ccastillo.dev', 'M');
    expect(m.size).toBeGreaterThan(0);
    expect(m.version).toBeGreaterThanOrEqual(1);
    expect(m.ecc).toBe('M');
  });

  it('devuelve booleanos en get()', () => {
    const m = buildMatrix('hola', 'M');
    expect(typeof m.get(0, 0)).toBe('boolean');
  });

  it('marca en negro la esquina superior izquierda (patrón de localización)', () => {
    const m = buildMatrix('hola', 'M');
    expect(m.get(0, 0)).toBe(true);
    expect(m.get(0, 6)).toBe(true);
    expect(m.get(1, 1)).toBe(false);
  });

  it('un nivel de corrección más alto no reduce el tamaño de la matriz', () => {
    const l = buildMatrix('https://ccastillo.dev/una/ruta/larga', 'L');
    const h = buildMatrix('https://ccastillo.dev/una/ruta/larga', 'H');
    expect(h.size).toBeGreaterThanOrEqual(l.size);
  });

  it('lanza QrCapacityError cuando el contenido no cabe', () => {
    expect(() => buildMatrix('x'.repeat(5000), 'H')).toThrow(QrCapacityError);
  });

  it('lanza QrCapacityError con texto vacío', () => {
    expect(() => buildMatrix('', 'M')).toThrow(QrCapacityError);
  });
});
```

- [ ] **Step 2: Ejecutar los tests y comprobar que fallan**

```bash
npm test -- tests/qr-engine.test.ts
```

Esperado: FAIL, no se encuentra el módulo `../src/qr-engine`.

- [ ] **Step 3: Implementar `src/qr-engine.ts`**

```ts
import QRCode from 'qrcode';

export type EccLevel = 'L' | 'M' | 'Q' | 'H';

export const ECC_LEVELS: readonly EccLevel[] = ['L', 'M', 'Q', 'H'] as const;

/** Porcentaje aproximado del código que cada nivel puede perder y aun así leerse. */
export const ECC_TOLERANCE: Record<EccLevel, number> = { L: 7, M: 15, Q: 25, H: 30 };

export interface QrMatrix {
  /** Ancho y alto en módulos, sin zona silenciosa. */
  readonly size: number;
  /** true = módulo oscuro. */
  get(row: number, col: number): boolean;
  readonly version: number;
  readonly ecc: EccLevel;
}

/** El contenido no cabe en un código QR con el nivel de corrección elegido. */
export class QrCapacityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QrCapacityError';
  }
}

export function buildMatrix(text: string, ecc: EccLevel): QrMatrix {
  if (text.length === 0) {
    throw new QrCapacityError('No hay contenido que codificar.');
  }

  let code: QRCode.QRCode;
  try {
    code = QRCode.create(text, { errorCorrectionLevel: ecc });
  } catch (cause) {
    throw new QrCapacityError(
      'El contenido es demasiado largo para un código QR con este nivel de corrección. ' +
        'Acórtalo o baja el nivel.',
    );
  }

  const { modules, version } = code;
  return {
    size: modules.size,
    version,
    ecc,
    get: (row, col) => modules.get(row, col) === 1,
  };
}
```

- [ ] **Step 4: Ejecutar los tests y comprobar que pasan**

```bash
npm test -- tests/qr-engine.test.ts
```

Esperado: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/qr-engine.ts tests/qr-engine.test.ts
git commit -m "feat: motor de QR sobre la matriz cruda de módulos"
```

---

### Task 3: Renderizador a canvas (`renderer.ts`)

**Files:**
- Create: `src/renderer.ts`
- Test: `tests/renderer.test.ts`

**Interfaces:**
- Consumes: `QrMatrix` de `qr-engine.ts`.
- Produces:
  - `const QUIET_ZONE = 4`
  - `interface RenderStyle { foreground: string; background: string; logo?: HTMLImageElement | null }`
  - `function drawToCanvas(canvas: HTMLCanvasElement, matrix: QrMatrix, sizePx: number, style: RenderStyle): void`
  - `function modulePixelSize(matrix: QrMatrix, sizePx: number): number`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/renderer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildMatrix } from '../src/qr-engine';
import { modulePixelSize, QUIET_ZONE } from '../src/renderer';

describe('QUIET_ZONE', () => {
  it('son 4 módulos, el mínimo que exige la especificación', () => {
    expect(QUIET_ZONE).toBe(4);
  });
});

describe('modulePixelSize', () => {
  it('reparte el tamaño pedido entre la matriz más las dos zonas silenciosas', () => {
    const matrix = buildMatrix('hola', 'M');
    const total = matrix.size + QUIET_ZONE * 2;
    expect(modulePixelSize(matrix, 512)).toBe(Math.floor(512 / total));
  });

  it('nunca devuelve menos de 1 píxel por módulo', () => {
    const matrix = buildMatrix('hola', 'M');
    expect(modulePixelSize(matrix, 4)).toBe(1);
  });
});
```

- [ ] **Step 2: Ejecutar los tests y comprobar que fallan**

```bash
npm test -- tests/renderer.test.ts
```

Esperado: FAIL, no se encuentra `../src/renderer`.

- [ ] **Step 3: Implementar `src/renderer.ts`**

Nota de implementación: se redondea el tamaño de módulo a un entero de píxeles y se
centra el dibujo. Un módulo de tamaño fraccionario produce bordes borrosos por
antialiasing, y los bordes borrosos son la segunda causa de códigos que no escanean.

```ts
import type { QrMatrix } from './qr-engine';

/** Módulos de margen obligatorio alrededor del código. */
export const QUIET_ZONE = 4;

/** Proporción del lado del QR que puede ocupar el logo. */
export const LOGO_RATIO = 0.22;

export interface RenderStyle {
  foreground: string;
  background: string;
  logo?: HTMLImageElement | null;
}

export function modulePixelSize(matrix: QrMatrix, sizePx: number): number {
  const total = matrix.size + QUIET_ZONE * 2;
  return Math.max(1, Math.floor(sizePx / total));
}

export function drawToCanvas(
  canvas: HTMLCanvasElement,
  matrix: QrMatrix,
  sizePx: number,
  style: RenderStyle,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no permitió dibujar en el canvas.');

  canvas.width = sizePx;
  canvas.height = sizePx;

  const scale = modulePixelSize(matrix, sizePx);
  const drawn = (matrix.size + QUIET_ZONE * 2) * scale;
  const offset = Math.floor((sizePx - drawn) / 2);

  ctx.fillStyle = style.background;
  ctx.fillRect(0, 0, sizePx, sizePx);

  ctx.fillStyle = style.foreground;
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (!matrix.get(row, col)) continue;
      ctx.fillRect(
        offset + (col + QUIET_ZONE) * scale,
        offset + (row + QUIET_ZONE) * scale,
        scale,
        scale,
      );
    }
  }

  if (style.logo) drawLogo(ctx, style, matrix.size * scale, offset + QUIET_ZONE * scale);
}

function drawLogo(
  ctx: CanvasRenderingContext2D,
  style: RenderStyle,
  qrPx: number,
  qrOffset: number,
): void {
  const logo = style.logo;
  if (!logo) return;

  const box = Math.round(qrPx * LOGO_RATIO);
  const pad = Math.round(box * 0.12);
  const center = qrOffset + qrPx / 2;
  const left = Math.round(center - box / 2);
  const top = Math.round(center - box / 2);

  // Un respaldo del color de fondo evita que los módulos asomen bajo un logo
  // con transparencia y le da al escáner un borde limpio.
  ctx.fillStyle = style.background;
  ctx.fillRect(left - pad, top - pad, box + pad * 2, box + pad * 2);

  const ratio = logo.naturalWidth / logo.naturalHeight || 1;
  const w = ratio >= 1 ? box : box * ratio;
  const h = ratio >= 1 ? box / ratio : box;
  ctx.drawImage(logo, center - w / 2, center - h / 2, w, h);
}
```

- [ ] **Step 4: Ejecutar los tests y comprobar que pasan**

```bash
npm test -- tests/renderer.test.ts
```

Esperado: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer.ts tests/renderer.test.ts
git commit -m "feat: renderizado a canvas con zona silenciosa y logo"
```

---

### Task 4: Fase 1 completa — vista previa en vivo y descarga PNG

**Files:**
- Create: `src/export.ts`
- Create: `src/state.ts`
- Modify: `src/main.ts` (reemplazar por completo)

**Interfaces:**
- Consumes: `buildMatrix`, `QrCapacityError`, `drawToCanvas`.
- Produces:
  - `function downloadPng(canvas: HTMLCanvasElement, filename: string): void`
  - `interface AppState { type: string; values: Record<string, string>; ecc: EccLevel; sizePx: number; foreground: string; background: string; logo: HTMLImageElement | null }`
  - `function createStore(initial: AppState, onChange: () => void)` con `get()` y `patch(partial)`.

- [ ] **Step 1: Escribir `src/export.ts`**

```ts
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadPng(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (blob) triggerDownload(blob, filename);
  }, 'image/png');
}

export function downloadSvg(svg: string, filename: string): void {
  triggerDownload(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), filename);
}
```

- [ ] **Step 2: Escribir `src/state.ts`**

```ts
import type { EccLevel } from './qr-engine';

export interface AppState {
  type: string;
  values: Record<string, string>;
  ecc: EccLevel;
  sizePx: number;
  foreground: string;
  background: string;
  logo: HTMLImageElement | null;
}

export interface Store {
  get(): Readonly<AppState>;
  patch(partial: Partial<AppState>): void;
}

export function createStore(initial: AppState, onChange: () => void): Store {
  let state = initial;
  return {
    get: () => state,
    patch(partial) {
      state = { ...state, ...partial };
      onChange();
    },
  };
}
```

- [ ] **Step 3: Reescribir `src/main.ts` con vista previa en vivo**

En esta tarea el tipo de contenido es fijo (`url`) y el nivel ECC fijo en `M`. Las tareas
posteriores lo generalizan.

```ts
import './styles.css';
import { buildMatrix, QrCapacityError } from './qr-engine';
import { drawToCanvas } from './renderer';
import { downloadPng } from './export';
import { createStore, type AppState } from './state';

const canvas = document.querySelector<HTMLCanvasElement>('#preview')!;
const payloadEl = document.querySelector<HTMLElement>('#payload')!;
const readoutEl = document.querySelector<HTMLElement>('#readout')!;
const alertEl = document.querySelector<HTMLElement>('#alert')!;
const fieldsEl = document.querySelector<HTMLElement>('#fields')!;
const pngBtn = document.querySelector<HTMLButtonElement>('#download-png')!;

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

// Campo provisional; la Task 10 lo sustituye por el formulario dinámico.
fieldsEl.innerHTML = `
  <label for="field-url">Dirección web</label>
  <input type="url" id="field-url" placeholder="https://ejemplo.com" />
`;
const input = document.querySelector<HTMLInputElement>('#field-url')!;
input.value = initial.values.url ?? '';
input.addEventListener('input', () => store.patch({ values: { url: input.value } }));

let timer: number | undefined;
function schedule(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(render, 150);
}

function render(): void {
  const state = store.get();
  const text = state.values.url ?? '';
  payloadEl.textContent = text;

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
    pngBtn.disabled = false;
  } catch (error) {
    const message =
      error instanceof QrCapacityError ? error.message : 'No se pudo generar el código.';
    clearCanvas();
    readoutEl.textContent = '';
    setAlert(message);
    pngBtn.disabled = true;
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

pngBtn.addEventListener('click', () => downloadPng(canvas, 'codigo-qr.png'));

render();
```

- [ ] **Step 4: Verificar la Fase 1 a mano**

```bash
npm run dev
```

Comprobar, en este orden:
1. Al cargar, ya hay un QR visible (sin pulsar nada).
2. Al escribir en el campo, el QR se actualiza solo, con un retardo perceptible mínimo.
3. La lectura monoespaciada muestra versión, tamaño, ECC y bytes.
4. El bloque `se codifica exactamente esto` muestra la URL literal.
5. «Descargar PNG» guarda un archivo con margen blanco alrededor del código.
6. **Escanear el PNG descargado con la cámara del celular y confirmar que abre la URL.**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: fase 1 — vista previa en vivo y descarga PNG"
```

---

### Task 5: Renderizado y exportación en SVG

**Files:**
- Modify: `src/renderer.ts` (añadir `renderToSvg`)
- Modify: `src/main.ts` (conectar el botón SVG)
- Test: `tests/svg.test.ts`

**Interfaces:**
- Consumes: `QrMatrix`, `RenderStyle`, `QUIET_ZONE`.
- Produces: `function renderToSvg(matrix: QrMatrix, sizePx: number, style: RenderStyle, logoHref?: string | null): string`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/svg.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildMatrix } from '../src/qr-engine';
import { renderToSvg, QUIET_ZONE } from '../src/renderer';

const style = { foreground: '#000000', background: '#ffffff' };

describe('renderToSvg', () => {
  it('declara un viewBox que incluye las dos zonas silenciosas', () => {
    const matrix = buildMatrix('hola', 'M');
    const svg = renderToSvg(matrix, 512, style);
    const total = matrix.size + QUIET_ZONE * 2;
    expect(svg).toContain(`viewBox="0 0 ${total} ${total}"`);
  });

  it('es un documento SVG independiente con espacio de nombres', () => {
    const svg = renderToSvg(buildMatrix('hola', 'M'), 512, style);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg.trim().endsWith('</svg>')).toBe(true);
  });

  it('usa los colores indicados', () => {
    const svg = renderToSvg(buildMatrix('hola', 'M'), 512, {
      foreground: '#1F3BE0',
      background: '#F6F7F9',
    });
    expect(svg).toContain('#1F3BE0');
    expect(svg).toContain('#F6F7F9');
  });

  it('dibuja tantos módulos oscuros como tiene la matriz', () => {
    const matrix = buildMatrix('hola', 'M');
    let dark = 0;
    for (let r = 0; r < matrix.size; r++)
      for (let c = 0; c < matrix.size; c++) if (matrix.get(r, c)) dark++;
    const svg = renderToSvg(matrix, 512, style);
    expect((svg.match(/M/g) ?? []).length).toBeGreaterThanOrEqual(dark);
  });
});
```

- [ ] **Step 2: Ejecutar los tests y comprobar que fallan**

```bash
npm test -- tests/svg.test.ts
```

Esperado: FAIL, `renderToSvg` no está exportado.

- [ ] **Step 3: Añadir `renderToSvg` a `src/renderer.ts`**

El SVG se emite con coordenadas en módulos (viewBox = módulos totales) y un único `path`
para todos los módulos oscuros. Así el archivo es pequeño y escala sin pérdida.

```ts
export function renderToSvg(
  matrix: QrMatrix,
  sizePx: number,
  style: RenderStyle,
  logoHref?: string | null,
): string {
  const total = matrix.size + QUIET_ZONE * 2;

  let path = '';
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (matrix.get(row, col)) {
        path += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
      }
    }
  }

  const logo = logoHref ? logoMarkup(matrix.size, logoHref, style.background) : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">
<rect width="${total}" height="${total}" fill="${style.background}"/>
<path d="${path}" fill="${style.foreground}"/>${logo}
</svg>`;
}

function logoMarkup(qrModules: number, href: string, background: string): string {
  const box = qrModules * LOGO_RATIO;
  const pad = box * 0.12;
  const center = QUIET_ZONE + qrModules / 2;
  const left = center - box / 2;
  return `
<rect x="${left - pad}" y="${left - pad}" width="${box + pad * 2}" height="${box + pad * 2}" fill="${background}"/>
<image x="${left}" y="${left}" width="${box}" height="${box}" href="${href}" preserveAspectRatio="xMidYMid meet"/>`;
}
```

- [ ] **Step 4: Ejecutar los tests y comprobar que pasan**

```bash
npm test -- tests/svg.test.ts
```

Esperado: 4 tests PASS.

- [ ] **Step 5: Conectar el botón SVG en `src/main.ts`**

Añadir el import y el manejador. El logo se incrusta como data URI para que el SVG sea
autónomo; `logoDataUrl` se guarda en el módulo y lo rellena la Task 8.

```ts
import { downloadPng, downloadSvg } from './export';
import { drawToCanvas, renderToSvg } from './renderer';

let logoDataUrl: string | null = null;
function setLogoDataUrl(value: string | null): void { logoDataUrl = value; }

const svgBtn = document.querySelector<HTMLButtonElement>('#download-svg')!;
svgBtn.addEventListener('click', () => {
  const state = store.get();
  const text = currentPayload();
  const matrix = buildMatrix(text, state.ecc);
  downloadSvg(
    renderToSvg(matrix, state.sizePx, {
      foreground: state.foreground,
      background: state.background,
    }, logoDataUrl),
    'codigo-qr.svg',
  );
});
```

Extraer también la función `currentPayload()` que hoy calcula `state.values.url ?? ''`,
para que `render()` y el botón SVG usen la misma fuente. En la Task 10 esa función pasa a
delegar en `content-types`.

Deshabilitar `svgBtn` junto a `pngBtn` en la rama de error de `render()`.

- [ ] **Step 6: Verificar a mano**

```bash
npm run dev
```

Descargar el SVG, abrirlo en el navegador y ampliarlo al 800%: los bordes deben seguir
perfectamente nítidos, sin escalones. Escanearlo también.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: renderizado y exportación en SVG"
```

---

### Task 6: Fase 2 completa — selectores de corrección y tamaño

**Files:**
- Create: `src/ui/controls.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `ECC_LEVELS`, `ECC_TOLERANCE`, `Store`.
- Produces:
  - `function mountEccControl(host: HTMLElement, store: Store): { setLocked(locked: boolean, reason: string): void }`
  - `function mountSizeControl(host: HTMLElement, store: Store): void`

`setLocked` existe desde ya porque la Task 8 la necesita para forzar el nivel H cuando hay
logo. Implementarla completa en esta tarea.

- [ ] **Step 1: Escribir `src/ui/controls.ts`**

```ts
import { ECC_LEVELS, ECC_TOLERANCE, type EccLevel } from '../qr-engine';
import type { Store } from '../state';

export const SIZES = [256, 512, 1024, 2048] as const;

export interface EccControl {
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
    <p class="hint" id="ecc-hint">
      Un nivel más alto resiste mejor la suciedad, los dobleces o un logo encima,
      a cambio de un patrón más denso.
    </p>
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
        hint.textContent =
          'Un nivel más alto resiste mejor la suciedad, los dobleces o un logo encima, ' +
          'a cambio de un patrón más denso.';
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
```

- [ ] **Step 2: Añadir el estilo de `.hint` a `src/styles.css`**

```css
.hint {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.45;
  color: var(--muted);
  max-width: 44ch;
}
```

- [ ] **Step 3: Montar los controles en `src/main.ts`**

```ts
import { mountEccControl, mountSizeControl } from './ui/controls';

const eccControl = mountEccControl(document.querySelector<HTMLElement>('#ecc-row')!, store);
mountSizeControl(document.querySelector<HTMLElement>('#size-row')!, store);
```

Guardar `eccControl` en el ámbito del módulo: la Task 8 lo usa.

- [ ] **Step 4: Verificar la Fase 2 a mano**

```bash
npm run dev
```

1. Cambiar de L a H con la misma URL: el patrón debe volverse **visiblemente más denso**
   y la lectura debe subir de versión.
2. Cambiar el tamaño a 2048 y descargar el PNG: el archivo debe medir 2048×2048.
3. El SVG descargado debe ser idéntico en apariencia al PNG.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: fase 2 — selectores de corrección de errores y tamaño"
```

---

### Task 7: Contraste (`contrast.ts`) y selectores de color

**Files:**
- Create: `src/contrast.ts`
- Test: `tests/contrast.test.ts`
- Modify: `src/ui/controls.ts` (añadir `mountColorControl`)
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: nada externo (lógica pura).
- Produces:
  - `function contrastRatio(hexA: string, hexB: string): number`
  - `function scanabilityWarning(foreground: string, background: string): string | null`
  - `function mountColorControl(host: HTMLElement, store: Store): void`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/contrast.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { contrastRatio, scanabilityWarning } from '../src/contrast';

describe('contrastRatio', () => {
  it('da 21 para negro sobre blanco', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  });

  it('da 1 para dos colores iguales', () => {
    expect(contrastRatio('#1F3BE0', '#1F3BE0')).toBeCloseTo(1, 5);
  });

  it('es simétrico', () => {
    expect(contrastRatio('#15171C', '#F6F7F9')).toBeCloseTo(
      contrastRatio('#F6F7F9', '#15171C'),
      5,
    );
  });

  it('acepta hex de tres dígitos', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 1);
  });
});

describe('scanabilityWarning', () => {
  it('no avisa con negro sobre blanco', () => {
    expect(scanabilityWarning('#000000', '#FFFFFF')).toBeNull();
  });

  it('avisa cuando el contraste es bajo', () => {
    const warning = scanabilityWarning('#777777', '#8A8A8A');
    expect(warning).toBeTypeOf('string');
    expect(warning).toContain('contraste');
  });

  it('avisa con más énfasis cuando el contraste es crítico', () => {
    const critical = scanabilityWarning('#808080', '#828282');
    expect(critical).toContain('no va a escanear');
  });
});
```

- [ ] **Step 2: Ejecutar los tests y comprobar que fallan**

```bash
npm test -- tests/contrast.test.ts
```

Esperado: FAIL, no se encuentra `../src/contrast`.

- [ ] **Step 3: Implementar `src/contrast.ts`**

```ts
/** Umbral por debajo del cual el código es poco fiable. */
const LOW = 4.5;
/** Umbral por debajo del cual, en la práctica, no se lee. */
const CRITICAL = 3;

function parseHex(hex: string): [number, number, number] {
  let value = hex.replace('#', '').trim();
  if (value.length === 3) {
    value = value
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const int = Number.parseInt(value, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

/** Luminancia relativa según WCAG 2.1. */
function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const [light, dark] = a > b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Devuelve un aviso legible si la combinación compromete el escaneo, o null si está bien.
 * Se avisa, nunca se impide: la decisión es del usuario.
 */
export function scanabilityWarning(foreground: string, background: string): string | null {
  const ratio = contrastRatio(foreground, background);
  const shown = ratio.toFixed(1);

  if (ratio < CRITICAL) {
    return `Contraste ${shown}:1 — este código no va a escanear. Oscurece el frente o aclara el fondo.`;
  }
  if (ratio < LOW) {
    return `Contraste ${shown}:1 — bajo. Puede fallar con poca luz o con cámaras modestas.`;
  }
  return null;
}
```

- [ ] **Step 4: Ejecutar los tests y comprobar que pasan**

```bash
npm test -- tests/contrast.test.ts
```

Esperado: 7 tests PASS.

- [ ] **Step 5: Añadir `mountColorControl` a `src/ui/controls.ts`**

El valor hexadecimal se muestra en monoespaciada, siguiendo la regla del sistema de
diseño: es un dato técnico.

```ts
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
```

- [ ] **Step 6: Añadir el estilo de los colores a `src/styles.css`**

```css
.colors { display: flex; align-items: end; gap: calc(var(--mod) * 2); flex-wrap: wrap; }
.color { display: grid; gap: calc(var(--mod) * 0.5); justify-items: start; }
.color input[type="color"] {
  width: 44px; height: 44px; padding: 0;
  border: 1px solid var(--line); border-radius: 2px;
  background: none; cursor: pointer;
}
.color__hex { font-family: var(--font-mono); font-size: 0.6875rem; color: var(--muted); }
.btn--quiet { padding: calc(var(--mod) * 1) calc(var(--mod) * 1.5); font-size: 0.8125rem; }
```

- [ ] **Step 7: Conectar el aviso en `src/main.ts`**

Dentro de `render()`, tras dibujar correctamente, sustituir `setAlert(null)` por:

```ts
setAlert(scanabilityWarning(state.foreground, state.background));
```

Montar el control:

```ts
import { scanabilityWarning } from './contrast';
import { mountColorControl } from './ui/controls';

mountColorControl(document.querySelector<HTMLElement>('#color-row')!, store);
```

- [ ] **Step 8: Verificar a mano**

Poner frente y fondo casi iguales: debe aparecer el aviso, el QR debe seguir generándose y
los botones de descarga deben seguir activos. Volver a negro sobre blanco: el aviso
desaparece.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: contraste y selectores de color con aviso de escaneabilidad"
```

---

### Task 8: Fase 3 completa — logo con nivel H forzado

**Files:**
- Modify: `src/ui/controls.ts` (añadir `mountLogoControl`)
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `EccControl.setLocked`, `setLogoDataUrl`, `Store`.
- Produces: `function mountLogoControl(host: HTMLElement, store: Store, onLogo: (dataUrl: string | null) => void): void`

- [ ] **Step 1: Añadir `mountLogoControl` a `src/ui/controls.ts`**

La imagen se lee con `FileReader` a data URI. Nunca se sube a ningún sitio: es coherente
con la promesa del producto y además permite incrustarla en el SVG exportado.

```ts
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
```

- [ ] **Step 2: Conectar en `src/main.ts` con el bloqueo del nivel H**

```ts
import { mountLogoControl } from './ui/controls';

mountLogoControl(document.querySelector<HTMLElement>('#logo-row')!, store, (dataUrl) => {
  setLogoDataUrl(dataUrl);
  eccControl.setLocked(
    dataUrl !== null,
    'Con un logo encima el nivel queda fijo en H: es el único que recupera el 30% del ' +
      'código y compensa la parte que el logo tapa.',
  );
});
```

- [ ] **Step 3: Verificar la Fase 3 a mano**

```bash
npm run dev
```

1. Subir un PNG: aparece centrado en la vista previa al instante.
2. El selector de corrección salta a H, queda deshabilitado y muestra la explicación.
3. «Quitar logo» lo elimina y vuelve a habilitar el selector.
4. Descargar el PNG **y** el SVG con logo: el logo debe aparecer en ambos.
5. **Criterio de aceptación: escanear el QR con logo en dos apps de cámara distintas.**

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: fase 3 — logo centrado con nivel de corrección H forzado"
```

---

### Task 9: Tipos de contenido (`content-types.ts`)

El escapado de WiFi es el punto donde un error pasa desapercibido: el QR se genera sin
protestar y falla al escanear. Por eso lleva tests exhaustivos.

**Files:**
- Create: `src/content-types.ts`
- Test: `tests/content-types.test.ts`

**Interfaces:**
- Consumes: nada externo (lógica pura).
- Produces:
  - `interface FieldDef { name: string; label: string; type: 'text' | 'url' | 'password' | 'tel' | 'email' | 'textarea' | 'select'; placeholder?: string; options?: { value: string; label: string }[]; required?: boolean }`
  - `interface ContentType { id: string; label: string; fields: FieldDef[]; serialize(values: Record<string, string>): string }`
  - `const CONTENT_TYPES: ContentType[]`
  - `function getContentType(id: string): ContentType`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/content-types.test.ts`:

```ts
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
    expect(
      type.serialize({ ssid: 'Red', password: 'a;b,c:d"e\\f', security: 'WPA' }),
    ).toBe('WIFI:T:WPA;S:Red;P:a\\;b\\,c\\:d\\"e\\\\f;;');
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
```

- [ ] **Step 2: Ejecutar los tests y comprobar que fallan**

```bash
npm test -- tests/content-types.test.ts
```

Esperado: FAIL, no se encuentra `../src/content-types`.

- [ ] **Step 3: Implementar `src/content-types.ts`**

```ts
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
 * Escapa los caracteres reservados del formato WIFI:.
 * Sin esto, una contraseña con «;» o «:» genera un código que parece correcto
 * y falla en el momento de escanear.
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
      },
    ],
    serialize({ ssid, password, security }) {
      const name = (ssid ?? '').trim();
      if (!name) return '';
      const type = security || 'WPA';
      const credential =
        type === 'nopass' || !password ? '' : `P:${escapeWifi(password)};`;
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
```

- [ ] **Step 4: Ejecutar los tests y comprobar que pasan**

```bash
npm test -- tests/content-types.test.ts
```

Esperado: 17 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content-types.ts tests/content-types.test.ts
git commit -m "feat: los cuatro tipos de contenido con escapado WiFi y vCard 3.0"
```

---

### Task 10: Fase 4 completa — formulario dinámico

**Files:**
- Create: `src/ui/fields.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `CONTENT_TYPES`, `getContentType`, `Store`.
- Produces:
  - `function mountTypePicker(host: HTMLElement, store: Store): void`
  - `function mountFields(host: HTMLElement, store: Store): void` — se vuelve a llamar cada vez que cambia el tipo.

- [ ] **Step 1: Escribir `src/ui/fields.ts`**

```ts
import { CONTENT_TYPES, getContentType, type FieldDef } from '../content-types';
import type { Store } from '../state';

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
    store.patch({ type: target.value, values: {} });
  });
}

function fieldMarkup(field: FieldDef, value: string): string {
  const id = `field-${field.name}`;
  const hint = field.hint ? `<p class="hint">${field.hint}</p>` : '';

  if (field.type === 'textarea') {
    return `<div class="field">
      <label for="${id}">${field.label}</label>
      <textarea id="${id}" data-field="${field.name}" placeholder="${field.placeholder ?? ''}">${value}</textarea>
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

  return `<div class="field">
    <label for="${id}">${field.label}</label>
    <input type="${field.type}" id="${id}" data-field="${field.name}"
           value="${value.replace(/"/g, '&quot;')}" placeholder="${field.placeholder ?? ''}" />
    ${hint}
  </div>`;
}

export function mountFields(host: HTMLElement, store: Store): void {
  const state = store.get();
  const type = getContentType(state.type);

  host.innerHTML = type.fields
    .map((field) => fieldMarkup(field, state.values[field.name] ?? defaultFor(field)))
    .join('');

  // Sembrar el estado con los valores por defecto de los select, para que la vista
  // previa sea correcta antes de que el usuario toque nada.
  const seeded: Record<string, string> = { ...state.values };
  for (const field of type.fields) {
    seeded[field.name] ??= defaultFor(field);
  }
  if (Object.keys(seeded).length !== Object.keys(state.values).length) {
    store.patch({ values: seeded });
  }

  host.addEventListener('input', (event) => handle(event, store));
  host.addEventListener('change', (event) => handle(event, store));
}

function defaultFor(field: FieldDef): string {
  return field.type === 'select' ? (field.options?.[0]?.value ?? '') : '';
}

function handle(event: Event, store: Store): void {
  const target = event.target as HTMLElement;
  const name = target.dataset.field;
  if (!name) return;
  const value = (target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  store.patch({ values: { ...store.get().values, [name]: value } });
}
```

- [ ] **Step 2: Añadir el estilo del selector de tipo y los campos**

```css
.types { display: flex; gap: var(--mod); flex-wrap: wrap; }
.type { position: relative; }
.type input { position: absolute; opacity: 0; inset: 0; cursor: pointer; }
.type span {
  display: block;
  padding: calc(var(--mod) * 1) calc(var(--mod) * 1.75);
  border: 1px solid var(--line);
  border-radius: 2px;
  background: var(--surface);
  font-size: 0.875rem;
  transition: border-color 120ms ease, color 120ms ease;
}
.type input:checked + span { border-color: var(--signal); color: var(--signal); }
.type input:focus-visible + span { outline: 2px solid var(--signal); outline-offset: 2px; }

.fields { display: grid; gap: calc(var(--mod) * 2); }
.field { display: grid; gap: calc(var(--mod) * 0.75); }
```

- [ ] **Step 3: Generalizar `src/main.ts`**

Sustituir el campo provisional de la Task 4 y la función `currentPayload()`:

```ts
import { getContentType } from './content-types';
import { mountTypePicker, mountFields } from './ui/fields';

function currentPayload(): string {
  const state = store.get();
  return getContentType(state.type).serialize(state.values);
}
```

En `render()`, usar `currentPayload()` y mostrar el vacío como estado invitador en vez de
como error:

```ts
const text = currentPayload();
payloadEl.textContent = text || '—';

if (!text) {
  clearCanvas();
  readoutEl.textContent = '';
  setAlert(null);
  pngBtn.disabled = true;
  svgBtn.disabled = true;
  return;
}
```

Montar el selector de tipo, y volver a montar los campos cuando el tipo cambie:

```ts
const typesEl = document.querySelector<HTMLElement>('#types')!;
mountTypePicker(typesEl, store);
mountFields(fieldsEl, store);

let lastType = store.get().type;
function onStateChange(): void {
  const type = store.get().type;
  if (type !== lastType) {
    lastType = type;
    mountFields(fieldsEl, store);
  }
  schedule();
}
```

Pasar `onStateChange` a `createStore` en lugar de `schedule` directamente. Eliminar el
bloque `fieldsEl.innerHTML = ...` provisional y su listener.

- [ ] **Step 4: Verificar la Fase 4 a mano**

```bash
npm run dev
```

1. Cambiar entre los cuatro tipos: los campos cambian y el bloque de payload muestra la
   cadena correcta en cada caso (`WIFI:...`, `BEGIN:VCARD...`).
2. Escribir un SSID que contenga `;` y confirmar que el payload lo muestra escapado.
3. **Criterio de aceptación: generar un QR de WiFi con una red real y comprobar que un
   celular se conecta al escanearlo.**
4. Generar un QR de contacto y comprobar que el celular ofrece guardar el contacto.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: fase 4 — formulario dinámico con cuatro tipos de contenido"
```

---

### Task 11: Cierre — README, verificación completa y notas de despliegue

**Files:**
- Create: `README.md`
- Modify: `index.html` (nota de pie)

- [ ] **Step 1: Ejecutar la verificación completa**

```bash
npm test
npm run build
```

Esperado: todos los tests PASS y `dist/` generado sin errores de TypeScript.

- [ ] **Step 2: Confirmar que no hay peticiones de red**

```bash
npm run preview
```

Abrir la pestaña Red de las herramientas del navegador, recargar, usar la app a fondo
(cambiar tipo, color, subir logo, descargar). Tras la carga inicial no debe aparecer
**ninguna** petición. Después, activar el modo sin conexión y comprobar que todo sigue
funcionando.

- [ ] **Step 3: Escribir `README.md`**

Debe cubrir: qué es y qué no es (sin QR dinámicos, sin servidor, sin rastreo), cómo
desarrollar (`npm install`, `npm run dev`, `npm test`), cómo compilar (`npm run build` →
`dist/`), y el bloque de Nginx para servir el sitio estático:

```nginx
server {
    listen 443 ssl http2;
    server_name qr.ccastillo.dev;

    root /var/www/qr;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|svg|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Incluir la nota de que `base: './'` permite servir el mismo `dist/` también desde una
subcarpeta de `ccastillo.dev`.

- [ ] **Step 4: Añadir la nota de pie en `index.html`**

Antes de `</main>`, dentro de `<body>`:

```html
<footer class="colophon">
  <p>
    Este generador no crea códigos dinámicos: no hay redirección intermedia que pueda
    caerse, cambiar de destino o contar quién escanea. Lo que ves en el bloque de arriba
    es exactamente lo que queda grabado en el código.
  </p>
</footer>
```

Con su estilo:

```css
.colophon {
  max-width: 68ch;
  margin: calc(var(--mod) * 8) auto 0;
  padding-top: calc(var(--mod) * 3);
  border-top: 1px solid var(--line);
}
.colophon p { margin: 0; font-size: 0.8125rem; color: var(--muted); max-width: 60ch; }
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: README con instrucciones de despliegue y nota de cierre"
```

---

## Cobertura del spec

| Requisito del spec | Tarea |
|---|---|
| Pipeline de cuatro etapas | 2, 3, 4, 9 |
| Renderizado propio sobre matriz cruda | 2, 3 |
| Fase 1 — MVP con PNG | 4 |
| Fase 2 — SVG, ECC, tamaño | 5, 6 |
| Fase 3 — colores, contraste, logo, H forzado | 7, 8 |
| Fase 4 — URL, texto, WiFi, vCard | 9, 10 |
| Zona silenciosa de 4 módulos | 3, 5 |
| Manejo de contenido demasiado largo | 2, 4 |
| Sin peticiones de red | 1, 11 |
| Mobile-first, dos columnas en escritorio | 1 |
| `base: './'` | 1 |
| Tests de lógica pura | 2, 3, 5, 7, 9 |
| Despliegue en Nginx | 11 |
