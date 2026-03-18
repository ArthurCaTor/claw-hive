#!/usr/bin/env node
/**
 * Unit Tests for Claw-Hive API Endpoints
 * 通过 HTTP API 测试单元功能
 */

const http = require('http');

const BASE_URL = 'http://localhost:8080';
let passed = 0;
let failed = 0;

function test(name, fn) {
  return new Promise((resolve) => {
    fn()
      .then(() => {
        console.log(`  ✅ ${name}`);
        passed++;
        resolve();
      })
      .catch((e) => {
        console.log(`  ❌ ${name}`);
        console.log(`     Error: ${e.message}`);
        failed++;
        resolve();
      });
  });
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || 'Assertion failed'}: expected ${expected}, got ${actual}`);
  }
}

function assertContains(str, substr, msg) {
  if (!str.includes(substr)) {
    throw new Error(`${msg || 'String does not contain'}: "${str}" does not include "${substr}"`);
  }
}

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    }).on('error', reject);
  });
}

function httpPost(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let response = '';
      res.on('data', chunk => response += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(response) });
        } catch {
          resolve({ status: res.statusCode, data: response });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('\n🧪 Claw-Hive API Unit Tests\n');

  // ============================================
  // Health & Status
  // ============================================
  console.log('━━━ Health & Status ━━━');

  await test('GET /api/health returns 200', async () => {
    const res = await httpGet('/api/health');
    assertEqual(res.status, 200);
  });

  await test('GET /api/debug-proxy/status returns proxy status', async () => {
    const res = await httpGet('/api/debug-proxy/status');
    assertEqual(res.status, 200);
    assert(res.data.running !== undefined);
  });

  // ============================================
  // Token Statistics
  // ============================================
  console.log('\n━━━ Token Statistics ━━━');

  await test('GET /api/stats/tokens returns token stats', async () => {
    const res = await httpGet('/api/stats/tokens');
    assertEqual(res.status, 200);
    assert(res.data.captureCount !== undefined);
    assert(res.data.totalTokens !== undefined);
  });

  await test('Token stats has required fields', async () => {
    const res = await httpGet('/api/stats/tokens');
    assert(res.data.totalInputTokens !== undefined);
    assert(res.data.totalOutputTokens !== undefined);
    assert(res.data.byModel !== undefined);
    assert(res.data.byHour !== undefined);
  });

  // ============================================
  // Cost Calculator
  // ============================================
  console.log('\n━━━ Cost Calculator ━━━');

  await test('GET /api/cost/summary returns cost summary', async () => {
    const res = await httpGet('/api/cost/summary');
    assertEqual(res.status, 200);
    assert(res.data.totalCost !== undefined);
  });

  await test('GET /api/cost/pricing returns pricing', async () => {
    const res = await httpGet('/api/cost/pricing');
    assertEqual(res.status, 200);
    assert(res.data.pricing !== undefined);
  });

  await test('Cost summary includes MiniMax-M2.7 pricing', async () => {
    const res = await httpGet('/api/cost/pricing');
    assert(res.data.pricing['MiniMax-M2.7'] !== undefined);
    assertEqual(res.data.pricing['MiniMax-M2.7'].input, 0.70);
    assertEqual(res.data.pricing['MiniMax-M2.7'].output, 2.80);
  });

  // ============================================
  // Captures
  // ============================================
  console.log('\n━━━ Captures ━━━');

  await test('GET /api/debug-proxy/captures returns array', async () => {
    const res = await httpGet('/api/debug-proxy/captures');
    assertEqual(res.status, 200);
    assert(Array.isArray(res.data.captures));
  });

  await test('Captures has pagination info', async () => {
    const res = await httpGet('/api/debug-proxy/captures');
    assert(res.data.pagination !== undefined);
    assert(res.data.pagination.page !== undefined);
    assert(res.data.pagination.limit !== undefined);
  });

  await test('Captures pagination works with params', async () => {
    const res = await httpGet('/api/debug-proxy/captures?page=1&limit=5');
    assertEqual(res.data.pagination.page, 1);
    assertEqual(res.data.pagination.limit, 5);
  });

  // ============================================
  // Search
  // ============================================
  console.log('\n━━━ Search ━━━');

  await test('GET /api/debug-proxy/search returns results', async () => {
    const res = await httpGet('/api/debug-proxy/search?q=hello');
    assertEqual(res.status, 200);
    assert(res.data.query !== undefined);
    assert(res.data.count !== undefined);
    assert(Array.isArray(res.data.results));
  });

  await test('Search requires query parameter', async () => {
    const res = await httpGet('/api/debug-proxy/search');
    assertEqual(res.status, 400);
  });

  // ============================================
  // LLM Tracker
  // ============================================
  console.log('\n━━━ LLM Tracker ━━━');

  await test('GET /api/llm-tracker/providers returns array', async () => {
    const res = await httpGet('/api/llm-tracker/providers');
    assertEqual(res.status, 200);
    assert(Array.isArray(res.data.providers));
  });

  await test('GET /api/llm-tracker/agents returns object', async () => {
    const res = await httpGet('/api/llm-tracker/agents');
    assertEqual(res.status, 200);
    assert(typeof res.data.agents === 'object');
  });

  await test('GET /api/llm-tracker/switches returns array', async () => {
    const res = await httpGet('/api/llm-tracker/switches');
    assertEqual(res.status, 200);
    assert(Array.isArray(res.data.switches));
  });

  // ============================================
  // Alerts
  // ============================================
  console.log('\n━━━ Alerts ━━━');

  await test('GET /api/alerts returns alerts', async () => {
    const res = await httpGet('/api/alerts');
    assertEqual(res.status, 200);
    assert(Array.isArray(res.data.alerts));
  });

  await test('GET /api/alerts/summary returns summary', async () => {
    const res = await httpGet('/api/alerts/summary');
    assertEqual(res.status, 200);
    assert(res.data.total !== undefined);
    assert(res.data.unacknowledged !== undefined);
  });

  await test('GET /api/alerts/rules returns rules', async () => {
    const res = await httpGet('/api/alerts/rules');
    assertEqual(res.status, 200);
    assert(Array.isArray(res.data.rules));
    assert(res.data.rules.length > 0);
  });

  await test('Alert rules have required fields', async () => {
    const res = await httpGet('/api/alerts/rules');
    const rule = res.data.rules[0];
    assert(rule.id !== undefined);
    assert(rule.name !== undefined);
    assert(rule.level !== undefined);
    assert(rule.enabled !== undefined);
  });

  // ============================================
  // Optimizer
  // ============================================
  console.log('\n━━━ Optimizer ━━━');

  await test('GET /api/optimizer/config returns config', async () => {
    const res = await httpGet('/api/optimizer/config');
    assertEqual(res.status, 200);
    assert(res.data.config !== undefined);
  });

  await test('Optimizer config has enabled field', async () => {
    const res = await httpGet('/api/optimizer/config');
    assert(res.data.config.enabled !== undefined);
  });

  await test('POST /api/optimizer/enable works', async () => {
    const res = await httpPost('/api/optimizer/enable', {});
    assertEqual(res.status, 200);
    assertEqual(res.data.success, true);
  });

  await test('POST /api/optimizer/disable works', async () => {
    const res = await httpPost('/api/optimizer/disable', {});
    assertEqual(res.status, 200);
    assertEqual(res.data.success, true);
  });

  // ============================================
  // Metrics
  // ============================================
  console.log('\n━━━ Metrics ━━━');

  await test('GET /metrics returns Prometheus format', async () => {
    const res = await httpGet('/metrics');
    assertEqual(res.status, 200);
    assertContains(res.data, '# HELP');
    assertContains(res.data, '# TYPE');
  });

  await test('Metrics include claw_hive metrics', async () => {
    const res = await httpGet('/metrics');
    assertContains(res.data, 'claw_hive');
  });

  // ============================================
  // Export
  // ============================================
  console.log('\n━━━ Export ━━━');

  await test('GET /api/export/captures/json returns JSON', async () => {
    const res = await httpGet('/api/export/captures/json');
    assertEqual(res.status, 200);
    assert(res.data.captures !== undefined);
    assert(res.data.exportedAt !== undefined);
  });

  // ============================================
  // Summary
  // ============================================
  console.log('\n═══════════════════════════════════════');
  console.log(`🧪 Tests: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
