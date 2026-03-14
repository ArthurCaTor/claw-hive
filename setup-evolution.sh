#!/bin/bash
# ClawHive Evolution System Installer
# 运行方法: bash setup-evolution.sh
# 
# 这个脚本会自动完成所有安装步骤

set -e  # 遇到错误立即停止

echo ""
echo "=========================================="
echo "  ClawHive Evolution System Installer"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查函数
check() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
    else
        echo -e "${RED}❌ $1${NC}"
        exit 1
    fi
}

# ========== 阶段 1: 环境检查 ==========
echo "📋 阶段 1: 环境检查"
echo ""

# 检查目录
cd /home/arthur/claw-hive 2>/dev/null
check "目录存在: /home/arthur/claw-hive"

# 检查 Git
git status > /dev/null 2>&1
check "Git 仓库有效"

# 检查 Node.js
node --version > /dev/null 2>&1
check "Node.js 可用"

# 检查关键文件
test -f src/server.js
check "src/server.js 存在"

test -f package.json
check "package.json 存在"

echo ""

# ========== 阶段 2: Git 准备 ==========
echo "📋 阶段 2: Git 准备"
echo ""

# 提交当前更改（如果有）
if ! git diff --quiet 2>/dev/null || ! git diff --staged --quiet 2>/dev/null; then
    echo -e "${YELLOW}⚠️  发现未提交的更改，正在保存...${NC}"
    git add -A
    git commit -m "checkpoint before evolution setup" 2>/dev/null || true
fi
check "工作区干净"

# 创建或切换到 evolution 分支
if git show-ref --verify --quiet refs/heads/evolution; then
    git checkout evolution
    echo -e "${YELLOW}ℹ️  切换到已存在的 evolution 分支${NC}"
else
    git checkout -b evolution
    echo -e "${GREEN}ℹ️  创建新的 evolution 分支${NC}"
fi
check "在 evolution 分支"

echo ""

# ========== 阶段 3: 创建目录 ==========
echo "📋 阶段 3: 创建目录结构"
echo ""

mkdir -p evolution/history
check "创建 evolution/history"

mkdir -p tests
check "创建 tests"

echo ""

# ========== 阶段 4: 创建 EVOLUTION.md ==========
echo "📋 阶段 4: 创建文件"
echo ""

cat > EVOLUTION.md << 'EVOLUTION_EOF'
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
EVOLUTION_EOF
check "创建 EVOLUTION.md"

# ========== 创建 evolution/runner.js ==========
cat > evolution/runner.js << 'RUNNER_EOF'
#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const RESULTS_FILE = path.join(__dirname, 'results.jsonl');
const HISTORY_DIR = path.join(__dirname, 'history');

class EvolutionRunner {
  constructor() {
    this.generation = this.getNextGeneration();
  }

  getNextGeneration() {
    try {
      if (!fs.existsSync(RESULTS_FILE)) return 1;
      const lines = fs.readFileSync(RESULTS_FILE, 'utf-8').trim().split('\n');
      if (lines.length === 0 || lines[0] === '') return 1;
      const lastLine = lines[lines.length - 1];
      const lastResult = JSON.parse(lastLine);
      return (lastResult.generation || 0) + 1;
    } catch (e) {
      return 1;
    }
  }

