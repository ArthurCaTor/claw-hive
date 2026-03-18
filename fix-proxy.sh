#!/bin/bash
# ============================================================
# Debug Proxy 开关脚本 v5
# 修复：移除 set -e，添加更好的错误处理和调试输出
# 用法: bash fix-proxy.sh [start|stop|status|killall]
# ============================================================

# 不使用 set -e，手动检查关键错误

OPENCLAW_JSON="$HOME/.openclaw/openclaw.json"
BACKUP_FILE="$HOME/.openclaw/openclaw.json.backup.proxy-fix"
CLAW_HIVE_DIR="$HOME/claw-hive"
# Check for TypeScript first, then JavaScript
if [ -f "$CLAW_HIVE_DIR/src/services/llm-proxy.ts" ]; then
    LLM_PROXY_FILE="$CLAW_HIVE_DIR/src/services/llm-proxy.ts"
elif [ -f "$CLAW_HIVE_DIR/src/services/llm-proxy.js" ]; then
    LLM_PROXY_FILE="$CLAW_HIVE_DIR/src/services/llm-proxy.js"
else
    echo "❌ 找不到 llm-proxy.ts 或 llm-proxy.js"
    exit 1
fi
PROXY_PORT=8999
CLAW_HIVE_PORT=8080
ORIGINAL_URL="https://api.minimax.io/anthropic"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_ok()   { echo -e "${GREEN}✅ $1${NC}"; }
log_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_err()  { echo -e "${RED}❌ $1${NC}"; }
log_info() { echo -e "   $1"; }
log_debug() { echo -e "   [DEBUG] $1"; }

# ============================================================
# 自动获取本机 IP 地址
# ============================================================
get_local_ip() {
    if [ -n "$PROXY_HOST" ]; then
        echo "$PROXY_HOST"
        return
    fi
    
    local IP=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K[0-9.]+' | head -1)
    if [ -n "$IP" ]; then
        echo "$IP"
        return
    fi
    
    IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    if [ -n "$IP" ] && [ "$IP" != "127.0.0.1" ]; then
        echo "$IP"
        return
    fi
    
    echo "127.0.0.1"
}

LOCAL_IP=$(get_local_ip)
PROXY_URL="http://${LOCAL_IP}:${PROXY_PORT}/anthropic"

# ============================================================
# 使用 Python 修改 baseUrl
# ============================================================
set_baseurl() {
    local NEW_URL="$1"
    log_info "设置 baseUrl: $NEW_URL"
    
    python3 << EOF
import json
import sys

config_path = "$OPENCLAW_JSON"
new_url = "$NEW_URL"

try:
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    if 'models' in config and 'providers' in config['models'] and 'minimax-portal' in config['models']['providers']:
        old_url = config['models']['providers']['minimax-portal'].get('baseUrl', 'N/A')
        config['models']['providers']['minimax-portal']['baseUrl'] = new_url
        print(f"修改: {old_url} -> {new_url}")
    else:
        print("ERROR: Cannot find minimax-portal provider", file=sys.stderr)
        sys.exit(1)
    
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)
    
    print("OK")
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
EOF
    
    local RESULT=$?
    if [ $RESULT -eq 0 ]; then
        log_ok "baseUrl 已设置"
        return 0
    else
        log_err "baseUrl 设置失败"
        return 1
    fi
}

# ============================================================
# 获取当前 baseUrl
# ============================================================
get_baseurl() {
    python3 -c "
import json
try:
    with open('$OPENCLAW_JSON', 'r') as f:
        config = json.load(f)
    print(config['models']['providers']['minimax-portal']['baseUrl'])
except Exception as e:
    print('ERROR: ' + str(e))
" 2>/dev/null
}

