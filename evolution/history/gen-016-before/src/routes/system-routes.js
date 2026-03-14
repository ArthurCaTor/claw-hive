// Gateway, Debug, Session, and Cron routes
// Extracted from server.js
const fs = require('fs');
const path = require('path');

module.exports = function(app, { sessionWatcher, debugService, OPENCLAW_DIR, findConfigPath }) {
  // Gateway status
  app.get('/api/gateway/status', (req, res) => {
    const info = sessionWatcher.getWatchedInfo();
    res.json({ 
      connected: !!info.filepath,
      agent: info.agent,
      sessionId: info.sessionId,
    });
  });

  // Debug status
  app.get('/api/debug/status', (req, res) => {
    res.json(debugService.getStatus());
  });

  // Start debug mode
  app.post('/api/debug/start', async (req, res) => {
    try {
      const result = await debugService.start();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Stop debug mode
  app.post('/api/debug/stop', async (req, res) => {
    try {
      const result = await debugService.stop();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Emergency rollback
  app.post('/api/debug/rollback', async (req, res) => {
    try {
      const result = await debugService.emergencyRollback();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get debug recordings
  app.get('/api/debug/recordings', async (req, res) => {
    try {
      const data = await debugService.getRecordings();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get all sessions
  app.get('/api/sessions', (req, res) => {
    const sessions = sessionWatcher.getAllSessions();
    const grouped = {};
    for (const s of sessions) {
      if (!grouped[s.agent]) grouped[s.agent] = [];
      grouped[s.agent].push({
        sessionId: s.sessionId,
        mtime: s.mtime,
      });
    }
    res.json(grouped);
  });

  // Get single session
  app.get('/api/sessions/:Agent/:sessionId', (req, res) => {
    const { agent, sessionId } = req.params;
    const filepath = path.join(OPENCLAW_DIR, 'agents', agent, 'sessions', `${sessionId}.jsonl`);
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const events = sessionWatcher.readSession(filepath);
    res.json({ agent, sessionId, events });
  });

  // Watch a session
  app.post('/api/sessions/:Agent/:sessionId/watch', (req, res) => {
    const { agent, sessionId } = req.params;
    const filepath = path.join(OPENCLAW_DIR, 'agents', agent, 'sessions', `${sessionId}.jsonl`);
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    sessionWatcher.watchFile(filepath, agent, sessionId);
    res.json({ ok: true, watching: `${agent}/${sessionId}` });
  });

  // Cron jobs
  app.get('/api/cron', (req, res) => {
    const configPath = findConfigPath();
    let cronJobs = [];
    
    if (configPath) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const env = config.env?.vars || {};
        
        cronJobs = [
          {
            id: 'daily-report',
            name: 'Daily Report',
            schedule: env.REPORT_TIME ? `${env.REPORT_TIME.replace(':', ' ')} * *` : '0 9 * * *',
            status: env.SEND_DAILY_REPORT === 'true' ? 'active' : 'idle',
          },
          {
            id: 'health-check',
            name: 'Health Check',
            schedule: '*/15 * * * *',
            status: 'active',
          },
        ];
      } catch (e) {
        // ignore
      }
    }
    
    res.json({ jobs: cronJobs });
  });
};
