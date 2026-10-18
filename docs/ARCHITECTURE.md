# Arquitectura

La aplicación se distribuye como archivos estáticos. El contenido del usuario se serializa,
se convierte en una matriz QR y se dibuja localmente. No hay API ni base de datos.

| Módulo | Responsabilidad |
| --- | --- |
| `src/main.ts` | Orquestación, actualización de vista previa y eventos. |
| `src/state.ts` | Estado de contenido, exportación y apariencia. |
| `src/content-types.ts` | Campos declarativos y serialización de los nueve tipos. |
| `src/qr-engine.ts` | Cálculo de la matriz mediante `QRCode.create()`. |
| `src/geometry.ts` | Trazados de módulos y esquinas, con zona silenciosa. |
| `src/renderer.ts` | Dibujo en canvas y exportación SVG desde la geometría común. |
| `src/verify.ts` | Decodificación local a resolución fija de 512 px. |
| `src/contrast.ts` | Luminancia relativa y avisos de contraste. |
| `src/export.ts` | Descargas con blobs locales. |
| `src/ui/` | Construcción de campos y controles. |
| `src/background.tsx` | Fondo animado con React y Paper Shaders. |

## Decisiones de diseño

`qrcode` resuelve la codificación, la corrección de errores y la selección de máscara.
El proyecto conserva el control del renderizado para admitir formas, colores y logos.
Canvas utiliza `Path2D` y SVG incorpora los mismos trazados; el escalado y redondeo de
píxeles pueden producir diferencias entre formatos.

La zona silenciosa es de cuatro módulos. El PNG utiliza una escala entera por módulo.
Con un logo activo se fuerza el nivel H. El lado del logo se limita al 22 % del lado
útil del QR, más un respaldo del color de fondo; eso no significa que se tape el 22 %
del área ni garantiza que cualquier logo se pueda leer.

## Qué comprueban las pruebas

| Capa | Comprueba | Límite |
| --- | --- | --- |
| Serialización | Escapados y formatos de WiFi, vCard, SMS, correo, ubicación y evento. | La interpretación puede variar entre aplicaciones móviles. |
| Geometría | Trazados, patrones de localización y márgenes. | No sustituye una lectura real. |
| Round-trip | La matriz rasterizada por un ayudante de pruebas vuelve al contenido original con jsQR. | Ese rasterizador es independiente del dibujado de producción. |
| Verificación en vivo | El diseño con sus formas, colores y logo se lee a 512 px. | No verifica cada resolución exportada ni las condiciones físicas de impresión. |

La verificación no bloquea la descarga. Un resultado correcto en pantalla no garantiza
la lectura con todas las cámaras, tamaños o condiciones de iluminación. Los porcentajes
de corrección de errores tampoco equivalen a un porcentaje de superficie que pueda taparse.

## Cargas y conexión

El lector y el fondo se cargan por separado. Todos los recursos se sirven con la aplicación;
la generación no depende de APIs externas. Para usar la pestaña sin conexión deben haber
terminado de cargar los recursos necesarios. No hay service worker ni instalación PWA.

[Volver al README](../README.md)
