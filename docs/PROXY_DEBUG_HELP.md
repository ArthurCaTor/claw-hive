# Debug Proxy - 请求 Claude 帮助

## 问题描述

正在实现 H-12 Debug Proxy 功能，需要拦截 OpenClaw 发送给 LLM 的 API 请求。

## 已完成的工作

1. **llm-proxy.ts** - 实现本地 Proxy 服务
   - 监听端口 8999
   - 转发请求到真实的 MiniMax API
   - 记录请求和响应
   
2. **debug-proxy-routes.js** - API 端点
   - /api/debug-proxy/start
   - /api/debug-proxy/stop
   - /api/debug-proxy/captures

3. **server.js** - 注册路由

## 测试步骤

1. 启动 claw-hive server
2. 启动 proxy: `curl -X POST http://192.168.2.22:3000/api/debug-proxy/start`
3. 验证 proxy 运行: `curl http://192.168.2.22:8999/_health` → 返回 `{"status":"ok"}`
4. 在 MacBookPro 上启动 OpenClaw gateway 带环境变量:
   ```
   MINIMAX_API_HOST=http://192.168.2.22:8999 npx openclaw gateway
   ```
5. 通过 Telegram 发送消息给 coder

## 实际结果

- ✅ Proxy 可以启动并监听 0.0.0.0:8999
- ✅ curl 可以从 MacBookPro 连接到 proxy (验证网络通)
- ❌ 没有捕获到任何 API 调用 (totalCalls: 0)

## 已验证的事实

1. **环境变量名称正确**: 代码中使用 `MINIMAX_API_HOST`
   ```javascript
   const raw = params.apiHost?.trim() || env.MINIMAX_API_HOST?.trim() || params.modelBaseUrl?.trim() || "https://api.minimax.io";
   ```

2. **网络连通**: MacBookPro 可以 curl 到 192.168.2.22:8999

3. **Gateway 启动**: OpenClaw gateway 成功启动，日志显示正常

4. **消息发送**: 日志显示收到消息，但显示 "Skipping short or empty message"

## 可能的原因

1. 环境变量没有被正确传递到 gateway 进程
2. OpenClaw 使用了配置文件的 apiHost，覆盖了环境变量
3. 消息太短被跳过，没有真正调用 LLM

## 需要帮助

1. 如何确认 OpenClaw 实际使用的 API URL 是什么？
2. 是否有其他方式设置 API 代理？
3. 为什么消息会被跳过而不调用 LLM？

## 环境信息

- OpenClaw: 2026.3.12
- Proxy: claw-hive 内置
- MiniMax API: https://api.minimax.io
