# Formas, verificación en vivo y tipos nuevos — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Añadir verificación de escaneo en vivo, formas personalizables de módulos y ojos, y cinco tipos de contenido nuevos.

**Architecture:** El cambio estructural es unificar la geometría. Hoy el canvas pinta píxeles y el SVG construye un `path`: dos implementaciones de la misma forma. Se sustituyen por un único módulo `geometry.ts` que produce descripciones de trazado en coordenadas de módulo; el canvas las rellena con `Path2D` y el SVG las incrusta literalmente. Sobre esa base, las formas son una variación del trazado y salen idénticas en ambos formatos.

**Tech Stack:** Se añade `jsqr` como dependencia de producción para la verificación. Al planificar se estimó en ~10 KB; medido en el build resultó ser 130 KB (47 KB comprimido), casi cuatro veces el resto de la aplicación, así que se carga en un chunk aparte mediante importación dinámica y la verificación pasa a ser asíncrona.

## Global Constraints

Siguen vigentes todas las del plan anterior, y en particular:

- **Sin peticiones de red en tiempo de ejecución.** `jsqr` se empaqueta en el build.
- **Sin códigos dinámicos, sin backend, sin cuentas, sin analítica.**
- **Zona silenciosa de 4 módulos** en todo código generado y exportado.
- Interfaz en español, en minúscula tipo oración.
- La interfaz es monocroma salvo foco y estado activo; el color libre es el del usuario.
- Monoespaciada para lo que lee la máquina, sans para lo que lee la persona.

## Decisiones de diseño

**La verificación mide el canvas real, con logo.** El logo se dibuja después de los
módulos y es lo que más rompe la lectura. Verificar la matriz sin logo certificaría algo
distinto de lo que el usuario descarga. Se usa un canvas oculto a resolución fija (512 px)
que pasa por el mismo `drawToCanvas`, de modo que incluye formas, colores y logo.

**La verificación no bloquea.** Muestra la evidencia y el usuario decide, igual que el
aviso de contraste actual. El contraste deja de ser la advertencia principal y pasa a ser
la explicación probable cuando la verificación falla.

**Los ojos se dibujan analíticamente, no desde la matriz.** Los tres patrones de
localización ocupan posiciones fijas y su proporción 1:1:3:1:1 es lo que busca el escáner.
Dibujarlos como figura propia garantiza que ningún estilo la altere.

**El test de round-trip usa su propio rasterizador.** Al pasar el renderizador a trazados,
el test deja de poder reutilizarlo. Se le da un rasterizador de referencia propio, lo que
además lo vuelve independiente de la pieza que comprueba.

---

### Task 1: Geometría unificada (`geometry.ts`)

**Files:**
- Create: `src/geometry.ts`
- Test: `tests/geometry.test.ts`

**Interfaces:**
- Produces:
  - `type BodyShape = 'square' | 'rounded' | 'dot' | 'fluid'`
  - `type EyeShape = 'square' | 'rounded' | 'circle' | 'leaf'`
  - `interface ShapeStyle { body: BodyShape; eye: EyeShape }`
  - `interface Geometry { body: string; eyes: string }` — trazados `d` en coordenadas de módulo, con la zona silenciosa ya sumada.
  - `function buildGeometry(matrix: QrMatrix, shape: ShapeStyle): Geometry`
  - `function isFinderModule(matrix: QrMatrix, row: number, col: number): boolean`
  - `const BODY_SHAPES`, `const EYE_SHAPES` con etiqueta en español para la interfaz.

- [ ] **Step 1: Tests de detección de patrones de localización y de invariantes del trazado**

Los tests comprueban: que los tres patrones se detectan y ningún otro módulo, que ninguna
coordenada del trazado cae fuera de la zona útil (esto sustituye a la comprobación de
píxeles de la zona silenciosa), y que cada forma produce un trazado no vacío.

- [ ] **Step 2: Ejecutar y ver fallar**

- [ ] **Step 3: Implementar**

Helpers de trazado (`roundedRectPath`, `circlePath`) con coordenadas redondeadas a 3
decimales. El cuerpo recorre los módulos oscuros que no pertenecen a un patrón de
localización. En `fluid`, cada esquina se redondea solo si los dos vecinos que la forman
están vacíos. Los ojos se dibujan en las tres esquinas: anillo exterior 7×7 con hueco 5×5
(regla `evenodd`) y centro 3×3.

- [ ] **Step 4: Ejecutar y ver pasar**

- [ ] **Step 5: Commit**

---

### Task 2: Renderizador sobre la geometría

**Files:**
- Modify: `src/renderer.ts`
- Modify: `tests/renderer.test.ts`, `tests/svg.test.ts`
- Create: `tests/helpers/rasterize.ts`
- Modify: `tests/decode.test.ts`

