/**
 * @file services/capture-file-writer.js
 * @description Writes API captures to JSONL files, one per agent per day
 *              将 API 捕获写入 JSONL 文件，每个 Agent 每天一个文件
 * 
 * Key design principles:
 * 关键设计原则：
 * 1. Non-blocking async writes (不阻塞的异步写入)
 * 2. Per-agent file isolation (每 Agent 文件隔离)
 * 3. Daily file rotation (每日文件轮转)
 * 4. Buffer writes for performance (缓冲写入以提高性能)
 */

const fs = require('fs');
const path = require('path');

class CaptureFileWriter {
  constructor(options = {}) {
    // Base directory for capture files
    this.baseDir = options.baseDir || path.join(process.cwd(), 'captures');
    
    // Flush interval in ms (default: 1 second)
    this.flushInterval = options.flushInterval || 1000;
    
    // Write buffer (batch writes for performance)
    this.writeBuffer = [];
    
    // Open file streams (reuse for efficiency)
    this.streams = new Map(); // key: "agent-YYYY-MM-DD", value: WriteStream
    
    // Current date string (for file rotation)
    this.currentDate = this.getDateString();
    
    // Flush timer
    this.flushTimer = null;
    
    // Initialized flag
    this.initialized = false;
  }

  /**
   * Initialize the writer
   */
  async initialize() {
    if (this.initialized) return;
    
    console.log(`[CaptureFileWriter] Initializing with baseDir: ${this.baseDir}`);
    
    // Create base directory if not exists
    await fs.promises.mkdir(this.baseDir, { recursive: true });
    await fs.promises.mkdir(path.join(this.baseDir, '_metadata'), { recursive: true });
    
    // Start flush timer
    this.startFlushTimer();
    
    // Start date rotation checker
    this.startDateRotationChecker();
    
    this.initialized = true;
    console.log('[CaptureFileWriter] Initialized successfully');
  }

  /**
   * Write a capture record (non-blocking, buffered)
   * @param {string} agentId - Agent identifier
   * @param {object} capture - Capture record to write
   */
  write(agentId, capture) {
    // Add to buffer (will be flushed periodically)
    this.writeBuffer.push({
      agentId,
      record: {
        id: capture.id,
        ts: capture.timestamp || new Date().toISOString(),
        agent: agentId,
        provider: capture.provider,
        model: capture.model,
        req: {
          method: capture.request?.method || 'POST',
          path: capture.request?.path || '/v1/chat/completions',
          tokens: capture.tokens?.input || 0,
          body: capture.request?.body,
        },
        res: capture.response ? {
          status: capture.response.status,
          tokens: capture.tokens?.output || 0,
          latency: capture.latency_ms || 0,
          body: capture.response.body,
        } : null,
        cost: capture.cost || 0,
        error: capture.error,
      },
    });
  }

  /**
   * Flush buffer to files
   */
  async flush() {
    if (this.writeBuffer.length === 0) return;
    
    // Take current buffer and reset
    const toWrite = this.writeBuffer;
    this.writeBuffer = [];
    
    // Group by agent
    const byAgent = new Map();
    for (const item of toWrite) {
      const existing = byAgent.get(item.agentId) || [];
      existing.push(item.record);
      byAgent.set(item.agentId, existing);
    }
    
    // Write each agent's records
    for (const [agentId, records] of byAgent) {
      await this.writeToAgentFile(agentId, records);
    }
    
    console.log(`[CaptureFileWriter] Flushed ${toWrite.length} records to files`);
  }

  /**
   * Write records to agent's daily file
   */
  async writeToAgentFile(agentId, records) {
    try {
      const stream = await this.getOrCreateStream(agentId);
      
      for (const record of records) {
        const line = JSON.stringify(record) + '\n';
        stream.write(line);
      }
    } catch (err) {
      console.error(`[CaptureFileWriter] Write error for ${agentId}:`, err);
    }
  }

  /**
   * Get or create write stream for agent
   */
  async getOrCreateStream(agentId) {
    const streamKey = `${agentId}-${this.currentDate}`;
    
    // Check if stream exists and is still valid
    let stream = this.streams.get(streamKey);
    if (stream && !stream.destroyed) {
      return stream;
    }
    
    // Close old stream if exists
    if (stream) {
      stream.end();
    }
    
    // Create agent directory if needed
    const agentDir = path.join(this.baseDir, agentId);
    await fs.promises.mkdir(agentDir, { recursive: true });
    
    // Create new stream (append mode)
    const filePath = path.join(agentDir, `${this.currentDate}.jsonl`);
    stream = fs.createWriteStream(filePath, { flags: 'a' });
    
    stream.on('error', (err) => {
      console.error(`[CaptureFileWriter] Stream error for ${agentId}:`, err);
    });
    
    this.streams.set(streamKey, stream);
    console.log(`[CaptureFileWriter] Created stream for ${agentId} -> ${filePath}`);
    
    return stream;
  }

  /**
   * Get current date string (YYYY-MM-DD)
   */
  getDateString() {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Start flush timer
   */
  startFlushTimer() {
    this.flushTimer = setInterval(async () => {
      try {
        await this.flush();
      } catch (err) {
        console.error('[CaptureFileWriter] Flush error:', err);
      }
    }, this.flushInterval);
  }

  /**
   * Start date rotation checker
   */
  startDateRotationChecker() {
    // Check every minute for date change
    setInterval(() => {
      const newDate = this.getDateString();
      if (newDate !== this.currentDate) {
        console.log(`[CaptureFileWriter] Date rotation: ${this.currentDate} -> ${newDate}`);
        
        this.currentDate = newDate;
        
        // Close old streams (will be recreated on next write)
        for (const [key, stream] of this.streams) {
          stream.end();
        }
        this.streams.clear();
      }
    }, 60000);
  }

  /**
   * Shutdown gracefully
   */
  async shutdown() {
    console.log('[CaptureFileWriter] Shutting down...');
    
    // Stop timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    // Final flush
    await this.flush();
    
    // Close all streams
    for (const [key, stream] of this.streams) {
      stream.end();
    }
    this.streams.clear();
    
    console.log('[CaptureFileWriter] Shutdown complete');
  }
}

// Export singleton instance
const captureFileWriter = new CaptureFileWriter();

module.exports = { CaptureFileWriter, captureFileWriter };
