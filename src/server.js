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

// Cost Analysis Endpoint
app.get('/api/cost', (req, res) => {
  const agents = Object.values(agentStore);
  const totalTokens = agents.reduce((sum, a) => sum + (a.tokens_used || 0), 0);
  
  // Get today's date
  const today = new Date().toDateString();
  
  // Group by model
  const byModel = {};
  for (const agent of agents) {
    const model = agent.model || 'unknown';
    if (!byModel[model]) {
      byModel[model] = { tokens: 0, requests: 0 };
    }
    byModel[model].tokens += agent.tokens_used || 0;
    byModel[model].requests += 1;
  }
  
  // Calculate estimated cost (approximate pricing)
  const pricing = {
    'MiniMax-M2.5': 0.0003,
    'MiniMax-M2.1': 0.0002,
    'MiniMax-M3': 0.0005,
    'claude-3.5-sonnet': 0.003,
    'gpt-4o': 0.0025,
  };
  
  let estimatedCost = 0;
  for (const [model, data] of Object.entries(byModel)) {
    const rate = pricing[model] || 0.00025;
    estimatedCost += (data.tokens / 1000000) * rate * 2;
  }
  
  // Calculate today's usage (approximate based on updated_at)
  const todayTokens = agents.reduce((sum, a) => {
    if (a.updated_at) {
      const updated = new Date(a.updated_at).toDateString();
      if (updated === today) {
        return sum + (a.tokens_used || 0);
      }
    }
    return sum;
  }, 0);
  
  // Projected monthly: assume 30 days, use today's as average if we have data
  const projectedMonthly = todayTokens > 0 ? todayTokens * 30 : totalTokens;
  
  const calculateCost = (tokens) => {
    let cost = 0;
    for (const [model, data] of Object.entries(byModel)) {
      const rate = pricing[model] || 0.00025;
      const modelTokens = Math.floor(tokens / Object.keys(byModel).length);
      cost += (modelTokens / 1000000) * rate * 2;
    }
    return cost;
  };
  
  res.json({
    total_tokens: totalTokens,
    estimated_cost: estimatedCost.toFixed(2),
    by_model: byModel,
    breakdown: {
      today: {
        tokens: todayTokens,
        cost: calculateCost(todayTokens).toFixed(2),
      },
      all_time: {
        tokens: totalTokens,
        cost: estimatedCost.toFixed(2),
      },
      projected_monthly: {
        tokens: projectedMonthly,
        cost: calculateCost(projectedMonthly).toFixed(2),
      }
    }
  });
});

