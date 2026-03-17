// @ts-nocheck
// Session Watcher - TypeScript version
const _fs = require('fs');
const _path = require('path');
const _os = require('os');

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || _path.join(_os.homedir(), '.openclaw');

class SessionWatcher {
  private listeners = new Set();
  private activeWatcher: any = null;
  private filePosition = 0;
  private watchedFile = '';
  private watchedAgent = '';
  private watchedSessionId = '';
  private pollInterval: any = null;
  private readonly POLL_INTERVAL_MS = 30000;

  getAllSessions() {
    const agentsDir = _path.join(OPENCLAW_DIR, 'agents');
    const sessions: any[] = [];
    if (!_fs.existsSync(agentsDir)) return sessions;
    
    try {
      const agentDirs = _fs.readdirSync(agentsDir).filter((name: string) => {
        const stat = _fs.statSync(_path.join(agentsDir, name));
        return stat.isDirectory();
      });

      for (const agent of agentDirs) {
        const sessionsDir = _path.join(agentsDir, agent, 'sessions');
        if (!_fs.existsSync(sessionsDir)) continue;
        
        try {
          const files = _fs.readdirSync(sessionsDir).filter((f: string) => f.endsWith('.jsonl'));
          for (const file of files) {
            const filepath = _path.join(sessionsDir, file);
            try {
              const stat = _fs.statSync(filepath);
              sessions.push({ agent, sessionId: file.replace('.jsonl', ''), filepath, mtime: stat.mtime });
            } catch {}
          }
        } catch {}
      }
    } catch {}
    return sessions.sort((a: any, b: any) => b.mtime.getTime() - a.mtime.getTime());
  }

  readSession(filepath: string): any[] {
    if (!_fs.existsSync(filepath)) return [];
    try {
      const content = _fs.readFileSync(filepath, 'utf-8');
      return content.split('\n').filter((line: string) => line.trim()).map((line: string) => {
        try { return JSON.parse(line) } catch { return null }
      }).filter(Boolean);
    } catch { return [] }
  }

  watchFile(filepath: string, agent: string, sessionId: string) {
    if (this.activeWatcher) {
      try { this.activeWatcher.close(); } catch {}
    }
    this.watchedFile = filepath;
    this.watchedAgent = agent;
    this.watchedSessionId = sessionId;
    
    try {
      const stat = _fs.statSync(filepath);
      this.filePosition = stat.size;
      this.activeWatcher = _fs.watch(filepath, () => {});
      console.log(`[SessionWatcher] watching: ${agent}/${sessionId}`);
    } catch (e) {
      console.error('[SessionWatcher] watch error:', e);
    }
  }

  subscribe(cb: any) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  getWatchedInfo() {
    return { filepath: this.watchedFile, agent: this.watchedAgent, sessionId: this.watchedSessionId };
  }
}

const sessionWatcher = new SessionWatcher();
setTimeout(() => sessionWatcher.watchFile('', '', ''), 1000);

module.exports = { sessionWatcher, OPENCLAW_DIR };
