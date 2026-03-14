#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');

program
  .name('openclaw-dashboard')
  .description('Real-time dashboard for OpenClaw agents')
  .version('1.0.0');

program
  .command('start')
  .description('Start the dashboard server')
  .option('-p, --port <port>', 'Port to listen on', '8080')
  .option('--no-open', 'Do not open browser automatically')
  .action((options) => {
    process.env.PORT = options.port;
    require('../src/server.js');
    
    if (options.open) {
      setTimeout(() => {
        try {
          require('open')(`http://localhost:${options.port}`);
        } catch (e) {
          console.log('Could not open browser automatically');
        }
      }, 1000);
    }
    
    console.log(`✅ OpenClaw Dashboard running at http://localhost:${options.port}`);
  });

// Sessions command - list all historical sessions
program
  .command('sessions')
  .description('List all historical sessions')
  .option('-a, --agent <name>', 'Filter by agent name')
  .option('-l, --limit <number>', 'Limit number of sessions', '20')
  .action((options) => {
    const fs = require('fs');
    const path = require('path');
    const homeDir = process.env.HOME || '/home/arthur';
    const agentsDir = path.join(homeDir, '.openclaw', 'agents');
    
    let allSessions = [];
    
    if (fs.existsSync(agentsDir)) {
      const agents = fs.readdirSync(agentsDir);
      for (const agent of agents) {
        const sessionsDir = path.join(agentsDir, agent, 'sessions');
        if (fs.existsSync(sessionsDir)) {
          const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'));
          for (const file of files) {
            const sessionId = file.replace('.jsonl', '');
            const stats = fs.statSync(path.join(sessionsDir, file));
            allSessions.push({
              agent,
              sessionId,
              mtime: stats.mtime,
            });
          }
        }
      }
    }
    
    // Filter by agent if specified
    let filtered = allSessions;
    if (options.agent) {
      filtered = allSessions.filter(s => s.agent === options.agent);
    }
    
    // Sort by mtime descending (newest first)
    filtered.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
    
    // Limit
    filtered = filtered.slice(0, parseInt(options.limit));
    
    // Format output
    console.log('\n📋 Historical Sessions\n');
    console.log('Agent'.padEnd(15) + 'Session ID'.padEnd(40) + 'Last Modified');
    console.log('-'.repeat(80));
    
    for (const s of filtered) {
      const agent = s.agent.padEnd(15);
      const sessionId = s.sessionId.substring(0, 38).padEnd(40);
      const mtime = s.mtime ? new Date(s.mtime).toLocaleString() : 'N/A';
      console.log(agent + sessionId + mtime);
    }
    
    console.log('\n');
  });



// Tail command - show session output
program
  .command('tail')
  .description('Show session output')
  .argument('[sessionId]', 'Session ID to show')
  .option('-a, --agent <name>', 'Agent name (gets latest session)')
  .option('-n, --lines <number>', 'Number of recent messages to show', '5')
  .action((sessionId, options) => {
    const fs = require('fs');
    const path = require('path');
    const homeDir = process.env.HOME || '/home/arthur';
    const numLines = parseInt(options.lines) || 5;
    
    let targetSession = sessionId;
    
    if (!targetSession && options.agent) {
      const agentsDir = path.join(homeDir, '.openclaw', 'agents');
      const sessionsDir = path.join(agentsDir, options.agent, 'sessions');
      if (fs.existsSync(sessionsDir)) {
        const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'));
        if (files.length > 0) {
          const withStats = files.map(f => ({
            file: f,
            mtime: fs.statSync(path.join(sessionsDir, f)).mtime
          }));
          withStats.sort((a, b) => b.mtime - a.mtime);
          targetSession = withStats[0].file.replace('.jsonl', '');
        }
      }
    }
    
    if (!targetSession) {
      console.log('No session found. Specify session ID or agent name.');
      process.exit(1);
    }
    
    const filepath = path.join(homeDir, '.openclaw', 'agents', options.agent || 'coder', 'sessions', targetSession + '.jsonl');
    
    if (!fs.existsSync(filepath)) {
      console.log('Session file not found:', filepath);
      process.exit(1);
    }
    
    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.trim().split('\n');
    
    // Parse and format each line as readable messages
    const entries = [];
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const type = entry.type;
        const ts = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '';
        
        if (type === 'message' && entry.message) {
          const role = entry.message.role || '?';
          const msg = entry.message.content || [];
          for (const block of msg) {
            if (block.type === 'text') {
              const text = block.text || '';
              entries.push(`[${ts}] ${role}: ${text.substring(0, 200)}`);
            }
          }
        }
      } catch (e) {
        // Skip invalid lines
      }
    }
    
    // Show last N entries
    const lastEntries = entries.slice(-numLines);
    for (const e of lastEntries) {
      console.log(e);
    }
  });

// Quota command - show API quota usage
program
  .command('quota')
  .description('Show API quota usage')
  .option('-a, --agent <name>', 'Agent name')
  .action((options) => {
    const { sessionWatcher } = require('../src/services/session-watcher');
    const sessions = sessionWatcher.getAllSessions();
    console.log('\nAPI Quota Usage\n');
    console.log('Agent'.padEnd(15) + 'Requests'.padEnd(12) + 'Status');
    console.log('-'.repeat(40));
    const byAgent = {};
    for (const s of sessions) {
      if (!byAgent[s.agent]) byAgent[s.agent] = { requests: 0 };
      byAgent[s.agent].requests++;
    }
    for (const [agent, data] of Object.entries(byAgent)) {
      const status = data.requests > 100 ? 'High' : 'Normal';
      console.log(agent.padEnd(15) + String(data.requests).padEnd(12) + status);
    }
    console.log('\n');
  });

program.parse();
