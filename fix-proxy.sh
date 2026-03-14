#!/bin/bash
# ============================================================
# Debug Proxy 开关脚本 v2
# 用法: bash fix-proxy.sh [start|stop|status]
#   start  — 修复代码 + 启动 proxy + 切换 gateway 到 proxy
#   stop   — 恢复一切到正常状态
#   status — 检查当前状态
# ============================================================

set -e

OPENCLAW_JSON="$HOME/.openclaw/openclaw.json"
BACKUP_FILE="$HOME/.openclaw/openclaw.json.backup.proxy-fix"
CLAW_HIVE_DIR="$HOME/claw-hive"
LLM_PROXY_FILE="$CLAW_HIVE_DIR/src/services/llm-proxy.js"
PROXY_PORT=8999
CLAW_HIVE_PORT=8080
PROXY_URL="http://192.168.2.22:$PROXY_PORT/anthropic"
ORIGINAL_URL="https://api.minimax.io/anthropic"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_ok()   { echo -e "${GREEN}✅ $1${NC}"; }
log_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_err()  { echo -e "${RED}❌ $1${NC}"; }
log_info() { echo -e "   $1"; }

# ============================================================
# 强制杀掉 gateway（4 层递进，确保干净）
# ============================================================
force_kill_gateway() {
    log_info "强制停止 gateway..."

    # 层 1: openclaw 自带 stop
    openclaw gateway stop 2>/dev/null || true
    sleep 1

    # 层 2: systemctl stop
    systemctl --user stop openclaw-gateway.service 2>/dev/null || true
    sleep 1

    # 层 3: pkill
    pkill -f "openclaw.*gateway" 2>/dev/null || true
    pkill -f "openclaw-gateway" 2>/dev/null || true
    sleep 1

    # 层 4: kill -9（最后手段）
    if pgrep -f "openclaw.*gateway" > /dev/null 2>&1; then
        log_warn "Gateway 顽固，kill -9..."
        pkill -9 -f "openclaw.*gateway" 2>/dev/null || true
        sleep 1
    fi

    # 确认
    if pgrep -f "openclaw.*gateway" > /dev/null 2>&1; then
        log_err "Gateway 无法停止！PID: $(pgrep -f 'openclaw.*gateway')"
        return 1
    else
        log_ok "Gateway 已完全停止"
    fi
}

# ============================================================
# 启动 gateway 并验证
# ============================================================
start_gateway() {
    local MODE=$1  # "proxy" 或 "normal"

    nohup npx openclaw gateway > /tmp/openclaw-gateway.log 2>&1 &
    local GATEWAY_PID=$!
    log_info "等待 gateway 启动 (PID: $GATEWAY_PID)..."

    # 最多等 15 秒
    for i in $(seq 1 15); do
        sleep 1
        if pgrep -f "openclaw.*gateway" > /dev/null 2>&1; then
            # 检查是否真正在监听
            if grep -q "listening on" /tmp/openclaw-gateway.log 2>/dev/null; then
                log_ok "Gateway 已启动（$MODE 模式）"
                return 0
            fi
        fi
    done

    # 超时
    if pgrep -f "openclaw.*gateway" > /dev/null 2>&1; then
        log_ok "Gateway 进程存在（$MODE 模式）"
        return 0
    else
        log_err "Gateway 启动失败！"
        tail -15 /tmp/openclaw-gateway.log 2>/dev/null
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

    # 1. 恢复 openclaw.json（先改配置再重启）
    if [ -f "$BACKUP_FILE" ]; then
        cp "$BACKUP_FILE" "$OPENCLAW_JSON"
        log_ok "openclaw.json 已从备份恢复"
    else
        if grep -q "192.168.2.22:$PROXY_PORT" "$OPENCLAW_JSON" 2>/dev/null; then
            sed -i "s|http://192.168.2.22:$PROXY_PORT/anthropic|https://api.minimax.io/anthropic|g" "$OPENCLAW_JSON"
            log_ok "openclaw.json baseUrl 已改回 api.minimax.io"
        else
            log_ok "openclaw.json 已经是正常状态"
        fi
    fi

    # 2. 验证配置
    CURRENT_URL=$(cat "$OPENCLAW_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['models']['providers']['minimax-portal']['baseUrl'])" 2>/dev/null || echo "unknown")
    log_info "baseUrl: $CURRENT_URL"

    # 3. 强制杀掉 gateway
    echo ""
    force_kill_gateway

    # 4. 重新启动（读取已恢复的配置）
    echo ""
    if ! start_gateway "正常"; then
        log_err "请手动运行: npx openclaw gateway"
    fi

    echo ""
    log_ok "恢复完成！OpenClaw 直连 MiniMax，不走 proxy。"
    echo ""
}

