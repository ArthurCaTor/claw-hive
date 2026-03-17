/**
 * Unit tests for claw-hive services
 * 服务单元测试
 */
const { existsSync, readFileSync } = require('fs');
const { join } = require('path');

const PROJECT_ROOT = join(__dirname, '..');

describe('Core Modules', () => {
  it('server.js should exist', () => {
    expect(existsSync(join(PROJECT_ROOT, 'src/server.js'))).toBe(true);
  });
  
  it('package.json should be valid JSON', () => {
    const pkg = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8'));
    expect(pkg.name).toBe('claw-hive');
  });
});

describe('Services', () => {
  it('session-watcher.js should exist', () => {
    expect(existsSync(join(PROJECT_ROOT, 'src/services/session-watcher.js'))).toBe(true);
  });
  
  it('llm-proxy.js should exist', () => {
    expect(existsSync(join(PROJECT_ROOT, 'src/services/llm-proxy.js'))).toBe(true);
  });
});

describe('Routes', () => {
  it('routes folder should exist', () => {
    expect(existsSync(join(PROJECT_ROOT, 'src/routes'))).toBe(true);
  });
});
