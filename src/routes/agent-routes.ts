// Agent routes
// Extracted from server.js
import * as fs from 'fs';
import { Application } from 'express';

interface Agent {
  id?: string;
  identity?: { name?: string; emoji?: string };
  workspace?: string;
  model?: string;
  subagents?: string[];
}

interface AgentStore {
  [key: string]: unknown;
}

interface FindConfigPath {
  (): string | null;
}

interface ValidateAgentUpdate {
  (data: unknown): { valid: boolean; errors: string[] };
}

export default function agentRoutes(app: Application, { agentStore, findConfigPath, validateAgentUpdate }: { agentStore: AgentStore; findConfigPath: FindConfigPath; validateAgentUpdate: ValidateAgentUpdate }): void {
  // Get all agents
  app.get('/api/agents', (req, res) => {
    res.json(Object.values(agentStore as Record<string, any>));
  });

  // Get agent config
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
        res.json({ error: 'Failed to read config' });
      }
    } else {
      res.json({ error: 'Config not found' });
    }
  });

  // Get single agent
  app.get('/api/agent/:id', (req, res) => {
    const id = req.params.id;
    if (agentStore[id]) {
      res.json(agentStore[id]);
    } else {
      const configPath = findConfigPath();
      let KNOWN_AGENTS = {};
      if (configPath) {
        try {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          KNOWN_AGENTS = (config.agents?.list || []).reduce((acc, a) => {
            acc[a.id] = a.identity || {};
            return acc;
          }, {});
        } catch (e) {}
      }
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

  // Register agent
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

  // Update agent status
  app.post('/api/agent/status', (req, res) => {
    const { agent_id, status, task, output, tokens_used } = req.body;
    
    const validation = validateAgentUpdate(req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, errors: validation.errors });
    }
    
    if (agentStore[agent_id]) {
      agentStore[agent_id] = {
        ...(agentStore[agent_id] as Record<string, any>)[agent_id],
        ...req.body,
        updated_at: Date.now(),
      };
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Agent not found' });
    }
  });

  // Control agent (pause, resume, restart, stop)
  app.post('/api/agent/control', (req, res) => {
    const { agent_id, action } = req.body;
    
    if (!agent_id || !action) {
      res.status(400).json({ error: 'agent_id and action are required' });
      return;
    }
    
    switch (action) {
      case 'pause':
        if (agentStore[agent_id]) {
          (agentStore[agent_id] as Record<string, any>).status = 'paused';
          (agentStore[agent_id] as Record<string, any>).task = 'Paused by user';
        }
        res.json({ success: true, message: `Agent ${agent_id} paused` });
        break;
      case 'resume':
        if (agentStore[agent_id]) {
          (agentStore[agent_id] as Record<string, any>).status = 'working';
          (agentStore[agent_id] as Record<string, any>).task = 'Resumed';
        }
        res.json({ success: true, message: `Agent ${agent_id} resumed` });
        break;
      case 'restart':
        if (agentStore[agent_id]) {
          (agentStore[agent_id] as Record<string, any>).status = 'working';
          (agentStore[agent_id] as Record<string, any>).task = 'Restarting...';
          (agentStore[agent_id] as Record<string, any>).output = '';
        }
        res.json({ success: true, message: `Agent ${agent_id} restart initiated` });
        break;
      case 'stop':
        if (agentStore[agent_id]) {
          (agentStore[agent_id] as Record<string, any>).status = 'stopped';
          (agentStore[agent_id] as Record<string, any>).task = 'Stopped by user';
        }
        res.json({ success: true, message: `Agent ${agent_id} stopped` });
        break;
      default:
        res.status(400).json({ error: 'Invalid action' });
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
};