  countLines() {
    try {
      const srcDir = path.join(PROJECT_ROOT, 'src');
      const result = execSync(
        `find "${srcDir}" -name "*.js" -type f | xargs wc -l | tail -1`,
        { encoding: 'utf-8', cwd: PROJECT_ROOT }
      );
      const match = result.trim().match(/^\s*(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    } catch (e) {
      return -1;
    }
  }

  countDeps() {
    try {
      const pkgPath = path.join(PROJECT_ROOT, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      return Object.keys(pkg.dependencies || {}).length;
    } catch (e) {
      return -1;
    }
  }

  measureStartup() {
    try {
      const start = Date.now();
      execSync('timeout 5 node src/server.js &', { cwd: PROJECT_ROOT, stdio: 'ignore' });
      execSync('sleep 1');
      try {
        execSync('curl -s -o /dev/null http://localhost:8080/api/health || true', {
          cwd: PROJECT_ROOT, encoding: 'utf-8', timeout: 3000
        });
      } catch (e) {}
      const elapsed = Date.now() - start;
      try { execSync('pkill -f "node src/server.js" || true', { stdio: 'ignore' }); } catch (e) {}
      return elapsed;
    } catch (e) {
      try { execSync('pkill -f "node src/server.js" || true', { stdio: 'ignore' }); } catch (e) {}
      return -1;
    }
  }

  runTests() {
    try {
      console.log('\n📋 运行测试...\n');
      execSync('npm test', { cwd: PROJECT_ROOT, stdio: 'inherit' });
      return { passed: true, error: null };
    } catch (e) {
      return { passed: false, error: e.message };
    }
  }

  calculateMetrics() {
    console.log('📊 计算指标...');
    const metrics = {
      loc: this.countLines(),
      deps: this.countDeps(),
      startup_ms: this.measureStartup(),
      timestamp: new Date().toISOString()
    };
    console.log(`   代码行数: ${metrics.loc}`);
    console.log(`   依赖数量: ${metrics.deps}`);
    console.log(`   启动时间: ${metrics.startup_ms}ms`);
    return metrics;
  }

  createSnapshot(name) {
    const snapshotDir = path.join(HISTORY_DIR, name);
    try {
      fs.mkdirSync(snapshotDir, { recursive: true });
      execSync(`cp -r src "${snapshotDir}/"`, { cwd: PROJECT_ROOT });
      console.log(`📸 快照已保存: ${name}`);
    } catch (e) {
      console.error('创建快照失败:', e.message);
    }
  }

  logResult(result) {
    try {
      const line = JSON.stringify(result) + '\n';
      fs.appendFileSync(RESULTS_FILE, line);
      console.log(`📝 结果已记录`);
    } catch (e) {
      console.error('记录结果失败:', e.message);
    }
  }

  verify() {
    const gen = this.generation;
    console.log(`\n${'='.repeat(50)}`);
    console.log(`  ClawHive Evolution - Generation ${gen}`);
    console.log(`${'='.repeat(50)}\n`);

    // 检查分支
    try {
      const branch = execSync('git branch --show-current', {
        cwd: PROJECT_ROOT, encoding: 'utf-8'
      }).trim();
      if (branch !== 'evolution') {
        console.error(`❌ 错误: 当前分支是 "${branch}"，必须在 "evolution" 分支`);
        process.exit(1);
      }
      console.log(`✅ 分支检查通过: ${branch}`);
    } catch (e) {
      console.error('❌ Git 检查失败:', e.message);
      process.exit(1);
    }

    const snapshotName = `gen-${String(gen).padStart(3, '0')}-before`;
    this.createSnapshot(snapshotName);

    console.log('\n--- 修改前指标 ---');
    const beforeMetrics = this.calculateMetrics();

    const testResult = this.runTests();

    if (!testResult.passed) {
      console.log('\n❌ 测试失败！正在回滚...');
      execSync('git checkout -- .', { cwd: PROJECT_ROOT });
      execSync('git clean -fd', { cwd: PROJECT_ROOT });
      
      this.logResult({
        generation: gen, status: 'FAILED', reason: 'tests_failed',
        error: testResult.error, metrics: beforeMetrics,
        timestamp: new Date().toISOString()
      });
      console.log('已回滚。检查错误后重试。');
      process.exit(1);
    }

    console.log('\n✅ 测试通过！');
    console.log('\n--- 修改后指标 ---');
    const afterMetrics = this.calculateMetrics();

    console.log('\n--- 指标对比 ---');
    const locDiff = afterMetrics.loc - beforeMetrics.loc;
    const startupDiff = afterMetrics.startup_ms - beforeMetrics.startup_ms;
    console.log(`   代码行数: ${beforeMetrics.loc} → ${afterMetrics.loc} (${locDiff >= 0 ? '+' : ''}${locDiff})`);
    console.log(`   启动时间: ${beforeMetrics.startup_ms}ms → ${afterMetrics.startup_ms}ms`);

    const improved = afterMetrics.loc < beforeMetrics.loc || afterMetrics.startup_ms < beforeMetrics.startup_ms;

    if (improved) {
      console.log('\n🎉 检测到改进！建议保留。');
    } else {
      console.log('\n⚠️ 未检测到改进，但测试通过。');
    }
    console.log('   保留: git add -A && git commit -m "evolution: gen-' + gen + ' - 描述"');
    console.log('   回滚: git checkout -- . && git clean -fd');

    this.logResult({
      generation: gen, status: 'VERIFIED', improved: improved,
      before: beforeMetrics, after: afterMetrics,
      diff: { loc: locDiff, startup_ms: startupDiff },
      timestamp: new Date().toISOString()
    });

    console.log(`\n${'='.repeat(50)}`);
    console.log(`  Generation ${gen} 验证完成`);
    console.log(`${'='.repeat(50)}\n`);
  }
}

const runner = new EvolutionRunner();
runner.verify();
RUNNER_EOF
chmod +x evolution/runner.js
check "创建 evolution/runner.js"

# ========== 创建 tests/smoke.test.js ==========
cat > tests/smoke.test.js << 'TEST_EOF'
#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}`);
    console.log(`     错误: ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

console.log('\n🧪 ClawHive Smoke Tests\n');

console.log('📁 文件存在性测试:');
test('src/server.js 存在', () => {
  assert(fs.existsSync(path.join(PROJECT_ROOT, 'src/server.js')));
});
test('src/services/session-watcher.js 存在', () => {
  assert(fs.existsSync(path.join(PROJECT_ROOT, 'src/services/session-watcher.js')));
});
test('package.json 存在', () => {
  assert(fs.existsSync(path.join(PROJECT_ROOT, 'package.json')));
});
test('bin/cli.js 存在', () => {
  assert(fs.existsSync(path.join(PROJECT_ROOT, 'bin/cli.js')));
});

console.log('\n🔍 语法检查测试:');
test('src/server.js 语法正确', () => {
  execSync(`node --check "${path.join(PROJECT_ROOT, 'src/server.js')}"`, { encoding: 'utf-8' });
});
test('src/services/session-watcher.js 语法正确', () => {
  execSync(`node --check "${path.join(PROJECT_ROOT, 'src/services/session-watcher.js')}"`, { encoding: 'utf-8' });
});
test('src/services/llm-proxy.js 语法正确', () => {
  execSync(`node --check "${path.join(PROJECT_ROOT, 'src/services/llm-proxy.js')}"`, { encoding: 'utf-8' });
});
test('bin/cli.js 语法正确', () => {
  execSync(`node --check "${path.join(PROJECT_ROOT, 'bin/cli.js')}"`, { encoding: 'utf-8' });
});

console.log('\n📦 模块加载测试:');
test('可以 require session-watcher', () => {
  const modulePath = path.join(PROJECT_ROOT, 'src/services/session-watcher.js');
  delete require.cache[require.resolve(modulePath)];
  const mod = require(modulePath);
  assert(mod.sessionWatcher, 'sessionWatcher 应该被导出');
});
test('可以 require llm-proxy', () => {
  const modulePath = path.join(PROJECT_ROOT, 'src/services/llm-proxy.js');
  delete require.cache[require.resolve(modulePath)];
  const mod = require(modulePath);
  assert(mod.llmProxy, 'llmProxy 应该被导出');
});

console.log('\n📋 package.json 测试:');
test('package.json 是有效的 JSON', () => {
  const content = fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf-8');
  JSON.parse(content);
});
test('package.json 有 name 字段', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf-8'));
  assert(pkg.name === 'claw-hive', `name 应该是 "claw-hive"，实际是 "${pkg.name}"`);
});
test('package.json 有必要的依赖', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf-8'));
  const deps = pkg.dependencies || {};
  assert(deps.express, '应该有 express 依赖');
  assert(deps.ws, '应该有 ws 依赖');
  assert(deps.commander, '应该有 commander 依赖');
});

console.log('\n' + '='.repeat(40));
console.log(`测试完成: ${passed} 通过, ${failed} 失败`);
console.log('='.repeat(40) + '\n');

if (failed > 0) process.exit(1);
else process.exit(0);
TEST_EOF
chmod +x tests/smoke.test.js
check "创建 tests/smoke.test.js"

# ========== 创建空的 results.jsonl ==========
touch evolution/results.jsonl
check "创建 evolution/results.jsonl"

# ========== 阶段 5: 更新 package.json ==========
echo ""
echo "📋 阶段 5: 更新 package.json"
echo ""

# 使用 node 来安全地修改 JSON
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
pkg.scripts = pkg.scripts || {};
pkg.scripts.test = 'node tests/smoke.test.js';
pkg.scripts.evolve = 'node evolution/runner.js';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('package.json 已更新');
"
check "更新 package.json"

echo ""

# ========== 阶段 6: 验证安装 ==========
echo "📋 阶段 6: 验证安装"
echo ""

npm test
check "测试通过"

echo ""

# ========== 阶段 7: 提交 ==========
echo "📋 阶段 7: 提交到 Git"
echo ""

git add -A
git commit -m "setup: install evolution system for self-improvement"
check "提交成功"

echo ""
echo "=========================================="
echo -e "${GREEN}  ✅ 安装完成！${NC}"
echo "=========================================="
echo ""
echo "当前分支: $(git branch --show-current)"
echo ""
echo "下一步："
echo "  1. 阅读 EVOLUTION.md 了解进化规则"
echo "  2. 做一个小改动"
echo "  3. 运行 npm run evolve 验证"
echo ""
echo "=========================================="
