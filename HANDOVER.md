# ClawHive 项目交接文档

## 项目概述

**ClawHive** 是一个实时监控 OpenClaw AI Agent 状态的 Dashboard。

- **项目位置**: `/home/arthur/claw-hive`
- **GitHub**: https://github.com/ArthurCaTor/claw-hive
- **技术栈**: Node.js + Express + React + Vite + WebSocket

---

## 快速启动

```bash
# Terminal 1: 启动 API 服务器
cd /home/arthur/claw-hive
PORT=3000 node src/server.js &

# Terminal 2: 启动前端
cd /home/arthur/claw-hive
npx vite --host 0.0.0.0 --port 8080 &
```

**访问地址**: http://192.168.2.22:8080

---

## 架构说明

```
┌─────────────────┐     ┌─────────────────┐
│  Vite (8080)   │────▶│  API (3000)     │
│  前端 + 代理    │     │  后端 + WebSocket│
└─────────────────┘     └─────────────────┘
                              │
                              ▼
                      ┌─────────────────┐
                      │ OpenClaw sessions│
                      └─────────────────┘
```

- **API 服务器 (3000)**: 每10秒轮询 OpenClaw sessions，提供 REST API + WebSocket
- **Vite 开发服务器 (8080)**: 前端界面，代理 API 请求到 3000

---

## 重要规则

### ⚠️ 不要做的事情
1. **不要使用生产构建** (`npm run build`) - 会导致白屏
2. **不要用单一 Express 服务器** - 有 CORS 问题
3. **不要修改前端的 API URL** - 已经配置好代理

### ✅ 正确的做法
1. 始终保持两个服务器运行: API (3000) + Vite (8080)
2. 先启动 API 服务器，再启动 Vite
3. 修改代码后 Vite 会自动热重载

---

## 常见问题 & 解决方案

### 白屏 / React 不加载
```bash
# 检查服务器是否运行
ss -tlnp | grep -E "3000|8080"

# 重启两个服务器
cd /home/arthur/claw-hive
PORT=3000 node src/server.js &
npx vite --host 0.0.0.0 --port 8080 &
```

### WebSocket 错误
这是 Vite 代理的正常现象，可以忽略。Polling 每10秒会自动轮询作为备用。

### Agent 状态不更新
检查服务器日志，确认 session 检测逻辑是否正常工作。

### API 连接被拒绝
API 服务器 (3000) 可能没有运行。优先启动 API 服务器。

---

## 维护任务

### 定期任务
- 确保两个服务器持续运行
- 监控 GitHub 仓库的更新

### 更新代码后
1. Vite 会自动热重载
2. 如果需要完全重载，刷新浏览器

---

## 调试命令

```bash
# 检查端口
ss -tlnp | grep -E "3000|8080"

# 检查 API
curl http://localhost:3000/api/agents

# 检查前端
curl http://localhost:8080/

# 查看日志
tail -50 /tmp/api.log
tail -50 /tmp/vite.log
```

---

## GitHub 操作

### 推送更新
```bash
cd /home/arthur/claw-hive
git add .
git commit -m "your message"
git push origin main
```

### 更新依赖
```bash
cd /home/arthur/claw-hive
npm install
```

---

## 下一步可能的改进

1. **修复 WebSocket 稳定性** - 当前有偶尔断开的问题
2. **优化 Polling 阈值** - 当前是10分钟
3. **添加更多 Agent 信息** - 比如最后活跃时间、详细信息
4. **支持更多 Channel** - 除了 Telegram，还支持 Discord、Slack 等
5. **部署到云端** - 目前只在本地运行

---

## 联系方式

如有疑问，可以查看：
- 项目 Skill 文档: `~/.openclaw/workspace-nova/skills/claw-hive/SKILL.md`
- OpenClaw 文档

---

**祝维护顺利！** 🚀
