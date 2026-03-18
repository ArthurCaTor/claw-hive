# Claw-Hive 系统蓝图 (System Blueprint)

## 完整架构图 (Architecture)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        用户 (Telegram)                                    │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│   │ User A  │  │ User B  │  │ User C  │  │ User D  │  │ User E  │  │ User F  │ │
│   │(MiniMax)│  │(MiniMax)│  │(OpenAI) │  │(OpenAI) │  │(Claude) │  │(Claude) │ │
│   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘ │
└────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────────┘
         │          │          │          │          │          │
         ▼          ▼          ▼          ▼          ▼          ▼
┌───────────────────────────────────────────────────────────────────────────┐
│              OpenClaw Gateway (Telegram Router)                         │
│                    agent_chat plugin                                │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                    claw-hive Server (:8080)                         │
│                                                                       │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│  │ Agent 1 │ │ Agent 2 │ │ Agent 3 │ │ Agent 4 │ │ Agent 5 │ │ Agent 6 │ │
│  │(MiniMax│ │(MiniMax│ │(OpenAI │ │(OpenAI │ │ Claude  │ │ Claude  │ │
│  │  M2.5) │ │  M2.5) │ │  GPT-4o)│ │  GPT-4o)│ │ Sonnet) │ │ Sonnet) │ │
│  └───┬─────┘ └───┬─────┘ └───┬─────┘ └───┬─────┘ └───┬─────┘ └───┬─────┘ │
│      │          │          │          │          │          │         │
│      │          │          │          │          │          │         │
│      ▼          ▼          ▼          ▼          ▼          ▼         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Memory Management (内存管理)                     │   │
│  │  • conversation history (最近 N 条消息)                     │   │
│  │  • context window (滑动窗口)                              │   │
│  │  • variables (模型/角色配置)                              │   │
│  │  • memory: short + long (工作+持久记忆)                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                    LLM Proxy (:8999)                             │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────┐        │
│  │   Provider Router (根据 agent.model 路由)                │        │
│  └─────────────────────────────────────────────────────────┘        │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────┐        │
│  │   captures: [] (内存中保存最近 100 条调用记录)           │        │
│  └─────────────────────────────────────────────────────────┘        │
│                                                                       │
│      │              │              │                                │
│      ▼              ▼              ▼                                │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐                          │
│  │ MiniMax │   │ OpenAI  │   │ Claude  │                          │
│  │  M2.5  │   │ GPT-4o  │   │ Sonnet │                          │
│  └────┬────┘   └────┬────┘   └────┬────┘                          │
└───────┼─────────────┼─────────────┼──────────────────────────────────┘
        │             │             │
        ▼             ▼             ▼
   api.minimax.io  api.openai.com  api.anthropic.com
```

---

## 数据流: 一问一答 (Message Flow)

```
Step 1: 用户发送消息
─────────────────────────────────────────
Telegram User ──▶ Gateway ──▶ Agent Queue

Step 2: Agent 加载上下文 (内存)
─────────────────────────────────────────
Agent ──▶ Session Store ──▶ conversation history
     ──▶ Memory Manager ──▶ working memory

Step 3: LLM 调用
─────────────────────────────────────────
Agent ──▶ LLM Proxy ──▶ captures.push(request)
                         ──▶ Provider API

Step 4: 流式响应
─────────────────────────────────────────
Provider ──▶ Proxy ──▶ Agent ──▶ User (实时推送)

Step 5: 保存记录
─────────────────────────────────────────
Proxy ──▶ captures 数组 (内存, max 100条)
Agent ──▶ Session Store ──▶ events.jsonl (磁盘)

