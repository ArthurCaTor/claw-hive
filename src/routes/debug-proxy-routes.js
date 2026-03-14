// Debug Proxy Routes

const express = require('express');
const fs = require('fs');
const path = require('path');
const { llmProxy } = require('../services/llm-proxy');

const router = express.Router();
const CAPTURES_DIR = path.join(process.cwd(), 'captures');

// Proxy status
router.get('/api/debug-proxy/status', (req, res) => {
  res.json(llmProxy.getStatus());
});

// Start Proxy
router.post('/api/debug-proxy/start', async (req, res) => {
  try {
    const result = await llmProxy.start();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stop Proxy
router.post('/api/debug-proxy/stop', async (req, res) => {
  try {
    const result = await llmProxy.stop();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Proxy Mode Control - Direct implementation of fix-proxy.sh
// ============================================================

const { exec, spawn } = require('child_process');
const HOMEDIR = process.env.HOME || '/home/arthur';
const OPENCLAW_JSON = path.join(HOMEDIR, '.openclaw', 'openclaw.json');
const BACKUP_FILE = path.join(HOMEDIR, '.openclaw', 'openclaw.json.backup.proxy-fix');
const LLM_PROXY_FILE = path.join(process.cwd(), 'src/services/llm-proxy.js');
const PROXY_PORT = 8999;
const PROXY_URL = `http://localhost:${PROXY_PORT}/anthropic`;
const ORIGINAL_URL = 'https://api.minimax.io/anthropic';

// Helper: Kill gateway process
function killGateway() {
  return new Promise((resolve) => {
    exec('pkill -f "openclaw.*gateway" || pkill -f "openclaw-gateway" || true', (err) => {
      setTimeout(() => {
        exec('pkill -9 -f "openclaw.*gateway" || true', () => resolve());
      }, 1000);
    });
  });
}

// Helper: Restart claw-hive server
function restartClawHive() {
  return new Promise((resolve, reject) => {
    // Kill existing
    exec('pkill -f "node.*server.js" || true', (err) => {
      setTimeout(() => {
        // Start new
        const child = spawn('node', ['src/server.js'], { 
          cwd: process.cwd(), 
          detached: true, 
          stdio: 'ignore' 
        });
        child.unref();
        setTimeout(() => resolve(), 3000);
      }, 2000);
    });
  });
}

// Helper: Start proxy service
function startProxyService() {
  return new Promise((resolve, reject) => {
    exec(`curl -s -X POST http://localhost:8080/api/debug-proxy/start`, (err) => {
      setTimeout(() => resolve(), 2000);
    });
  });
}

// Helper: Check proxy health
function checkProxyHealth() {
  return new Promise((resolve) => {
    exec(`curl -s http://localhost:${PROXY_PORT}/_health`, (err, stdout) => {
      resolve(stdout && stdout.includes('"ok"'));
    });
  });
}

// Helper: Restart gateway
function restartGateway() {
  return new Promise((resolve) => {
    exec('nohup npx openclaw gateway > /tmp/openclaw-gateway.log 2>&1 &', (err) => {
      setTimeout(() => resolve(), 5000);
    });
  });
}

// Start Proxy Mode
router.post('/api/proxy-mode/start', async (req, res) => {
  const logs = [];
  
  try {
    // Step 1: Fix llm-proxy.js
    logs.push('Fixing llm-proxy.js...');
    if (fs.existsSync(LLM_PROXY_FILE)) {
      let content = fs.readFileSync(LLM_PROXY_FILE, 'utf8');
      content = content.replace(/console\.log.*Content-Type.*isStreaming.*\n/g, '');
      content = content.replace(
        /const isStreaming = contentType\.includes.*/g,
        'const isStreaming = true; // FORCE: MiniMax always streams'
      );
      fs.writeFileSync(LLM_PROXY_FILE, content);
    }
    
    // Step 2: Backup openclaw.json
    logs.push('Backing up openclaw.json...');
    if (fs.existsSync(OPENCLAW_JSON)) {
      fs.copyFileSync(OPENCLAW_JSON, BACKUP_FILE);
    }
    
    // Step 3: Restart claw-hive
    logs.push('Restarting claw-hive server...');
    await restartClawHive();
    
    // Step 4: Start proxy service
    logs.push('Starting proxy service...');
    await startProxyService();
    
    // Step 5: Check proxy health
    const healthy = await checkProxyHealth();
    if (!healthy) {
      throw new Error('Proxy service failed to start');
    }
    logs.push('Proxy service started');
    
    // Step 6: Modify openclaw.json baseUrl
    logs.push('Modifying openclaw.json...');
    if (fs.existsSync(OPENCLAW_JSON)) {
      let content = fs.readFileSync(OPENCLAW_JSON, 'utf8');
      content = content.replace(/https:\/\/api\.minimax\.io\/anthropic/g, PROXY_URL);
      fs.writeFileSync(OPENCLAW_JSON, content);
    }
    
    // Step 7: Kill and restart gateway
    logs.push('Restarting gateway...');
    await killGateway();
    await restartGateway();
    
    logs.push('Done! Proxy mode enabled.');
    res.json({ success: true, logs });
    
  } catch (err) {
    logs.push(`Error: ${err.message}`);
    res.status(500).json({ success: false, logs, error: err.message });
  }
});

// Stop Proxy Mode
router.post('/api/proxy-mode/stop', async (req, res) => {
  const logs = [];
  
  try {
    // Step 1: Restore openclaw.json
    logs.push('Restoring openclaw.json...');
    if (fs.existsSync(BACKUP_FILE)) {
      fs.copyFileSync(BACKUP_FILE, OPENCLAW_JSON);
    } else if (fs.existsSync(OPENCLAW_JSON)) {
      let content = fs.readFileSync(OPENCLAW_JSON, 'utf8');
      content = content.replace(new RegExp(PROXY_URL, 'g'), ORIGINAL_URL);
      fs.writeFileSync(OPENCLAW_JSON, content);
    }
    
    // Step 2: Kill and restart gateway
    logs.push('Restarting gateway...');
    await killGateway();
    await restartGateway();
    
    logs.push('Done! Proxy mode disabled.');
    res.json({ success: true, logs });
    
  } catch (err) {
    logs.push(`Error: ${err.message}`);
    res.status(500).json({ success: false, logs, error: err.message });
  }
});

// Get all captures (summary)
router.get('/api/debug-proxy/captures', (req, res) => {
  const captures = llmProxy.getCaptures().map(c => ({
    id: c.id,
    timestamp: c.timestamp,
    status: c.response.status,
    latency_ms: c.latency_ms,
    tokens: c.tokens,
    model: c.request.body?.model || 'unknown',
    messageCount: c.request.body?.messages?.length || 0,
    toolCount: c.request.body?.tools?.length || 0,
    hasSystem: !!c.request.body?.system,
  }));
  res.json(captures);
});

// Get single capture
router.get('/api/debug-proxy/captures/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid capture ID' });
  }
  const capture = llmProxy.getCapture(id);
  if (!capture) {
    return res.status(404).json({ error: 'Capture not found' });
  }
  res.json(capture);
});

// SSE - real-time push
router.get('/api/debug-proxy/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const onCapture = (capture) => {
    const summary = {
      id: capture.id,
      timestamp: capture.timestamp,
      status: capture.response.status,
      latency_ms: capture.latency_ms,
      tokens: capture.tokens,
      model: capture.request.body?.model || 'unknown',
      messageCount: capture.request.body?.messages?.length || 0,
      toolCount: capture.request.body?.tools?.length || 0,
      hasSystem: !!capture.request.body?.system,
    };
    res.write(`data: ${JSON.stringify(summary)}\n\n`);
  };

  llmProxy.on('capture', onCapture);
  req.on('close', () => llmProxy.off('capture', onCapture));
});

