// @ts-nocheck
/**
 * LLM Proxy Service - Passive Mode
 * 
 * @ai-context
 * ROLE: Observer/Follower (NOT decision maker!)
 * - Transparently forward all requests (no modification)
 * - Record requests and responses
 * - Save to file for persistence
 * - Emit events for real-time dashboard updates
 * 
 * PASSIVE MODE FEATURES:
 * ✅ Transparent forwarding (no request/response modification)
 * ✅ Request/response recording
 * ✅ File persistence (JSONL)
 * ✅ Memory cache (100 captures max)
 * ✅ SSE event emission for real-time updates
 * ✅ Sensitive header sanitization
 */

const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

// ============================================
// CONFIGURATION
// ============================================

const CAPTURES_DIR = path.join(process.cwd(), 'captures');
const REAL_API = process.env.LLM_PROXY_TARGET || 'https://api.minimax.io';
const MAX_MEMORY_CAPTURES = 100;
const FORWARD_TIMEOUT_MS = 120000; // 2 minutes

// ============================================
// SSE PARSING UTILITIES
// ============================================

/**
 * Extract usage info from SSE stream text
 */
function extractUsageFromSSE(sseText) {
 const lines = sseText.split('\n');
 let usage = null;

 for (const line of lines) {
 if (!line.startsWith('data: ')) continue;
 const jsonStr = line.slice(6);
 if (jsonStr === '[DONE]') continue;

 try {
 const parsed = JSON.parse(jsonStr);
 if (parsed.usage) {
 usage = parsed.usage;
 }
 if (parsed.message?.usage) {
 usage = parsed.message.usage;
 }
 } catch {
 // Skip non-JSON lines
 }
 }

 return usage;
}

