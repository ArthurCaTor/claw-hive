# Context Stream Inspector - 完整 Prompt 记录方案

## 当前状态

### 已实现 (v3)
- ✅ 读取本地 `.jsonl` 文件
- ✅ 实时监听新事件 (fs.watch)
- ✅ 显示：user message, assistant reply, thinking, tool calls

### 未实现
- ❌ System Prompt (SOUL.md、规则)
- ❌ Memory 注入内容
- ❌ 发送给 LLM 的完整 messages 数组

---

## 原因

OpenClaw 的 `.jsonl` 文件只记录运行时事件（message, thinking, toolCall），不记录发送给 LLM 的完整 prompt。

---

## 需要修改的位置

### 1. 写入 Session 文件
**文件：** `dist/auth-profiles-MKCH-k1W.js`

```javascript
SessionManager.open(sessionFile).appendMessage({
  role: "assistant", 
  content: [{ type: "text", text: mirrorText }]
})
```

### 2. 构建 System Prompt
**文件：** `dist/compact-1mmJ_KWL.js`

包含函数：
- `buildSkillsSection()` - 技能部分
- `buildMemorySection()` - Memory 注入
- `buildUserIdentitySection()` - 用户身份
- `buildAgentSystemPrompt()` - 完整 system prompt

### 3. 发送给 LLM 的消息构建
需要找 `buildMessages()` 或类似函数

---

## 修改方案

| 步骤 | 修改位置 | 说明 |
|------|----------|------|
| 1 | 在 `appendMessage()` 之前 | 记录发送给 LLM 的 messages 数组 |
| 2 | 添加新事件类型 | 如 `prompt_build` 或 `context_snapshot` |
| 3 | 写入 .jsonl | 和现有 `message` 事件一样的方式 |

---

## 记录内容

需要确认要记录哪些：
1. **仅 System Prompt** - SOUL.md、人格、规则
2. **Memory 注入** - MEMORY.md 内容
3. **完整 Messages 数组** - 所有发送给 LLM 的消息

---

## 相关文件路径

OpenClaw 源码位置：
```
~/.nvm/versions/node/v22.22.0/lib/node_modules/openclaw/dist/
```

关键文件：
- `compact-1mmJ_KWL.js` - System prompt 构建
- `auth-profiles-MKCH-k1W.js` - Session 写入

---

*Created: 2026-03-13*
*Status: Pending Implementation*
