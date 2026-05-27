#!/bin/bash
# ─── Backup diario de PostgreSQL ──────────────────────────────────────────────
# Crontab sugerido (3am todos los días):
#   0 3 * * * /var/www/admin-portal/deploy/backup-db.sh
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DB_NAME="eventos_db"
DB_USER="eventos_user"
BACKUP_DIR="/var/backups/eventos"
LOG_FILE="/var/log/eventos-backup.log"
RETENTION_DAYS=30

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Crear directorio si no existe
mkdir -p "$BACKUP_DIR"

log "Iniciando backup de ${DB_NAME}..."

if pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"; then
  SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
  log "Backup exitoso: ${BACKUP_FILE} (${SIZE})"
else
  log "ERROR: El backup falló."
  exit 1
fi

# Eliminar backups más viejos que RETENTION_DAYS días
DELETED=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +${RETENTION_DAYS} -print -delete | wc -l)
if [ "$DELETED" -gt 0 ]; then
  log "Se eliminaron ${DELETED} backup(s) con más de ${RETENTION_DAYS} días."
fi

log "Backup completado correctamente."
exit 0
