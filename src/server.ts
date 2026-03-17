#!/usr/bin/env node

/**
 * @file src/server.ts
 * @description claw-hive main server — Express + WebSocket + SSE
 *              claw-hive 主服务器
 *
 * Responsibilities (after refactor):
 * 重构后的职责：
 * 1. Express app setup (middleware, static files)
 * 2. WebSocket broadcast
 * 3. OpenClaw polling loop
 * 4. SSE context stream
 * 5. Route mounting (all handlers in route files)
 * 6. Graceful shutdown
 *
 * All agent state management is in agent-store.ts
 * 所有 Agent 状态管理在 agent-store.ts 中
 */

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import WebSocket from 'ws';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { createServer } from 'http';

// Utils
import { createRateLimiter } from './utils/rate-limiter';
import { logger } from './utils/logger';
import { validateConfig } from './utils/config-validator';

// Services
import { agentStore } from './services/agent-store';
import { debugService } from './services/debug-service';
import { sessionWatcher, OPENCLAW_DIR } from './services/session-watcher';
import { recordingStore } from './services/recording-store';
import { openclawReader } from './services/openclaw-reader';
import { llmTracker } from './services/llm-tracker';

// Types
import type { OpenClawConfig, AgentDefaults } from './types';

// ============================================
// Configuration — 配置
// ============================================

