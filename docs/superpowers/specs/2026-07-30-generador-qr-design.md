# Generador de QR local — Diseño

Fecha: 2026-07-30
Estado: aprobado

## Propósito

Generador de códigos QR que funciona por completo en el navegador. El contenido del
usuario nunca sale de su dispositivo. El QR codifica siempre el destino final directo,
nunca un redireccionamiento propio.

## Principios innegociables

Estos condicionan cada decisión técnica. Si una funcionalidad futura los contradice,
se descarta la funcionalidad.

1. **Sin QR dinámicos.** El QR contiene la URL real, el texto real, la red WiFi real.
   Nada de acortadores propios ni redirecciones intermedias.
2. **Sin servidor.** Todo el cálculo ocurre en el navegador. No existe backend.
3. **Sin publicidad, sin tracking individual, sin cuentas.**
4. **Offline tras la carga inicial.** Cero peticiones de red durante el uso: sin fuentes
   externas, sin CDN, sin APIs.

## Stack

- HTML + CSS + **TypeScript**, sin framework. La app es un formulario y un canvas;
  React o Vue añadirían complejidad sin resolver ningún problema real.
- **Vite** como bundler. Compila TypeScript sin configuración adicional y produce un
  build estático limpio.
- **`qrcode`** (npm) para el cálculo del patrón. No se reimplementa Reed-Solomon.
- **Vitest** para la lógica pura.
- Despliegue: archivos estáticos servidos por Nginx en un VPS.

## Arquitectura

Pipeline unidireccional de cuatro etapas:

```
content-types.ts   texto/URL/WiFi/vCard  →  string final a codificar
        ↓
qr-engine.ts       string + nivel ECC    →  matriz de módulos
        ↓
renderer.ts        matriz                →  canvas  |  string SVG
        ↓
export.ts          canvas/svg            →  descarga PNG | SVG
```

### Decisión central: renderizado propio sobre la matriz cruda

Se usa `QRCode.create(texto, { errorCorrectionLevel })`, que devuelve la matriz de
módulos, en lugar de `QRCode.toCanvas()` o `QRCode.toString()`.

Motivo: los renderers incluidos en la librería no permiten superponer un logo ni
controlar el dibujado con precisión. Partiendo de la matriz cruda, el canvas y el SVG
se derivan de la misma fuente de verdad — el PNG y el SVG resultan idénticos — y la
lógica de color, zona silenciosa y logo vive en un único lugar en vez de duplicarse
en dos renderers que pueden divergir.

La librería sigue resolviendo lo difícil: corrección de errores y selección de máscara.

### Estructura de archivos

```
.
├── index.html
├── src/
│   ├── main.ts            # estado de la app y orquestación
│   ├── qr-engine.ts       # wrapper de qrcode → matriz de módulos
│   ├── renderer.ts        # matriz → canvas / SVG (color, logo, quiet zone)
│   ├── content-types.ts   # definición declarativa de los cuatro tipos
│   ├── contrast.ts        # ratio de luminancia y avisos de escaneabilidad
│   ├── export.ts          # descargas PNG y SVG
│   ├── ui/fields.ts       # construye el formulario según el tipo elegido
│   └── styles.css
├── tests/
├── package.json
├── vite.config.ts
└── README.md
```

Dos archivos se añaden sobre la propuesta inicial:

- **`contrast.ts`**: lógica pura y aislable. No pertenece al renderer, que dibuja.
- **`ui/fields.ts`**: separa *cómo se serializa un tipo* (dato) de *cómo se dibuja su
  formulario* (DOM). Añadir un tipo de contenido nuevo pasa a ser editar una tabla,
  no ramificar un `if/else`.

### Modelo de los tipos de contenido

Cada tipo se declara como dato. La UI se genera a partir de la declaración:

```ts
{
  id: 'wifi',
  label: 'WiFi',
  fields: [ { name: 'ssid', ... }, { name: 'password', type: 'password' }, ... ],
  serialize: (v) => `WIFI:T:${v.security};S:${esc(v.ssid)};P:${esc(v.password)};;`
}
```

### Estado y flujo

Un único objeto de estado y una función de render. Cualquier cambio en el formulario o
en los controles actualiza el estado y redibuja.

