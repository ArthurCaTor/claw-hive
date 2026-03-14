// Stats routes
// Extracted from server.js
const fs = require('fs');

module.exports = function(app, { agentStore, findConfigPath, getStats }) {
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
      estimatedCost += (data.tokens / 1000000) * rate * 2;
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
};
