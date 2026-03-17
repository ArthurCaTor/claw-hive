/**
 * @file src/services/llm-proxy.ts
 * @description LLM Proxy — transparent API proxy that records all LLM traffic
 *              LLM 代理 — 透明 API 代理，记录所有 LLM 流量
 *
 * Architecture:
 * 架构：
 *   OpenClaw Agent → claw-hive Proxy (:8999) → Real LLM API
 *
 * Core principle: Forward first, record after. Never block the agent.
 * 核心原则：先转发，后记录。永远不阻塞 Agent。
 */

import express, { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import type { CaptureRecord, CaptureTokens, CaptureRequest, ProxyStatus, ProxyStartResult, ProxyStopResult } from '../types';
import { captureFileWriter } from './capture-file-writer';
import { providerIdentifier } from './provider-identifier';
import { llmTracker } from './llm-tracker';
import { logger } from '../utils/logger';

// ============================================
// Configuration — 配置
// ============================================

const CAPTURES_DIR = path.join(process.cwd(), 'captures');
const REAL_API = process.env.LLM_API_TARGET || 'https://api.minimax.io';
const FORWARD_TIMEOUT_MS = parseInt(process.env.PROXY_TIMEOUT || '120000', 10);
const MAX_MEMORY_CAPTURES = 100;
const MAX_BODY_SIZE = 100 * 1024 * 1024; // 100MB
const MEMORY_CHECK_INTERVAL = 60000;

// ============================================
// SSE Parsing Utilities — SSE 解析工具
// ============================================

interface SSEUsage {
  input_tokens?: number;
  output_tokens?: number;
  [key: string]: any;
}

/**
 * Extract usage info from SSE stream text
 * 从 SSE stream 文本中提取 usage 信息
 */
function extractUsageFromSSE(sseText: string): SSEUsage | null {
  const lines = sseText.split('\n');
  let usage: SSEUsage | null = null;

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const jsonStr = line.slice(6);
    if (jsonStr === '[DONE]') continue;

    try {
      const parsed = JSON.parse(jsonStr);
      // Anthropic: usage in message_delta or message_stop
      if (parsed.usage) usage = parsed.usage;
      // Nested message.usage
      if (parsed.message?.usage) usage = parsed.message.usage;
      // OpenAI: usage at top level of final chunk
      if (parsed.choices?.[0]?.finish_reason && parsed.usage) usage = parsed.usage;
    } catch {
      // Skip non-JSON lines — 跳过非 JSON 行
    }
  }

  return usage;
}

/**
 * Extract assistant reply text from SSE stream
 * 从 SSE stream 中提取 assistant 回复文本
 */
function extractTextFromSSE(sseText: string): string {
  const lines = sseText.split('\n');
  const parts: string[] = [];

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const jsonStr = line.slice(6);
    if (jsonStr === '[DONE]') continue;

    try {
      const parsed = JSON.parse(jsonStr);
      // Anthropic format
      if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
        parts.push(parsed.delta.text);
      }
      // OpenAI format
      if (parsed.choices?.[0]?.delta?.content) {
        parts.push(parsed.choices[0].delta.content);
      }
    } catch {
      // Skip — 跳过
    }
  }

  return parts.join('');
}

/**
 * Detect if response is a streaming SSE response
 * 检测响应是否为 streaming SSE 响应
 */
function isStreamingResponse(contentType: string, requestBody: any): boolean {
  if (contentType.includes('text/event-stream')) return true;
  if (contentType.includes('text/plain')) return true;
  if (requestBody?.stream === true) return true;
  // MiniMax compatible-mode always streams when stream is not explicitly false
  // MiniMax 兼容模式在 stream 没有明确设为 false 时总是 streaming
  if (requestBody?.stream !== false && contentType.includes('application/')) return true;
  return false;
}

// ============================================
// Auth Header Passthrough — 认证头转发
// ============================================

const AUTH_HEADERS = ['x-api-key', 'authorization', 'anthropic-version'] as const;

function buildForwardHeaders(incomingHeaders: Record<string, string | string[] | undefined>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  for (const key of AUTH_HEADERS) {
    const value = incomingHeaders[key];
    if (value) {
      headers[key] = Array.isArray(value) ? value[0] : value;
    }
  }

  return headers;
}

function sanitizeHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!value) continue;
    const k = key.toLowerCase();
    const v = String(Array.isArray(value) ? value[0] : value);
    if (k === 'x-api-key' || k === 'authorization') {
      safe[key] = v.length > 12 ? v.slice(0, 8) + '...' + v.slice(-4) : '***REDACTED***';
    } else {
      safe[key] = v;
    }
  }
  return safe;
}

// ============================================
// Main LLM Proxy Class — LLM 代理主类
// ============================================

