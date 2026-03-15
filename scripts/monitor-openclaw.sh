#!/bin/bash
# Monitor OpenClaw processes for high CPU/Memory usage
# Run: ./monitor-openclaw.sh &

LOG_FILE="/tmp/openclaw-monitor-$(date +%Y%m%d-%H%M%S).log"

echo "Starting OpenClaw monitoring... Log: $LOG_FILE"
echo "Timestamp | PID | USER | %CPU | %MEM | RSS(MB) | COMMAND" > "$LOG_FILE"

while true; do
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Find all node processes related to OpenClaw
    ps aux | grep -E "node|openclaw|claw-hive" | grep -v grep | while read line; do
        PID=$(echo $line | awk '{print $2}')
        USER=$(echo $line | awk '{print $1}')
        CPU=$(echo $line | awk '{print $3}')
        MEM=$(echo $line | awk '{print $4}')
        RSS=$(echo $line | awk '{print $6}')  # KB
        RSS_MB=$((RSS / 1024))
        CMD=$(echo $line | awk '{for(i=11;i<=NF;i++) printf "%s ", $i; print ""}')
        
        # Highlight high usage
        if (( $(echo "$CPU > 50" | bc -l) )) || (( $(echo "$MEM > 50" | bc -l) )); then
            echo "⚠️  $TIMESTAMP | $PID | $USER | $CPU% | $MEM% | ${RSS_MB}MB | $CMD" >> "$LOG_FILE"
        else
            echo "$TIMESTAMP | $PID | $USER | $CPU% | $MEM% | ${RSS_MB}MB | $CMD" >> "$LOG_FILE"
        fi
    done
    
    # Also log system-wide CPU/Memory
    echo "--- System ---" >> "$LOG_FILE"
    top -bn1 | head -5 >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
    
    sleep 5
done
