# ClawHive Evolution Audit v2.0
# ClawHive 进化审计 v2.0

## Mission Overview
## 任务概述

You are the ClawHive Code Auditor. Your mission is to run **100 autonomous evolution cycles** to audit, harden, and improve the existing codebase.

你是 ClawHive 代码审计员。你的任务是运行 **100 轮自主进化循环**，审计、加固和改进现有代码。

---

## Critical Rules
## 关键规则

### DO NOT:
### 禁止：
1. **DO NOT add new features** — Only improve existing code
   **禁止添加新功能** — 只改进现有代码
2. **DO NOT ask Arthur for confirmation** — Run all 100 cycles autonomously
   **禁止向 Arthur 确认** — 自主运行全部 100 轮
3. **DO NOT touch production (main branch)** — All work stays in evolution branch
   **禁止触碰生产环境（main 分支）** — 所有工作都在 evolution 分支
4. **DO NOT modify more than 100 lines per cycle** — Small, safe changes only
   **每轮改动禁止超过 100 行** — 只做小而安全的改动
5. **DO NOT break existing functionality** — If tests fail, revert immediately
   **禁止破坏现有功能** — 测试失败立即回滚

### DO:
### 要求：
1. **Find bugs** — Logic errors, edge cases, null checks, error handling
   **寻找 bug** — 逻辑错误、边界情况、空值检查、错误处理
2. **Improve code quality** — Readability, consistency, performance
   **提高代码质量** — 可读性、一致性、性能
3. **Harden existing features** — Better error messages, validation, resilience
   **加固现有功能** — 更好的错误信息、验证、健壮性
4. **Document issues** — Log everything for final report
   **记录问题** — 记录所有内容用于最终报告
5. **Run tests after every change** — `npm test` must pass
   **每次改动后运行测试** — `npm test` 必须通过

---

## Pre-Audit Setup
## 审计前准备

Before starting the 100 cycles, execute these commands:

开始 100 轮循环前，执行以下命令：

```bash
cd /home/arthur/claw-hive

# Step 1: Ensure all previous work is merged to main
# 步骤 1：确保之前的工作已合并到 main
git checkout main
git pull origin main 2>/dev/null || true
git log --oneline -3

# Step 2: Push to GitHub if not already done
# 步骤 2：如果还没有，推送到 GitHub
git push origin main

# Step 3: Reset evolution branch from fresh main
# 步骤 3：从最新的 main 重置 evolution 分支
git checkout evolution
git reset --hard main

# Step 4: Archive old EVOLUTION.md
# 步骤 4：存档旧的 EVOLUTION.md
mv EVOLUTION.md EVOLUTION-V1-COMPLETE.md 2>/dev/null || true

# Step 5: Confirm clean state
# 步骤 5：确认干净状态
git status
npm test
```

---

## Audit Focus Areas
## 审计重点区域

### Area 1: Bug Detection (Cycles 1-25)
### 区域 1：Bug 检测（第 1-25 轮）

Focus on finding and fixing bugs:
专注于发现和修复 bug：

| File/Area | What to Check | 检查内容 |
|-----------|---------------|----------|
| `src/server.js` | Null pointer exceptions, unhandled promises | 空指针异常、未处理的 Promise |
| `src/routes/*.js` | Missing error handling, invalid input | 缺少错误处理、无效输入 |
| `src/services/*.js` | Race conditions, resource leaks | 竞争条件、资源泄漏 |
| `bin/cli.js` | Edge cases in CLI commands | CLI 命令的边界情况 |

**Bug Categories to Track:**
**要追踪的 Bug 类别：**
- `[BUG-CRITICAL]` — Could crash the server
- `[BUG-HIGH]` — Incorrect behavior, data loss possible
- `[BUG-MEDIUM]` — Unexpected behavior, poor UX
- `[BUG-LOW]` — Minor issues, cosmetic

---

### Area 2: Code Hardening (Cycles 26-50)
### 区域 2：代码加固（第 26-50 轮）

Focus on making existing code more robust:
专注于使现有代码更健壮：

| Improvement | Description | 描述 |
|-------------|-------------|------|
| Input validation | Check all user inputs | 检查所有用户输入 |
| Error messages | Make errors helpful and clear | 使错误信息有用且清晰 |
| Defensive coding | Add null checks, default values | 添加空值检查、默认值 |
| Timeout handling | Add timeouts to async operations | 为异步操作添加超时 |
| Resource cleanup | Ensure files/connections are closed | 确保文件/连接被关闭 |

---

### Area 3: LLM Proxy Audit (Cycles 51-70)
### 区域 3：LLM 代理审计（第 51-70 轮）

Deep audit of `src/services/llm-proxy.js`:
深度审计 `src/services/llm-proxy.js`：

| Check | Description | 描述 |
|-------|-------------|------|
| Error recovery | What happens when API fails? | API 失败时会发生什么？ |
| Memory management | Are captures properly limited? | capture 是否正确限制？ |
| Streaming stability | SSE parsing edge cases | SSE 解析的边界情况 |
| Connection handling | Timeout, retry, cleanup | 超时、重试、清理 |
| Header forwarding | Are all necessary headers passed? | 所有必要的 header 是否都传递了？ |

**Evaluate:**
**评估：**
- Should proxy have its own CLI commands? (`claw-hive proxy start/stop/status`)
- Can proxy code be simplified?
- Are there any security issues?

---

### Area 4: CLI Commands Audit (Cycles 71-85)
### 区域 4：CLI 命令审计（第 71-85 轮）

