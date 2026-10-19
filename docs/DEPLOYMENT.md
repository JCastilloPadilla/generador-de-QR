# Despliegue estático

La instancia pública está en **[qr.ccastillo.dev](https://qr.ccastillo.dev/)**, servida
por Apache en el VPS. Su configuración y mantenimiento están documentados en
[infra/qr.ccastillo.dev/README.md](../infra/qr.ccastillo.dev/README.md).
El ejemplo de Nginx de esta guía es una alternativa para otros servidores.

```bash
npm ci
npm test
npm run build
npm run preview
```

Revisa la compilación local y copia el contenido de `dist/` al directorio público del servidor.
No necesitas ejecutar Node.js en producción. Vite usa `base: './'` para generar rutas relativas.

## Nginx

Ejemplo HTTP para un dominio dedicado; sustituye el dominio y directorio por los tuyos.
Configura HTTPS y sus certificados por separado antes de publicar.

```nginx
server {
    listen 80;
    server_name qr.example.com;
    root /var/www/qr;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    # Solo assets con hash generados por Vite.
    location /assets/ {
        try_files $uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Para publicar en `/qr/`, copia `dist/` dentro del directorio `qr` de la raíz pública
y sirve esa ruta con su `index.html`. Comprueba los enlaces de navegación al usar
una subcarpeta: las rutas absolutas como `/` siguen apuntando a la raíz del dominio.

## Comprobación manual

- Genera un QR y confirma que su contenido visible coincide con lo que querías codificar.
- Descarga PNG y SVG, y prueba ambos con una cámara o lector.
- Si usas logo, colores o formas, prueba también el tamaño físico final.
- Revisa móvil, teclado y preferencia de movimiento reducido.
- Confirma que los recursos y chunks se sirven desde tu propio dominio.

La aplicación no incorpora analítica, pero los registros de Nginx dependen de tu configuración.

[Volver al README](../README.md)
