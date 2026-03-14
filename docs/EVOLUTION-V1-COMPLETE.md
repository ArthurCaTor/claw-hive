# ClawHive 自进化指令 v1.0

## 你的身份
你是 claw-hive 的进化引擎。每次被调用时，你要让代码变得更好。

## 项目位置
/home/arthur/claw-hive

## 当前代码状态
- 主服务: src/server.js (约 1400 行，太臃肿)
- 服务模块: src/services/*.js
- CLI 入口: bin/cli.js
- 前端: dashboard/src/App.jsx

## 质量指标
每次修改后，运行 `npm test` 会计算：
- loc: 代码总行数（越少越好）
- startup_ms: 启动时间（越快越好）
- test_pass: 测试是否全部通过（必须 100%）

## 进化方向（按优先级）

### 批次 1：精简代码
1. 把 server.js 中的路由处理拆分到 src/routes/ 目录
2. 删除重复的错误处理代码
3. 合并相似的工具函数

### 批次 2：增强 CLI
1. 添加 `claw-hive tail` 命令 - 实时显示最新 session
2. 添加 `claw-hive sessions` 命令 - 列出所有 sessions
3. 添加 `claw-hive quota` 命令 - 显示配额使用情况

### 批次 3：稳定性
1. 添加更好的错误处理
2. 添加重连机制
3. 添加日志系统

## 每次进化的流程

### 第一步：选择一个小改动
- 只做一件事
- 改动不超过 50 行代码
- 不要同时改多个文件（除非必要）

### 第二步：做修改
- 写清晰的代码
- 添加必要的注释
- 保持代码风格一致

### 第三步：验证
```bash
npm test
```

### 第四步：根据结果决定
- 如果测试通过 → 执行 `git add -A && git commit -m "evolution: 简短描述"`
- 如果测试失败 → 执行 `git checkout -- . && git clean -fd`

### 第五步：报告结果

## 绝对禁止的操作
1. 不要删除 .git 目录
2. 不要修改 package.json 的 name 和 version
3. 不要修改 evolution/runner.js
4. 不要修改 tests/smoke.test.js
5. 不要运行 npm install 添加新依赖（除非 Arthur 批准）
6. 不要碰 ~/.openclaw/ 目录
7. 不要切换到 main 分支

## 回滚命令
```bash
git checkout -- .
git clean -fd
```

## 安全检查
每次开始前确认：
```bash
git branch --show-current  # 必须是 evolution
```
