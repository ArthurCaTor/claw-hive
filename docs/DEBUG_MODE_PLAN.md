# Context Inspector Debug Mode - 开关方案

## 目标

开发一个"调试开关"功能：
- 点击"启动监控" → 注入代码，记录 LLM 输入（prompt）
- 点击"停止监控" → 恢复 OpenClaw 默认状态
- 不永久修改 OpenClaw 代码，每次重启自动恢复

---

## 方案设计

### 核心思路

不修改 OpenClaw 源码，而是通过 **Runtime Hook** 方式：

```
方案 A: Express Middleware 注入
├── 在 claw-hive 搭建一个代理服务器
├── 拦截发给 LLM 的请求
├── 记录完整 prompt
└── 转发给 LLM

方案 B: Node.js Module Patching  
├── 在 claw-hive 运行时动态 require
├── 替换 OpenClaw 的关键模块
├── 拦截 write 操作
└── 不修改源码，只在运行时替换

方案 C: Webhook/Proxy 模式
├── 让 OpenClaw 调用 webhook
├── claw-hive 接收并记录
└── 依赖 OpenClaw 支持 webhook
```

---

## 推荐方案：方案 B (Runtime Patching)

### 原理

1. claw-hive 启动时加载 OpenClaw 模块
2. 用 `require.cache` 或 `Module.prototype.load` 拦截
3. 找到写入 .jsonl 的函数，在其前后插入记录逻辑

### 实现步骤

```javascript
// claw-hive/src/services/prompt-hook.js

class PromptHook {
  constructor() {
    this.active = false;
    this.originalAppend = null;
  }

  // 启动监控 - 注入 Hook
  start() {
    if (this.active) return;
    
    // 1. 找到 OpenClaw 的 session 写入模块
    const sessionModule = require('openclaw/dist/auth-profiles-MKCH-k1W.js');
    
    // 2. 保存原始函数
    this.originalAppend = sessionModule.appendMessage;
    
    // 3. 替换为包装函数
    sessionModule.appendMessage = (sessionFile, message) => {
      // 记录 message
      this.recordPrompt(message);
      
      // 调用原始函数
      return this.originalAppend(sessionFile, message);
    };
    
    this.active = true;
    console.log('[PromptHook] Started - recording prompts');
  }

  // 停止监控 - 恢复原始
  stop() {
    if (!this.active) return;
    
    // 恢复原始函数
    const sessionModule = require('openclaw/dist/auth-profiles-MKCH-k1W.js');
    sessionModule.appendMessage = this.originalAppend;
    
    this.active = false;
    console.log('[PromptHook] Stopped - restored original');
  }

  recordPrompt(message) {
    // 写入单独的文件或发送到前端
  }
}
```

---

## UI 设计

### Context 页面新增

```
┌─────────────────────────────────────────────────────────┐
│ [📡 Live] [📂 Recordings]  [🔧 Debug Mode: OFF/ON]     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 当 Debug Mode 开启时：                                   │
│                                                         │
│ ┌─ SYSTEM PROMPT ─────────────────────────────────┐   │
│ │ You are Coder agent...                          │   │
│ │ SOUL.md 内容...                                  │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ ┌─ MEMORY INJECTION ──────────────────────────────┐   │
│ │ ## Memory Recall...                              │   │
│ │ 2026-03-12: 完成功能列表...                      │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ ┌─ TOOLS DESCRIPTION ──────────────────────────────┐   │
│ │ bash: Execute shell commands...                  │   │
│ │ read: Read file contents...                     │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 按钮状态

- **灰色按钮**："🔧 Start Debug" - 启动监控
- **红色按钮**："🔧 Stop Debug" - 停止监控

---

## 技术细节

### 1. 需要拦截的位置

根据之前分析，OpenClaw 写入 .jsonl 的位置：
- `auth-profiles-MKCH-k1W.js` - `appendMessage()` 函数

### 2. 记录什么

| 字段 | 说明 |
|------|------|
| timestamp | 时间戳 |
| direction | input (发给LLM) / output (LLM回复) |
| role | system / user / assistant |
| content | 消息内容 |
| tokens | token 数量 |

### 3. 存储位置

```
~/.openclaw/agents/{agent}/prompts/{session_id}/
├── prompt-001.json
├── prompt-002.json
└── ...
```

---

## 风险与限制

| 风险 | 解决方案 |
|------|----------|
| OpenClaw 重启后 Hook 失效 | 每次请求前检查并重新注入 |
| 模块路径变化 | 动态查找，不硬编码 |
| 性能影响 | 仅在 Debug Mode 时启用 Hook |

---

## 替代方案：如果方案 B 失败

如果 Runtime Patching 不可行，改用 **方案 A - 代理模式**：

```
User → coder agent → claw-hive proxy → MiniMax LLM
                 ↓
            记录 prompt
```

需要 OpenClaw 支持配置 LLM 代理 URL。

---

*Created: 2026-03-13*
*Status: 待评估可行性*
