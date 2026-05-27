#!/bin/bash
# ─── Instalación inicial en servidor nuevo ────────────────────────────────────
# Uso: sudo bash setup.sh
# Requisito: EVENTOS_DB_PASSWORD debe estar definida en el entorno antes de correr.
#   export EVENTOS_DB_PASSWORD="tu_password_seguro"
#   sudo -E bash setup.sh
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_USER="eventos"
APP_DIR="/var/www/admin-portal"
LOG_DIR="/var/log/pm2"
BACKUP_DIR="/var/backups/eventos"
DB_NAME="eventos_db"
DB_USER="eventos_user"

# ── Colores ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
warn() { echo -e "${YELLOW}[AVISO]${NC} $*"; }
step() { echo -e "\n${YELLOW}══ $* ══${NC}"; }

# ── Verificaciones previas ────────────────────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
  err "Este script debe ejecutarse como root (sudo bash setup.sh)."
fi

if [ -z "${EVENTOS_DB_PASSWORD:-}" ]; then
  err "La variable EVENTOS_DB_PASSWORD no está definida. Exportala antes de correr el script."
fi

DISTRO=$(lsb_release -cs 2>/dev/null || echo "desconocida")
if [ "$DISTRO" != "jammy" ]; then
  warn "Este script fue probado en Ubuntu 22.04 (jammy). Distro detectada: ${DISTRO}. Continuando..."
else
  ok "Ubuntu 22.04 detectado."
fi

# ── 1. Sistema base ───────────────────────────────────────────────────────────
step "1 · Actualización del sistema"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx ufw
ok "Paquetes base instalados."

# ── 2. Node.js 20 LTS ────────────────────────────────────────────────────────
step "2 · Node.js 20 LTS"
if ! command -v node &>/dev/null || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
ok "Node.js $(node -v) instalado."

# ── 3. PostgreSQL 16 ─────────────────────────────────────────────────────────
step "3 · PostgreSQL 16"
if ! command -v psql &>/dev/null; then
  sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
  apt-get update -qq
  apt-get install -y postgresql-16
fi
systemctl enable postgresql
systemctl start postgresql
ok "PostgreSQL $(psql --version | awk '{print $3}') instalado."

# ── 4. PM2 ───────────────────────────────────────────────────────────────────
step "4 · PM2"
if ! command -v pm2 &>/dev/null; then
  npm install -g pm2
fi
ok "PM2 $(pm2 --version) instalado."

# ── 5. Dependencias de sistema para Puppeteer/Chromium ───────────────────────
step "5 · Dependencias Chromium (Puppeteer)"
apt-get install -y -qq \
  chromium-browser \
  libgbm1 libnss3 libatk-bridge2.0-0 libgtk-3-0 libx11-xcb1 \
  libxcomposite1 libxdamage1 libxrandr2 libxss1 libxtst6 libasound2 \
  fonts-liberation fonts-noto-color-emoji
ok "Dependencias de Chromium instaladas."

# ── 6. Usuario de sistema ─────────────────────────────────────────────────────
step "6 · Usuario '${APP_USER}'"
if ! id "$APP_USER" &>/dev/null; then
  useradd --system --shell /usr/sbin/nologin --create-home "$APP_USER"
  ok "Usuario '${APP_USER}' creado."
else
  ok "Usuario '${APP_USER}' ya existe."
fi

# ── 7. Directorios ────────────────────────────────────────────────────────────
step "7 · Directorios de la aplicación"
mkdir -p "$APP_DIR" "$BACKUP_DIR" "$LOG_DIR"
chown -R "${APP_USER}:${APP_USER}" "$APP_DIR" "$BACKUP_DIR" "$LOG_DIR"
ok "Directorios creados."

# ── 8. Base de datos ──────────────────────────────────────────────────────────
step "8 · Configuración de PostgreSQL"
# Idempotente: crea usuario y base de datos solo si no existen
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${EVENTOS_DB_PASSWORD}';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
ok "Base de datos '${DB_NAME}' y usuario '${DB_USER}' configurados."

# ── 9. UFW (firewall) ─────────────────────────────────────────────────────────
step "9 · Firewall UFW"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ok "UFW configurado (SSH + 80 + 443)."

# ── 10. Crontab para backup diario ───────────────────────────────────────────
step "10 · Crontab backup diario (3am)"
CRON_JOB="0 3 * * * ${APP_DIR}/deploy/backup-db.sh >> /var/log/eventos-backup.log 2>&1"
# Idempotente: agrega solo si no existe
(crontab -l 2>/dev/null | grep -qF "backup-db.sh") || \
  (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
ok "Crontab configurado."

# ── Permisos de scripts ───────────────────────────────────────────────────────
chmod +x "${APP_DIR}/deploy/"*.sh 2>/dev/null || true

# ── Resumen final ─────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Instalación completada. Pasos manuales pendientes:${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════${NC}"
echo ""
echo "  1. Clonar el repositorio:"
echo "     git clone <REPO_URL> ${APP_DIR}"
echo ""
echo "  2. Copiar y editar el archivo de entorno:"
echo "     cp ${APP_DIR}/deploy/.env.production.example ${APP_DIR}/backend/.env"
echo "     nano ${APP_DIR}/backend/.env"
echo ""
echo "  3. Copiar la config de Nginx y activarla:"
echo "     sed -i 's/TU_DOMINIO/tu.dominio.com/g' ${APP_DIR}/deploy/nginx.conf"
echo "     cp ${APP_DIR}/deploy/nginx.conf /etc/nginx/sites-available/admin-portal"
echo "     ln -sf /etc/nginx/sites-available/admin-portal /etc/nginx/sites-enabled/"
echo "     nginx -t && systemctl reload nginx"
echo ""
echo "  4. Obtener certificado SSL:"
echo "     certbot --nginx -d tu.dominio.com"
echo ""
echo "  5. Ejecutar el primer deploy:"
echo "     bash ${APP_DIR}/deploy/deploy.sh"
echo ""
echo "  6. Configurar PM2 para arrancar con el sistema:"
echo "     pm2 startup"
echo "     pm2 save"
echo ""
