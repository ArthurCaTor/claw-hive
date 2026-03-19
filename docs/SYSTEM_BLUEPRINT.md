# System Blueprint: 6-Agent Multi-Provider Architecture

## 🎯 Overview

本蓝图描述一个基于 OpenClaw 的 6 Agent 系统，每个 Agent 使用不同的 LLM Provider，通过独立的 Telegram Bot 与用户交互。

```
┌─────────────────────────────────────────────────────────────────┐
│                         OpenClaw Gateway                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Message Router                        │   │
│  │         (根据 Telegram Chat ID 分发到对应 Agent)         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  MiniMax A    │   │  MiniMax B    │   │  OpenAI A    │
│  @coder_bot   │   │  @scout_bot   │   │  @dev_bot    │
│  (coder)      │   │  (scout)      │   │  (developer) │
└───────────────┘   └───────────────┘   └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  OpenAI B     │   │  Claude A     │   │  Claude B    │
│  @analyst_bot│   │  @claude1_bot │   │  @claude2_bot│
│  (analyst)   │   │  (researcher) │   │  (specialist)│
└───────────────┘   └───────────────┘   └───────────────┘
```

## 🤖 Agent 配置

### MiniMax Agents (2x)

```yaml
agents:
  coder:
    name: "Coder MiniMax-A"
    model: "MiniMax-M2.1"
    provider: "minimax"
    telegram_bot: "@your_coder_bot"
    soul: |
      你是一个专业的程序员助手，名叫 Coder。
      你擅长编程、调试、代码审查和架构设计。
      用中文回答，技术术语保留英文。
    skills:
      - coding
      - debugging
      - code-review
    tools:
      - file_read
      - file_write
      - exec
      - browser
  
  scout:
    name: "Scout MiniMax-B"
    model: "MiniMax-M2.1"  
    provider: "minimax"
    telegram_bot: "@your_scout_bot"
    soul: |
      你是一个信息收集专家，名叫 Scout。
      你擅长搜索、调研、分析和整理信息。
      用简洁清晰的语言回答。
    skills:
      - research
      - analysis
      - web-search
    tools:
      - web_search
      - memory_read
```

### OpenAI Agents (2x)

```yaml
agents:
  developer:
    name: "Developer OpenAI-A"
    model: "gpt-4o"
    provider: "openai"
    telegram_bot: "@your_dev_bot"
    soul: |
      你是一个全栈开发专家，名叫 Developer。
      你擅长 Web 开发、API 设计、数据库优化。
      提供实践导向的解决方案。
    skills:
      - web-development
      - api-design
      - database
    tools:
      - file_read
      - file_write
      - exec
      - browser
  
  analyst:
    name: "Analyst OpenAI-B"
    model: "gpt-4o-mini"
    provider: "openai"
    telegram_bot: "@your_analyst_bot"
    soul: |
      你是一个数据分析师，名叫 Analyst。
      你擅长数据分析、统计、可视化。
      用数据和图表解释现象。
    skills:
      - data-analysis
      - statistics
      - visualization
    tools:
      - web_search
      - data_process
```

### Claude Agents (2x)

```yaml
agents:
  researcher:
    name: "Researcher Claude-A"
    model: "claude-sonnet-4-20250514"
    provider: "anthropic"
    telegram_bot: "@your_claude1_bot"
    soul: |
      你是一个深度研究专家，名叫 Researcher。
      你擅长深入分析复杂问题、逻辑推理、多角度思考。
      提供详尽、有理有据的分析。
    skills:
      - deep-research
      - logic
      - reasoning
    tools:
      - web_search
      - browser
      - memory_read
  
  specialist:
    name: "Specialist Claude-B"
    model: "claude-opus-4-20250514"
    provider: "anthropic"
    telegram_bot: "@your_claude2_bot"
    soul: |
      你是一个专业领域顾问，名叫 Specialist。
      你在多个专业领域有深入知识。
      提供高质量、高准确性的专业建议。
    skills:
      - consulting
      - problem-solving
      - strategy
    tools:
      - web_search
      - memory_read
      - file_read
```

## 🔌 Provider 配置

