#!/usr/bin/env node

/**
 * Sync Worker - Claw-Hive
 * 
 * Monitors JSONL files and syncs to PostgreSQL
 * 
 * Usage: node index.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import chokidar from 'chokidar';

const { Client } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

// Configuration
const CONFIG = {
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/openclaw_memory',
  batchSize: 100,
  flushIntervalMs: 5000,
  checkpointFile: path.join(ROOT_DIR, '.sync-checkpoint.json'),
  watchedDirs: [
    path.join(ROOT_DIR, 'captures'),
    path.join(ROOT_DIR, 'events'),
    path.join(ROOT_DIR, 'sessions'),
  ],
};

// State
let dbClient = null;
let buffer = [];
let flushTimer = null;
let checkpoint = {};
let isRunning = false;

// Logger
function log(level, ...args) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}]`, ...args);
}

const info = (...a) => log('INFO', ...a);
const warn = (...a) => log('WARN', ...a);
const error = (...a) => log('ERROR', ...a);

// Checkpoint management
function loadCheckpoint() {
  try {
    if (fs.existsSync(CONFIG.checkpointFile)) {
      checkpoint = JSON.parse(fs.readFileSync(CONFIG.checkpointFile, 'utf-8'));
      info('Loaded checkpoint:', Object.keys(checkpoint).length, 'files');
    }
  } catch (e) {
    warn('Could not load checkpoint:', e.message);
    checkpoint = {};
  }
}

function saveCheckpoint() {
  try {
    fs.writeFileSync(CONFIG.checkpointFile, JSON.stringify(checkpoint, null, 2));
  } catch (e) {
    error('Failed to save checkpoint:', e.message);
  }
}

function updateCheckpoint(filePath, offset) {
  checkpoint[filePath] = offset;
  // Debounce save
  if (!saveCheckpoint.timer) {
    saveCheckpoint.timer = setTimeout(() => {
      saveCheckpoint();
      saveCheckpoint.timer = null;
    }, 1000);
  }
}

// Database connection
async function connectDB() {
  try {
    dbClient = new Client({ connectionString: CONFIG.databaseUrl });
    await dbClient.connect();
    info('Connected to PostgreSQL');
    
    // Create tables if not exist
    await createTables();
  } catch (e) {
    error('Failed to connect to PostgreSQL:', e.message);
    process.exit(1);
  }
}

async function createTables() {
  await dbClient.query(`
    CREATE TABLE IF NOT EXISTS captures (
      id SERIAL PRIMARY KEY,
      agent_id TEXT,
      model TEXT,
      provider TEXT,
      tokens_in INT DEFAULT 0,
      tokens_out INT DEFAULT 0,
      latency_ms INT,
      status_code INT,
      request_json JSONB,
      response_json JSONB,
      cost_usd DECIMAL(10,6),
      raw_json JSONB,
      source_file TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await dbClient.query(`
    CREATE TABLE IF NOT EXISTS llm_switches (
      id SERIAL PRIMARY KEY,
      agent_id TEXT NOT NULL,
      from_provider TEXT,
      from_model TEXT,
      to_provider TEXT,
      to_model TEXT,
      switched_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await dbClient.query(`
    CREATE INDEX IF NOT EXISTS idx_captures_agent ON captures(agent_id)
  `);
  await dbClient.query(`
    CREATE INDEX IF NOT EXISTS idx_captures_created ON captures(created_at)
  `);
  await dbClient.query(`
    CREATE INDEX IF NOT EXISTS idx_captures_model ON captures(model)
  `);

  info('Database tables ready');
}

// Flush buffer to database (one at a time for reliability)
async function flushBuffer() {
  if (buffer.length === 0) return;
  
  const batch = buffer.splice(0);
  let success = 0;
  
  try {
    for (const item of batch) {
      try {
        await dbClient.query(`
          INSERT INTO claw_hive.captures 
          (agent_id, model, provider, tokens_in, tokens_out, latency_ms, status_code, cost_usd, source_file, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        `, [
          item.agent_id || null,
          item.model || null,
          item.provider || null,
          item.tokens_in || 0,
          item.tokens_out || 0,
          item.latency_ms || null,
          item.status_code || null,
          item.cost || 0,
          item.source || null
        ]);
        success++;
      } catch (e) {
        // Skip this record, continue with next
        warn('Failed to insert record:', e.message);
      }
    }
    
    info(`Synced ${success}/${batch.length} records to PostgreSQL`);
  } catch (e) {
    error('Fatal batch error:', e.message);
    buffer.unshift(...batch);
  }
}

// Queue item for database insert
function queueCapture(capture, sourceFile) {
  // Map from capture file format to database schema
  const mapped = {
    agent_id: capture.agent || capture.agent_id || null,
    model: capture.req?.body?.model || capture.model || null,
    provider: capture.provider || null,
    tokens_in: capture.req?.tokens || capture.tokens_in || 0,
    tokens_out: capture.res?.tokens || capture.tokens_out || 0,
    latency_ms: capture.latency_ms || null,
    status_code: capture.res?.status || capture.status_code || null,
    cost: capture.cost || 0,
    source: sourceFile,
  };
  
  buffer.push(mapped);
  
  if (buffer.length >= CONFIG.batchSize) {
    flushBuffer();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flushBuffer, CONFIG.flushIntervalMs);
  }
}

// Read new lines from file (with size limit)
async function readNewLines(filePath, lastOffset = 0, maxLines = 1000) {
  try {
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    
    if (fileSize <= lastOffset) {
      return { offset: lastOffset, lines: [] };
    }
    
    // Limit read size for very large files (10MB max)
    const maxBytes = 10 * 1024 * 1024;
    const bytesToRead = Math.min(fileSize - lastOffset, maxBytes);
    
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(bytesToRead);
    fs.readSync(fd, buffer, 0, bytesToRead, lastOffset);
    fs.closeSync(fd);
    
    const content = buffer.toString('utf-8');
    let lines = content.split('\n').filter(line => line.trim());
    
    // If file is still larger than what we read, don't update offset
    let newOffset = lastOffset + bytesToRead;
    if (lines.length >= maxLines && fileSize > newOffset) {
      info(`File ${filePath}: ${lines.length} new lines, will continue next scan`);
      newOffset = lastOffset; // Don't advance, will retry
    }
    
    return { offset: newOffset, lines };
  } catch (e) {
    error('Error reading file:', filePath, e.message);
    return { offset: lastOffset, lines: [] };
  }
}

// Process a single line
function processLine(line, sourceFile) {
  try {
    const data = JSON.parse(line);
    queueCapture(data, sourceFile);
  } catch (e) {
    warn('Invalid JSON line:', e.message);
  }
}

// Start file watcher
async function startWatcher() {
  info('Starting file watcher...');
  info('Watching directories:', CONFIG.watchedDirs);
  
  // Initial scan of all files
  for (const dir of CONFIG.watchedDirs) {
    if (!fs.existsSync(dir)) {
      warn('Directory does not exist:', dir);
      continue;
    }
    
    const files = fs.readdirSync(dir, { recursive: true })
      .filter(f => f.endsWith('.jsonl'));
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const lastOffset = checkpoint[filePath] || 0;
      
      if (lastOffset === 0) {
        info('Initial scan:', filePath);
      }
      
      const { offset, lines } = await readNewLines(filePath, lastOffset);
      
      for (const line of lines) {
        processLine(line, filePath);
      }
      
      if (lines.length > 0) {
        updateCheckpoint(filePath, offset);
      }
    }
  }
  
  // Flush initial buffer
  await flushBuffer();
  
  // Start watching for changes
  const watcher = chokidar.watch(CONFIG.watchedDirs, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 100,
    },
  });
  
  watcher.on('change', async (filePath) => {
    if (!filePath.endsWith('.jsonl')) return;
    
    info('File changed:', filePath);
    const lastOffset = checkpoint[filePath] || 0;
    const { offset, lines } = await readNewLines(filePath, lastOffset);
    
    for (const line of lines) {
      processLine(line, filePath);
    }
    
    if (lines.length > 0) {
      updateCheckpoint(filePath, offset);
      await flushBuffer();
    }
  });
  
  info('File watcher started');
}

// Graceful shutdown
async function shutdown() {
  info('Shutting down...');
  isRunning = false;
  
  if (flushTimer) {
    clearTimeout(flushTimer);
  }
  
  await flushBuffer();
  
  if (dbClient) {
    await dbClient.end();
  }
  
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Main
async function main() {
  info('='.repeat(50));
  info('Claw-Hive Sync Worker v1.0');
  info('='.repeat(50));
  
  loadCheckpoint();
  await connectDB();
  await startWatcher();
  
  info('Sync Worker is running');
  isRunning = true;
}

main().catch(e => {
  error('Fatal error:', e);
  process.exit(1);
});
