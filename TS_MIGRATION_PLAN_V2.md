# Phase 5 TypeScript 迁移 - 完整计划

## 当前状态

已迁移 (✅):
- health-routes.ts
- provider-identifier.ts
- cost-calculator.ts
- llm-tracker.ts
- server.ts (参考)
- agent-store.ts (参考)
- llm-proxy.ts (参考)

未迁移 (❌):
- server.js (主入口)
- capture-file-writer.js
- llm-proxy.js
- 其他 services/*.js
- 其他 routes/*.js
- utils/*.js

---

## 依赖问题分析

```
llm-proxy.js ──────► capture-file-writer.js
     │                        │
     │                        │
     ▼                        ▼
server.js ◄───────────────────┘
```

**问题**: llm-proxy.js require capture-file-writer.js
**解决**: 通过依赖注入传递，不直接 require

---

## 迁移顺序

### 阶段 1: 准备 (30 分钟)

- [ ] 修改 llm-proxy.js 使用依赖注入获取 captureFileWriter
- [ ] 修改 server.js 传递 captureFileWriter 给 llm-proxy
- [ ] 测试确保正常工作

### 阶段 2: 核心服务 (1 小时)

- [ ] 迁移 capture-file-writer.js → capture-file-writer.ts
- [ ] 迁移 llm-proxy.js → llm-proxy.ts
- [ ] 迁移 session-watcher.js → session-watcher.ts

### 阶段 3: 其他服务 (1 小时)

- [ ] 迁移 openclaw-reader.js
- [ ] 迁移 recording-store.js
- [ ] 迁移 prompt-store.js
- [ ] 迁移 debug-service.js

### 阶段 4: 工具类 (30 分钟)

- [ ] 迁移 config-validator.js
- [ ] 迁移 rate-limiter.js (可选)
- [ ] 迁移 logger.js (可选)

### 阶段 5: 路由 (30 分钟)

- [ ] 迁移剩余 routes/*.js
- [ ] 添加 route 依赖类型

### 阶段 6: 主入口 (30 分钟)

- [ ] 创建 server.ts
- [ ] 测试完整功能
- [ ] 替换 server.js

---

## 验证标准

每个文件迁移后:
- [ ] `npx tsc --noEmit` 零错误
- [ ] `npm test` 通过
- [ ] 服务正常启动

---

## 时间估计

总时间: ~4 小时

可以分多次完成，一次迁移一个阶段。
