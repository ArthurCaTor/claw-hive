/**
 * Integration tests for API routes
 * API 路由集成测试
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
        console.log(`     错误: ${e.message}`);
        failed++;
        resolve();
      });
  });
}

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('\n🔌 API Integration Tests\n');

  // Health endpoint
  await test('GET /api/health returns 200', async () => {
    const res = await request('GET', '/api/health');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  // Agents endpoint
  await test('GET /api/agents returns 200', async () => {
    const res = await request('GET', '/api/agents');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  // Models endpoint
  await test('GET /api/models returns 200', async () => {
    const res = await request('GET', '/api/models');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  // Channels endpoint
  await test('GET /api/channels returns 200', async () => {
    const res = await request('GET', '/api/channels');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  // Skills endpoint
  await test('GET /api/skills returns 200', async () => {
    const res = await request('GET', '/api/skills');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  // Stats endpoint
  await test('GET /api/stats returns 200', async () => {
    const res = await request('GET', '/api/stats');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  // Cost endpoint
  await test('GET /api/cost returns 200', async () => {
    const res = await request('GET', '/api/cost');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  // Debug status endpoint
  await test('GET /api/debug/status returns 200', async () => {
    const res = await request('GET', '/api/debug/status');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  // Debug proxy status endpoint
  await test('GET /api/debug-proxy/status returns 200', async () => {
    const res = await request('GET', '/api/debug-proxy/status');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  // 404 handling - server returns SPA fallback for unknown routes
  await test('GET /api/nonexistent returns HTML fallback (SPA)', async () => {
    const res = await request('GET', '/api/nonexistent');
    // Server returns SPA fallback, not 404
    if (!res.data.includes('<!doctype html>')) {
      throw new Error('Expected HTML fallback');
    }
  });

  console.log('\n' + '='.repeat(40));
  console.log(`集成测试完成: ${passed} 通过, ${failed} 失败`);
  console.log('='.repeat(40) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

// Check if server is running
const checkServer = () => {
  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}/api/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
};

(async () => {
  console.log('检查服务器状态...');
  const isRunning = await checkServer();
  
  if (!isRunning) {
    console.log('❌ 服务器未运行。请先启动服务器: npm start');
    console.log('   然后在另一个终端运行: node tests/integration.test.js');
    process.exit(1);
  }
  
  console.log('✅ 服务器运行中，开始测试...\n');
  await runTests();
})();
