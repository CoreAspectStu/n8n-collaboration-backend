
#!/bin/bash

# n8n Collaboration Backend Maintenance Script
# This script performs routine maintenance tasks

set -e

# Configuration
LOG_FILE="/home/ubuntu/maintenance.log"
APP_DIR="/home/ubuntu/n8n-collaboration-backend"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Starting maintenance tasks..."

# Update system packages
log "Updating system packages..."
sudo apt update && sudo apt upgrade -y
log "System packages updated"

# Clean up Docker resources
if command -v docker &> /dev/null; then
    log "Cleaning up Docker resources..."
    
    # Remove unused images
    docker image prune -f
    log "Unused Docker images removed"
    
    # Remove unused containers
    docker container prune -f
    log "Unused Docker containers removed"
    
    # Remove unused networks
    docker network prune -f
    log "Unused Docker networks removed"
    
    # Remove unused volumes (be careful!)
    # Uncomment the next line only if you're sure
    # docker volume prune -f
    # log "Unused Docker volumes removed"
    
    # Show Docker disk usage
    DOCKER_USAGE=$(docker system df)
    log "Docker disk usage after cleanup:"
    log "$DOCKER_USAGE"
fi

# Clean up application logs (keep last 30 days)
if [ -d "$APP_DIR/logs" ]; then
    log "Cleaning up old application logs..."
    find "$APP_DIR/logs" -name "*.log" -mtime +30 -delete
    find "$APP_DIR/logs" -name "*.log.*" -mtime +30 -delete
    log "Old application logs cleaned up"
fi

# Clean up system logs
log "Cleaning up system logs..."
sudo journalctl --vacuum-time=30d
log "System logs cleaned up"

# Check disk space
log "Checking disk space..."
DISK_USAGE=$(df -h /)
log "Disk usage:"
log "$DISK_USAGE"

# Check memory usage
log "Checking memory usage..."
MEMORY_USAGE=$(free -h)
log "Memory usage:"
log "$MEMORY_USAGE"

# Check for security updates
log "Checking for security updates..."
SECURITY_UPDATES=$(apt list --upgradable 2>/dev/null | grep -i security | wc -l)
if [ "$SECURITY_UPDATES" -gt 0 ]; then
    log "Warning: $SECURITY_UPDATES security updates available"
    # Uncomment to auto-install security updates
    # sudo unattended-upgrade
else
    log "No security updates available"
fi

# Restart services if needed
if [ -f "/var/run/reboot-required" ]; then
    log "System reboot required after updates"
    # Uncomment to auto-reboot (be careful!)
    # sudo reboot
else
    log "No system reboot required"
fi

# Check application health
if command -v curl &> /dev/null; then
    log "Checking application health..."
    if curl -f -s http://localhost:3000/health > /dev/null; then
        log "Application health check passed"
    else
        log "Warning: Application health check failed"
        # Restart application if health check fails
        if command -v docker-compose &> /dev/null; then
            log "Attempting to restart application..."
            cd "$APP_DIR"
            docker-compose restart
            log "Application restarted"
        fi
    fi
fi

# Generate maintenance report
REPORT_FILE="/home/ubuntu/maintenance_report_$(date +%Y%m%d).txt"
{
    echo "n8n Collaboration Backend Maintenance Report"
    echo "Generated: $(date)"
    echo "=========================================="
    echo ""
    echo "Disk Usage:"
    df -h
    echo ""
    echo "Memory Usage:"
    free -h
    echo ""
    echo "Docker Usage:"
    if command -v docker &> /dev/null; then
        docker system df
    else
        echo "Docker not available"
    fi
    echo ""
    echo "System Uptime:"
    uptime
    echo ""
    echo "Load Average:"
    cat /proc/loadavg
} > "$REPORT_FILE"

log "Maintenance report generated: $REPORT_FILE"

# Send notification (optional - requires mail setup)
if command -v mail &> /dev/null; then
    mail -s "n8n Collaboration Backend Maintenance Report" admin@yourdomain.com < "$REPORT_FILE"
    log "Maintenance report sent via email"
fi

log "Maintenance tasks completed successfully"
