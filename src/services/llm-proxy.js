// LLM Proxy Service - Intercept and record LLM API requests

const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const CAPTURES_DIR = path.join(process.cwd(), 'captures');
const REAL_API = 'https://api.minimax.io';
const MAX_MEMORY_CAPTURES = 100;
const FORWARD_TIMEOUT_MS = 120000;

// ========== SSE 解析工具函数 ==========

/**
 * 从 SSE stream 文本中提取 usage 信息
 * SSE 格式: "event: message_delta\ndata: {"type":"message_delta","usage":{...}}\n\n"
 * usage 通常在最后一个 message_delta 事件中
 */
function extractUsageFromSSE(sseText) {
  const lines = sseText.split('\n');
  let usage = null;

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const jsonStr = line.slice(6); // 去掉 "data: "
    if (jsonStr === '[DONE]') continue;

    try {
      const parsed = JSON.parse(jsonStr);
      // Anthropic 格式：usage 在 message_delta 或 message_stop 事件中
      if (parsed.usage) {
        usage = parsed.usage;
      }
      // 也检查嵌套的 message.usage
      if (parsed.message?.usage) {
        usage = parsed.message.usage;
      }
    } catch {
      // 跳过非 JSON 的行
    }
  }

  return usage;
}

/**
 * 从 SSE stream 文本中提取 assistant 回复
 * 拼合所有 content_block_delta 中的 text
 */
function extractTextFromSSE(sseText) {
  const lines = sseText.split('\n');
  const textParts = [];

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const jsonStr = line.slice(6);
    if (jsonStr === '[DONE]') continue;

    try {
      const parsed = JSON.parse(jsonStr);
      // Anthropic 格式：text 在 content_block_delta 事件中
      if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
        textParts.push(parsed.delta.text);
      }
      // 也检查 thinking
      if (parsed.type === 'content_block_delta' && parsed.delta?.thinking) {
        // 可以选择是否记录 thinking，这里先跳过
      }
    } catch {
      // 跳过
    }
  }

  return textParts.join('');
}

