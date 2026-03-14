#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const path = require('path');
const os = require('os');
const { execFile, execSync } = require('child_process');
const fs = require('fs');

// Services
const { debugService } = require('./services/debug-service');
const { sessionWatcher, OPENCLAW_DIR } = require('./services/session-watcher');
const { recordingStore } = require('./services/recording-store');

const app = express();
const PORT = process.env.OPENCLAW_DASHBOARD_PORT || process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public/
app.use(express.static(path.join(__dirname, '../public')));

// Config paths
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
    console.error('Error loading config:', e.message);
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
  console.log('WebSocket client connected');
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
  return new Promise((resolve, reject) => {
    execFile(OPENCLAW_CMD, ['sessions', '--all-agents', '--json'], { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      try {
        const data = JSON.parse(stdout);
        resolve(data.sessions || []);
      } catch (e) {
        reject(e);
      }
    });
  });
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
      console.log(`Found ${sessions.length} sessions`);
      
      for (const session of sessions) {
        const key = session.key || '';
        const parts = key.split(':');
        const agentId = parts[1];
        
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
      console.error('Error polling OpenClaw:', err.message);
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

app.get('/api/agents', (req, res) => {
  res.json(Object.values(agentStore));
});

// Get agent config from openclaw.json
app.get('/api/agents/config', (req, res) => {
  const configPath = findConfigPath();
  if (configPath) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const agentsList = config.agents?.list || [];
      res.json({
        total: agentsList.length,
        agents: agentsList.map(a => ({
          id: a.id,
          name: a.identity?.name || a.id,
          emoji: a.identity?.emoji || '🤖',
          workspace: a.workspace,
          model: a.model,
          subagents: a.subagents,
        })),
        defaults: config.agents?.defaults,
      });
    } catch (e) {
      res.json({ error: e.message });
    }
  } else {
    res.json({ error: 'Config not found' });
  }
});

// Get available models
app.get('/api/models', (req, res) => {
  const configPath = findConfigPath();
  if (configPath) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const models = config.agents?.defaults?.models || {};
      const modelList = Object.entries(models).map(([id, info]) => ({
        id,
        name: info.alias || id,
        params: info.params || {},
      }));
      
      if (modelList.length === 0) {
        modelList.push(
          { id: 'minimax-portal/MiniMax-M2.5', name: 'MiniMax-M2.5' },
          { id: 'minimax-portal/MiniMax-M2.1', name: 'MiniMax-M2.1' },
          { id: 'minimax-portal/MiniMax-M3', name: 'MiniMax-M3' },
          { id: 'anthropic/claude-3.5-sonnet', name: 'Claude-3.5' },
          { id: 'openai/gpt-4o', name: 'GPT-4o' }
        );
      }
      
      res.json({ total: modelList.length, models: modelList });
    } catch (e) {
      res.json({ error: e.message });
    }
  } else {
    res.json({ error: 'Config not found' });
  }
});

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
        console.error('Error reading log path:', logPath.path, e.message);
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
app.get('/api/files', (req, res) => {
  const { path: reqPath, workspace } = req.query;
  
  const workspacePaths = {
    nova: path.join(os.homedir(), '.openclaw', 'workspace-nova'),
    coder: path.join(os.homedir(), '.openclaw', 'workspace-coder'),
    scout: path.join(os.homedir(), '.openclaw', 'workspace-scout'),
    memory: path.join(os.homedir(), '.openclaw', 'workspace-memory'),
  };
  
  const basePath = workspacePaths[workspace] || workspacePaths.coder;
  const targetPath = reqPath ? path.join(basePath, reqPath) : basePath;
  
  if (!fs.existsSync(targetPath)) {
    res.json({ error: 'Path not found' });
    return;
  }
  
  try {
    const items = fs.readdirSync(targetPath, { withFileTypes: true });
    const files = items.map(item => ({
      name: item.name,
      type: item.isDirectory() ? 'directory' : 'file',
      path: reqPath || '',
      size: item.isDirectory() ? 0 : fs.statSync(path.join(targetPath, item.name)).size,
      modified: fs.statSync(path.join(targetPath, item.name)).mtime.toISOString(),
    }));
    
    res.json({
      workspace,
      path: reqPath || '/',
      items: files,
    });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// Get file content
app.get('/api/files/content', (req, res) => {
  const { workspace, path: filePath } = req.query;
  
  const workspacePaths = {
    nova: path.join(os.homedir(), '.openclaw', 'workspace-nova'),
    coder: path.join(os.homedir(), '.openclaw', 'workspace-coder'),
    scout: path.join(os.homedir(), '.openclaw', 'workspace-scout'),
    memory: path.join(os.homedir(), '.openclaw', 'workspace-memory'),
  };
  
  const basePath = workspacePaths[workspace] || workspacePaths.coder;
  const fullPath = path.join(basePath, filePath);
  
  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }
  
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    res.json({
      workspace,
      path: filePath,
      content,
      size: fs.statSync(fullPath).size,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Session Search Endpoint
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

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const HOST = process.env.HOST || '0.0.0.0';
httpServer.listen(PORT, HOST, () => {
  console.log(`✅ OpenClaw Dashboard running at http://localhost:${PORT}`);
  console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
  
  // Start watching latest session
  const sessions = sessionWatcher.getAllSessions();
  if (sessions.length > 0) {
    const latest = sessions[0];
    sessionWatcher.watchFile(latest.filepath, latest.agent, latest.sessionId);
    console.log(`[SessionWatcher] watching: ${latest.agent}/${latest.sessionId}`);
  }
});

module.exports = app;
