# Generador de QR

Generador de códigos QR que funciona por completo en el navegador. El contenido nunca
sale del dispositivo y el código apunta siempre al destino final directo.

## Qué es, y qué no es

**Lo que hace**

- Genera códigos QR de enlaces, texto, redes WiFi y contactos (vCard).
- Exporta a PNG (cuatro tamaños) y a SVG vectorial.
- Permite elegir el nivel de corrección de errores, los colores y un logo central.
- Muestra en todo momento la cadena exacta que se está codificando.

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
formato de la vCard y el cálculo de contraste. Además, `tests/decode.test.ts` renderiza
el código a píxeles y lo vuelve a leer con un decodificador independiente, porque un QR
puede generarse sin errores y aun así no escanear.

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
renderer.ts        matriz                →  canvas  |  SVG
        ↓
export.ts          canvas / SVG          →  descarga PNG | SVG
```

| Archivo | Responsabilidad |
|---|---|
| `src/qr-engine.ts` | Único módulo que conoce la librería `qrcode`. Devuelve la matriz cruda. |
| `src/renderer.ts` | Dibuja la matriz en canvas y en SVG. Zona silenciosa, color y logo. |
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
