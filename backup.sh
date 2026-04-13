#!/bin/bash
# CRM Automated Backup Script
# Creates a timestamped zip of all CRM data, retaining the last 30 days of backups.
#
# Usage:
#   bash backup.sh
#
# Schedule daily via cron (example – runs at 2 AM):
#   0 2 * * * /path/to/My-CRM/backup.sh >> ~/Desktop/CRM-Data/backups/backup.log 2>&1

BACKUP_DIR=~/Desktop/CRM-Data/backups
DATA_DIR=~/Desktop/CRM-Data
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/crm_backup_$TIMESTAMP.zip"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Create backup archive (exclude the backups subdirectory to avoid nesting)
zip -r "$BACKUP_FILE" "$DATA_DIR" \
  -x "*/backups/*" \
  > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "✓ Backup created: $BACKUP_FILE"
else
  echo "❌ Backup failed" >&2
  exit 1
fi

# Remove backups older than 30 days
find "$BACKUP_DIR" -name "crm_backup_*.zip" -mtime +30 -delete

echo "✓ Cleanup complete – backups older than 30 days removed"
