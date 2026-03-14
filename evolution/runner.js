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
