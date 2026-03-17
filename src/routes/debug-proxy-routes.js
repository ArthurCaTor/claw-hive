// Debug Proxy Routes - Fixed version
// 修复：/api/debug-proxy/start 直接调用 llmProxy.start()

const express = require('express');
const fs = require('fs');
const path = require('path');

const { llmProxy } = require('../services/llm-proxy');

const router = express.Router();
const CAPTURES_DIR = path.join(process.cwd(), 'captures');

// ============================================================
// Proxy 控制 - 直接启动/停止 Proxy 服务
// ============================================================

// Proxy 状态
router.get('/api/debug-proxy/status', (req, res) => {
  res.json(llmProxy.getStatus());
});

// 启动 Proxy（直接调用 llmProxy.start）
router.post('/api/debug-proxy/start', async (req, res) => {
  try {
    console.log('[debug-proxy] Starting Proxy service...');
    const result = await llmProxy.start();
    console.log('[debug-proxy] Proxy start result:', result);
    res.json(result);
  } catch (err) {
    console.error('[debug-proxy] Failed to start proxy:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 停止 Proxy
router.post('/api/debug-proxy/stop', async (req, res) => {
  try {
    console.log('[debug-proxy] Stopping Proxy service...');
    const result = await llmProxy.stop();
    console.log('[debug-proxy] Proxy stop result:', result);
    res.json(result);
  } catch (err) {
    console.error('[debug-proxy] Failed to stop proxy:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// Captures - 获取捕获的请求
// ============================================================

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

// ============================================================
// History - 历史文件操作
// ============================================================

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
