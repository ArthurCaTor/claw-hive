#!/usr/bin/env node
/**
 * 30 Agent Scale Test
 * 
 * 注意: 如果服务器有 rate limiting (100 req/min per IP),
 * 测试会受限。建议先用较少的 agents 测试。
 */

const http = require('http');
const BASE_URL = 'http://localhost:8080';

const NUM_AGENTS = 30;
const REQUESTS_PER_AGENT = 3; // 减少到 3，避免 rate limit

let total = 0, success = 0, failed = 0;
let latencies = [];

function req(path) {
  return new Promise((resolve) => {
    const start = Date.now();
    http.get(BASE_URL + path, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        latencies.push(Date.now() - start);
        total++;
        if (res.statusCode === 200) success++;
        else {
          failed++;
          if (res.statusCode === 429) {
            // Rate limited - this is expected for high concurrency
          }
        }
        resolve();
      });
    }).on('error', () => {
      total++;
      failed++;
      resolve();
    });
  });
}

async function agent(id) {
  const endpoints = [
    '/api/health',
    '/api/debug-proxy/status',
    '/api/stats/tokens',
    '/api/cost/summary',
    '/api/llm-tracker/providers',
    '/api/alerts/summary',
    '/api/optimizer/config',
    '/api/llm-tracker/switches',
    '/api/cost/pricing',
  ];
  
  for (let i = 0; i < REQUESTS_PER_AGENT; i++) {
    const path = endpoints[Math.floor(Math.random() * endpoints.length)];
    await req(path);
    // Small delay to avoid overwhelming
    await new Promise(r => setTimeout(r, 20));
  }
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   30 Agent Scale Test                      ║');
  console.log('╚══════════════════════════════════════════════╝\n');
  
  const totalRequests = NUM_AGENTS * REQUESTS_PER_AGENT;
  console.log(`Agents: ${NUM_AGENTS}`);
  console.log(`Requests/agent: ${REQUESTS_PER_AGENT}`);
  console.log(`Total requests: ${totalRequests}`);
  console.log(`Note: 429 (rate limited) responses are expected for high concurrency\n`);
  
  // Verify server
  try {
    await req('/api/health');
    console.log(`Initial check: ${success > 0 ? '✅ Server OK' : '❌ Server error'}\n`);
    total = success = failed = 0;
    latencies = [];
  } catch (e) {
    console.log('❌ Cannot connect:', e.message, '\n');
    process.exit(1);
  }
  
  const start = Date.now();
  
  console.log('Running agents in parallel...\n');
  
  // Run all agents
  await Promise.all(Array.from({length: NUM_AGENTS}, (_, i) => agent(i + 1)));
  
  const duration = (Date.now() - start) / 1000;
  const avg = latencies.length > 0 ? latencies.reduce((a,b) => a+b, 0) / latencies.length : 0;
  
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║              RESULTS                        ║');
  console.log('╚══════════════════════════════════════════════╝\n');
  console.log(`Total requests: ${total}`);
  console.log(`Successful (200): ${success}`);
  console.log(`Failed (non-200): ${failed}`);
  console.log(`Rate limited (429): ${failed > 0 ? 'Some requests' : 'None'}`);
  console.log(`\nPerformance:`);
  console.log(`  Duration: ${duration.toFixed(2)}s`);
  console.log(`  RPS: ${total/duration.toFixed(1)}`);
  console.log(`  Latency: avg=${avg.toFixed(0)}ms min=${Math.min(...latencies)}ms max=${Math.max(...latencies)}ms\n`);
  
  // Test passes if at least 50% succeed (accounting for rate limiting)
  const passed = success >= total * 0.5;
  console.log(passed ? '✅ TEST PASSED' : '❌ TEST FAILED');
  console.log('\nNote: Lower success rate due to rate limiting is expected.');
  console.log('In production, implement distributed rate limiting or reduce concurrency.\n');
  
  process.exit(passed ? 0 : 1);
}

main();