// Rate Limit Monitoring Endpoint
app.get('/api/rate-limits', (req, res) => {
  const agents = Object.values(agentStore);
  
  // Group by model and track usage
  const byModel = {};
  for (const agent of agents) {
    const model = agent.model || 'unknown';
    if (!byModel[model]) {
      byModel[model] = {
        model,
        requests: 0,
        total_tokens: 0,
        active_sessions: 0,
      };
    }
    byModel[model].total_tokens += agent.tokens_used || 0;
    byModel[model].requests += 1;
    if (agent.status === 'working') {
      byModel[model].active_sessions += 1;
    }
  }
  
  // Define rate limits for each model
  const rateLimits = {
    'minimax-portal/MiniMax-M2.5': { rpm: 500, tpm: 150000, daily: 10000000 },
    'minimax-portal/MiniMax-M2.1': { rpm: 500, tpm: 150000, daily: 10000000 },
    'minimax-portal/MiniMax-M3': { rpm: 300, tpm: 100000, daily: 5000000 },
    'anthropic/claude-3.5-sonnet': { rpm: 50, tpm: 200000, daily: 5000000 },
    'openai/gpt-4o': { rpm: 500, tpm: 150000, daily: 10000000 },
  };
  
  const result = Object.values(byModel).map(item => {
    const limits = rateLimits[item.model] || { rpm: 500, tpm: 150000, daily: 10000000 };
    return {
      ...item,
      limits,
      rpm_used: item.active_sessions,
      rpm_percent: Math.round((item.active_sessions / limits.rpm) * 100),
      tpm_percent: Math.round((item.total_tokens / limits.tpm) * 100),
    };
  });
  
  res.json({
    timestamp: new Date().toISOString(),
    models: result,
  });
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
app.get('/api/memory', (req, res) => {
  const memoryPaths = [
    path.join(os.homedir(), '.openclaw', 'workspace-memory'),
    path.join(os.homedir(), '.openclaw', 'workspace-coder', 'memory'),
    path.join(os.homedir(), '.openclaw', 'workspace-nova', 'memory'),
    path.join(os.homedir(), '.openclaw', 'workspace-scout', 'memory'),
  ];
  
  const memories = [];
  
  for (const memPath of memoryPaths) {
    if (fs.existsSync(memPath)) {
      try {
        const files = fs.readdirSync(memPath);
        const wsName = path.basename(path.dirname(memPath));
        
        for (const file of files) {
          if (file.endsWith('.md')) {
            const filePath = path.join(memPath, file);
            const stats = fs.statSync(filePath);
            memories.push({
              id: `${wsName}/${file.replace('.md', '')}`,
              workspace: wsName,
              filename: file,
              path: filePath,
              size: stats.size,
              modified: stats.mtime.toISOString(),
            });
          }
        }
      } catch (e) {
        console.error('Error reading memory path:', memPath, e.message);
      }
    }
  }
  
  // Sort by modified date
  memories.sort((a, b) => new Date(b.modified) - new Date(a.modified));
  
  res.json({
    timestamp: new Date().toISOString(),
    memories: memories.slice(0, 50),  // Limit to 50 most recent
  });
});

// Get specific memory file content - handle paths with slashes
app.get('/api/memory/*', (req, res) => {
  // Get the full path after /api/memory/
  let id = req.params[0];
  
  // Handle workspace/filename format - extract just the filename
  if (id && id.includes('/')) {
    id = id.split('/').pop();
  }
  
  const memoryPaths = [
    path.join(os.homedir(), '.openclaw', 'workspace-memory'),
    path.join(os.homedir(), '.openclaw', 'workspace-coder', 'memory'),
    path.join(os.homedir(), '.openclaw', 'workspace-nova', 'memory'),
    path.join(os.homedir(), '.openclaw', 'workspace-scout', 'memory'),
  ];
  
  for (const memPath of memoryPaths) {
    const filePath = path.join(memPath, `${id}.md`);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const stats = fs.statSync(filePath);
        res.json({
          id,
          content,
          size: stats.size,
          modified: stats.mtime.toISOString(),
        });
        return;
      } catch (e) {
        res.status(500).json({ error: e.message });
        return;
      }
    }
  }
  
  res.status(404).json({ error: 'Memory file not found' });
});

// Save memory file
app.put('/api/memory/:id', (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  
  if (!content) {
    res.status(400).json({ error: 'Content is required' });
    return;
  }
  
  const memoryPaths = [
    path.join(os.homedir(), '.openclaw', 'workspace-memory'),
    path.join(os.homedir(), '.openclaw', 'workspace-coder', 'memory'),
    path.join(os.homedir(), '.openclaw', 'workspace-nova', 'memory'),
    path.join(os.homedir(), '.openclaw', 'workspace-scout', 'memory'),
  ];
  
  for (const memPath of memoryPaths) {
    const filePath = path.join(memPath, `${id}.md`);
    if (fs.existsSync(filePath)) {
      try {
        // Create backup
        const backupPath = filePath + '.backup';
        fs.copyFileSync(filePath, backupPath);
        
        // Write new content
        fs.writeFileSync(filePath, content, 'utf8');
        
        res.json({ success: true, message: 'File saved', backup: backupPath });
        return;
      } catch (e) {
        res.status(500).json({ error: e.message });
        return;
      }
    }
  }
  
  res.status(404).json({ error: 'Memory file not found' });
});

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
