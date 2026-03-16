// Session Watcher - Read local .jsonl files + fs.watch for real-time updates
const fs = require('fs');
const path = require('path');
const os = require('os');

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || path.join(os.homedir(), '.openclaw');

class SessionWatcher {
  constructor() {
    this.listeners = new Set();
    this.activeWatcher = null;
    this.filePosition = 0;
    this.watchedFile = '';
    this.watchedAgent = '';
    this.watchedSessionId = '';
    // Auto-switch polling
    this.pollInterval = null;
    this.POLL_INTERVAL_MS = 30000; // Check every 30 seconds
  }

  // Start polling for new sessions
  startAutoSwitch() {
    if (this.pollInterval) return; // Already running
    
    this.pollInterval = setInterval(() => {
      const sessions = this.getAllSessions();
      if (sessions.length === 0) return;
      
      const latest = sessions[0];
      // Check if there's a newer session than what we're watching
      if (latest.filepath !== this.watchedFile) {
        console.log(`[SessionWatcher] New session detected, switching to: ${latest.agent}/${latest.sessionId}`);
        this.watchFile(latest.filepath, latest.agent, latest.sessionId);
      }
    }, this.POLL_INTERVAL_MS);
    
    console.log('[SessionWatcher] Auto-switch enabled, checking every 30s');
  }

  // Stop polling
  stopAutoSwitch() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      console.log('[SessionWatcher] Auto-switch disabled');
    }
  }

  // List all sessions across all agents
  getAllSessions() {
    const agentsDir = path.join(OPENCLAW_DIR, 'agents');
    const sessions = [];

    if (!fs.existsSync(agentsDir)) return sessions;

    try {
      const agentDirs = fs.readdirSync(agentsDir).filter(name => {
        const stat = fs.statSync(path.join(agentsDir, name));
        return stat.isDirectory();
      });

      for (const agent of agentDirs) {
        const sessionsDir = path.join(agentsDir, agent, 'sessions');
        if (!fs.existsSync(sessionsDir)) continue;

        try {
          const files = fs.readdirSync(sessionsDir).filter(f =>
            f.endsWith('.jsonl') && !f.includes('.reset') && !f.startsWith('.')
          );

          for (const file of files) {
            const filepath = path.join(sessionsDir, file);
            try {
              const stat = fs.statSync(filepath);
              sessions.push({
                agent,
                sessionId: file.replace('.jsonl', ''),
                filepath,
                mtime: stat.mtime,
              });
            } catch (e) {}
          }
        } catch (e) {}
      }
    } catch (e) {}

    // Sort by mtime, newest first
    return sessions.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  }

  // Read all events from a session file
  readSession(filepath) {
    if (!fs.existsSync(filepath)) return [];
    try {
      const content = fs.readFileSync(filepath, 'utf-8');
      return content
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          try { return JSON.parse(line) } catch { return null }
        })
        .filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  // Watch a specific session file
  watchFile(filepath, agent, sessionId) {
    // Stop previous watcher
    if (this.activeWatcher) {
      try { this.activeWatcher.close(); } catch (e) {}
      this.activeWatcher = null;
    }

    this.watchedFile = filepath;
    this.watchedAgent = agent;
    this.watchedSessionId = sessionId;

    try {
      const stat = fs.statSync(filepath);
      this.filePosition = stat.size;

      this.activeWatcher = fs.watch(filepath, (eventType) => {
        if (eventType !== 'change') return;
        
        try {
          const currentSize = fs.statSync(filepath).size;
          if (currentSize <= this.filePosition) return;

          // Read only new bytes
          const fd = fs.openSync(filepath, 'r');
          const newBytes = currentSize - this.filePosition;
          const buf = Buffer.alloc(newBytes);
          fs.readSync(fd, buf, 0, newBytes, this.filePosition);
          fs.closeSync(fd);
          this.filePosition = currentSize;

          // Parse new lines and broadcast
          buf.toString('utf-8')
            .split('\n')
            .filter(line => line.trim())
            .forEach(line => {
              try {
                const event = JSON.parse(line);
                this.listeners.forEach(cb =>
                  cb({ ...event, _agent: agent, _sessionId: sessionId })
                );
              } catch (e) {}
            });
        } catch (e) {
          console.error('[SessionWatcher] read error:', e);
        }
      });

      console.log(`[SessionWatcher] watching: ${agent}/${sessionId}`);
    } catch (e) {
      console.error('[SessionWatcher] watch error:', e);
    }
  }

  // Watch the latest session automatically
  watchLatest() {
    const sessions = this.getAllSessions();
    if (sessions.length > 0) {
      this.watchFile(sessions[0].filepath, sessions[0].agent, sessions[0].sessionId);
    }
  }

  subscribe(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  getWatchedFile() {
    return this.watchedFile;
  }

  getWatchedInfo() {
    return {
      filepath: this.watchedFile,
      agent: this.watchedAgent,
      sessionId: this.watchedSessionId,
    };
  }
}

const sessionWatcher = new SessionWatcher();

// Start watching latest session on load
setTimeout(() => {
  console.log('[SessionWatcher] Starting...');
  sessionWatcher.watchLatest();
  sessionWatcher.startAutoSwitch();
}, 1000);

// Cleanup on exit
process.on('exit', () => {
  if (sessionWatcher.activeWatcher) {
    try { sessionWatcher.activeWatcher.close(); } catch (e) {}
  }
});

module.exports = { sessionWatcher, OPENCLAW_DIR };
