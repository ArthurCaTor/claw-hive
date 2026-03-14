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