class LLMProxy extends EventEmitter {
  constructor(port = 8999) {
    super();
    this.port = port;
    this.app = null;
    this.server = null;
    this.captures = [];
    this.callCounter = 0;
    this.startedAt = null;
    
    // ✅ FIX: Memory leak prevention
    this.MAX_CAPTURES = 100;
    this.MAX_BODY_SIZE = 1024; // 1KB preview only
    
    // ✅ FIX: Memory monitoring (every 60 seconds)
    this.memoryCheckInterval = setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
      
      console.log(`[Proxy-Memory] Heap: ${heapUsedMB}MB / ${heapTotalMB}MB`);
      
      if (heapUsedMB > 500) {
        console.warn(`[Proxy-Memory] WARNING: High memory usage! ${heapUsedMB}MB`);
      }
    }, 60000);
  }

  async start() {
    if (this.server) {
      return { success: true, port: this.port };
    }

    // Ensure captures directory exists
    fs.mkdirSync(CAPTURES_DIR, { recursive: true });

    this.app = express();
    this.app.use(express.json({ limit: '50mb' }));

    // Log ALL incoming requests for debugging
    this.app.use((req, res, next) => {
      console.log(`[Proxy] INCOMING: ${req.method} ${req.url} ${req.path}`);
      next();
    });

    // Health check endpoint
    this.app.get('/_health', (req, res) => {
      res.json({
        status: 'ok',
        uptime: this.startedAt ? Math.round((Date.now() - this.startedAt.getTime()) / 1000) : 0,
        calls: this.callCounter,
      });
    });

    // Intercept all requests
    this.app.all('/*', async (req, res) => {
      const startTime = Date.now();
      const callId = ++this.callCounter;

      const capturedRequest = {
        method: req.method,
        path: req.path,
        headers: this.sanitizeHeaders(req.headers),
        body: req.body,
      };

      try {
        const targetUrl = `${REAL_API}${req.path}`;

        const forwardHeaders = {
          'Content-Type': 'application/json',
        };

        // Pass through auth headers
        if (req.headers['x-api-key']) {
          forwardHeaders['x-api-key'] = req.headers['x-api-key'];
        }
        if (req.headers['authorization']) {
          forwardHeaders['Authorization'] = req.headers['authorization'];
        }
        if (req.headers['anthropic-version']) {
          forwardHeaders['anthropic-version'] = req.headers['anthropic-version'];
        }

        const apiResponse = await fetch(targetUrl, {
          method: req.method,
          headers: forwardHeaders,
          body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
          signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
        });

        // ========== 检测 Streaming vs JSON ==========
        const contentType = apiResponse.headers.get('content-type') || '';
        const isStreaming = true;

        if (isStreaming) {
          // ========== STREAMING 模式 ==========
          // 直接 pipe 给 OpenClaw，同时收集内容用于记录

          // 1. 先把 response headers 转发给 OpenClaw
          res.status(apiResponse.status);
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');

          // 2. 收集 chunks 用于记录
          const chunks = [];
          const reader = apiResponse.body.getReader();
          const decoder = new TextDecoder();

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              // 转发给 OpenClaw（实时）
              res.write(value);

              // 同时收集用于记录
              chunks.push(decoder.decode(value, { stream: true }));
            }
          } catch (pipeErr) {
            console.error(`[Proxy] #${callId} Stream pipe error:`, pipeErr.message);
          }

          res.end();

          // 3. 记录完整的 streaming 数据（在响应结束后）
          const latency = Date.now() - startTime;
          const fullStreamText = chunks.join('');

          // 从 SSE 数据中提取 usage 信息
          const usage = extractUsageFromSSE(fullStreamText);
          // 从 SSE 数据中提取 assistant 回复文本
          const assistantText = extractTextFromSSE(fullStreamText);

          try {
            // ✅ Use safe capture with truncated bodies
            const capture = this.createSafeCapture(
              callId,
              new Date().toISOString(),
              capturedRequest,
              {
                status: apiResponse.status,
                body: { _streaming: true, _raw_length: fullStreamText.length, assistant_text: assistantText, usage: usage },
              },
              latency,
              {
                input: usage?.input_tokens || 0,
                output: usage?.output_tokens || 0,
              }
            );

            this.captures.push(capture);
            if (this.captures.length > this.MAX_CAPTURES) {
              this.captures = this.captures.slice(-this.MAX_CAPTURES);
            }
            this.saveCaptureToFile(capture);
            this.emit('capture', capture);

            console.log(
              `[Proxy] #${callId} STREAM ${req.method} ${req.path} → ` +
              `${apiResponse.status} ${latency}ms ` +
              `(in:${usage?.input_tokens || '?'} out:${usage?.output_tokens || '?'})`
            );
          } catch (recordErr) {
            console.error(`[Proxy] #${callId} Record error (non-fatal):`, recordErr.message);
          }

        } else {
          // ========== JSON 模式（非 streaming）==========
          const responseBody = await apiResponse.json();
          const latency = Date.now() - startTime;

          // Return to OpenClaw FIRST (mechanism 1: forward first, record after)
          res.status(apiResponse.status);
          res.json(responseBody);

          // Record (after response, won't block OpenClaw)
          try {
            // ✅ Use safe capture with truncated bodies
            const capture = this.createSafeCapture(
              callId,
              new Date().toISOString(),
              capturedRequest,
              {
                status: apiResponse.status,
                body: responseBody,
              },
              latency,
              {
                input: responseBody?.usage?.input_tokens || 0,
                output: responseBody?.usage?.output_tokens || 0,
              }
            );

            // Mechanism 5: Memory protection
            this.captures.push(capture);
            if (this.captures.length > this.MAX_CAPTURES) {
              this.captures = this.captures.slice(-this.MAX_CAPTURES);
            }

            this.saveCaptureToFile(capture);
            this.emit('capture', capture);

            console.log(
              `[Proxy] #${callId} JSON ${req.method} ${req.path} → ` +
              `${apiResponse.status} ${latency}ms ` +
              `(in:${capture.tokens.input} out:${capture.tokens.output})`
            );
          } catch (recordErr) {
            console.error(`[Proxy] #${callId} Record error (non-fatal):`, recordErr.message);
          }
        }

      } catch (err) {
        const latency = Date.now() - startTime;
        console.error(`[Proxy] #${callId} ERROR:`, err.message);

        const errorCapture = this.createSafeCapture(
          callId,
          new Date().toISOString(),
          capturedRequest,
          { status: 502, body: { error: err.message } },
          latency,
          { input: 0, output: 0 }
        );

        this.captures.push(errorCapture);
        if (this.captures.length > this.MAX_CAPTURES) {
          this.captures = this.captures.slice(-this.MAX_CAPTURES);
        }
        this.saveCaptureToFile(errorCapture);
        this.emit('capture', errorCapture);

        res.status(502).json({
          error: 'Proxy forward failed',
          message: err.message,
        });
      }
    });

    // Mechanism 2: Global error fallback - direct passthrough
    this.app.use((err, req, res, next) => {
      console.error('[Proxy] Unhandled error, attempting direct passthrough:', err.message);
      try {
        const targetUrl = `${REAL_API}${req.path}`;
        fetch(targetUrl, {
          method: req.method,
          headers: { 'Content-Type': 'application/json' },
          body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
        })
          .then(r => r.json())
          .then(body => res.json(body))
          .catch(() => res.status(502).json({ error: 'Proxy passthrough failed' }));
      } catch {
        res.status(502).json({ error: 'Proxy internal error' });
      }
    });

    // Start server
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, '0.0.0.0', () => {
        this.startedAt = new Date();
        this.captures = [];
        this.callCounter = 0;

        console.log(`[Proxy] Running on http://localhost:${this.port}`);
        console.log(`[Proxy] Forwarding to ${REAL_API}`);
        console.log(`[Proxy] Start OpenClaw with:`);
        console.log(`  MINIMAX_API_HOST=http://localhost:${this.port} openclaw`);

        resolve({ success: true, port: this.port });
      });

      this.server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve({ success: false, port: this.port, error: `Port ${this.port} already in use` });
        } else {
          resolve({ success: false, port: this.port, error: err.message });
        }
      });
    });
  }

  async stop() {
    const totalCalls = this.callCounter;
    return new Promise((resolve) => {
      if (!this.server) {
        resolve({ success: true, totalCalls: 0 });
        return;
      }
      this.server.close(() => {
        this.server = null;
        this.app = null;
        this.startedAt = null;
        // ✅ Clear memory monitoring interval
        if (this.memoryCheckInterval) {
          clearInterval(this.memoryCheckInterval);
          this.memoryCheckInterval = null;
        }
        console.log(`[Proxy] Stopped. Total calls captured: ${totalCalls}`);
        resolve({ success: true, totalCalls });
      });
    });
  }

  getStatus() {
    return {
      running: this.server !== null,
      port: this.port,
      startedAt: this.startedAt?.toISOString() || null,
      totalCalls: this.callCounter,
      uptimeSeconds: this.startedAt
        ? Math.round((Date.now() - this.startedAt.getTime()) / 1000)
        : 0,
    };
  }

  getCaptures() {
    return [...this.captures].reverse();
  }

  getCapture(id) {
    return this.captures.find(c => c.id === id);
  }

  /**
   * Truncate body to prevent memory bloat
   */
  truncateBody(body) {
    if (!body) return null;
    
    let str;
    if (typeof body === 'string') {
      str = body;
    } else {
      try {
        str = JSON.stringify(body);
      } catch (e) {
        return '[Unable to stringify]';
      }
    }
    
    if (str.length <= this.MAX_BODY_SIZE) {
      return str;
    }
    
    return str.substring(0, this.MAX_BODY_SIZE) + '... [TRUNCATED]';
  }

  /**
   * Create a memory-safe capture record
   */
  createSafeCapture(callId, timestamp, capturedRequest, responseData, latency, tokens) {
    return {
      id: callId,
      timestamp: timestamp,
      request: {
        method: capturedRequest.method,
        path: capturedRequest.path,
        headers: capturedRequest.headers,
        // ✅ Only store truncated body preview
        bodyPreview: this.truncateBody(capturedRequest.body),
      },
      response: {
        status: responseData.status,
        // ✅ Only store truncated response preview  
        bodyPreview: this.truncateBody(responseData.body),
        tokens: tokens,
      },
      latency_ms: latency,
      tokens: tokens,
    };
  }

  sanitizeHeaders(headers) {
    const safe = {};
    for (const [key, value] of Object.entries(headers || {})) {
      if (!value) continue;
      const k = key.toLowerCase();
      if (k === 'x-api-key' || k === 'authorization') {
        const v = String(value);
        safe[key] = v.length > 12 ? v.slice(0, 8) + '...' + v.slice(-4) : '***REDACTED***';
      } else {
        safe[key] = String(value);
      }
    }
    return safe;
  }

  saveCaptureToFile(capture) {
    try {
      const filename = `call-${String(capture.id).padStart(4, '0')}-${Date.now()}.json`;
      const filepath = path.join(CAPTURES_DIR, filename);
      fs.writeFileSync(filepath, JSON.stringify(capture, null, 2));
    } catch (err) {
      console.error('[Proxy] Failed to save capture:', err.message);
    }
  }
}

const llmProxy = new LLMProxy(8999);

module.exports = { LLMProxy, llmProxy };
