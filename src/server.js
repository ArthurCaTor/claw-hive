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

// Switch agent model
app.post('/api/agent/:id/model', (req, res) => {
  const { id } = req.params;
  const { model } = req.body;
  
  if (!model) {
    res.status(400).json({ error: 'model is required' });
    return;
  }
  
  if (agentStore[id]) {
    agentStore[id].model = model;
  }
  
  res.json({ success: true, message: `Agent ${id} model switched to ${model}` });
});

// ============================================================
// LLM Tracker API - P2-05
// ============================================================

// Get current LLM for all agents
app.get('/api/llms/current', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    agents: llmTracker.getCurrentLLMs(),
  });
});

// Get LLM switch history
app.get('/api/llms/switches', (req, res) => {
  const { agent, limit } = req.query;
  const history = llmTracker.getSwitchHistory(agent, parseInt(limit) || 50);
  res.json({
    timestamp: new Date().toISOString(),
    count: history.length,
    switches: history,
  });
});

// Get LLM health metrics (error rate, latency)
app.get('/api/llms/health', (req, res) => {
  const { provider } = req.query;
  if (provider) {
    res.json({
      timestamp: new Date().toISOString(),
      provider,
      metrics: llmTracker.getHealthMetrics(provider),
    });
  } else {
    res.json({
      timestamp: new Date().toISOString(),
      providers: llmTracker.getAllHealthMetrics(),
    });
  }
});

// Get LLM stats summary
app.get('/api/llms/stats', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    stats: llmTracker.getStats(),
  });
});

app.get('/api/agent/:id', (req, res) => {
  const id = req.params.id;
  if (agentStore[id]) {
    res.json(agentStore[id]);
  } else {
    const KNOWN_AGENTS = loadAgentsFromConfig();
    if (KNOWN_AGENTS[id]) {
      res.json({
        agent_id: id,
        ...KNOWN_AGENTS[id],
        status: 'idle',
        task: 'Waiting for task',
      });
    } else {
      res.status(404).json({ error: 'Agent not found' });
    }
  }
});

app.post('/api/agent/register', (req, res) => {
  const { agent_id, name, role, avatar, color } = req.body;
  agentStore[agent_id] = {
    agent_id,
    name: name || agent_id,
    role: role || 'Agent',
    avatar: avatar || '🤖',
    color: color || '#60a5fa',
    status: 'idle',
    task: 'Waiting for task',
    registered_at: new Date().toISOString(),
  };
  res.json({ success: true });
});

app.post('/api/agent/status', (req, res) => {
  const { agent_id, status, task, output, tokens_used } = req.body;
  
  // Validate request
  const validation = validateAgentUpdate(req.body);
  if (!validation.valid) {
    return res.status(400).json({ success: false, errors: validation.errors });
  }
  
  if (agentStore[agent_id]) {
    agentStore[agent_id] = {
      ...agentStore[agent_id],
      ...req.body,
      updated_at: Date.now(),
      updated_at_iso: new Date().toISOString(),
    };
  } else {
    agentStore[agent_id] = {
      ...req.body,
      updated_at: Date.now(),
      updated_at_iso: new Date().toISOString(),
    };
  }
  res.json({ success: true });
});

// Agent Lifecycle Controls
app.post('/api/agent/control', (req, res) => {
  const { agent_id, action } = req.body;
  
  if (!agent_id || !action) {
    res.status(400).json({ error: 'agent_id and action are required' });
    return;
  }
  
  // Actions: pause, resume, restart, stop
  // Note: These are simulated - actual control would require integration with the OpenClaw runtime
  switch (action) {
    case 'pause':
      if (agentStore[agent_id]) {
        agentStore[agent_id].status = 'paused';
        agentStore[agent_id].task = 'Paused by user';
      }
      res.json({ success: true, message: `Agent ${agent_id} paused` });
      break;
    case 'resume':
      if (agentStore[agent_id]) {
        agentStore[agent_id].status = 'working';
        agentStore[agent_id].task = 'Resumed';
      }
      res.json({ success: true, message: `Agent ${agent_id} resumed` });
      break;
    case 'restart':
      // Simulate restart by clearing state
      if (agentStore[agent_id]) {
        agentStore[agent_id].status = 'working';
        agentStore[agent_id].task = 'Restarting...';
        agentStore[agent_id].output = '';
      }
      res.json({ success: true, message: `Agent ${agent_id} restart initiated` });
      break;
    case 'stop':
      if (agentStore[agent_id]) {
        agentStore[agent_id].status = 'stopped';
        agentStore[agent_id].task = 'Stopped by user';
      }
      res.json({ success: true, message: `Agent ${agent_id} stopped` });
      break;
    default:
      res.status(400).json({ error: 'Invalid action' });
  }
});


