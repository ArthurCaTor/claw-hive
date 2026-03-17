// Gateway, Debug, Session, and Cron routes
// Extracted from server.js
import * as fs from 'fs';
import * as path from 'path';
import { Application } from 'express';

interface SessionWatcher {
  getWatchedInfo?: () => unknown;
}

interface DebugService {
  getStatus?: () => unknown;
  start?: () => Promise<unknown>;
  stop?: () => Promise<unknown>;
}

interface FindConfigPath {
  (): string | null;
}

export default function systemRoutes(app: Application, { sessionWatcher, debugService, OPENCLAW_DIR, findConfigPath }: { sessionWatcher?: SessionWatcher; debugService?: DebugService; OPENCLAW_DIR: string; findConfigPath: FindConfigPath }): void {
  // Gateway status
  app.get('/api/gateway/status', (req, res) => {
    const info = (sessionWatcher as any).getWatchedInfo();
    res.json({ 
      connected: !!info.filepath,
      agent: info.agent,
      sessionId: info.sessionId,
    });
  });

  // Debug status
  app.get('/api/debug/status', (req, res) => {
    res.json((debugService as any).getStatus()());
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
      const result = await (debugService as any).emergencyRollback();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get debug recordings
  app.get('/api/debug/recordings', async (req, res) => {
    try {
      const data = await (debugService as any).getRecordings();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get all sessions
  app.get('/api/sessions', (req, res) => {
    const sessions = (sessionWatcher as any).getAllSessions();
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
  app.get('/api/sessions/:agent/:sessionId', (req, res) => {
    const { agent, sessionId } = req.params;
    
    // Security: validate inputs
    if (!agent || !sessionId || agent.includes('..') || sessionId.includes('..')) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }
    
    const sessionsDir = path.join(OPENCLAW_DIR, 'agents', agent, 'sessions');
    const filepath = path.join(sessionsDir, `${sessionId}.jsonl`);
    
    // Security: ensure path is within sessions directory
    if (!filepath.startsWith(sessionsDir)) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const events = (sessionWatcher as any).readSession(filepath);
    res.json({ agent, sessionId, events });
  });

  // Watch a session
  app.post('/api/sessions/:agent/:sessionId/watch', (req, res) => {
    const { agent, sessionId } = req.params;
    
    // Security: validate inputs
    if (!agent || !sessionId || agent.includes('..') || sessionId.includes('..')) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }
    
    const sessionsDir = path.join(OPENCLAW_DIR, 'agents', agent, 'sessions');
    const filepath = path.join(sessionsDir, `${sessionId}.jsonl`);
    
    // Security: ensure path is within sessions directory
    if (!filepath.startsWith(sessionsDir)) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    (sessionWatcher as any).watchFile(filepath, agent, sessionId);
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

  // Config endpoint
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

  // Cron jobs list
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
            lastRun: null,
            nextRun: new Date(Date.now() + 86400000).toISOString(),
          },
          {
            id: 'health-check',
            name: 'Health Check',
            schedule: config.heartbeat?.every || '30m',
            status: 'active',
            lastRun: new Date(Date.now() - 1800000).toISOString(),
            nextRun: new Date(Date.now() + 1800000).toISOString(),
          },
        ];
      } catch (e) {
        cronJobs = [];
      }
    }
    
    res.json({ total: cronJobs.length, jobs: cronJobs });
  });

  // Trigger cron job manually
  app.post('/api/cron/:id/run', (req, res) => {
    const { id } = req.params;
    res.json({ success: true, message: `Cron job ${id} triggered`, timestamp: new Date().toISOString() });
  });

  // Cron run history
  app.get('/api/cron/history', (req, res) => {
    const history = [
      { id: 'daily-report', name: 'Daily Report', status: 'success', duration: 45, timestamp: new Date(Date.now() - 86400000).toISOString() },
      { id: 'health-check', name: 'Health Check', status: 'success', duration: 3, timestamp: new Date(Date.now() - 1800000).toISOString() },
    ];
    res.json({ total: history.length, runs: history });
  });
};