# ============================================================
# 清理 openclaw 进程（保护 claw-hive）
# ============================================================
kill_all_openclaw() {
    echo ""
    log_info "=== 清理 openclaw 进程（保护 claw-hive）==="

    # 获取所有 openclaw 相关 PID，但排除 claw-hive
    local PIDS_TO_KILL=()
    while IFS= read -r line; do
        local PID=$(echo "$line" | awk '{print $2}')
        local CMD=$(echo "$line" | awk '{for(i=11;i<=NF;i++) printf "%s ", $i; print ""}')

        # 跳过 claw-hive 相关进程
        if echo "$CMD" | grep -q "claw-hive\|server\.js\|server\.ts"; then
            log_info "  保护: PID $PID"
            continue
        fi

        # 只杀 openclaw gateway 和 openclaw 本体
        if echo "$CMD" | grep -q "openclaw"; then
            PIDS_TO_KILL+=("$PID")
            log_info "  标记: PID $PID"
        fi
    done < <(ps aux | grep -i "openclaw" | grep -v grep)

    if [ ${#PIDS_TO_KILL[@]} -eq 0 ]; then
        log_ok "没有需要清理的 openclaw 进程"
        return 0
    fi

    log_warn "将清理 ${#PIDS_TO_KILL[@]} 个进程"

    # 先 SIGTERM
    for PID in "${PIDS_TO_KILL[@]}"; do
        kill "$PID" 2>/dev/null || true
    done
    sleep 2

    # 检查存活，再 SIGKILL
    for PID in "${PIDS_TO_KILL[@]}"; do
        if kill -0 "$PID" 2>/dev/null; then
            log_warn "  强制杀死: PID $PID"
            kill -9 "$PID" 2>/dev/null || true
        fi
    done
    sleep 1

    log_ok "openclaw 进程清理完成"
}

# ============================================================
# 启动 gateway（使用 systemctl）
# ============================================================
start_gateway() {
    local MODE=$1
    
    log_info "启动 gateway ($MODE 模式)..."
    
    # 尝试使用 systemctl 启动
    systemctl --user start openclaw-gateway.service 2>/dev/null
    sleep 3
    
    # 检查是否启动成功
    if systemctl --user is-active openclaw-gateway.service >/dev/null 2>&1; then
        log_ok "Gateway 已通过 systemctl 启动"
        return 0
    fi
    
    # 如果 systemctl 失败，尝试直接启动
    log_warn "systemctl 启动失败，尝试直接启动..."
    
    nohup npx openclaw gateway > /tmp/openclaw-gateway.log 2>&1 &
    local GATEWAY_PID=$!
    log_info "等待 gateway 启动 (PID: $GATEWAY_PID)..."

    for i in $(seq 1 10); do
        sleep 1
        if pgrep -f "openclaw.*gateway" > /dev/null 2>&1; then
            log_ok "Gateway 已启动（$MODE 模式）"
            return 0
        fi
    done

    if pgrep -f "openclaw.*gateway" > /dev/null 2>&1; then
        log_ok "Gateway 进程存在（$MODE 模式）"
        return 0
    else
        log_err "Gateway 启动失败！"
        tail -10 /tmp/openclaw-gateway.log 2>/dev/null || true
        return 1
    fi
}

# ============================================================
# stop — 恢复一切到正常状态
# ============================================================
do_stop() {
    echo ""
    echo "=============================="
    echo "  恢复正常模式"
    echo "=============================="
    echo ""

    # Step 1: 杀死所有 openclaw 进程
    kill_all_openclaw

    # Step 2: 恢复 baseUrl
    echo ""
    log_info "=== Step 2: 恢复 baseUrl ==="
    
    CURRENT_URL=$(get_baseurl)
    log_info "当前 baseUrl: $CURRENT_URL"
    
    if [ "$CURRENT_URL" = "$ORIGINAL_URL" ]; then
        log_ok "baseUrl 已经是正常状态"
    else
        set_baseurl "$ORIGINAL_URL"
        
        # 验证
        NEW_URL=$(get_baseurl)
        log_info "验证 baseUrl: $NEW_URL"
        if [ "$NEW_URL" = "$ORIGINAL_URL" ]; then
            log_ok "baseUrl 已恢复"
        else
            log_err "baseUrl 恢复失败！"
        fi
    fi

    # Step 3: 启动 gateway
    echo ""
    log_info "=== Step 3: 启动 Gateway ==="
    start_gateway "正常"

    echo ""
    log_ok "恢复完成！OpenClaw 直连 MiniMax。"
    echo ""
}

# ============================================================
# start — 启动 proxy 模式
# ============================================================
do_start() {
    echo ""
    echo "=============================="
    echo "  启动 Debug Proxy 模式"
    echo "=============================="
    echo ""
    
    log_info "检测到本机 IP: $LOCAL_IP"
    log_info "Proxy URL: $PROXY_URL"
    echo ""

    # Step 1: 杀死所有 openclaw 进程
    log_info "=== Step 1: 清理进程 ==="
    kill_all_openclaw

    # Step 2: 检查文件
    echo ""
    log_info "=== Step 2: 检查文件 ==="
    if [ ! -f "$LLM_PROXY_FILE" ]; then
        log_err "找不到 $LLM_PROXY_FILE"
        exit 1
    fi
    if [ ! -f "$OPENCLAW_JSON" ]; then
        log_err "找不到 $OPENCLAW_JSON"
        exit 1
    fi
    log_ok "文件检查通过"

    # Step 3: 修复 llm-proxy.js
    log_info "=== Step 3: 检查 llm-proxy.js ==="

    # Step 4: 备份
    echo ""
    log_info "=== Step 4: 备份配置 ==="
    cp "$OPENCLAW_JSON" "$BACKUP_FILE"
    log_ok "openclaw.json 已备份"

    # Step 5: 重启 claw-hive server
    echo ""
    log_info "=== Step 5: 重启 claw-hive server ==="
    
    # 彻底杀掉所有 claw-hive 相关进程
    log_info "清理 claw-hive 相关进程..."
    
    # 杀掉所有可能占用 8080 端口的进程
    for PID in $(lsof -ti :8080 2>/dev/null); do
        log_info "杀掉占用 8080 端口的进程: $PID"
        kill -9 $PID 2>/dev/null || true
    done
    
    # 杀掉所有 node src/server.js 进程
    for PID in $(pgrep -f "node src/server.js" 2>/dev/null); do
        log_info "杀掉 claw-hive 进程: $PID"
        kill -9 $PID 2>/dev/null || true
    done
    
    # 杀掉所有 claw-hive 相关的 node 进程
    for PID in $(pgrep -f "claw-hive" 2>/dev/null); do
        log_info "杀掉 claw-hive 相关进程: $PID"
        kill -9 $PID 2>/dev/null || true
    done
    
    sleep 2
    
    # 确认 8080 端口已释放
    if lsof -ti :8080 >/dev/null 2>&1; then
        log_err "端口 8080 仍被占用！"
        lsof -i :8080
        exit 1
    fi
    log_ok "端口 8080 已释放"

    cd "$CLAW_HIVE_DIR"
    nohup node src/server.js > /tmp/claw-hive.log 2>&1 &
    CLAW_PID=$!
    log_info "等待 claw-hive 启动 (PID: $CLAW_PID)..."
    sleep 3

    if kill -0 $CLAW_PID 2>/dev/null; then
        log_ok "claw-hive server 启动成功 (PID: $CLAW_PID)"
    else
        log_err "claw-hive server 启动失败！"
        tail -20 /tmp/claw-hive.log 2>/dev/null || true
        exit 1
    fi

    # Step 6: 启动 proxy
    echo ""
    log_info "=== Step 6: 启动 Proxy ==="
    
    log_info "调用 /api/debug-proxy/start..."
    PROXY_RESPONSE=$(curl -s -X POST http://localhost:$CLAW_HIVE_PORT/api/debug-proxy/start 2>&1)
    log_debug "Proxy 响应: $PROXY_RESPONSE"
    
    # 等待 Proxy 启动（最多 10 秒）
    log_info "等待 Proxy 启动..."
    PROXY_OK=0
    for i in $(seq 1 10); do
        sleep 1
        HEALTH=$(curl -s http://localhost:$PROXY_PORT/_health 2>&1)
        if echo "$HEALTH" | grep -q '"status"' || echo "$HEALTH" | grep -q '"ok"'; then
            log_ok "Proxy 启动成功 (尝试 $i 次)"
            log_debug "Health: $HEALTH"
            PROXY_OK=1
            break
        fi
        log_info "  等待中... ($i/10)"
    done
    
    if [ "$PROXY_OK" -eq 0 ]; then
        log_err "Proxy 启动失败！"
        log_info "查看日志: tail -100 /tmp/claw-hive.log"
        log_info "手动检查: curl http://localhost:$PROXY_PORT/_health"
        # 继续执行，不退出
    fi

    # Step 7: 修改 baseUrl
    echo ""
    log_info "=== Step 7: 修改 baseUrl ==="
    
    CURRENT_URL=$(get_baseurl)
    log_info "当前 baseUrl: $CURRENT_URL"
    
    set_baseurl "$PROXY_URL"
    
    # 验证
    NEW_URL=$(get_baseurl)
    log_info "新的 baseUrl: $NEW_URL"
    
    if [ "$NEW_URL" = "$PROXY_URL" ]; then
        log_ok "baseUrl 已修改成功"
    else
        log_err "baseUrl 修改失败！"
        log_err "预期: $PROXY_URL"
        log_err "实际: $NEW_URL"
    fi

    # Step 8: 启动 gateway
    echo ""
    log_info "=== Step 8: 启动 Gateway ==="
    start_gateway "proxy"

    # Step 9: 最终验证
    echo ""
    log_info "=== Step 9: 最终验证 ==="

    # 验证 proxy
    HEALTH=$(curl -s http://localhost:$PROXY_PORT/_health 2>&1)
    if echo "$HEALTH" | grep -q '"ok"'; then
        log_ok "Proxy: 运行中"
    else
        log_err "Proxy: 未运行"
    fi

    # 验证 baseUrl
    CURRENT_URL=$(get_baseurl)
    if echo "$CURRENT_URL" | grep -q "$PROXY_PORT"; then
        log_ok "baseUrl: $CURRENT_URL (走 Proxy)"
    else
        log_err "baseUrl: $CURRENT_URL (未修改!)"
    fi

    # 验证 gateway
    if pgrep -f "openclaw" > /dev/null 2>&1; then
        COUNT=$(pgrep -f "openclaw" 2>/dev/null | wc -l)
        log_ok "Gateway: 运行中 ($COUNT 个进程)"
    else
        log_err "Gateway: 未运行"
    fi

    # 完成
    echo ""
    echo "=============================="
    echo -e "  ${GREEN}🎉 Debug Proxy 模式${NC}"
    echo "=============================="
    echo ""
    echo "  本机 IP:   $LOCAL_IP"
    echo "  Proxy:     http://${LOCAL_IP}:$PROXY_PORT"
    echo "  Dashboard: http://${LOCAL_IP}:$CLAW_HIVE_PORT"
    echo ""
    echo "  测试方法:"
    echo "    通过 Telegram 发消息给 coder"
    echo ""
    echo "  查看捕获:"
    echo "    curl http://${LOCAL_IP}:$CLAW_HIVE_PORT/api/debug-proxy/captures"
    echo ""
    echo "  恢复正常:"
    echo "    bash $0 stop"
    echo ""
}

# ============================================================
# status — 检查当前状态
# ============================================================
do_status() {
    echo ""
    echo "=============================="
    echo "  当前状态检查"
    echo "=============================="
    echo ""
    
    log_info "本机 IP: $LOCAL_IP"
    echo ""

    # openclaw 进程
    COUNT=$(pgrep -f "openclaw" 2>/dev/null | wc -l)
    if [ "$COUNT" -gt 5 ]; then
        log_err "openclaw 进程数: $COUNT（过多！运行: bash $0 killall）"
    elif [ "$COUNT" -gt 0 ]; then
        log_ok "openclaw 进程数: $COUNT"
    else
        log_warn "openclaw 进程数: 0（未运行）"
    fi

    # 内存
    OPENCLAW_MEM=$(ps aux 2>/dev/null | grep openclaw | grep -v grep | awk '{sum += $6} END {print int(sum/1024)}')
    if [ -n "$OPENCLAW_MEM" ] && [ "$OPENCLAW_MEM" -gt 3000 ]; then
        log_err "openclaw 内存: ${OPENCLAW_MEM}MB（过高！）"
    else
        log_ok "openclaw 内存: ${OPENCLAW_MEM:-0}MB"
    fi

    # claw-hive
    if pgrep -f "node src/server.js" > /dev/null 2>&1; then
        log_ok "claw-hive server: 运行中"
    else
        log_err "claw-hive server: 未运行"
    fi

    # proxy
    HEALTH=$(curl -s http://localhost:$PROXY_PORT/_health 2>/dev/null)
    if echo "$HEALTH" | grep -q '"ok"'; then
        log_ok "Proxy: 运行中"
    else
        log_err "Proxy: 未运行"
    fi

    # gateway
    if pgrep -f "openclaw.*gateway" > /dev/null 2>&1; then
        log_ok "Gateway: 运行中"
    else
        log_err "Gateway: 未运行"
    fi

    # baseUrl
    CURRENT_URL=$(get_baseurl)
    if echo "$CURRENT_URL" | grep -q "$PROXY_PORT"; then
        log_warn "baseUrl: $CURRENT_URL (走 Proxy)"
    elif [ "$CURRENT_URL" = "$ORIGINAL_URL" ]; then
        log_ok "baseUrl: $CURRENT_URL (正常)"
    else
        log_err "baseUrl: $CURRENT_URL (异常)"
    fi

    echo ""
}

# ============================================================
# killall — 只杀死所有 openclaw 进程
# ============================================================
do_killall() {
    echo ""
    echo "=============================="
    echo "  清理所有 openclaw 进程"
    echo "=============================="
    
    kill_all_openclaw
    
    echo ""
    echo "重新启动 gateway:"
    echo "  systemctl --user start openclaw-gateway.service"
    echo "  或: npx openclaw gateway"
    echo ""
}

# ============================================================
# 主入口
# ============================================================
case "${1:-status}" in
    start)
        do_start
        ;;
    stop)
        do_stop
        ;;
    status)
        do_status
        ;;
    killall)
        do_killall
        ;;
    *)
        echo "用法: bash $0 [start|stop|status|killall]"
        echo ""
        echo "  start   — 启动 proxy 模式"
        echo "  stop    — 恢复正常模式"
        echo "  status  — 检查当前状态"
        echo "  killall — 杀死所有 openclaw 进程"
        echo ""
        echo "环境变量:"
        echo "  PROXY_HOST — 指定 IP（默认自动检测）"
        exit 1
        ;;
esac