app.get('/api/config', (req, res) => {
  const configPath = findConfigPath();
  if (configPath) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      res.json(config);
    } catch (e) {
      res.json({ error: e.message });
    }
  } else {
    res.json({ error: 'Config not found' });
  }
});

// Memory Viewer Endpoint - List memory files

// Log Viewer - List available log files
app.get('/api/logs', (req, res) => {
  const logPaths = [
    { path: path.join(os.homedir(), '.openclaw'), name: 'OpenClaw' },
    { path: '/var/log', name: 'System' },
  ];
  
  const logs = [];
  
  for (const logPath of logPaths) {
    if (fs.existsSync(logPath.path)) {
      try {
        const files = fs.readdirSync(logPath.path);
        for (const file of files) {
          if (file.endsWith('.log') || file === 'syslog' || file === 'auth.log') {
            const filePath = path.join(logPath.path, file);
            try {
              const stats = fs.statSync(filePath);
              if (stats.isFile()) {
                logs.push({
                  id: `${logPath.name}/${file}`,
                  name: file,
                  category: logPath.name,
                  path: filePath,
                  size: stats.size,
                  modified: stats.mtime.toISOString(),
                });
              }
            } catch (e) {
              // Skip files we can't access
            }
          }
        }
      } catch (e) {
        logger.error({ path: logPath.path, err: e.message }, 'Error reading log path');
      }
    }
  }
  
  // Sort by modified date
  logs.sort((a, b) => new Date(b.modified) - new Date(a.modified));
  
  res.json({
    timestamp: new Date().toISOString(),
    logs: logs.slice(0, 30),
  });
});

