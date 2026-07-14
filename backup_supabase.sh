#!/bin/bash

# Configuración
BACKUP_DIR="/home/cristian/backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
DATE_DAY=$(date +"%Y-%m-%d")
LOG_FILE="$BACKUP_DIR/backup.log"
REMOTE_DEST="gdrive:LukeAPP_Backups/$DATE_DAY"

# Asegurar que el directorio local existe
mkdir -p "$BACKUP_DIR"

echo "==================================================" >> "$LOG_FILE"
echo "[$TIMESTAMP] Iniciando Respaldo de Supabase" >> "$LOG_FILE"

# 1. Respaldo de Base de Datos
DB_BACKUP_FILE="$BACKUP_DIR/db_$TIMESTAMP.sql.gz"
echo "[$TIMESTAMP] Exportando Base de Datos..." >> "$LOG_FILE"
docker exec supabase-db pg_dumpall -U postgres | gzip > "$DB_BACKUP_FILE" 2>> "$LOG_FILE"

if [ $? -eq 0 ]; then
    echo "[$TIMESTAMP] ✓ Base de datos exportada con éxito." >> "$LOG_FILE"
else
    echo "[$TIMESTAMP] ✗ Error exportando base de datos." >> "$LOG_FILE"
fi

# 2. Respaldo de Storage (Archivos)
STORAGE_VOL="/home/cristian/supabase-docker/docker/volumes/storage"
STORAGE_BACKUP_FILE="$BACKUP_DIR/storage_$TIMESTAMP.tar.gz"
echo "[$TIMESTAMP] Comprimiendo Storage..." >> "$LOG_FILE"
tar -czf "$STORAGE_BACKUP_FILE" -C "$STORAGE_VOL" . 2>> "$LOG_FILE"

if [ $? -eq 0 ]; then
    echo "[$TIMESTAMP] ✓ Storage comprimido con éxito." >> "$LOG_FILE"
else
    echo "[$TIMESTAMP] ✗ Error comprimiendo Storage." >> "$LOG_FILE"
fi

# 3. Sincronización a Google Drive (Offsite)
echo "[$TIMESTAMP] Subiendo a Google Drive..." >> "$LOG_FILE"
/usr/bin/rclone copy "$DB_BACKUP_FILE" "$REMOTE_DEST" >> "$LOG_FILE" 2>&1
RCLONE_DB_STATUS=$?

/usr/bin/rclone copy "$STORAGE_BACKUP_FILE" "$REMOTE_DEST" >> "$LOG_FILE" 2>&1
RCLONE_STORAGE_STATUS=$?

if [ $RCLONE_DB_STATUS -eq 0 ] && [ $RCLONE_STORAGE_STATUS -eq 0 ]; then
    echo "[$TIMESTAMP] ✓ Respaldo subido a Google Drive exitosamente." >> "$LOG_FILE"
else
    echo "[$TIMESTAMP] ⚠️ Hubo errores subiendo a Google Drive." >> "$LOG_FILE"
fi

# 4. Limpieza de respaldos locales y en la nube antiguos (más de 7 días)
echo "[$TIMESTAMP] Limpiando respaldos locales antiguos..." >> "$LOG_FILE"
find "$BACKUP_DIR" -type f -name "*.gz" -mtime +7 -exec rm {} \; >> "$LOG_FILE" 2>&1

echo "[$TIMESTAMP] Limpiando respaldos antiguos en Google Drive..." >> "$LOG_FILE"
/usr/bin/rclone delete "gdrive:LukeAPP_Backups" --min-age 7d >> "$LOG_FILE" 2>&1

echo "[$TIMESTAMP] Respaldo finalizado." >> "$LOG_FILE"
echo "==================================================" >> "$LOG_FILE"
