// @ts-nocheck
// Session Search routes
// Extracted from server.js
const { Application } = require('express');

interface Agent {
  agent_id?: string;
  name?: string;
  role?: string;
  avatar?: string;
  color?: string;
  status?: string;
  task?: string;
  output?: string;
  model?: string;
  heartbeat?: string | null;
  tokens_used?: number;
  updated_at?: number | null;
}

interface AgentStore {
  [key: string]: Agent;
}

export default function sessionSearchRoutes(app: Application, { agentStore }: { agentStore: AgentStore }): void {
  // Session Search Endpoint
  app.get('/api/sessions/search', (req, res) => {
    const { q } = req.query;
    const query = String(q || '').toLowerCase();
    
    // Get all sessions from agentStore with defensive coding
    if (!agentStore) {
      return res.json({ query, total: 0, sessions: [], error: 'agentStore not initialized' });
    }
    
    const sessions = Object.values(agentStore).map(agent => ({
      agent_id: agent?.agent_id || 'unknown',
      name: agent?.name || 'Unknown',
      role: agent?.role || 'unknown',
      avatar: agent?.avatar || '🤖',
      color: agent?.color || '#60a5fa',
      status: agent?.status || 'unknown',
      task: agent?.task || '',
      output: agent?.output || '',
      model: agent?.model || 'unknown',
      heartbeat: agent?.heartbeat || null,
      tokens_used: agent?.tokens_used || 0,
      updated_at: agent?.updated_at || null,
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
};
