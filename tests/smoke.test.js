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

console.log('\n🧪 ClawHive Smoke Tests (TypeScript)\n');

console.log('📁 文件存在性测试:');
test('src/server.ts 存在', () => {
  assert(fs.existsSync(path.join(PROJECT_ROOT, 'src/server.ts')));
});
test('src/services/session-watcher.ts 存在', () => {
  assert(fs.existsSync(path.join(PROJECT_ROOT, 'src/services/session-watcher.ts')));
});
test('package.json 存在', () => {
  assert(fs.existsSync(path.join(PROJECT_ROOT, 'package.json')));
});

console.log('\n🔍 TypeScript 编译测试:');
test('src/server.ts 可以编译', () => {
  execSync(`npx tsc --noEmit src/server.ts`, { encoding: 'utf-8', cwd: PROJECT_ROOT });
});
test('src/services/session-watcher.ts 可以编译', () => {
  execSync(`npx tsc --noEmit src/services/session-watcher.ts`, { encoding: 'utf-8', cwd: PROJECT_ROOT });
});
test('src/services/llm-proxy.ts 可以编译', () => {
  execSync(`npx tsc --noEmit src/services/llm-proxy.ts`, { encoding: 'utf-8', cwd: PROJECT_ROOT });
});

console.log('\n📦 模块加载测试 (使用 ts-node):');
test('可以加载 session-watcher', () => {
  // Use ts-node to register and load
  require('ts-node').register({
    compilerOptions: { module: 'commonjs' }
  });
  const mod = require(path.join(PROJECT_ROOT, 'src/services/session-watcher.ts'));
  assert(mod.sessionWatcher, 'sessionWatcher 应该被导出');
});
test('可以加载 llm-proxy', () => {
  require('ts-node').register({
    compilerOptions: { module: 'commonjs' }
  });
  const mod = require(path.join(PROJECT_ROOT, 'src/services/llm-proxy.ts'));
  assert(mod.llmProxy || mod.LLMProxy, 'llmProxy/LLMProxy 应该被导出');
});

console.log('\n📋 package.json 测试:');
test('package.json 是有效的 JSON', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf-8'));
  assert(pkg.scripts && pkg.scripts.start, '应该有 start script');
});

console.log('\n===========================================');
console.log(`测试完成: ${passed} 通过, ${failed} 失败`);
console.log('===========================================');

process.exit(failed > 0 ? 1 : 0);
