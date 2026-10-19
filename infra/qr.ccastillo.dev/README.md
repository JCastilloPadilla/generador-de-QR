# qr.ccastillo.dev

Sitio estático independiente en el VPS, servido por Apache. No requiere un proceso Node.js.
Las claves SSH permanecen en la máquina del operador y no se incluyen en el repositorio.

Publicado el 18 de octubre de 2026. Certificado de Let's Encrypt emitido para este
subdominio y prueba de renovación ejecutada con éxito. El respaldo previo a la
instalación está en `/var/backups/qr.ccastillo.dev/20261019T000639Z/` (fecha UTC).

## Configuración

- DNS: registro A `qr` hacia la IPv4 pública del VPS; TTL 300.
- Webroot: `/var/www/qr.ccastillo.dev/public_html`.
- HTTP: `/etc/apache2/sites-available/qr.ccastillo.dev.conf` (`http.conf`).
- HTTPS: `/etc/apache2/sites-available/qr.ccastillo.dev-ssl.conf` (`https.conf`).
- Reglas: `/etc/apache2/qr.ccastillo.dev-security.conf` (`security.conf`).
- Certificado independiente: `/etc/letsencrypt/live/qr.ccastillo.dev/`.
- Renovación: `certbot.timer` y hook `qr-ccastillo-dev-apache-reload`.
- Permisos: propietario `ubuntu:www-data`, directorios 755 y archivos 644.

Las configuraciones de `ccastillo.dev` y `ccastillo.me` se conservan. Los directorios
no se listan y los archivos ocultos, respaldos, claves y scripts PHP están bloqueados.
Solo se transfiere el contenido compilado de `dist/`, nunca las fuentes ni credenciales.

## Primera instalación

1. Ejecutar `npm ci`, `npm test` y `npm run build` en la máquina del operador.
2. Transferir los archivos de `dist/` y estas configuraciones a un directorio temporal del VPS.
3. Instalar el contenido con los permisos indicados y las reglas en sus rutas definitivas.
4. Habilitar únicamente el VirtualHost HTTP, validar Apache y recargarlo.
5. Confirmar que el DNS público resuelve al VPS y que la ruta ACME responde por HTTP.
6. Emitir el certificado sin modificar los otros VirtualHosts:

   ```sh
   sudo certbot certonly --webroot \
     --webroot-path /var/www/qr.ccastillo.dev/public_html \
     --cert-name qr.ccastillo.dev -d qr.ccastillo.dev --non-interactive
   ```

   Este comando presupone una cuenta de Certbot existente con los términos aceptados.

7. Habilitar el VirtualHost HTTPS e instalar `reload-apache.sh` como hook ejecutable.
8. Validar la configuración y recargar Apache:

   ```sh
   sudo apachectl configtest && sudo systemctl reload apache2
   ```

9. Probar HTTPS, redirección HTTP, recursos, generación y descarga.
10. Probar la renovación:

    ```sh
    sudo certbot renew --cert-name qr.ccastillo.dev --dry-run \
      --no-random-sleep-on-renew --run-deploy-hooks
    ```

## Actualizaciones y reversión

Respaldar el índice, favicon y configuraciones en un directorio con fecha UTC dentro de
`/var/backups/qr.ccastillo.dev/`, fuera del webroot. Instalar primero los assets con hash
y conservar los anteriores. Publicar el índice mediante `install` a `index.next.html`
y `mv` a `index.html` dentro del mismo webroot. No borrar `.well-known/`.

Si falla la nueva versión, restaurar el índice y favicon respaldados. Los assets anteriores
permiten que vuelva a funcionar sin recompilar ni reiniciar Apache.

Para retirar solo este sitio, conservando archivos y certificados:

```sh
sudo a2dissite qr.ccastillo.dev.conf qr.ccastillo.dev-ssl.conf
sudo apachectl configtest && sudo systemctl reload apache2
```
