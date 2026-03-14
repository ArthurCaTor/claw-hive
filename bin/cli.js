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
    const { sessionWatcher } = require('../src/services/session-watcher');
    const sessions = sessionWatcher.getAllSessions();
    
    // Filter by agent if specified
    let filtered = sessions;
    if (options.agent) {
      filtered = sessions.filter(s => s.agent === options.agent);
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
      const agent = (s.agent || 'unknown').padEnd(15);
      const sessionId = (s.sessionId || 'unknown').substring(0, 38).padEnd(40);
      const mtime = s.mtime ? new Date(s.mtime).toLocaleString() : 'N/A';
      console.log(agent + sessionId + mtime);
    }
    
    console.log('\n');
  });

program.parse();