export class LLMProxy extends EventEmitter {
  private port: number;
  private app: express.Express | null = null;
  private server: import('http').Server | null = null;
  private captures: CaptureRecord[] = [];
  private callCounter = 0;
  private startedAt: Date | null = null;
  private memoryCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor(port = 8999) {
    super();
    this.port = port;

    // Initialize file writer — 初始化文件写入器
    captureFileWriter.initialize().catch(err => {
      logger.error({ err }, '[LLMProxy] Failed to initialize file writer');
    });
  }

  // ============================================
  // Lifecycle — 生命周期
  // ============================================

  async start(): Promise<ProxyStartResult> {
    if (this.server) {
      return { success: true, port: this.port };
    }

    fs.mkdirSync(CAPTURES_DIR, { recursive: true });

    this.app = express();
    this.app.use(express.json({ limit: '50mb' }));

    // Request logging — 请求日志
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      logger.debug({ method: req.method, url: req.url }, '[LLMProxy] Incoming');
      next();
    });

    // Health check — 健康检查
    this.app.get('/_health', (_req: Request, res: Response) => {
      res.json({
        status: 'ok',
        uptime: this.startedAt ? Math.round((Date.now() - this.startedAt.getTime()) / 1000) : 0,
        calls: this.callCounter,
      });
    });

    // Main intercept handler — 主拦截处理器
    this.app.all('/*', (req: Request, res: Response) => this.handleRequest(req, res));

    // Error fallback — 错误兜底
    this.app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
      logger.error({ err: err.message }, '[LLMProxy] Unhandled error, direct passthrough');
      this.directPassthrough(req, res);
    });

    // Start memory monitoring — 启动内存监控
    this.startMemoryMonitor();

    // Start server — 启动服务
    return new Promise<ProxyStartResult>((resolve) => {
      this.server = this.app!.listen(this.port, '0.0.0.0', () => {
        this.startedAt = new Date();
        this.captures = [];
        this.callCounter = 0;
        logger.info({ port: this.port, target: REAL_API }, '[LLMProxy] Started');
        resolve({ success: true, port: this.port });
      });

      this.server.on('error', (err: NodeJS.ErrnoException) => {
        const msg = err.code === 'EADDRINUSE'
          ? `Port ${this.port} already in use`
          : err.message;
        resolve({ success: false, port: this.port, error: msg });
      });
    });
  }

  async stop(): Promise<ProxyStopResult> {
    const totalCalls = this.callCounter;

    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }

    if (!this.server) {
      return { success: true, totalCalls: 0 };
    }

    return new Promise<ProxyStopResult>((resolve) => {
      this.server!.close(async () => {
        this.server = null;
        this.app = null;
        this.startedAt = null;
        await captureFileWriter.shutdown();
        logger.info({ totalCalls }, '[LLMProxy] Stopped');
        resolve({ success: true, totalCalls });
      });
    });
  }

  // ============================================
  // Request Handler — 请求处理器
  // ============================================

  private async handleRequest(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const callId = ++this.callCounter;
    const capturedRequest: CaptureRequest = {
      method: req.method,
      path: req.path,
      headers: sanitizeHeaders(req.headers as Record<string, string>),
      body: req.body,
    };

    // Identify provider — 识别提供商
    const providerInfo = providerIdentifier.identify(req);

    try {
      const targetUrl = `${REAL_API}${req.path}`;
      const forwardHeaders = buildForwardHeaders(req.headers as Record<string, string>);

      const apiResponse = await fetch(targetUrl, {
        method: req.method,
        headers: forwardHeaders,
        body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
        signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
      });

      const contentType = apiResponse.headers.get('content-type') || '';
      const streaming = isStreamingResponse(contentType, req.body);

      if (streaming) {
        await this.handleStreamingResponse(callId, req, res, apiResponse, capturedRequest, startTime, providerInfo);
      } else {
        await this.handleJsonResponse(callId, req, res, apiResponse, capturedRequest, startTime, providerInfo);
      }

    } catch (err: any) {
      const latency = Date.now() - startTime;
      logger.error({ callId, err: err.message, latency }, '[LLMProxy] Forward failed');

      const capture = this.buildCapture(callId, capturedRequest,
        { status: 502, body: { error: err.message } },
        latency, { input: 0, output: 0 }
      );
      this.recordCapture(capture, providerInfo.provider, latency, false);

      res.status(502).json({ error: 'Proxy forward failed', message: err.message });
    }
  }

  // ============================================
  // Streaming Response Handler — Streaming 响应处理
  // ============================================

  private async handleStreamingResponse(
    callId: number,
    req: Request,
    res: Response,
    apiResponse: globalThis.Response,
    capturedRequest: CaptureRequest,
    startTime: number,
    providerInfo: { provider: string; model: string; source: string },
  ): Promise<void> {
    // 1. Forward headers to client — 转发响应头给客户端
    res.status(apiResponse.status);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 2. Pipe chunks while collecting for recording — 边转发边收集
    const chunks: string[] = [];
    const reader = apiResponse.body!.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);  // Forward in real-time — 实时转发
        chunks.push(decoder.decode(value, { stream: true }));
      }
    } catch (pipeErr: any) {
      logger.error({ callId, err: pipeErr.message }, '[LLMProxy] Stream pipe error');
    }

    res.end();

    // 3. Record after response completes — 响应结束后记录
    const latency = Date.now() - startTime;
    const fullText = chunks.join('');
    const usage = extractUsageFromSSE(fullText);
    const assistantText = extractTextFromSSE(fullText);
    const tokens: CaptureTokens = {
      input: usage?.input_tokens || 0,
      output: usage?.output_tokens || 0,
    };

    const capture = this.buildCapture(callId, capturedRequest, {
      status: apiResponse.status,
      body: {
        _streaming: true,
        _raw_length: fullText.length,
        assistant_text: assistantText.slice(0, 2000), // Truncate for memory — 截断以节省内存
        usage,
      },
    }, latency, tokens);

    this.recordCapture(capture, providerInfo.provider, latency, apiResponse.status < 400);

    logger.info({
      callId, method: req.method, path: req.path,
      status: apiResponse.status, latency,
      provider: providerInfo.provider,
      inputTokens: tokens.input, outputTokens: tokens.output,
    }, '[LLMProxy] STREAM complete');
  }

  // ============================================
  // JSON Response Handler — JSON 响应处理
  // ============================================

  private async handleJsonResponse(
    callId: number,
    req: Request,
    res: Response,
    apiResponse: globalThis.Response,
    capturedRequest: CaptureRequest,
    startTime: number,
    providerInfo: { provider: string; model: string; source: string },
  ): Promise<void> {
    const responseBody = await apiResponse.json();
    const latency = Date.now() - startTime;

    // Forward first — 先转发
    res.status(apiResponse.status);
    res.json(responseBody);

    // Record after — 后记录
    const tokens: CaptureTokens = {
      input: responseBody?.usage?.input_tokens || 0,
      output: responseBody?.usage?.output_tokens || 0,
    };

    const capture = this.buildCapture(callId, capturedRequest, {
      status: apiResponse.status,
      body: responseBody,
    }, latency, tokens);

    this.recordCapture(capture, providerInfo.provider, latency, apiResponse.status < 400);

    logger.info({
      callId, method: req.method, path: req.path,
      status: apiResponse.status, latency,
      provider: providerInfo.provider,
      inputTokens: tokens.input, outputTokens: tokens.output,
    }, '[LLMProxy] JSON complete');
  }

  // ============================================
  // Capture Management — 捕获管理
  // ============================================

  private buildCapture(
    callId: number,
    request: CaptureRequest,
    response: { status: number; body: any },
    latencyMs: number,
    tokens: CaptureTokens,
  ): CaptureRecord {
    return {
      id: callId,
      timestamp: new Date().toISOString(),
      request,
      response: { status: response.status, body: response.body, tokens },
      latency_ms: latencyMs,
      tokens,
    };
  }

  private recordCapture(
    capture: CaptureRecord,
    provider: string,
    latencyMs: number,
    success: boolean,
  ): void {
    try {
      // Memory store (ring buffer) — 内存存储（环形缓冲）
      this.captures.push(capture);
      if (this.captures.length > MAX_MEMORY_CAPTURES) {
        this.captures = this.captures.slice(-MAX_MEMORY_CAPTURES);
      }

      // File store (non-blocking) — 文件存储（非阻塞）
      captureFileWriter.write('default', capture);

      // Emit for real-time dashboard — 发射给实时仪表板
      this.emit('capture', capture);

      // Track provider health — 跟踪提供商健康
      llmTracker.recordCall(provider, latencyMs, success);
    } catch (err: any) {
      logger.error({ err: err.message }, '[LLMProxy] Record error (non-fatal)');
    }
  }

  // ============================================
  // Direct Passthrough (error fallback) — 直接透传（错误兜底）
  // ============================================

  private directPassthrough(req: Request, res: Response): void {
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
  }

  // ============================================
  // Memory Monitor — 内存监控
  // ============================================

  private startMemoryMonitor(): void {
    this.memoryCheckInterval = setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
      logger.debug({ heapUsedMB, heapTotalMB }, '[LLMProxy] Memory');
      if (heapUsedMB > 500) {
        logger.warn({ heapUsedMB }, '[LLMProxy] High memory usage');
      }
    }, MEMORY_CHECK_INTERVAL);
  }

  // ============================================
  // Query Methods — 查询方法
  // ============================================

  getStatus(): ProxyStatus {
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

  getCaptures(): CaptureRecord[] {
    return [...this.captures].reverse();
  }

  getCapture(id: number): CaptureRecord | undefined {
    return this.captures.find(c => c.id === id);
  }
}

// ============================================
// Singleton Export — 单例导出
// ============================================

export const llmProxy = new LLMProxy(
  parseInt(process.env.PROXY_PORT || '8999', 10)
);
