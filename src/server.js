#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const fs = require('fs');

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
const ACTIVE_THRESHOLD = 120000;

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
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    openclaw_accessible: true,
  });
});

app.get('/api/agents', (req, res) => {
  res.json(Object.values(agentStore));
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

app.get('/api/stats', (req, res) => {
  res.json(getStats());
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

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const HOST = process.env.HOST || '0.0.0.0';
httpServer.listen(PORT, HOST, () => {
  console.log(`✅ OpenClaw Dashboard running at http://localhost:${PORT}`);
  console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
});

module.exports = app;
