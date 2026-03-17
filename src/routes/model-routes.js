// Model routes
// Extracted from server.js
const fs = require('fs');

module.exports = function(app, { findConfigPath }) {
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
        res.json({ error: 'Failed to read model config'});
      }
    } else {
      res.json({ error: 'Config not found' });
    }
  });
};