Audit `bin/cli.js` and related:
审计 `bin/cli.js` 及相关：

| Command | Check | 检查 |
|---------|-------|------|
| `sessions` | Empty results, invalid agent names | 空结果、无效 agent 名称 |
| `tail` | Non-existent sessions, permission errors | 不存在的 session、权限错误 |
| `quota` | Edge cases, formatting | 边界情况、格式化 |
| `start` | Port conflicts, startup failures | 端口冲突、启动失败 |

**Evaluate:**
**评估：**
- Should `claw-hive proxy` CLI be added?
- Are error messages helpful?
- Is output formatting consistent?

---

### Area 5: General Code Quality (Cycles 86-100)
### 区域 5：通用代码质量（第 86-100 轮）

| Check | Description | 描述 |
|-------|-------------|------|
| Dead code | Remove unused functions/variables | 删除未使用的函数/变量 |
| Duplicate code | Merge similar code blocks | 合并相似代码块 |
| Naming | Improve unclear variable/function names | 改进不清晰的变量/函数名 |
| Comments | Add/fix comments where needed | 在需要的地方添加/修复注释 |
| Consistency | Code style consistency | 代码风格一致性 |

---

## Cycle Execution Protocol
## 循环执行协议

For each cycle (1 to 100), follow this exact protocol:
对于每一轮循环（1 到 100），严格遵循此协议：

```
CYCLE {N}/100
============

1. IDENTIFY - Pick ONE issue to fix from current focus area
   识别 - 从当前重点区域选择一个问题修复

2. ANALYZE - Understand the code, plan the fix
   分析 - 理解代码，规划修复

3. IMPLEMENT - Make the change (max 100 lines)
   实现 - 做出改动（最多 100 行）

4. TEST - Run: npm test
   测试 - 运行：npm test

5. VERIFY - Check the fix works as expected
   验证 - 检查修复是否按预期工作

6. DECIDE:
   决定：
   - If tests PASS → git add -A && git commit -m "audit-{N}: description"
     如果测试通过 → git add -A && git commit -m "audit-{N}: description"
   - If tests FAIL → git checkout -- . && git clean -fd
     如果测试失败 → git checkout -- . && git clean -fd

7. LOG - Record the result in audit-log.jsonl
   记录 - 在 audit-log.jsonl 中记录结果

8. CONTINUE to next cycle (do not stop)
   继续下一轮循环（不要停止）
```

---

## Logging Format
## 日志格式

Create/append to `evolution/audit-log.jsonl`:
创建/追加到 `evolution/audit-log.jsonl`：

```json
{
  "cycle": 1,
  "area": "bug-detection",
  "file": "src/services/session-watcher.js",
  "type": "BUG-MEDIUM",
  "description": "getAllSessions() crashes if agents directory doesn't exist",
  "fix": "Added directory existence check before reading",
  "lines_changed": 5,
  "test_passed": true,
  "committed": true,
  "commit_hash": "abc1234"
}
```

---

## Final Report Structure
## 最终报告结构

After completing all 100 cycles, generate `AUDIT-REPORT.md`:
完成全部 100 轮后，生成 `AUDIT-REPORT.md`：

```markdown
# ClawHive Audit Report

## Executive Summary
- Total cycles: 100
- Bugs found: X
- Bugs fixed: X
- Code improvements: X
- Tests: All passing

## Section 1: Bugs Found and Fixed
### Critical Bugs
### High Priority Bugs
### Medium Priority Bugs
### Low Priority Bugs

## Section 2: Bugs Found but NOT Fixed (Need Arthur's Decision)
(List any bugs that require architectural changes or new features)

## Section 3: Code Hardening Completed
(List all defensive improvements made)

## Section 4: LLM Proxy Analysis
### Current State
### Issues Found
### Recommendations
- Should add proxy CLI? Yes/No, because...
- Should simplify code? Yes/No, because...
- Security concerns: ...

## Section 5: CLI Analysis
### Current State
### Issues Found
### Recommendations

## Section 6: Suggested Future Improvements
(Things that would require new features - for Arthur to decide)

## Appendix: All Commits
(List of all 100 cycle commits with descriptions)
```

---

## Emergency Procedures
## 紧急程序

### If tests keep failing:
### 如果测试持续失败：
```bash
git checkout -- .
git clean -fd
npm test
# If still failing, stop and report
```

### If you made a mistake:
### 如果犯了错误：
```bash
git reset --hard HEAD~1
npm test
```

### If something is seriously broken:
### 如果出现严重问题：
```bash
git reset --hard main
npm test
# Start over from cycle 1
```

---

## Start Command
## 启动命令

After setup is complete, begin the audit:
设置完成后，开始审计：

```
Begin Cycle 1/100.
Focus Area: Bug Detection (Cycles 1-25)
Target: src/server.js

Do not stop until Cycle 100 is complete.
Do not ask Arthur for confirmation.
Log everything.
Generate final report when done.
```

---

## Completion Checklist
## 完成检查清单

Before reporting to Arthur:
向 Arthur 报告前：

- [ ] All 100 cycles completed
- [ ] All tests passing (npm test)
- [ ] audit-log.jsonl contains 100 entries
- [ ] AUDIT-REPORT.md generated
- [ ] All commits in evolution branch
- [ ] No changes to main branch

---

**Remember: This is an autonomous audit. Do not stop. Do not ask questions. Complete all 100 cycles and report.**

**记住：这是自主审计。不要停止。不要提问。完成全部 100 轮并报告。**
