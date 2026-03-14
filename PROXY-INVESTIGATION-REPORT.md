# Proxy 精确拦截可行性报告
Date: 2026-03-13
Agent: Coder

## 调查 1：自定义 Base URL
### openclaw.json 中的相关配置
```json
{
  "models": {
    "providers": {
      "minimax-portal": {
        "baseUrl": "https://api.minimax.io/anthropic",
        "apiKey": "sk-cp-...",
        "api": "anthropic-messages",
        ...
      }
    }
  }
}
```

### 结论
- 是否支持自定义 base URL: **Yes**
- 配置方式: 
  - 在 `openclaw.json` 的 `models.providers.{provider}.baseUrl` 字段
  - 或者通过环境变量 `MINIMAX_API_HOST`

---

## 调查 2：LLM SDK
### 引用的 LLM client 库
从代码中可以看到 OpenClaw 使用原生 `fetch` 或自定义 HTTP 客户端，没有使用第三方 SDK（如 anthropic SDK 或 openai SDK）。

### API URL 构建方式
```javascript
// 优先级顺序:
const raw = params.apiHost?.trim() 
  || env.MINIMAX_API_HOST?.trim() 
  || params.modelBaseUrl?.trim() 
  || "https://api.minimax.io";
```

默认 URL: `https://api.minimax.io/anthropic`

### 结论
- 使用方式: 原生 fetch / 自定义 HTTP 客户端
- URL 可通过环境变量覆盖: `MINIMAX_API_HOST`

---

## 调查 3：环境变量
### 可用的环境变量
- `MINIMAX_API_HOST` - 覆盖 MiniMax API 域名
- `MINIMAX_API_KEY` - MiniMax API Key
- `ANTHROPIC_API_KEY` - Anthropic API Key
- `OPENAI_API_KEY` - OpenAI API Key
- `NO_PROXY`, `no_proxy` - 代理设置

### .env 文件
未找到 ~/.openclaw/.env 文件

### 结论
- 可通过 `MINIMAX_API_HOST` 环境变量设置代理

---

## 调查 4：实际请求
未进行实际测试（按要求不修改配置）

---

## 调查 5：Provider 配置
### 当前 model 配置
```json
{
  "id": "MiniMax-M2.5",
  "name": "MiniMax M2.5",
  "api": "anthropic-messages",
  "contextWindow": 200000,
  "maxTokens": 8192
}
```

### Provider API endpoint
- 默认: `https://api.minimax.io/anthropic`
- 可通过 `MINIMAX_API_HOST` 覆盖

---

## 总结
- **Proxy 方案是否可行**: Yes
- **推荐的拦截方式**: 
  1. 设置环境变量 `MINIMAX_API_HOST=http://localhost:8999`
  2. 启动本地 Proxy 服务在端口 8999
  3. Proxy 转发到真实的 `https://api.minimax.io/anthropic`
- **需要修改的配置**:
  - 在 OpenClaw 启动前设置环境变量: `MINIMAX_API_HOST=http://localhost:8999`
  - 或者在 openclaw.json 中修改 `baseUrl`
- **风险和注意事项**:
  - 需要重启 OpenClaw 生效
  - Proxy 需要能处理 HTTPS 请求（可能需要 SSL 证书处理）
  - 需要处理 API Key 透传
