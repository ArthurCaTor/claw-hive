// @ts-nocheck
/**
 * Debug Proxy Routes
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

// Import the IN-PROCESS proxy
const { llmProxy } = require('../services/llm-proxy');

// Import search service
const { captureSearch } = require('../services/capture-search');

const router = express.Router();
const CAPTURES_DIR = path.join(process.cwd(), 'captures');

// ============================================================
// PROXY CONTROL
// ============================================================

/**
 * GET /api/debug-proxy/status
 * Get proxy status
 */
router.get('/api/debug-proxy/status', (req, res) => {
 res.json(llmProxy.getStatus());
});

/**
 * POST /api/debug-proxy/start
 * Start the proxy service
 */
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

/**
 * POST /api/debug-proxy/stop
 * Stop the proxy service
 */
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
// CAPTURES (In-Memory)
// ============================================================

/**
 * GET /api/debug-proxy/captures
 * Get captures with pagination
 */
router.get('/api/debug-proxy/captures', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const model = req.query.model;
  const status = req.query.status;
  
  let captures = llmProxy.getCaptures();
  
  // Filter by model
  if (model && model !== 'all') {
    captures = captures.filter(c => 
      c.request?.body?.model?.toLowerCase().includes(model.toLowerCase())
    );
  }
  
  // Filter by status
  if (status && status !== 'all') {
    const statusCode = parseInt(status);
    captures = captures.filter(c => c.response?.status === statusCode);
  }
  
  const total = captures.length;
  const totalPages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  const paginatedCaptures = captures.slice(startIndex, endIndex).map(c => ({
    id: c.id,
    timestamp: c.timestamp,
    status: c.response?.status,
    latency_ms: c.latency_ms,
    tokens: c.tokens,
    model: c.request?.body?.model || 'unknown',
    messageCount: c.request?.body?.messages?.length || c.request?.body?.messages_count || 0,
    toolCount: c.request?.body?.tools?.length || c.request?.body?.tools_count || 0,
    hasSystem: !!c.request?.body?.system || !!c.request?.body?.has_system,
  }));
  
  res.json({
    captures: paginatedCaptures,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  });
});

/**
 * GET /api/debug-proxy/captures/:id
 * Get a single capture (full details)
 */
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

// ============================================================
// SEARCH
// ============================================================

/**
 * GET /api/debug-proxy/search
 * Search captures
 */
router.get('/api/debug-proxy/search', (req, res) => {
  const { q, fields, limit } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }
  
  const results = captureSearch.search({
    query: q,
    fields: fields ? fields.split(',') : ['all'],
    limit: parseInt(limit) || 50,
  });
  
  res.json({
    query: q,
    count: results.length,
    results: results.map(r => ({
      id: r.capture.id,
      timestamp: r.capture.timestamp,
      model: r.capture.request?.body?.model,
      score: r.score,
      matches: r.matches,
    })),
  });
});

// ============================================================
// SSE REAL-TIME STREAM
// ============================================================

/**
 * GET /api/debug-proxy/stream
 * SSE endpoint for real-time capture updates
 */
router.get('/api/debug-proxy/stream', (req, res) => {
 res.setHeader('Content-Type', 'text/event-stream');
 res.setHeader('Cache-Control', 'no-cache');
 res.setHeader('Connection', 'keep-alive');
 res.flushHeaders();

 const onCapture = (capture) => {
 const summary = {
 id: capture.id,
 timestamp: capture.timestamp,
 status: capture.response?.status,
 latency_ms: capture.latency_ms,
 tokens: capture.tokens,
 model: capture.request?.body?.model || 'unknown',
 messageCount: capture.request?.body?.messages?.length || 0,
 toolCount: capture.request?.body?.tools?.length || 0,
 hasSystem: !!capture.request?.body?.system,
 };
 res.write(`data: ${JSON.stringify(summary)}\n\n`);
 };

 llmProxy.on('capture', onCapture);
 
 req.on('close', () => {
 llmProxy.off('capture', onCapture);
 });
});

// ============================================================
// HISTORY FILES
// ============================================================

/**
 * GET /api/debug-proxy/history
 * List all history files
 */
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

/**
 * GET /api/debug-proxy/history/:filename
 * Read a specific history file
 */
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

/**
 * DELETE /api/debug-proxy/history
 * Clear all history files
 */
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