const PORT = parseInt(process.env.OPENCLAW_DASHBOARD_PORT || process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';
const POLL_INTERVAL = 10000;
const ACTIVE_THRESHOLD = 600000;

const CONFIG_PATHS = [
  process.env.OPENCLAW_CONFIG,
  path.join(os.homedir(), '.openclaw', 'openclaw.json'),
  path.join(process.cwd(), 'openclaw.json'),
];

function findConfigPath(): string | null {
  for (const p of CONFIG_PATHS) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

function loadConfig(): OpenClawConfig | null {
  const configPath = findConfigPath();
  if (!configPath) return null;
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const validation = validateConfig(config);
    if (!validation.valid) {
      logger.error({ errors: validation.errors }, 'Invalid OpenClaw config');
    }
    return config;
  } catch (e: any) {
    logger.error({ err: e.message }, 'Error loading config');
    return null;
  }
}

function loadAgentDefaults(): Record<string, AgentDefaults> {
  const config = loadConfig();
  if (!config) return {};
  const agents = config.agents?.list || [];
  const result: Record<string, AgentDefaults> = {};
  for (const agent of agents) {
    result[agent.id] = {
      name: agent.id,
      role: 'Agent',
      avatar: '🤖',
      color: '#60a5fa',
      model: agent.model || 'unknown',
    };
  }
  return result;
}

// ============================================
// Global Error Handlers — 全局错误处理
// ============================================

process.on('uncaughtException', (err) => {
  logger.fatal({ err: err.message, stack: err.stack }, 'Uncaught Exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled Rejection');
});

// ============================================
// Express App Setup — Express 应用设置
// ============================================

const app = express();

app.use(cors());
app.use(compression({
  filter: (req) => {
    // Don't compress SSE streams — 不压缩 SSE 流
    if (req.path.includes('context-stream') || req.path.includes('debug-proxy/stream')) {
      return false;
    }
    return true;
  },
}));
app.use(express.json({ limit: '10mb' }));

// Request logging — 请求日志
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 500 || req.path.startsWith('/api')) {
      logger.info({ duration, method: req.method, path: req.path, status: res.statusCode },
        `${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// Rate limiter — 速率限制
app.use('/api', createRateLimiter({ windowMs: 60000, maxRequests: 100 }));

// Static files — 静态文件
app.use(express.static(path.join(__dirname, '../public')));

// Swagger docs (if available) — API 文档
try {
  const swaggerSpec = require('./utils/openapi-spec');
  const swaggerUi = require('swagger-ui-express');
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api/spec', (_req, res) => res.json(swaggerSpec));
} catch {
  logger.warn('Swagger UI not available');
}

// ============================================
// WebSocket — WebSocket 广播
// ============================================

const httpServer = createServer(app);
const wss = new WebSocket.Server({ server: httpServer });

wss.on('connection', (ws) => {
  logger.info('WebSocket client connected');
  ws.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }));
});

function broadcast(data: any): void {
  const json = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  });
}

// ============================================
// OpenClaw Polling — OpenClaw 轮询
// ============================================

async function pollOpenclaw(): Promise<void> {
  const knownAgents = loadAgentDefaults();

  // Initialize agents from config — 从配置初始化 Agent
  for (const [agentId, defaults] of Object.entries(knownAgents)) {
    agentStore.initFromConfig(agentId, defaults);
  }

  try {
    const sessions = await openclawReader.getSessions();
    logger.info({ count: sessions.length }, `Found ${sessions.length} sessions`);

    const now = Date.now();

    for (const session of sessions) {
      const key = session.key || '';
      const agentId = session.agent || (key.split(':')[1]);
      if (!agentId || !knownAgents[agentId]) continue;

      const ageMs = session.ageMs || 0;
      const isActive = ageMs < ACTIVE_THRESHOLD;
      const tokens = session.totalTokens || 0;

      // Detect channel — 检测渠道
      let channel = 'CLI';
      if (key.includes('telegram')) channel = 'Telegram';
      else if (key.includes('discord')) channel = 'Discord';

      // Detect cross-agent source — 检测跨 Agent 来源
      const parts = key.split(':');
      let sourceAgent: string | null = null;
      if (session.systemSent && parts.length >= 4 && knownAgents[parts[3]]) {
        sourceAgent = parts[3];
      }

      // Build task description — 构建任务描述
      const taskDesc = sourceAgent
        ? `Active (Agent-${sourceAgent})`
        : `Session active (${channel})`;

      // Skip if we already have a more recent update — 跳过更旧的更新
      const existingUpdatedAt = agentStore.getUpdatedAt(agentId);
      if (existingUpdatedAt && (now - existingUpdatedAt) < ageMs) {
        const existing = agentStore.get(agentId);
        if (existing?.status === 'working') continue;
      }

      const model = session.model || agentStore.get(agentId)?.model || 'unknown';

      agentStore.updateFromSession(agentId, {
        status: isActive ? 'working' : 'idle',
        task: isActive ? taskDesc : 'Waiting for task',
        output: isActive ? taskDesc : null,
        model,
        modelSource: session.model ? 'session' : 'config',
        tokensUsed: typeof tokens === 'number' ? tokens : 0,
      });

      // Track LLM usage — 跟踪 LLM 使用
      const provider = llmTracker.getProviderFromModel(model);
      llmTracker.track(agentId, provider, model);
    }

    // Broadcast to all WebSocket clients — 广播给所有 WebSocket 客户端
    broadcast({
      type: 'agents_update',
      agents: agentStore.getAll(),
      stats: agentStore.getStats(),
      timestamp: new Date().toISOString(),
    });

  } catch (err: any) {
    logger.error({ err: err.message }, 'Error polling OpenClaw');
  }
}

// Start polling — 启动轮询
setInterval(pollOpenclaw, POLL_INTERVAL);
pollOpenclaw();

// ============================================
// SSE Context Stream — SSE 上下文流
// ============================================

app.get('/api/context-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const unsubscribe = sessionWatcher.subscribe((event: any) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    if (recordingStore.isRecording()) {
      recordingStore.appendEvent(event);
    }
  });

  req.on('close', () => {
    unsubscribe();
    res.end();
  });
});

// ============================================
// Route Mounting — 路由挂载
// ============================================

// Import all route modules — 导入所有路由模块
import debugProxyRoutes from './routes/debug-proxy-routes';
import healthRoutes from './routes/health-routes';
import agentRoutes from './routes/agent-routes';
import modelRoutes from './routes/model-routes';
import channelRoutes from './routes/channel-routes';
import skillsRoutes from './routes/skills-routes';
import memoryRoutes from './routes/memory-routes';
import logRoutes from './routes/log-routes';
import searchRoutes from './routes/search-routes';
import recordingRoutes from './routes/recording-routes';
import systemRoutes from './routes/system-routes';
import statsRoutes from './routes/stats-routes';
import filesRoutes from './routes/files-routes';
import openclawRoutes from './routes/openclaw-routes';
import metricsRoutes from './routes/metrics-routes';

// Dependencies passed to route factories — 传递给路由工厂的依赖
const routeDeps = { agentStore, findConfigPath, llmTracker };

app.use(debugProxyRoutes);
healthRoutes(app);
agentRoutes(app, routeDeps);
modelRoutes(app, { findConfigPath });
channelRoutes(app, { findConfigPath });
skillsRoutes(app);
memoryRoutes(app);
logRoutes(app);
searchRoutes(app, { agentStore });
recordingRoutes(app, { recordingStore });
systemRoutes(app, { sessionWatcher, debugService, OPENCLAW_DIR, findConfigPath });
statsRoutes(app, { agentStore, findConfigPath, getStats: () => agentStore.getStats() });
filesRoutes(app);
app.use('/api/openclaw', openclawRoutes);
app.use('/api/metrics', metricsRoutes.getMetrics);

// SPA fallback — SPA 回退
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware — 错误处理中间件
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err: err.message, method: req.method, path: req.path }, 'Express error');
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  res.status(err.status || 500).json({ error: message });
});

// ============================================
// Start Server — 启动服务器
// ============================================

httpServer.listen(PORT, HOST, () => {
  logger.info({ port: PORT }, `✅ claw-hive running at http://localhost:${PORT}`);

  // Auto-watch latest session — 自动监听最新 session
  const sessions = sessionWatcher.getAllSessions();
  if (sessions.length > 0) {
    const latest = sessions[0];
    sessionWatcher.watchFile(latest.filepath, latest.agent, latest.sessionId);
    logger.info({ agent: latest.agent, sessionId: latest.sessionId }, 'Watching session');
  }
});

// ============================================
// Graceful Shutdown — 优雅关闭
// ============================================

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down gracefully...');
  const { captureFileWriter } = await import('./services/capture-file-writer');
  await captureFileWriter.shutdown();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
