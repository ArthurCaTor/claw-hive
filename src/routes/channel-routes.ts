// @ts-nocheck
// Channel routes
// Extracted from server.js
const fs = require('fs');
const { Application } = require('express');

interface ChannelSettings {
  enabled?: boolean;
  type?: string;
  account_id?: string;
  bot_token?: string;
  api_key?: string;
  secret?: string;
  [key: string]: unknown;
}

interface Channel {
  name: string;
  enabled: boolean;
  type: string;
  account_id: string | null;
  config: Record<string, unknown>;
}

interface FindConfigPath {
  (): string | null;
}

module.exports = function channelRoutes(app: Application, { findConfigPath }: { findConfigPath: FindConfigPath }): void {
  // Get channels config
  app.get('/api/channels', (req, res) => {
    const configPath = findConfigPath();
    if (configPath) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const channels = config.channels || {};
        
        const channelList: Channel[] = Object.entries(channels).map(([name, settings]) => ({
          name,
          enabled: (settings as ChannelSettings).enabled || false,
          type: (settings as ChannelSettings).type || name,
          account_id: (settings as ChannelSettings).account_id || null,
          config: {
            bot_token: (settings as ChannelSettings).bot_token ? '***configured***' : null,
            api_key: (settings as ChannelSettings).api_key ? '***configured***' : null,
            ...Object.fromEntries(
              Object.entries(settings as Record<string, unknown>).filter(([k]) => !['bot_token', 'api_key', 'secret'].includes(k))
            ),
          },
        }));
        
        res.json({
          total: channelList.length,
          channels: channelList,
        });
      } catch (e) {
        res.json({ error: 'Failed to read channel config' });
      }
    } else {
      res.json({ error: 'Config not found' });
    }
  });
};
