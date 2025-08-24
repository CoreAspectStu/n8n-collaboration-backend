
#!/bin/bash

# n8n Collaboration Backend Backup Script
# This script creates backups of application data and logs

set -e

# Configuration
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/ubuntu/backups"
APP_DIR="/home/ubuntu/n8n-collaboration-backend"
LOG_FILE="$BACKUP_DIR/backup.log"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Starting backup process..."

# Backup application logs
if [ -d "$APP_DIR/logs" ]; then
    log "Backing up application logs..."
    tar -czf "$BACKUP_DIR/logs_backup_$DATE.tar.gz" -C "$APP_DIR" logs/
    log "Application logs backup completed: logs_backup_$DATE.tar.gz"
else
    log "No logs directory found, skipping logs backup"
fi

# Backup configuration files
log "Backing up configuration files..."
tar -czf "$BACKUP_DIR/config_backup_$DATE.tar.gz" \
    -C "$APP_DIR" \
    --exclude='node_modules' \
    --exclude='logs' \
    --exclude='.git' \
    .

log "Configuration backup completed: config_backup_$DATE.tar.gz"

# Database backup (if applicable)
if [ ! -z "$DB_HOST" ] && [ ! -z "$DB_NAME" ]; then
    log "Backing up database..."
    pg_dump -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" > "$BACKUP_DIR/db_backup_$DATE.sql"
    gzip "$BACKUP_DIR/db_backup_$DATE.sql"
    log "Database backup completed: db_backup_$DATE.sql.gz"
else
    log "No database configuration found, skipping database backup"
fi

# Docker volumes backup (if running in Docker)
if command -v docker &> /dev/null; then
    log "Backing up Docker volumes..."
    docker run --rm -v n8n-collaboration-backend_logs:/data -v "$BACKUP_DIR":/backup alpine tar czf /backup/docker_volumes_$DATE.tar.gz -C /data .
    log "Docker volumes backup completed: docker_volumes_$DATE.tar.gz"
fi

# Clean up old backups (keep last 7 days)
log "Cleaning up old backups..."
find "$BACKUP_DIR" -name "*_backup_*.tar.gz" -mtime +7 -delete
find "$BACKUP_DIR" -name "*_backup_*.sql.gz" -mtime +7 -delete

# Calculate backup sizes
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
log "Backup process completed. Total backup size: $TOTAL_SIZE"

# Send notification (optional - requires mail setup)
if command -v mail &> /dev/null; then
    echo "Backup completed successfully at $(date)" | mail -s "n8n Collaboration Backend Backup" admin@yourdomain.com
fi

log "Backup script finished successfully"