/**
 * Extract assistant reply text from SSE stream
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
 if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
 textParts.push(parsed.delta.text);
 }
 } catch {
 // Skip
 }
 }

 return textParts.join('');
}

// ============================================
// LLM PROXY CLASS
// ============================================

class LLMProxy extends EventEmitter {
 constructor(port = 8999) {
 super();
 this.port = port;
 this.app = null;
 this.server = null;
 this.captures = [];
 this.callCounter = 0;
 this.startedAt = null;
 this.memoryCheckInterval = null;
 }

 /**
 * Start the proxy server
 */
 async start() {
 if (this.server) {
 return { success: true, port: this.port };
 }

 // Ensure captures directory exists
 fs.mkdirSync(CAPTURES_DIR, { recursive: true });

 this.app = express();
 this.app.use(express.json({ limit: '50mb' }));

 // Request logging middleware
 this.app.use((req, res, next) => {
 console.log(`[LLMProxy] INCOMING: ${req.method} ${req.url} ${req.path}`);
 next();
 });

 // Health check endpoint
 this.app.get('/_health', (req, res) => {
 res.json({
 status: 'ok',
 uptime: this.startedAt ? Math.round((Date.now() - this.startedAt.getTime()) / 1000) : 0,
 calls: this.callCounter,
 captures: this.captures.length,
 });
 });

 // Intercept all requests
 this.app.all('/*', async (req, res) => {
 const startTime = Date.now();
 const callId = ++this.callCounter;

 // Capture request with sanitized headers
 const capturedRequest = {
 method: req.method,
 path: req.path,
 headers: this.sanitizeHeaders(req.headers),
 body: req.body,
 };

 try {
 const targetUrl = `${REAL_API}${req.path}`;

 // Build forward headers (pass through auth)
 const forwardHeaders = {
 'Content-Type': 'application/json',
 };

 if (req.headers['x-api-key']) {
 forwardHeaders['x-api-key'] = req.headers['x-api-key'];
 }
 if (req.headers['authorization']) {
 forwardHeaders['Authorization'] = req.headers['authorization'];
 }
 if (req.headers['anthropic-version']) {
 forwardHeaders['anthropic-version'] = req.headers['anthropic-version'];
 }

 // Forward request to real API
 const apiResponse = await fetch(targetUrl, {
 method: req.method,
 headers: forwardHeaders,
 body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
 signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
 });

 const contentType = apiResponse.headers.get('content-type') || '';
 
 // MiniMax always streams, so treat everything as streaming
 const isStreaming = true;

 if (isStreaming) {
 // ========== STREAMING MODE ==========
 // Pipe to client while collecting for recording

 // 1. Forward response headers first
 res.status(apiResponse.status);
 res.setHeader('Content-Type', 'text/event-stream');
 res.setHeader('Cache-Control', 'no-cache');
 res.setHeader('Connection', 'keep-alive');

 // 2. Collect chunks while forwarding
 const chunks = [];
 const reader = apiResponse.body.getReader();
 const decoder = new TextDecoder();

 try {
 while (true) {
 const { done, value } = await reader.read();
 if (done) break;

 // Forward to client in real-time
 res.write(value);

 // Collect for recording
 chunks.push(decoder.decode(value, { stream: true }));
 }
 } catch (pipeErr) {
 console.error(`[LLMProxy] #${callId} Stream pipe error:`, pipeErr.message);
 }

 res.end();

 // 3. Record after response completes
 const latency = Date.now() - startTime;
 const fullStreamText = chunks.join('');

 const usage = extractUsageFromSSE(fullStreamText);
 const assistantText = extractTextFromSSE(fullStreamText);

 try {
 const capture = {
 id: callId,
 timestamp: new Date().toISOString(),
 request: capturedRequest,
 response: {
 status: apiResponse.status,
 headers: Object.fromEntries(apiResponse.headers.entries()),
 body: {
 _streaming: true,
 _raw_length: fullStreamText.length,
 assistant_text: assistantText.slice(0, 500),
 usage: usage,
 },
 },
 latency_ms: latency,
 tokens: {
 input: usage?.input_tokens || 0,
 output: usage?.output_tokens || 0,
 },
 };

 this.addCapture(capture);

 console.log(
 `[LLMProxy] #${callId} STREAM ${req.method} ${req.path} → ` +
 `${apiResponse.status} ${latency}ms ` +
 `(in:${usage?.input_tokens || '?'} out:${usage?.output_tokens || '?'})`
 );
 } catch (recordErr) {
 console.error(`[LLMProxy] #${callId} Record error (non-fatal):`, recordErr.message);
 }

 } else {
 // ========== JSON MODE (non-streaming) ==========
 const responseBody = await apiResponse.json();
 const latency = Date.now() - startTime;

 // Return to client FIRST
 res.status(apiResponse.status);
 res.json(responseBody);

 // Record after response
 try {
 const capture = {
 id: callId,
 timestamp: new Date().toISOString(),
 request: capturedRequest,
 response: {
 status: apiResponse.status,
 headers: Object.fromEntries(apiResponse.headers.entries()),
 body: responseBody,
 },
 latency_ms: latency,
 tokens: {
 input: responseBody?.usage?.input_tokens || 0,
 output: responseBody?.usage?.output_tokens || 0,
 },
 };

 this.addCapture(capture);

 console.log(
 `[LLMProxy] #${callId} JSON ${req.method} ${req.path} → ` +
 `${apiResponse.status} ${latency}ms ` +
 `(in:${capture.tokens.input} out:${capture.tokens.output})`
 );
 } catch (recordErr) {
 console.error(`[LLMProxy] #${callId} Record error (non-fatal):`, recordErr.message);
 }
 }

 } catch (err) {
 const latency = Date.now() - startTime;
 console.error(`[LLMProxy] #${callId} ERROR:`, err.message);

 const errorCapture = {
 id: callId,
 timestamp: new Date().toISOString(),
 request: capturedRequest,
 response: {
 status: 502,
 headers: {},
 body: { error: err.message },
 },
 latency_ms: latency,
 tokens: { input: 0, output: 0 },
 };

 this.addCapture(errorCapture);

 res.status(502).json({
 error: 'Proxy forward failed',
 message: err.message,
 });
 }
 });

 // Global error handler with fallback
 this.app.use((err, req, res, next) => {
 console.error('[LLMProxy] Unhandled error, attempting direct passthrough:', err.message);
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

 // Start memory monitoring
 this.memoryCheckInterval = setInterval(() => {
 const usage = process.memoryUsage();
 const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
 console.log(`[LLMProxy] Heap: ${heapUsedMB}MB, Captures: ${this.captures.length}`);
 }, 60000);

 console.log(`[LLMProxy] Running on http://0.0.0.0:${this.port}`);
 console.log(`[LLMProxy] Forwarding to ${REAL_API}`);

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

 /**
 * Stop the proxy server
 */
 async stop() {
 const totalCalls = this.callCounter;
 
 if (this.memoryCheckInterval) {
 clearInterval(this.memoryCheckInterval);
 this.memoryCheckInterval = null;
 }

 return new Promise((resolve) => {
 if (!this.server) {
 resolve({ success: true, totalCalls: 0 });
 return;
 }
 this.server.close(() => {
 this.server = null;
 this.app = null;
 this.startedAt = null;
 console.log(`[LLMProxy] Stopped. Total calls captured: ${totalCalls}`);
 resolve({ success: true, totalCalls });
 });
 });
 }

 /**
 * Get proxy status
 */
 getStatus() {
 return {
 running: this.server !== null,
 port: this.port,
 startedAt: this.startedAt?.toISOString() || null,
 totalCalls: this.callCounter,
 capturesCount: this.captures.length,
 uptimeSeconds: this.startedAt
 ? Math.round((Date.now() - this.startedAt.getTime()) / 1000)
 : 0,
 };
 }

 /**
 * Get all captures (newest first)
 */
 getCaptures() {
 return [...this.captures].reverse();
 }

 /**
 * Get a single capture by ID
 */
 getCapture(id) {
 return this.captures.find(c => c.id === id);
 }

 /**
 * Add a capture to memory and save to file
 */
 addCapture(capture) {
 // Add to memory
 this.captures.push(capture);
 
 // Trim if over limit
 if (this.captures.length > MAX_MEMORY_CAPTURES) {
 this.captures = this.captures.slice(-MAX_MEMORY_CAPTURES);
 }

 // Save to file
 this.saveCaptureToFile(capture);
 
 // Emit event for SSE
 this.emit('capture', capture);
 }

 /**
 * Sanitize headers (redact sensitive values)
 */
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

 /**
 * Save capture to file
 */
 saveCaptureToFile(capture) {
 try {
 const filename = `call-${String(capture.id).padStart(4, '0')}-${Date.now()}.json`;
 const filepath = path.join(CAPTURES_DIR, filename);
 
 // Create a copy without large fields to save space
 const toSave = {
 ...capture,
 request: {
 ...capture.request,
 body: capture.request.body ? {
 model: capture.request.body.model,
 max_tokens: capture.request.body.max_tokens,
 messages_count: capture.request.body.messages?.length || 0,
 tools_count: capture.request.body.tools?.length || 0,
 has_system: !!capture.request.body.system,
 messages_preview: capture.request.body.messages?.slice(0, 2)?.map(m => ({
 role: m.role,
 content_preview: typeof m.content === 'string' 
 ? m.content.slice(0, 200) 
 : '[complex content]',
 })),
 } : null,
 },
 };
 
 fs.writeFileSync(filepath, JSON.stringify(toSave, null, 2));
 } catch (err) {
 console.error('[LLMProxy] Failed to save capture:', err.message);
 }
 }
}

// ============================================
// SINGLETON EXPORT
// ============================================

const llmProxy = new LLMProxy(8999);

module.exports = { LLMProxy, llmProxy };
