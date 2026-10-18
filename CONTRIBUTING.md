# Contribuir

Antes de proponer un cambio grande, abre un issue para explicar el problema y la solución.

## Preparar el proyecto

Usa Node.js 22.13 o superior y npm (recomendado: la última versión 22 LTS):

```bash
npm ci
npm run dev
```

Antes de enviar una pull request:

```bash
npm test
npm run build
```

## Principios del proyecto

- El contenido se procesa en el navegador.
- El código contiene el destino o contenido final, sin acortadores propios.
- No se añaden cuentas, publicidad ni analítica de escaneos.
- Las dependencias se empaquetan localmente, sin CDN necesarios para generar códigos.
- La interfaz debe funcionar en móvil y con teclado.

Mantén los cambios enfocados. Si modificas formatos, escapados o geometría, incluye pruebas
que detecten un fallo real. Si cambias la apariencia, añade una captura en la pull request
y comprueba que la exportación sigue siendo legible.

## Reportar un problema

Indica pasos para reproducirlo, navegador, dispositivo y resultado esperado. Usa datos
ficticios: no adjuntes contraseñas WiFi, contactos privados ni códigos con información sensible.

Para añadir un tipo de contenido, revisa `src/content-types.ts` y sus pruebas. Para formas
y exportación, revisa `src/geometry.ts` y `src/renderer.ts`.

La licencia del proyecto sigue pendiente de definición; esta guía no concede permisos
adicionales de uso o redistribución.