**Vista previa en vivo con debounce de ~150 ms, sin botón "Generar".** Generar un QR
cuesta menos de un milisegundo; un botón intermedio solo añade fricción. El único botón
de acción es *Descargar*. Esta decisión sustituye al botón "Generar" del plan original,
que además entraba en conflicto con la vista previa en vivo exigida en la Fase 3.

## Fases

Cada fase debe quedar funcional antes de empezar la siguiente.

### Fase 1 — MVP

Input de texto/URL, preview en vivo en canvas, nivel de corrección fijo en M,
descarga en PNG.

*Aceptación:* escribir una URL, ver el QR, descargarlo, escanearlo con el celular y que
abra la URL correcta.

### Fase 2 — Exportación y calidad

Exportación a SVG. Selector de nivel de corrección de errores (L/M/Q/H) con una nota
sobre el compromiso: más corrección significa un patrón más denso pero más resistente a
daño o a un logo encima. Selector de tamaño de salida en píxeles.

*Aceptación:* el SVG se ve nítido a cualquier escala; cambiar el nivel de corrección
cambia visiblemente la densidad del patrón.

### Fase 3 — Personalización visual

Colores de frente y fondo. Subida de logo para el centro.

- Con logo activo se **fuerza el nivel H**. El selector queda bloqueado con la
  explicación visible en pantalla, no oculto: el objetivo es que el usuario entienda
  por qué.
- El logo se limita a ~22% del área del QR y se dibuja sobre un margen del color de
  fondo, para no fragmentar módulos en los bordes.
- **Contraste**: aviso cuando el ratio de luminancia cae por debajo de 4.5:1 y alerta
  destacada por debajo de 3:1. Se advierte, no se prohíbe.

*Aceptación:* un QR con logo centrado escanea correctamente en al menos dos apps de
cámara distintas.

### Fase 4 — Tipos de contenido

URL, texto plano, WiFi y vCard. El formulario cambia sus campos según el tipo elegido.

- WiFi: formato `WIFI:T:<tipo>;S:<ssid>;P:<password>;;`. Los caracteres `\ ; , : "`
  presentes en el SSID o la contraseña **deben escaparse con barra invertida**; sin ese
  escapado el QR se genera corrupto y falla en silencio.
- vCard: vCard 3.0 con nombre, teléfono, correo y empresa.

*Aceptación:* un QR de WiFi conecta automáticamente un celular a una red de prueba.

### Fase 5 — Fuera del alcance actual

Modo educativo de tolerancia a daño e historial en localStorage. No se construyen ahora.

## Calidad del QR

- **Zona silenciosa de 4 módulos**, siempre, incluida en la exportación. Su ausencia es
  la causa más común de códigos que no escanean.
- Manejo explícito del caso "contenido demasiado largo para el nivel de corrección
  elegido": mensaje claro, no un fallo silencioso.

## Interfaz

- Minimalista. Sin banners, sin funciones ocultas tras un plan de pago.
- **Mobile-first**: una columna en móvil con el QR visible arriba; dos columnas en
  escritorio, con controles a la izquierda y vista previa fija a la derecha.
- Tipografía del sistema. No se cargan fuentes externas, por coherencia con el
  requisito de funcionamiento offline.
- La identidad visual concreta —paleta, escala tipográfica, densidad— se define durante
  la implementación con la skill `frontend-design`.

## Tests

Vitest sobre la lógica pura, donde los errores son silenciosos y caros:

- Escapado de caracteres especiales en WiFi.
- Formato de la vCard generada.
- Cálculo del ratio de contraste y sus umbrales.
- Comportamiento ante contenido que excede la capacidad del código.

El renderizado se valida escaneando con dispositivos reales, según los criterios de
aceptación de cada fase.

## Despliegue

Build estático servido por Nginx. `base: './'` en la configuración de Vite, de modo que
el mismo build funcione tanto en un subdominio (`qr.ccastillo.dev`) como en una
subcarpeta de `ccastillo.dev`. La decisión del dominio no obliga a recompilar distinto.

## Fuera de alcance

Cuentas de usuario o login. QR dinámicos o acortador propio. Analytics de escaneo.
Backend de cualquier tipo.
