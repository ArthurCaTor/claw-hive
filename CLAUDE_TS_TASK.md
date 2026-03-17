# Claude 的 TypeScript 迁移任务

## 项目：claw-hive

## 已完成

- ✅ 15 个 route 文件已转为 .ts
- ✅ 大部分 utils 转为 .ts
- ✅ 大部分 services 转为 .ts

## 需要 Claude 处理的

### 1. server.js (419 行)
- 入口文件，必须保持 .js（测试依赖）
- **不需要处理**

### 2. llm-proxy.js (525 行)
- 复杂流式处理
- **建议保留 .js**

### 3. 路由文件类型错误
部分 route 文件有类型错误需要修复：

```
agent-routes.ts - Property 'status', 'task', 'output' 类型问题
files-routes.ts - Duplicate identifier, query 参数类型问题
```

### 4. 服务文件导出问题
一些 .ts 文件缺少 `export default`

### 5. 其他保留的 .js 文件
- session-watcher.js
- prompt-hook.js
- logger.js
- openapi-spec.js

---

## 关键约束

1. **保持 CommonJS** - 不要改成 ESM
2. **保持向后兼容** - 旧的 require() 仍然有效
3. **测试必须通过** - 13 个 smoke tests
4. **渐进式** - 不要一次改太多

---

## 建议方案

1. 修复 route 文件的类型错误
2. 添加缺失的 export default
3. 保持大文件（server.js, llm-proxy.js）为 .js
4. 可选：开启 strict mode

---

## 测试命令

```bash
cd /home/arthur/claw-hive
npm test
```

必须 13/13 通过。
