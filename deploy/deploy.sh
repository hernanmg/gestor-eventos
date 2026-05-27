#!/bin/bash
# ─── Script de actualización (deploy) ────────────────────────────────────────
# Uso: ./deploy.sh
# Ejecutar desde el directorio raíz del proyecto: /var/www/admin-portal
# ──────────────────────────────────────────────────────────────────────────────
set -e

APP_DIR="/var/www/admin-portal"
BACKEND_DIR="${APP_DIR}/backend"
FRONTEND_DIR="${APP_DIR}/frontend"
START_TIME=$(date +%s)

# ── Colores ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*"; }
warn() { echo -e "${YELLOW}[AVISO]${NC} $*"; }
step() { echo -e "\n${YELLOW}▶ $*${NC}"; }

cd "$APP_DIR"

# ── 1. Pull ───────────────────────────────────────────────────────────────────
step "1/6 · git pull origin main"
git pull origin main
ok "Código actualizado."

# ── 2. Backend build ──────────────────────────────────────────────────────────
step "2/6 · Backend: npm install + build"
cd "$BACKEND_DIR"
npm install --omit=dev
npm run build
ok "Backend compilado."

# ── 3. Prisma migrations ──────────────────────────────────────────────────────
step "3/6 · Prisma: migrate deploy"
# Nunca usar migrate dev en producción
npx prisma migrate deploy
ok "Migraciones aplicadas."

# ── 4. Frontend build ─────────────────────────────────────────────────────────
step "4/6 · Frontend: npm install + build"
cd "$FRONTEND_DIR"
npm install
npm run build
ok "Frontend compilado."

# ── 5. PM2 reload (zero-downtime) ────────────────────────────────────────────
step "5/6 · PM2: reload sin downtime"
cd "$APP_DIR"
pm2 reload ecosystem.config.js --env production
ok "Backend recargado sin downtime."

# ── 6. Verificación de salud ──────────────────────────────────────────────────
step "6/6 · Verificando salud del backend..."
sleep 3  # dar tiempo a PM2 para levantar el proceso

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
  ok "Deploy exitoso ✓  (health → HTTP ${HTTP_CODE})"
else
  err "El backend no responde (HTTP ${HTTP_CODE}). Últimas líneas de log:"
  pm2 logs eventos-backend --lines 20 --nostream
  exit 1
fi

# ── Tiempo total ──────────────────────────────────────────────────────────────
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
echo -e "\n${GREEN}Deploy completado en ${ELAPSED}s.${NC}"