Step 6: Compaction (可选)
─────────────────────────────────────────
Memory ──▶ long-term.json (持久化)
```

---

## 内存管理架构 (Memory Management)

```
┌─────────────────────────────────────────────┐
│         Agent Session (内存)                   │
├─────────────────────────────────────────────┤
│                                             │
│  conversation: [                           │
│    {role: "user", content: "...", ts: 123},│
│    {role: "assistant", content: "...", ts: 124}│
│    ...                                      │
│  ]                                         │
│                                             │
│  context_window: [最近 N 条] ← 滑动窗口       │
│                                             │
│  variables: {                               │
│    agent_id: "coder",                       │
│    model: "MiniMax-M2.5",                 │
│    provider: "minimax-portal"              │
│  }                                         │
│                                             │
│  memory: {                                 │
│    short: [...],    ← 工作记忆 (易失)        │
│    long: [...]      ← 长期记忆 (持久化)      │
│  }                                         │
└─────────────────────────────────────────────┘
              │
              │ compaction 触发
              ▼
┌─────────────────────────────────────────────┐
│         Compaction 流程                      │
├─────────────────────────────────────────────┤
│                                             │
│  1. 合并 conversation → summary             │
│  2. 提取关键信息 (preferences, facts)      │
│  3. 写入 memory/long-term.json           │
│  4. 清空旧消息，保留 summary               │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 文件系统布局 (File System)

```
~/.openclaw/
├── workspace-coder/
│   ├── sessions/
│   │   ├── {session-id}.json        # 完整会话
│   │   └── {session-id}.events.jsonl  # 事件流
│   ├── memory/
│   │   ├── long-term.json           # 持久记忆
│   │   └── working.json           # 工作记忆
│   └── config.json
│
├── workspace-nova/
├── workspace-scout/
└── openclaw.json                  # 全局配置

~/claw-hive/
├── captures/                      # LLM 调用记录
│   ├── 2026-03-18-minimax.jsonl
│   ├── 2026-03-18-openai.jsonl
│   └── 2026-03-18-anthropic.jsonl
│
└── logs/
```

---

## Agent 配置示例 (Configuration)

```json
{
  "agents": [
    {
      "agent_id": "coder",
      "name": "Coder",
      "provider": "minimax-portal",
      "model": "MiniMax-M2.5",
      "telegram_chat_id": "111"
    },
    {
      "agent_id": "nova",
      "name": "NOVA", 
      "provider": "minimax-portal",
      "model": "MiniMax-M2.5",
      "telegram_chat_id": "222"
    },
    {
      "agent_id": "scout",
      "name": "Scout",
      "provider": "openai",
      "model": "gpt-4o",
      "telegram_chat_id": "333"
    },
    {
      "agent_id": "druid",
      "name": "Druid",
      "provider": "openai",
      "model": "gpt-4o",
      "telegram_chat_id": "444"
    },
    {
      "agent_id": "scribe",
      "name": "Scribe",
      "provider": "anthropic",
      "model": "claude-sonnet-4-20250514",
      "telegram_chat_id": "555"
    },
    {
      "agent_id": "tester",
      "name": "Tester",
      "provider": "anthropic",
      "model": "claude-sonnet-4-20250514",
      "telegram_chat_id": "666"
    }
  ]
}
```

---

## 核心文件 (Core Files)

| 文件 | 作用 |
|------|------|
| `session-watcher.ts` | 监控会话变化，触发写入 |
| `llm-proxy.ts` | LLM 请求代理，捕获调用 |
| `openclaw-reader.ts` | 读取 OpenClaw 状态 |
| `prompt-store.ts` | 提示词管理 |
| `recording-store.ts` | 录制存储 |
| `capture-file-writer.ts` | 写入 captures 目录 |

---

## Provider 路由逻辑

```typescript
// llm-proxy.ts
const providerMap = {
  'minimax-portal': 'https://api.minimax.io/anthropic',
  'openai': 'https://api.openai.com/v1',
  'anthropic': 'https://api.anthropic.com/v1'
};

// 根据 agent config 中的 provider 选择
const targetUrl = providerMap[agent.provider] + req.path;
```

---
*Generated: 2026-03-18*

---

## 专业图表 (Generated SVG)

### 系统架构图
![System Blueprint](/SYSTEM_BLUEPRINT.svg)

*打开浏览器访问查看高清版本: http://192.168.2.22:8080/SYSTEM_BLUEPRINT.svg*