# ============================================================
# start — 修复代码 + 启动 proxy + 切换 gateway
# ============================================================
do_start() {
    echo ""
    echo "=============================="
    echo "  启动 Debug Proxy 模式"
    echo "=============================="
    echo ""

    # ---- Step 1: 检查文件存在 ----
    if [ ! -f "$LLM_PROXY_FILE" ]; then
        log_err "找不到 $LLM_PROXY_FILE"
        exit 1
    fi
    if [ ! -f "$OPENCLAW_JSON" ]; then
        log_err "找不到 $OPENCLAW_JSON"
        exit 1
    fi
    log_ok "文件检查通过"

    # ---- Step 2: 修复 llm-proxy.js ----
    echo ""
    log_info "检查 llm-proxy.js..."

    sed -i '/console.log.*Content-Type.*isStreaming/d' "$LLM_PROXY_FILE"

    if grep -q "const isStreaming = true" "$LLM_PROXY_FILE"; then
        log_ok "isStreaming = true（已设置）"
    elif grep -q "const isStreaming = contentType" "$LLM_PROXY_FILE"; then
        sed -i "s/const isStreaming = contentType.includes.*/const isStreaming = true; \/\/ FORCE: MiniMax always streams/" "$LLM_PROXY_FILE"
        log_ok "isStreaming 已改为 true"
    else
        log_warn "找不到 isStreaming 行，请手动检查"
    fi

    # ---- Step 3: 备份 openclaw.json ----
    echo ""
    cp "$OPENCLAW_JSON" "$BACKUP_FILE"
    log_ok "openclaw.json 已备份"

    # ---- Step 4: 重启 claw-hive server ----
    echo ""
    log_info "重启 claw-hive server..."
    kill $(pgrep -f "node src/server.js" 2>/dev/null) 2>/dev/null || true
    sleep 2

    cd "$CLAW_HIVE_DIR"
    nohup node src/server.js > /tmp/claw-hive.log 2>&1 &
    CLAW_PID=$!
    sleep 3

    if kill -0 $CLAW_PID 2>/dev/null; then
        log_ok "claw-hive server 启动成功 (PID: $CLAW_PID)"
    else
        log_err "claw-hive server 启动失败！"
        tail -20 /tmp/claw-hive.log 2>/dev/null
        exit 1
    fi

    # ---- Step 5: 启动 proxy ----
    log_info "启动 proxy..."
    curl -s -X POST http://localhost:$CLAW_HIVE_PORT/api/debug-proxy/start > /dev/null 2>&1
    sleep 2

    HEALTH=$(curl -s http://localhost:$PROXY_PORT/_health 2>/dev/null)
    if echo "$HEALTH" | grep -q '"ok"'; then
        log_ok "Proxy 启动成功"
    else
        log_err "Proxy 启动失败！查看: tail -50 /tmp/claw-hive.log"
        exit 1
    fi

    # ---- Step 6: 改 baseUrl 指向 proxy ----
    echo ""
    log_info "修改 baseUrl → proxy..."
    sed -i "s|https://api.minimax.io/anthropic|http://192.168.2.22:$PROXY_PORT/anthropic|g" "$OPENCLAW_JSON"

    CURRENT_URL=$(cat "$OPENCLAW_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['models']['providers']['minimax-portal']['baseUrl'])" 2>/dev/null || echo "error")
    if echo "$CURRENT_URL" | grep -q "$PROXY_PORT"; then
        log_ok "baseUrl: $CURRENT_URL"
    else
        log_err "baseUrl 修改失败: $CURRENT_URL"
        cp "$BACKUP_FILE" "$OPENCLAW_JSON"
        exit 1
    fi

    # ---- Step 7: 强制重启 gateway（最关键的一步）----
    echo ""
    log_info "=== 强制重启 gateway（确保读取新配置）==="

    force_kill_gateway

    # 二次确认
    sleep 1
    if pgrep -f "openclaw.*gateway" > /dev/null 2>&1; then
        log_err "Gateway 未能完全停止，恢复配置..."
        cp "$BACKUP_FILE" "$OPENCLAW_JSON"
        exit 1
    fi
    log_ok "确认 gateway 已完全停止"

    # 启动新 gateway
    echo ""
    if ! start_gateway "proxy"; then
        log_err "Gateway 启动失败，恢复配置..."
        cp "$BACKUP_FILE" "$OPENCLAW_JSON"
        force_kill_gateway
        start_gateway "正常" || true
        exit 1
    fi

    # ---- Step 8: 最终验证 ----
    echo ""
    log_info "最终验证..."

    # 验证 proxy 还在
    HEALTH=$(curl -s http://localhost:$PROXY_PORT/_health 2>/dev/null)
    if echo "$HEALTH" | grep -q '"ok"'; then
        log_ok "Proxy 正常"
    else
        log_err "Proxy 挂了！"
    fi

    # 验证 baseUrl
    CURRENT_URL=$(cat "$OPENCLAW_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['models']['providers']['minimax-portal']['baseUrl'])" 2>/dev/null || echo "error")
    if echo "$CURRENT_URL" | grep -q "$PROXY_PORT"; then
        log_ok "配置正确: $CURRENT_URL"
    else
        log_err "配置异常: $CURRENT_URL"
    fi

    # ---- 完成 ----
    echo ""
    echo "=============================="
    echo -e "  ${GREEN}🎉 Debug Proxy 已启动！${NC}"
    echo "=============================="
    echo ""
    echo "  Proxy:     http://192.168.2.22:$PROXY_PORT"
    echo "  Dashboard: http://192.168.2.22:$CLAW_HIVE_PORT"
    echo ""
    echo "  现在通过 Telegram 发一条消息给 coder 测试。"
    echo "  ❌ 不要发: hi / test / hello"
    echo "  ✅ 要发: 请帮我检查一下 claw-hive 项目的文件结构"
    echo ""
    echo "  查看结果:"
    echo "    curl http://192.168.2.22:$CLAW_HIVE_PORT/api/debug-proxy/captures"
    echo ""
    echo "  查看日志:"
    echo "    tail -f /tmp/claw-hive.log | grep Proxy"
    echo ""
    echo "  ⚠️  恢复正常: bash $0 stop"
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

    # claw-hive server
    if pgrep -f "node src/server.js" > /dev/null; then
        log_ok "claw-hive server: 运行中 (PID: $(pgrep -f 'node src/server.js' | head -1))"
    else
        log_err "claw-hive server: 未运行"
    fi

    # proxy health
    HEALTH=$(curl -s http://localhost:$PROXY_PORT/_health 2>/dev/null)
    if echo "$HEALTH" | grep -q '"ok"'; then
        log_ok "Proxy: 运行中 — $HEALTH"
    else
        log_err "Proxy: 未运行"
    fi

    # gateway
    if pgrep -f "openclaw.*gateway" > /dev/null; then
        log_ok "Gateway: 运行中 (PID: $(pgrep -f 'openclaw.*gateway' | head -1))"
    else
        log_err "Gateway: 未运行"
    fi

    # baseUrl
    CURRENT_URL=$(cat "$OPENCLAW_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['models']['providers']['minimax-portal']['baseUrl'])" 2>/dev/null || echo "parse error")
    if echo "$CURRENT_URL" | grep -q "$PROXY_PORT"; then
        log_warn "baseUrl: $CURRENT_URL (走 proxy)"
    else
        log_ok "baseUrl: $CURRENT_URL (正常模式)"
    fi

    # captures
    CAPTURES=$(curl -s http://localhost:$CLAW_HIVE_PORT/api/debug-proxy/status 2>/dev/null)
    if [ -n "$CAPTURES" ]; then
        log_info "Proxy 状态: $CAPTURES"
    fi

    # backup
    if [ -f "$BACKUP_FILE" ]; then
        log_ok "备份文件: 存在"
    else
        log_warn "备份文件: 不存在"
    fi

    # isStreaming
    if grep -q "const isStreaming = true" "$LLM_PROXY_FILE" 2>/dev/null; then
        log_ok "isStreaming: 强制 true"
    else
        log_warn "isStreaming: Content-Type 检测"
    fi

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
    *)
        echo "用法: bash $0 [start|stop|status]"
        echo ""
        echo "  start  — 启动 proxy 模式（拦截所有 LLM 请求）"
        echo "  stop   — 恢复正常模式（直连 MiniMax）"
        echo "  status — 检查当前状态"
        exit 1
        ;;
esac
