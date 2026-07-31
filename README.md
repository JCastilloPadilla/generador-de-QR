# Generador de QR

Generador de códigos QR que funciona por completo en el navegador. El contenido nunca
sale del dispositivo y el código apunta siempre al destino final directo.

## Qué es, y qué no es

**Lo que hace**

- Genera códigos QR de nueve tipos: enlace, texto, WiFi, contacto (vCard), llamada,
  SMS, correo, ubicación y evento de calendario.
- Exporta a PNG (cuatro tamaños) y a SVG vectorial.
- Permite elegir el nivel de corrección de errores, los colores, la forma de los módulos
  y de las esquinas, y un logo central.
- Muestra en todo momento la cadena exacta que se está codificando.
- **Se verifica a sí mismo**: decodifica el código que acaba de dibujar y dice si se lee.

**Lo que no hace, a propósito**

- **No genera códigos dinámicos.** No existe una URL intermedia propia que redirija.
  Un código dinámico deja de funcionar el día que el servicio cierra, y permite contar
  quién escanea. Aquí el código contiene el destino real y no depende de nadie.
- **No envía nada a ningún servidor.** No hay backend. El cálculo del patrón, el
  renderizado, el logo y las descargas ocurren en el navegador.
- **No hay cuentas, ni publicidad, ni analítica individual.**

## Desarrollo

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

Los tests cubren la lógica donde un error pasa desapercibido: el escapado de WiFi, el
formato de la vCard y el cálculo de contraste.

`tests/decode.test.ts` renderiza el código a píxeles y lo vuelve a leer con un
decodificador independiente. Eso verifica el extremo de la codificación —que un SSID con
`;` o un texto con acentos vuelven exactamente como entraron— en los cuatro niveles de
corrección y los cuatro tamaños. **No** verifica la geometría del dibujado: los
decodificadores toleran desplazamientos, espejados e incluso la ausencia de zona
silenciosa, así que un round-trip correcto no demuestra que el renderizado lo sea.

Por eso la zona silenciosa se comprueba aparte, en `tests/renderer.test.ts`, leyendo
directamente los píxeles del borde contra el valor literal de 4 módulos.

## Compilar para producción

```bash
npm run build
```

Genera `dist/` con archivos estáticos. `npm run preview` sirve ese build en local para
comprobarlo antes de subirlo.

`vite.config.ts` usa `base: './'`, así que el mismo `dist/` funciona tanto en un
subdominio (`qr.ccastillo.dev`) como en una subcarpeta (`ccastillo.dev/qr/`), sin
recompilar distinto.

## Despliegue con Nginx

Copiar el contenido de `dist/` al servidor y servirlo como sitio estático:

```nginx
server {
    listen 443 ssl http2;
    server_name qr.ccastillo.dev;

    root /var/www/qr;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Los nombres de archivo llevan hash, así que se pueden cachear indefinidamente.
    location ~* \.(js|css|svg|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Para servirlo desde una subcarpeta, basta con un `location /qr/ { alias /var/www/qr/; }`
apuntando al mismo directorio.

## Arquitectura

Pipeline unidireccional de cuatro etapas:

```
content-types.ts   formulario            →  cadena final a codificar
        ↓
qr-engine.ts       cadena + nivel ECC    →  matriz de módulos
        ↓
geometry.ts        matriz + forma        →  trazados en coordenadas de módulo
        ↓
renderer.ts        trazados               →  canvas  |  SVG
        ↓                                        ↓
export.ts          descarga PNG | SVG      verify.ts  ¿se vuelve a leer?
```

| Archivo | Responsabilidad |
|---|---|
| `src/qr-engine.ts` | Único módulo que conoce la librería `qrcode`. Devuelve la matriz cruda. |
| `src/geometry.ts` | Traduce la matriz a trazados en coordenadas de módulo. Formas y zona silenciosa. |
| `src/renderer.ts` | Lleva esos trazados a canvas y a SVG. Color y logo. |
| `src/verify.ts` | Decodifica el código dibujado y explica la causa probable si no se lee. |
| `src/content-types.ts` | Los cuatro tipos, declarados como dato: campos y serialización. |
| `src/contrast.ts` | Luminancia relativa y avisos de escaneabilidad. |
| `src/export.ts` | Descargas mediante blobs locales. |
| `src/state.ts` | Estado de la aplicación. |
| `src/ui/` | Construcción del formulario y de los controles. |

**Por qué renderizado propio.** Se usa `QRCode.create()` en vez de `toCanvas()` o
`toString()` para quedarse con la matriz de módulos. Los renderizadores de la librería no
admiten un logo superpuesto ni control fino del dibujado. Partiendo de la matriz, el PNG y
el SVG salen de la misma fuente de verdad y son idénticos, y la lógica de color, zona
silenciosa y logo vive en un solo sitio. La librería sigue resolviendo lo difícil:
corrección de errores Reed-Solomon y selección de máscara.

## Las tres capas de verificación, y qué garantiza cada una

Ninguna sustituye a las otras. Están ordenadas de más barata a más real.

| Capa | Qué comprueba | Qué **no** comprueba |
|---|---|---|
| `tests/decode.test.ts` | Que lo serializado vuelve idéntico tras pasar por un QR y un lector. Cubre escapados y juegos de caracteres. | La geometría del dibujado: los lectores toleran desplazamientos, espejados y hasta la falta de zona silenciosa. |
| `tests/geometry.test.ts` | Que el trazado respeta la zona silenciosa y excluye los patrones de localización, en las 16 combinaciones de forma. | Que el resultado se lea. |
| Verificación en vivo (`src/verify.ts`) | Que el código real —con su forma, sus colores y su logo— se decodifica y devuelve lo esperado. | Que se lea **impreso**, en papel y con poca luz. De eso avisa `contrast.ts`. |

La verificación en vivo no bloquea la descarga. Muestra la evidencia y la decisión sigue
siendo del usuario: hay combinaciones que un lector rechaza y una cámara concreta acepta.

El lector pesa 130 KB, casi cuatro veces el resto de la aplicación junta, así que se carga
en un chunk aparte en cuanto termina la primera pintada. El código aparece al instante y
la verificación llega un momento después, sin retrasar nada.

Esta capa ya se ganó el sueldo: detectó que la forma de punto con radio 0.42 no se leía
en ninguna de sus combinaciones, porque los huecos entre módulos parten el patrón de
sincronización.

## Detalles que determinan si un código escanea

- **Zona silenciosa de 4 módulos**, siempre, incluida en la exportación. Su ausencia es la
  causa más común de códigos que no se leen.
- **Tamaño de módulo entero en píxeles.** Un módulo fraccionario produce bordes borrosos
  por antialiasing, y los bordes borrosos son la segunda causa.
- **Escapado de WiFi.** Los caracteres `\ ; , : "` en el SSID o la contraseña se escapan
  con barra invertida. Sin eso, el código se genera sin protestar y falla al escanear.
- **Logo → nivel H obligatorio.** Con logo el nivel queda fijo en H (recupera el 30%) y el
  logo se limita al 22% del área, sobre un margen del color de fondo.
- **Aviso de contraste.** Se advierte por debajo de 4.5:1 y con más énfasis por debajo de
  3:1. Se avisa, nunca se impide: la decisión es del usuario.

## Fuera de alcance

Cuentas de usuario, códigos dinámicos o acortador propio, analítica de escaneo, y backend
de cualquier tipo.
