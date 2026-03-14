#!/bin/bash
LOG_FILE="/tmp/claw-hive-monitor.log"
RESTART_COUNT=0

log() {
    echo "[$(date)] $1" >> "$LOG_FILE"
}

check_health() {
    curl -s -f http://localhost:8080/api/health > /dev/null 2>&1
    return $?
}

log "Health monitor started"

while true; do
    if check_health; then
        log "OK"
    else
        log "DOWN - restarting..."
        fuser -k 8080/tcp 2>/dev/null
        sleep 2
        cd ~/claw-hive
        nohup node src/server.js > /tmp/claw-hive.log 2>&1 &
        sleep 5
        if check_health; then
            log "Restarted OK"
        else
            log "Restart failed"
        fi
    fi
    sleep 30
done
