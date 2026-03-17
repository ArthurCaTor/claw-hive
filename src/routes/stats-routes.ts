// Stats routes
// Extracted from server.js
import * as fs from 'fs';
import { Application } from 'express';

interface Agent {
  tokens_used?: number;
  updated_at?: string;
  model?: string;
  status?: string;
}

interface AgentStore {
  [key: string]: Agent;
}

interface FindConfigPath {
  (): string | null;
}

interface GetStats {
  (): unknown;
}

interface LLMTracker {
  getCurrentLLMs?: () => unknown;
  getSwitchHistory?: (agentId?: string, limit?: number) => unknown;
  getHealthMetrics?: (provider: string) => unknown;
  getAllHealthMetrics?: () => unknown;
  getStats?: () => unknown;
}

export default function statsRoutes(app: Application, { agentStore, findConfigPath, getStats, llmTracker }: { agentStore: AgentStore; findConfigPath: FindConfigPath; getStats: GetStats; llmTracker?: LLMTracker }): void {
  // Stats endpoint
  app.get('/api/stats', (req, res) => {
    res.json(getStats());
  });

  // Cost Analysis
  app.get('/api/cost', (req, res) => {
    const agents = Object.values(agentStore);
    const totalTokens = agents.reduce((sum, a) => sum + (a.tokens_used || 0), 0);
    const today = new Date().toDateString();
    
    const byModel = {};
    for (const agent of agents) {
      const model = agent.model || 'unknown';
      if (!byModel[model]) {
        byModel[model] = { tokens: 0, requests: 0 };
      }
      byModel[model].tokens += agent.tokens_used || 0;
      byModel[model].requests += 1;
    }
    
    let pricing = {};
    const configPath = findConfigPath();
    if (configPath) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        pricing = config.pricing || {};
      } catch (e) {}
    }
    
    if (Object.keys(pricing).length === 0) {
      pricing = {
        'MiniMax-M2.5': 0.0003,
        'MiniMax-M2.1': 0.0002,
        'MiniMax-M3': 0.0005,
        'claude-3.5-sonnet': 0.003,
        'gpt-4o': 0.0025,
      };
    }
    
    let estimatedCost = 0;
    for (const [model, data] of Object.entries(byModel)) {
      const rate = pricing[model] || 0.00025;
      estimatedCost += ((data as any).tokens / 1000000) * rate * 2;
    }
    
    const todayTokens = agents.reduce((sum, a) => {
      if (a.updated_at) {
        const updated = new Date(a.updated_at).toDateString();
        if (updated === today) {
          return sum + (a.tokens_used || 0);
        }
      }
      return sum;
    }, 0);
    
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
        today: { tokens: todayTokens, cost: calculateCost(todayTokens).toFixed(2) },
        all_time: { tokens: totalTokens, cost: estimatedCost.toFixed(2) },
        projected_monthly: { tokens: projectedMonthly, cost: calculateCost(projectedMonthly).toFixed(2) }
      }
    });
  });

  // Rate Limits
  app.get('/api/rate-limits', (req, res) => {
    const agents = Object.values(agentStore);
    
    const byModel = {};
    for (const agent of agents) {
      const model = agent.model || 'unknown';
      if (!byModel[model]) {
        byModel[model] = { model, requests: 0, total_tokens: 0, active_sessions: 0 };
      }
      byModel[model].total_tokens += agent.tokens_used || 0;
      byModel[model].requests += 1;
      if (agent.status === 'working') {
        byModel[model].active_sessions += 1;
      }
    }
    
    let rateLimits = {};
    const configPath2 = findConfigPath();
    if (configPath2) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath2, 'utf8'));
        rateLimits = config.rateLimits || {};
      } catch (e) {}
    }
    
    if (Object.keys(rateLimits).length === 0) {
      rateLimits = {
        'minimax-portal/MiniMax-M2.5': { rpm: 500, tpm: 150000, daily: 10000000 },
        'minimax-portal/MiniMax-M2.1': { rpm: 500, tpm: 150000, daily: 10000000 },
        'minimax-portal/MiniMax-M3': { rpm: 300, tpm: 100000, daily: 5000000 },
        'anthropic/claude-3.5-sonnet': { rpm: 50, tpm: 200000, daily: 5000000 },
        'openai/gpt-4o': { rpm: 500, tpm: 150000, daily: 10000000 },
      };
    }
    
    const result = Object.values(byModel).map(item => {
      const limits = rateLimits[(item as any).model] || { rpm: 500, tpm: 150000, daily: 10000000 };
      return { ...(item as any),
        rpm_percent: Math.round(((item as any).active_sessions / limits.rpm) * 100),
        tpm_percent: Math.round(((item as any).total_tokens / limits.tpm) * 100),
      };
    });
    
    res.json({
      timestamp: new Date().toISOString(),
      models: result,
    });
  });

  // LLM Routes
  if (llmTracker) {
    // Get current LLM for all agents
    app.get('/api/llms/current', (_req, res) => {
      res.json(llmTracker.getCurrentLLMs());
    });

    // Get LLM switch history
    app.get('/api/llms/switches', (req, res) => {
      const agentId = String(req.query.agent_id);
      const limit = parseInt(String(req.query.limit)) || 50;
      res.json(llmTracker.getSwitchHistory(agentId, limit));
    });

    // Get LLM health metrics
    app.get('/api/llms/health', (req, res) => {
      const provider = String(req.query.provider);
      if (provider) {
        res.json(llmTracker.getHealthMetrics(provider));
      } else {
        res.json(llmTracker.getAllHealthMetrics());
      }
    });

    // Get LLM stats
    app.get('/api/llms/stats', (_req, res) => {
      res.json(llmTracker.getStats());
    });
  }
};