// History files list
router.get('/api/debug-proxy/history', (req, res) => {
  if (!fs.existsSync(CAPTURES_DIR)) return res.json([]);
  
  const files = fs.readdirSync(CAPTURES_DIR)
    .filter(f => f.startsWith('call-') && f.endsWith('.json'))
    .sort()
    .reverse();

  const list = files.map(filename => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(CAPTURES_DIR, filename), 'utf-8'));
      return {
        filename,
        id: data.id,
        timestamp: data.timestamp,
        status: data.response?.status,
        latency_ms: data.latency_ms,
        tokens: data.tokens,
        model: data.request?.body?.model,
      };
    } catch {
      return { filename, error: 'parse_failed' };
    }
  });
  res.json(list);
});

// Read history file
router.get('/api/debug-proxy/history/:filename', (req, res) => {
  const { filename } = req.params;
  
  // Security: prevent path traversal
  if (filename.includes('..') || filename.includes('~') || filename.includes('/')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  const filepath = path.join(CAPTURES_DIR, filename);
  if (!filepath.startsWith(CAPTURES_DIR)) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'Not found' });
  }
  try {
    res.json(JSON.parse(fs.readFileSync(filepath, 'utf-8')));
  } catch {
    res.status(500).json({ error: 'Parse failed' });
  }
});

// Clear history
router.delete('/api/debug-proxy/history', (req, res) => {
  if (!fs.existsSync(CAPTURES_DIR)) return res.json({ deleted: 0 });
  const files = fs.readdirSync(CAPTURES_DIR)
    .filter(f => f.startsWith('call-') && f.endsWith('.json'));
  for (const f of files) {
    fs.unlinkSync(path.join(CAPTURES_DIR, f));
  }
  res.json({ deleted: files.length });
});

module.exports = router;