// Get specific log file content - handle paths with slashes
app.get('/api/logs/*', (req, res) => {
  const id = req.params[0];
  const [category, ...nameParts] = id.split('/');
  const name = nameParts.join('/');
  
  let logPath;
  if (category === 'OpenClaw') {
    logPath = path.join(os.homedir(), '.openclaw', name);
  } else if (category === 'System') {
    logPath = path.join('/var/log', name);
  }
  
  if (logPath && fs.existsSync(logPath)) {
    try {
      // Read last 500 lines max
      const content = fs.readFileSync(logPath, 'utf8');
      const lines = content.split('\n');
      const lastLines = lines.slice(-500).join('\n');
      
      res.json({
        id,
        content: lastLines,
        totalLines: lines.length,
        showingLines: Math.min(500, lines.length),
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  } else {
    res.status(404).json({ error: 'Log file not found' });
  }
});

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
app.get('/api/cron', (req, res) => {
  // Read cron jobs from OpenClaw config
  const configPath = findConfigPath();
  let cronJobs = [];
  
  if (configPath) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const env = config.env?.vars || {};
      
      // Dynamically generate cron jobs from config
      cronJobs = [
        {
          id: 'daily-report',
          name: 'Daily Report',
          schedule: env.REPORT_TIME ? `${env.REPORT_TIME.replace(':', ' ')} * *` : '0 9 * * *',
          status: env.SEND_DAILY_REPORT === 'true' ? 'active' : 'idle',
          lastRun: null,
          nextRun: new Date(Date.now() + 86400000).toISOString(),
        },
        {
          id: 'health-check',
          name: 'Health Check',
          schedule: config.heartbeat?.every || '30m',
          status: 'active',
          lastRun: new Date(Date.now() - 1800000).toISOString(),
          nextRun: new Date(Date.now() + 1800000).toISOString(),
        },
        {
          id: 'memory-compaction',
          name: 'Memory Compaction',
          schedule: config.compaction?.mode === 'safeguard' ? '0 2 * * *' : 'idle',
          status: config.compaction?.mode ? 'active' : 'idle',
          lastRun: new Date(Date.now() - 172800000).toISOString(),
          nextRun: new Date(Date.now() + 61200000).toISOString(),
        },
      ];
    } catch (e) {
      // Fallback if config read fails
      cronJobs = [];
    }
  }
  
  res.json({
    total: cronJobs.length,
    jobs: cronJobs,
  });
});

// Trigger cron job manually
app.post('/api/cron/:id/run', (req, res) => {
  const { id } = req.params;
  
  res.json({
    success: true,
    message: `Cron job ${id} triggered manually`,
    timestamp: new Date().toISOString(),
  });
});

// Cron Run History
app.get('/api/cron/history', (req, res) => {
  // Simulated cron run history
  const history = [
    { id: 'daily-report', name: 'Daily Report', status: 'success', duration: 45, timestamp: new Date(Date.now() - 86400000).toISOString() },
    { id: 'daily-report', name: 'Daily Report', status: 'success', duration: 52, timestamp: new Date(Date.now() - 172800000).toISOString() },
    { id: 'daily-report', name: 'Daily Report', status: 'error', duration: 12, timestamp: new Date(Date.now() - 259200000).toISOString() },
    { id: 'health-check', name: 'Health Check', status: 'success', duration: 3, timestamp: new Date(Date.now() - 1800000).toISOString() },
    { id: 'health-check', name: 'Health Check', status: 'success', duration: 4, timestamp: new Date(Date.now() - 3600000).toISOString() },
    { id: 'health-check', name: 'Health Check', status: 'success', duration: 3, timestamp: new Date(Date.now() - 5400000).toISOString() },
    { id: 'memory-cleanup', name: 'Memory Cleanup', status: 'success', duration: 128, timestamp: new Date(Date.now() - 172800000).toISOString() },
    { id: 'memory-cleanup', name: 'Memory Cleanup', status: 'success', duration: 115, timestamp: new Date(Date.now() - 345600000).toISOString() },
  ];
  
  res.json({
    total: history.length,
    runs: history,
  });
});

// File Browser - List workspace files
app.get('/api/sessions/search', (req, res) => {
  const { q } = req.query;
  const query = (q || '').toLowerCase();
  
  // Get all sessions from agentStore
  const sessions = Object.values(agentStore).map(agent => ({
    agent_id: agent.agent_id,
    name: agent.name,
    role: agent.role,
    avatar: agent.avatar,
    color: agent.color,
    status: agent.status,
    task: agent.task,
    output: agent.output,
    model: agent.model,
    heartbeat: agent.heartbeat,
    tokens_used: agent.tokens_used,
    updated_at: agent.updated_at,
  }));
  
  // Filter by query if provided
  let results = sessions;
  if (query) {
    results = sessions.filter(s => 
      (s.name && s.name.toLowerCase().includes(query)) ||
      (s.task && s.task.toLowerCase().includes(query)) ||
      (s.output && s.output.toLowerCase().includes(query)) ||
      (s.agent_id && s.agent_id.toLowerCase().includes(query)) ||
      (s.role && s.role.toLowerCase().includes(query))
    );
  }
  
  res.json({
    query,
    total: results.length,
    sessions: results,
  });
});

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
app.use(debugProxyRoutes);
healthRoutes(app);
agentRoutes(app, { agentStore, findConfigPath });
modelRoutes(app, { findConfigPath });
channelRoutes(app, { findConfigPath });
skillsRoutes(app);
memoryRoutes(app);
logRoutes(app);
searchRoutes(app, { agentStore });
recordingRoutes(app, { recordingStore });
systemRoutes(app, { sessionWatcher, debugService, OPENCLAW_DIR, findConfigPath });
statsRoutes(app, { agentStore, findConfigPath, getStats });
filesRoutes(app);
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
