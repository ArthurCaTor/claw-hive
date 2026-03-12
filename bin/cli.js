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

program.parse();
