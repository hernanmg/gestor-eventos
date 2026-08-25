#!/bin/bash
# Backup automático antes de correr migraciones
# Uso: ./scripts/backup-before-migrate.sh (desde backend/)

# Carga DATABASE_URL desde .env si no está ya en el entorno — pg_dump
# necesita la variable seteada, y .env no se auto-exporta a un shell nuevo.
if [ -z "$DATABASE_URL" ] && [ -f .env ]; then
  set -a
  source .env
  set +a
fi

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL no está definida (ni en el entorno ni en .env)"
  exit 1
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"

mkdir -p "$BACKUP_DIR"

echo "🔒 Creando backup antes de migrar..."

if command -v pg_dump >/dev/null 2>&1; then
  # pg_dump instalado localmente
  pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
elif docker compose ps postgres >/dev/null 2>&1; then
  # Sin cliente local — Postgres corre en el contenedor docker-compose
  # (ver docker-compose.yml, servicio "postgres"). localhost dentro del
  # contenedor es el propio server, así que DATABASE_URL sigue siendo válida.
  docker compose exec -T postgres pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
else
  echo "❌ No se encontró pg_dump instalado ni un contenedor 'postgres' corriendo vía docker compose"
  exit 1
fi

if [ $? -eq 0 ]; then
  echo "✅ Backup creado: $BACKUP_FILE"
  echo "Para restaurar: psql \$DATABASE_URL < $BACKUP_FILE"
else
  echo "❌ Error al crear el backup"
  exit 1
fi
