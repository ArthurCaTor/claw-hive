// @ts-nocheck
// @ts-nocheck
const _express = require('express');
const _http = require('http');
const _fs = require('fs');
const _path = require('path');
const { EventEmitter } = require('events');

const CAPTURES_DIR = _path.join(process.cwd(), 'captures');
const REAL_API = 'https://api.minimax.io';

function extractUsageFromSSE(sseText) {
  const lines = sseText.split('\n');
  let usage = null;
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const jsonStr = line.slice(6);
    if (jsonStr === '[DONE]') continue;
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.usage) usage = parsed.usage;
      if (parsed.message?.usage) usage = parsed.message.usage;
    } catch {}
  }
  return usage;
}

function extractTextFromSSE(sseText) {
  const lines = sseText.split('\n');
  const textParts = [];
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const jsonStr = line.slice(6);
    if (jsonStr === '[DONE]') continue;
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
        textParts.push(parsed.delta.text);
      }
    } catch {}
  }
  return textParts.join('');
}

class LLMProxy extends EventEmitter {
  constructor(port = 8999, options = {}) {
    super();
    this.captureFileWriter = options.captureFileWriter || null;
    this.port = port;
    this.app = null;
    this.server = null;
    this.captures = [];
    this.callCounter = 0;
    this.startedAt = null;
    this.MAX_CAPTURES = 100;
    this.MAX_BODY_SIZE = 100 * 1024 * 1024;
    
    if (this.captureFileWriter?.initialize) {
      this.captureFileWriter.initialize().catch(() => {});
    }
    
    this.memoryCheckInterval = setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
      console.log(`[LLMProxy] Heap: ${heapUsedMB}/${heapTotalMB}MB`);
    }, 60000);
  }

  async start() {
    if (this.server) return { success: true, port: this.port };
    _fs.mkdirSync(CAPTURES_DIR, { recursive: true });
    this.app = _express();
    this.app.use(_express.json({ limit: '50mb' }));
    this.app.use((req, res, next) => {
      console.log(`[LLMProxy] INCOMING: ${req.method} ${req.path}`);
      next();
    });
    this.app.get('/_health', (req, res) => {
      res.json({ status: 'ok', uptime: this.startedAt ? Math.round((Date.now() - this.startedAt.getTime()) / 1000) : 0, calls: this.callCounter });
    });
    this.app.all('/*', async (req, res) => {
      const startTime = Date.now();
      const callId = ++this.callCounter;
      const capturedRequest = { method: req.method, path: req.path, headers: req.headers, body: req.body, callId, timestamp: new Date().toISOString() };
      try {
        const targetUrl = REAL_API + req.path;
        const forwardOptions = { method: req.method, headers: {} };
        if (req.headers.host) delete req.headers.host;
        forwardOptions.headers = { ...req.headers };
        if (req.body) forwardOptions.body = JSON.stringify(req.body);
        const forwardRes = await fetch(targetUrl, forwardOptions);
        const contentType = forwardRes.headers.get('content-type') || '';
        capturedRequest.response = { status: forwardRes.status, headers: Object.fromEntries(forwardRes.headers.entries()) };
        if (contentType.includes('text/event-stream')) {
          const text = await forwardRes.text();
          capturedRequest.response.body = text;
          capturedRequest.usage = extractUsageFromSSE(text);
          capturedRequest.text = extractTextFromSSE(text);
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          res.send(text);
        } else {
          const body = await forwardRes.text();
          capturedRequest.response.body = body;
          try {
            const parsed = JSON.parse(body);
            if (parsed.usage) capturedRequest.usage = parsed.usage;
          } catch {}
          res.status(forwardRes.status).send(body);
        }
        this.emit('call', capturedRequest);
      } catch (err) {
        console.error(`[LLMProxy] Error: ${err.message}`);
        res.status(500).json({ error: err.message });
      }
    });
    return new Promise((resolve) => {
      this.server = _http.createServer(this.app);
      this.server.listen(this.port, () => {
        this.startedAt = new Date();
        console.log(`[LLMProxy] Started on port ${this.port}`);
        resolve({ success: true, port: this.port });
      });
    });
  }

  stop() {
    if (this.memoryCheckInterval) clearInterval(this.memoryCheckInterval);
    if (this.server) { this.server.close(); this.server = null; }
  }
}

const llmProxy = new LLMProxy();
module.exports = { LLMProxy, llmProxy };
