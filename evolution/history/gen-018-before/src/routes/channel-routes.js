// Channel routes
// Extracted from server.js
const fs = require('fs');

module.exports = function(app, { findConfigPath }) {
  // Get channels config
  app.get('/api/channels', (req, res) => {
    const configPath = findConfigPath();
    if (configPath) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const channels = config.channels || {};
        
        const channelList = Object.entries(channels).map(([name, settings]) => ({
          name,
          enabled: settings.enabled || false,
          type: settings.type || name,
          account_id: settings.account_id || null,
          config: {
            bot_token: settings.bot_token ? '***configured***' : null,
            api_key: settings.api_key ? '***configured***' : null,
            ...Object.fromEntries(
              Object.entries(settings).filter(([k]) => !['bot_token', 'api_key', 'secret'].includes(k))
            ),
          },
        }));
        
        res.json({
          total: channelList.length,
          channels: channelList,
        });
      } catch (e) {
        res.json({ error: e.message });
      }
    } else {
      res.json({ error: 'Config not found' });
    }
  });
};
