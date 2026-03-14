// Agent routes
// Extracted from server.js
const fs = require('fs');

module.exports = function(app, { agentStore, findConfigPath }) {
  // Get all agents
  app.get('/api/agents', (req, res) => {
    res.json(Object.values(agentStore));
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
};