```yaml
providers:
  minimax:
    name: "MiniMax Portal"
    api_key: "${MINIMAX_API_KEY}"
    base_url: "https://api.minimax.chat"
    models:
      - "MiniMax-M2.1"
      - "MiniMax-M2.5"
  
  openai:
    name: "OpenAI"
    api_key: "${OPENAI_API_KEY}"
    base_url: "https://api.openai.com/v1"
    models:
      - "gpt-4o"
      - "gpt-4o-mini"
  
  anthropic:
    name: "Anthropic Claude"
    api_key: "${ANTHROPIC_API_KEY}"
    base_url: "https://api.anthropic.com"
    models:
      - "claude-sonnet-4-20250514"
      - "claude-opus-4-20250514"
```

## 📱 Telegram Bot 设置

### Bot 创建步骤

1. **联系 @BotFather** 在 Telegram 创建 Bot
2. **获取 Bot Token**
3. **为每个 Agent 创建独立 Bot**

### 路由配置

```yaml
channels:
  telegram:
    enabled: true
    bots:
      coder:
        token: "${TELEGRAM_CODER_BOT_TOKEN}"
        allowed_chats: [123456789]  # 允许的 Telegram Chat ID
      scout:
        token: "${TELEGRAM_SCOUT_BOT_TOKEN}"
        allowed_chats: [123456789]
      developer:
        token: "${TELEGRAM_DEV_BOT_TOKEN}"
        allowed_chats: [123456789]
      analyst:
        token: "${TELEGRAM_ANALYST_BOT_TOKEN}"
        allowed_chats: [123456789]
      researcher:
        token: "${TELEGRAM_RESEARCHER_BOT_TOKEN}"
        allowed_chats: [123456789]
      specialist:
        token: "${TELEGRAM_SPECIALIST_BOT_TOKEN}"
        allowed_chats: [123456789]
```

## 💰 成本估算（每月）

| Provider | Model | 消息量 | 估算成本 |
|----------|-------|--------|----------|
| MiniMax | M2.1 | 3000 | ~$5 |
| MiniMax | M2.1 | 3000 | ~$5 |
| OpenAI | GPT-4o | 1000 | ~$10 |
| OpenAI | GPT-4o-mini | 2000 | ~$2 |
| Anthropic | Claude Sonnet | 1000 | ~$15 |
| Anthropic | Claude Opus | 500 | ~$50 |

**总计：约 $87/月**

## 🛡️ 安全配置

### 认证

```yaml
security:
  api_keys:
    enabled: true
    header: "X-API-Key"
    keys:
      - "${CLAW_HIVE_API_KEY}"
  
  telegram:
    allowed_chat_ids:
      - 123456789  # Arthur
      - 987654321  # 其他用户
```

### 速率限制

```yaml
rate_limits:
  per_agent:
    coder:
      max_requests_per_minute: 10
      max_tokens_per_day: 100000
```

## 📊 监控面板

通过 Claw-Hive Dashboard 监控：

```
GET /api/agents          # 所有 Agent 状态
GET /api/cost             # 成本统计
GET /api/captures         # LLM 调用记录
```

## 🚀 部署架构

```
                    ┌─────────────────┐
                    │   Nginx/Traefik │
                    │   (反向代理)     │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ MiniMax  │  │  OpenAI  │  │Anthropic │
        │   API    │  │   API    │  │   API    │
        └──────────┘  └──────────┘  └──────────┘
```

## 📝 实施步骤

### Phase 1: 基础配置
1. [ ] 创建 6 个 Telegram Bot
2. [ ] 配置 Provider API Keys
3. [ ] 创建 agents.json 配置
4. [ ] 测试单 Agent 连接

### Phase 2: 路由配置
1. [ ] 配置 Telegram Channel 路由
2. [ ] 设置 Chat ID 白名单
3. [ ] 测试消息分发

### Phase 3: 监控
1. [ ] 配置 Claw-Hive 监控
2. [ ] 设置成本告警
3. [ ] Dashboard 集成

### Phase 4: 优化
1. [ ] 性能监控
2. [ ] 成本优化
3. [ ] Fallback 配置