**Interfaces:**
- `RenderStyle` gana `shape: ShapeStyle` y `eyeColor: string | null` (null = usa el color del cuerpo).
- `drawToCanvas` rellena `Path2D` con transformación de escala.
- `renderToSvg` incrusta los mismos trazados.
- Se elimina `renderToPixels` de `src`; el rasterizador de referencia pasa a `tests/helpers/`.

- [ ] **Step 1: Escribir el rasterizador de referencia del test**
- [ ] **Step 2: Adaptar `decode.test.ts` para usarlo, y verlo pasar**
- [ ] **Step 3: Reescribir `drawToCanvas` y `renderToSvg` sobre `buildGeometry`**
- [ ] **Step 4: Sustituir el test de píxeles de la zona silenciosa por el de geometría**
- [ ] **Step 5: Suite completa en verde y `npm run build` en exit 0**
- [ ] **Step 6: Commit**

---

### Task 3: Verificación de escaneo (`verify.ts`)

**Files:**
- Create: `src/verify.ts`
- Modify: `src/main.ts`, `index.html`, `src/styles.css`
- Modify: `package.json` (jsqr pasa a `dependencies`)

**Interfaces:**
- `interface Verification { ok: boolean; decoded: string | null; matches: boolean }`
- `function verify(canvas: HTMLCanvasElement, expected: string): Verification`
- `function createVerifier(): (matrix, style, expected) => Verification` — mantiene el canvas oculto de 512 px.

Estados en la interfaz:

| Estado | Texto |
|---|---|
| Correcto | `✓ verificado · se lee y devuelve exactamente esto` |
| No se lee | `⚠ no se lee · <causa probable>` |
| Difiere | `⚠ se lee, pero devuelve otra cosa` (no debería ocurrir; si ocurre es un fallo grave) |

Cuando falla, la causa probable sale de `contrast.ts` si el contraste es bajo, del tamaño
del logo si hay logo, o de la forma elegida si es `dot`.

- [ ] **Step 1: Implementar `verify.ts`**
- [ ] **Step 2: Añadir el bloque de estado a `index.html` y su estilo**
- [ ] **Step 3: Conectar en `main.ts`, sustituyendo el aviso de contraste como advertencia principal**
- [ ] **Step 4: Medir el coste de la verificación; si supera ~50 ms, verificar en `requestIdleCallback`**
- [ ] **Step 5: Verificar en el navegador: código válido, código con logo, y combinación de colores que rompe la lectura**
- [ ] **Step 6: Commit**

---

### Task 4: Controles de forma

**Files:**
- Modify: `src/ui/controls.ts`, `src/main.ts`, `src/state.ts`, `src/styles.css`, `index.html`

- [ ] **Step 1: `mountShapeControl` con dos filas de botones (cuerpo y ojos) y selector de color de ojo**
- [ ] **Step 2: Estilo de los botones de forma, con muestra visual de cada opción**
- [ ] **Step 3: Conectar al estado y al render**
- [ ] **Step 4: Verificar en el navegador que las 16 combinaciones se dibujan y se verifican**
- [ ] **Step 5: Commit**

---

### Task 5: Cinco tipos de contenido nuevos

**Files:**
- Modify: `src/content-types.ts`, `tests/content-types.test.ts`, `tests/decode.test.ts`
- Modify: `src/ui/fields.ts` (nuevo tipo de campo `datetime-local`)

Formatos:

| Tipo | Formato |
|---|---|
| Llamada | `tel:<numero>` |
| SMS | `SMSTO:<numero>:<mensaje>` |
| Correo | `mailto:<dir>?subject=…&body=…` con `encodeURIComponent` |
| Ubicación | `geo:<lat>,<lon>` |
| Evento | `BEGIN:VEVENT … END:VEVENT` con escapado RFC 5545 |

El escapado de `VEVENT` (`\` `;` `,` y salto de línea) es tan silencioso como el de WiFi:
sin él la importación al calendario falla sin avisar. Lleva tests propios.

- [ ] **Step 1: Tests de los cinco formatos, incluido el escapado de VEVENT**
- [ ] **Step 2: Ejecutar y ver fallar**
- [ ] **Step 3: Implementar los cinco tipos y el campo `datetime-local`**
- [ ] **Step 4: Ejecutar y ver pasar; añadir round-trip de evento y correo a `decode.test.ts`**
- [ ] **Step 5: Verificar en el navegador que la fila de nueve pastillas se reordena bien en móvil**
- [ ] **Step 6: Commit**

---

### Task 6: Cierre

- [ ] **Step 1: Suite completa y `npm run build`**
- [ ] **Step 2: Comprobar que no hay peticiones de red en el build**
- [ ] **Step 3: Actualizar `README.md` con las funciones nuevas y la nota sobre qué garantiza cada capa de verificación**
- [ ] **Step 4: Commit**
