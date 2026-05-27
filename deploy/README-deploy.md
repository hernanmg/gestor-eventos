# Deploy On-Premise — Admin Portal

Guía completa para instalar y mantener el sistema en un servidor Linux propio.

---

## 1. Requisitos previos

**Hardware mínimo recomendado**
- CPU: 2 vCPU
- RAM: 2 GB (4 GB recomendado por Puppeteer/Chromium)
- Disco: 20 GB SSD

**Sistema operativo**
- Ubuntu 22.04 LTS (jammy) — probado y recomendado

**Puertos necesarios en el router/firewall externo**
- 22 (SSH)
- 80 (HTTP → redirige a HTTPS)
- 443 (HTTPS)

**Dominio**
- Un dominio apuntando a la IP del servidor (registro A o CNAME). Necesario para SSL.

---

## 2. Instalación inicial

### 2a. Ejecutar el script de setup

```bash
export EVENTOS_DB_PASSWORD="elige_un_password_seguro"
sudo -E bash /ruta/a/setup.sh
```

El script instala automáticamente: Node.js 20, PostgreSQL 16, Nginx, Certbot, PM2, Chromium, UFW y crea el usuario de sistema `eventos`.

### 2b. Pasos manuales tras el setup

**Clonar el repositorio**
```bash
git clone <URL_DEL_REPO> /var/www/admin-portal
```

**Configurar Nginx**
```bash
sed -i 's/TU_DOMINIO/tu.dominio.com/g' /var/www/admin-portal/deploy/nginx.conf
cp /var/www/admin-portal/deploy/nginx.conf /etc/nginx/sites-available/admin-portal
ln -sf /etc/nginx/sites-available/admin-portal /etc/nginx/sites-enabled/admin-portal
rm -f /etc/nginx/sites-enabled/default   # quitar el default de nginx
nginx -t && systemctl reload nginx
```

**Configurar variables de entorno**
```bash
cp /var/www/admin-portal/deploy/.env.production.example /var/www/admin-portal/backend/.env
nano /var/www/admin-portal/backend/.env   # completar todos los valores
```

---

## 3. Primer deploy

```bash
bash /var/www/admin-portal/deploy/deploy.sh
```

El script realiza: pull → build backend → migraciones → build frontend → recarga PM2 → verifica salud.

**Configurar PM2 para arrancar con el servidor**
```bash
pm2 startup          # genera el comando que hay que ejecutar como root
pm2 save             # guarda la lista de procesos activos
```

---

## 4. SSL con Certbot

```bash
certbot --nginx -d tu.dominio.com
```

Certbot modifica automáticamente el nginx.conf con las rutas del certificado y configura la renovación automática.

**Verificar renovación automática**
```bash
certbot renew --dry-run
```

---

## 5. Actualizaciones futuras

Cada vez que haya cambios en `main`, simplemente ejecutar:

```bash
cd /var/www/admin-portal
bash deploy/deploy.sh
```

El script hace `pm2 reload` (zero-downtime) y verifica que el backend responda antes de terminar.

---

## 6. Comandos útiles de operación diaria

**Ver logs del backend en tiempo real**
```bash
pm2 logs eventos-backend
```

**Ver logs con contexto (últimas N líneas)**
```bash
pm2 logs eventos-backend --lines 50 --nostream
```

**Reiniciar el backend (con downtime)**
```bash
pm2 restart eventos-backend
```

**Recargar sin downtime**
```bash
pm2 reload eventos-backend
```

**Ver estado general de PM2**
```bash
pm2 status
pm2 monit       # dashboard interactivo
```

**Conectarse a la base de datos**
```bash
sudo -u postgres psql -d eventos_db
# o con el usuario de la app:
psql postgresql://eventos_user:PASSWORD@localhost:5432/eventos_db
```

**Correr un backup manual**
```bash
bash /var/www/admin-portal/deploy/backup-db.sh
```

**Listar backups disponibles**
```bash
ls -lh /var/backups/eventos/
```

**Verificar espacio en disco**
```bash
df -h /
du -sh /var/www/admin-portal/
du -sh /var/backups/eventos/
```

**Ver estado de Nginx**
```bash
systemctl status nginx
nginx -t          # validar configuración
```

---

## 7. Troubleshooting

### El backend no levanta
```bash
pm2 logs eventos-backend --lines 50 --nostream
pm2 status
```
Verificar que el archivo `backend/.env` existe y tiene `DATABASE_URL` correcta.

### Error de conexión a la base de datos
```bash
systemctl status postgresql
sudo -u postgres psql -c "\l"   # listar bases de datos
```
Si PostgreSQL está caído: `systemctl start postgresql`

### Puppeteer falla al generar PDF
Los síntomas son errores como `Could not find Chromium` o `spawn ENOENT`.

```bash
which chromium-browser   # debe devolver /usr/bin/chromium-browser
chromium-browser --version
```
Si no está instalado: `apt-get install -y chromium-browser`

Verificar que `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser` esté en `backend/.env`.

Si el error es `libgbm`, instalar dependencias:
```bash
apt-get install -y libgbm1 libnss3 libatk-bridge2.0-0
```

### Nginx 502 Bad Gateway
Significa que Nginx no puede conectarse al backend (puerto 3001).

```bash
pm2 status                          # ¿está running eventos-backend?
curl -s http://localhost:3001/api/health  # probar directo
pm2 restart eventos-backend
```

### Certificado SSL vencido
```bash
certbot renew
systemctl reload nginx
```
La renovación automática debería correr dos veces por día vía systemd timer. Verificar:
```bash
systemctl status certbot.timer
```
