#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const WebSocket = require('ws');
const path = require('path');
const os = require('os');
const { execFile, execSync } = require('child_process');
const fs = require('fs');

// Utils
const { createRateLimiter } = require('./utils/rate-limiter');
const { logger, child } = require('./utils/logger');
const { validateConfig, validateAgentUpdate, validateCronJob } = require('./utils/config-validator');
const swaggerSpec = require('./utils/openapi-spec');
const swaggerUi = require('swagger-ui-express');

// Services
const { debugService } = require('./services/debug-service');
const { sessionWatcher, OPENCLAW_DIR } = require('./services/session-watcher');
const { recordingStore } = require('./services/recording-store');
const { openclawReader } = require('./services/openclaw-reader');
const { llmTracker } = require('./services/llm-tracker');

const app = express();
const PORT = process.env.OPENCLAW_DASHBOARD_PORT || process.env.PORT || 8080;

// Global error handlers for stability
process.on('uncaughtException', (err) => {
  logger.fatal({ err: err.message, stack: err.stack }, '[FATAL] Uncaught Exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason }, '[ERROR] Unhandled Rejection');
});

// Middleware
app.use(cors());
// Compression with filter to skip SSE endpoints
app.use(compression({
  filter: (req, res) => {
    // Don't compress SSE streams
    if (req.path.includes('context-stream') || req.path.includes('debug-proxy/stream')) {
      return false;
    }
    return compression.filter(req, res);
  }
}));
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 500 || req.path.startsWith('/api')) {
      logger.info({
        duration,
        method: req.method,
        path: req.path,
        status: res.statusCode,
      }, `${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// Rate limiter for API routes
const apiRateLimiter = createRateLimiter({ windowMs: 60000, maxRequests: 100 });
app.use('/api', apiRateLimiter);

// Serve static files from public/
app.use(express.static(path.join(__dirname, '../public')));

// Swagger API docs
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/spec', (req, res) => res.json(swaggerSpec));
const CONFIG_PATHS = [
  process.env.OPENCLAW_CONFIG,
  path.join(os.homedir(), '.openclaw', 'openclaw.json'),
  path.join(process.cwd(), 'openclaw.json'),
];

function findConfigPath() {
  for (const p of CONFIG_PATHS) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

function loadAgentsFromConfig() {
  const configPath = findConfigPath();
  if (!configPath) return {};
  
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Validate config structure
    const validation = validateConfig(config);
    if (!validation.valid) {
      logger.error({ errors: validation.errors }, '[ConfigValidator] Invalid config, using defaults');
    } else if (validation.warnings.length > 0) {
      logger.warn({ warnings: validation.warnings }, '[ConfigValidator] Config warnings');
    }
    
    const agents = config.agents?.list || [];
    const result = {};
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
  } catch (e) {
    logger.error({ err: e.message }, 'Error loading config');
    return {};
  }
}

// In-memory store
let agentStore = {};
let storeLock = require('crypto').randomUUID(); // Simple lock indicator
const OPENCLAW_CMD = process.env.OPENCLAW_CMD || 'openclaw';
const POLL_INTERVAL = 10000;
const ACTIVE_THRESHOLD = 600000;

// WebSocket - attach to same HTTP server
const { createServer } = require('http');
const httpServer = createServer(app);

// WebSocket on same port
const wss = new WebSocket.Server({ server: httpServer });

wss.on('connection', (ws) => {
  logger.info('WebSocket client connected');
  ws.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }));
});

function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

function getOpenclawSessions() {
  // Use OpenClawReader instead of CLI to avoid process spawning
  return openclawReader.getSessions();
}

function pollOpenclaw() {
  const KNOWN_AGENTS = loadAgentsFromConfig();
  const now = Date.now();
  
  // Initialize agents from config
  for (const [agentId, defaults] of Object.entries(KNOWN_AGENTS)) {
    const existing = agentStore[agentId] || {};
    agentStore[agentId] = {
      agent_id: agentId,
      name: defaults.name || agentId,
      role: defaults.role || 'Agent',
      avatar: defaults.avatar || '🤖',
      color: defaults.color || '#60a5fa',
      model: existing.model || defaults.model || 'unknown',
      registered_at: existing.registered_at,
      status: 'idle',
      task: 'Waiting for task',
      output: null,
      heartbeat: existing.heartbeat || 'online',
      tokens_used: existing.tokens_used || 0,
      updated_at: now,
      updated_at_iso: new Date(now).toISOString(),
    };
  }
  
  getOpenclawSessions()
    .then((sessions) => {
      logger.info({ count: sessions.length }, `Found ${sessions.length} sessions`);
      
      for (const session of sessions) {
        // Support both CLI format (key) and OpenClawReader format (agent)
        const key = session.key || '';
        const agentId = session.agent || (key.split(':')[1]);
        
        if (!agentId || !KNOWN_AGENTS[agentId]) continue;
        
        const ageMs = session.ageMs || 0;
        const isActive = ageMs < ACTIVE_THRESHOLD;
        const tokens = session.totalTokens || 0;
        
        // Detect channel
        let channel = 'Unknown';
        if (key.includes('telegram')) channel = 'Telegram';
        else if (key.includes('discord')) channel = 'Discord';
        
        // Detect source agent for cross-agent messages
        let sourceAgent = null;
        const parts = key.split(':');
        if (session.systemSent && parts.length >= 4) {
          const potentialSource = parts[3];
          if (KNOWN_AGENTS[potentialSource]) {
            sourceAgent = potentialSource;
          }
        }
        
        let taskDesc;
        if (sourceAgent) {
          taskDesc = `Active (Agent-${sourceAgent})`;
        } else if (key.includes('telegram') || key.includes('discord')) {
          taskDesc = `Session active (${channel})`;
        } else {
          taskDesc = `Session active (${channel})`;
        }
        
        const old = agentStore[agentId] || {};
        const existingAgeMs = old.updated_at ? (now - old.updated_at) : Infinity;
        
        // Only update if this session is more recent than what's stored
        if (existingAgeMs < ageMs && old.status === 'working') continue;
        
        agentStore[agentId] = {
          ...old,
          agent_id: agentId,
          status: isActive ? 'working' : 'idle',
          task: isActive ? taskDesc : 'Waiting for task',
          output: isActive ? taskDesc : null,
          model: session.model || old.model || 'unknown',
          model_source: session.model ? 'session' : 'config',
          heartbeat: 'online',
          tokens_used: typeof tokens === 'number' ? tokens : 0,
          updated_at: now,
          updated_at_iso: new Date(now).toISOString(),
        };
        
        // Track LLM usage
        const model = session.model || old.model || 'unknown';
        const provider = llmTracker.getProviderFromModel(model);
        llmTracker.track(agentId, provider, model);
      }
      
      // Broadcast update
      broadcast({
        type: 'agents_update',
        agents: Object.values(agentStore),
        stats: getStats(),
        timestamp: new Date().toISOString(),
      });
    })
    .catch((err) => {
      logger.error({ err: err.message }, 'Error polling OpenClaw');
    });
}

function getStats() {
  const agents = Object.values(agentStore);
  const working = agents.filter(a => a.status === 'working').length;
  const idle = agents.length - working;
  const totalTokens = agents.reduce((sum, a) => sum + (a.tokens_used || 0), 0);
  
  return {
    total_agents: agents.length,
    working,
    idle,
    total_tokens: totalTokens,
  };
}

// Start polling
setInterval(pollOpenclaw, POLL_INTERVAL);
pollOpenclaw(); // Initial poll

// API Routes
// Note: Most routes moved to route files (agent-routes.js, model-routes.js, etc.)
// Route files mounted at bottom of server.js




// Agent Lifecycle Controls



// Memory Viewer Endpoint - List memory files

// Log Viewer - List available log files

// Get specific log file content - handle paths with slashes

// ============================================
// Context Stream Inspector (H-10)
// ============================================

// SSE stream - forward OpenClaw events to browser
app.get('/api/context-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const unsubscribe = sessionWatcher.subscribe((event) => {
    // Forward to browser
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    
    // Record if recording is active
    if (recordingStore.isRecording()) {
      recordingStore.appendEvent(event);
    }
  });

  req.on('close', () => {
    unsubscribe();
    res.end();
  });
});

// Cron Jobs Table - List scheduled jobs

// Trigger cron job manually

// Cron Run History

// File Browser - List workspace files

// Debug Proxy Routes (must be BEFORE SPA fallback)
const debugProxyRoutes = require('./routes/debug-proxy-routes');
const healthRoutes = require('./routes/health-routes');
const agentRoutes = require('./routes/agent-routes');
const modelRoutes = require('./routes/model-routes');
const channelRoutes = require('./routes/channel-routes');
const skillsRoutes = require('./routes/skills-routes');
const memoryRoutes = require('./routes/memory-routes');
const logRoutes = require('./routes/log-routes');
const searchRoutes = require('./routes/search-routes');
const recordingRoutes = require('./routes/recording-routes');
const systemRoutes = require('./routes/system-routes');
const statsRoutes = require('./routes/stats-routes');
const filesRoutes = require('./routes/files-routes');
const openclawRoutes = require('./routes/openclaw-routes');
const sessionSearchRoutes = require('./routes/session-search-routes');
app.use(debugProxyRoutes);
healthRoutes(app);
agentRoutes(app, { agentStore, findConfigPath, validateAgentUpdate });
modelRoutes(app, { findConfigPath });
channelRoutes(app, { findConfigPath });
skillsRoutes(app);
memoryRoutes(app);
logRoutes(app);
searchRoutes(app, { agentStore });
recordingRoutes(app, { recordingStore });
systemRoutes(app, { sessionWatcher, debugService, OPENCLAW_DIR, findConfigPath });
statsRoutes(app, { agentStore, findConfigPath, getStats, llmTracker });
filesRoutes(app);
sessionSearchRoutes(app, { agentStore });
app.use('/api/openclaw', openclawRoutes);

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Express error handling middleware
app.use((err, req, res, next) => {
  logger.error({ 
    err: err.message, 
    stack: err.stack,
    method: req.method,
    path: req.path,
    query: req.query,
  }, '[EXPRESS ERROR]');
  
  // Don't expose internal errors to clients in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
    
  res.status(err.status || err.statusCode || 500).json({ 
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

const HOST = process.env.HOST || '0.0.0.0';
httpServer.listen(PORT, HOST, () => {
  logger.info({ port: PORT }, `✅ OpenClaw Dashboard running at http://localhost:${PORT}`);
  logger.info(`   WebSocket: ws://localhost:${PORT}/ws`);
  
  // Start watching latest session
  const sessions = sessionWatcher.getAllSessions();
  if (sessions.length > 0) {
    const latest = sessions[0];
    sessionWatcher.watchFile(latest.filepath, latest.agent, latest.sessionId);
    logger.info({ agent: latest.agent, sessionId: latest.sessionId }, '[SessionWatcher] watching');
  }
});

module.exports = app;

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  const { captureFileWriter } = require('./services/capture-file-writer');
  await captureFileWriter.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  const { captureFileWriter } = require('./services/capture-file-writer');
  await captureFileWriter.shutdown();
  process.exit(0);
});
