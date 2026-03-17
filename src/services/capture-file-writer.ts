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
 * 5. In-memory cache per agent for fast queries (每 Agent 内存缓存快速查询)
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

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
    
    // ============================================================
    // Per-agent memory cache for fast queries
    // 每 Agent 内存缓存用于快速查询
    // ============================================================
    this.cache = new Map(); // agentId -> [{ record, timestamp }]
    this.MAX_CACHE_PER_AGENT = options.maxCachePerAgent || 500;
    this.cacheEnabled = options.cacheEnabled !== false; // default true
  }

  /**
   * Initialize the writer
   */
  async initialize() {
    if (this.initialized) return;
    
    logger.info(`[CaptureFileWriter] Initializing with baseDir: ${this.baseDir}`);
    
    // Create base directory if not exists
    await fs.promises.mkdir(this.baseDir, { recursive: true });
    await fs.promises.mkdir(path.join(this.baseDir, '_metadata'), { recursive: true });
    
    // Start flush timer
    this.startFlushTimer();
    
    // Start date rotation checker
    this.startDateRotationChecker();
    
    this.initialized = true;
    logger.info('[CaptureFileWriter] Initialized successfully');
  }

  /**
   * Write a capture record (non-blocking, buffered)
   * @param {string} agentId - Agent identifier
   * @param {object} capture - Capture record to write
   */
  write(agentId, capture) {
    // Create record
    const record = {
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
    };
    
    // Add to buffer (will be flushed periodically)
    this.writeBuffer.push({
      agentId,
      record,
    });
    
    // Add to in-memory cache for fast queries
    if (this.cacheEnabled) {
      this.addToCache(agentId, record);
    }
  }
  
  /**
   * Add record to per-agent cache
   * @param {string} agentId - Agent ID
   * @param {object} record - Capture record
   */
  addToCache(agentId, record) {
    let agentCache = this.cache.get(agentId) || [];
    agentCache.push({ record, timestamp: Date.now() });
    
    // Trim to max size (FIFO / circular buffer)
    if (agentCache.length > this.MAX_CACHE_PER_AGENT) {
      agentCache = agentCache.slice(-this.MAX_CACHE_PER_AGENT);
    }
    
    this.cache.set(agentId, agentCache);
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
    
    logger.info(`[CaptureFileWriter] Flushed ${toWrite.length} records to files`);
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
      logger.error(`[CaptureFileWriter] Write error for ${agentId}:`, err);
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
      logger.error(`[CaptureFileWriter] Stream error for ${agentId}:`, err);
    });
    
    this.streams.set(streamKey, stream);
    logger.info(`[CaptureFileWriter] Created stream for ${agentId} -> ${filePath}`);
    
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
        logger.error('[CaptureFileWriter] Flush error:', err);
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
        logger.info(`[CaptureFileWriter] Date rotation: ${this.currentDate} -> ${newDate}`);
        
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
    logger.info('[CaptureFileWriter] Shutting down...');
    
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
    
    logger.info('[CaptureFileWriter] Shutdown complete');
  }
  
  // ============================================================
  // Query API - Search captures
  // 查询 API - 搜索捕获记录
  // ============================================================
  
  /**
   * Get recent captures for an agent from cache
   * @param {string} agentId - Agent ID
   * @param {number} limit - Max records to return
   * @returns {Array} Array of capture records
   */
  getRecent(agentId, limit = 50) {
    const agentCache = this.cache.get(agentId) || [];
    return agentCache.slice(-limit).map(c => c.record);
  }
  
  /**
   * Query captures with filters
   * @param {Object} options - Query options
   * @param {string} [options.agentId] - Filter by agent
   * @param {string} [options.model] - Filter by model
   * @param {string} [options.provider] - Filter by provider
   * @param {string} [options.startDate] - Start date (ISO string)
   * @param {string} [options.endDate] - End date (ISO string)
   * @param {number} [options.limit=100] - Max results
   * @returns {Array} Matching records
   */
  query(options = {}) {
    const {
      agentId,
      model,
      provider,
      startDate,
      endDate,
      limit = 100
    } = options;
    
    let results = [];
    
    // Search in-memory cache first
    const agentsToSearch = agentId ? [agentId] : Array.from(this.cache.keys());
    
    for (const agent of agentsToSearch) {
      const agentCache = this.cache.get(agent) || [];
      
      for (const item of agentCache) {
        const record = item.record;
        
        // Apply filters
        if (model && record.model !== model) continue;
        if (provider && record.provider !== provider) continue;
        if (startDate && record.ts < startDate) continue;
        if (endDate && record.ts > endDate) continue;
        
        results.push(record);
        
        if (results.length >= limit) break;
      }
      
      if (results.length >= limit) break;
    }
    
    // Sort by timestamp descending
    results.sort((a, b) => new Date(b.ts) - new Date(a.ts));
    
    return results.slice(0, limit);
  }
  
  /**
   * Get daily stats for an agent
   * @param {string} agentId - Agent ID
   * @param {string} date - Date string (YYYY-MM-DD), defaults to today
   * @returns {Object} Stats object
   */
  getDailyStats(agentId, date = null) {
    const targetDate = date || this.getDateString();
    const agentCache = this.cache.get(agentId) || [];
    
    let totalCalls = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;
    let errors = 0;
    const models = new Set();
    const providers = new Set();
    
    for (const item of agentCache) {
      const record = item.record;
      if (!record.ts.startsWith(targetDate)) continue;
      
      totalCalls++;
      totalInputTokens += record.req?.tokens || 0;
      totalOutputTokens += record.res?.tokens || 0;
      totalCost += record.cost || 0;
      if (record.error) errors++;
      if (record.model) models.add(record.model);
      if (record.provider) providers.add(record.provider);
    }
    
    return {
      date: targetDate,
      agentId,
      totalCalls,
      totalInputTokens,
      totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      totalCost: Math.round(totalCost * 100) / 100,
      errors,
      models: Array.from(models),
      providers: Array.from(providers),
    };
  }
  
  /**
   * Get all available agent IDs with captures
   * @returns {Array} List of agent IDs
   */
  getAgentIds() {
    return Array.from(this.cache.keys());
  }
  
  /**
   * Clear cache for an agent
   * @param {string} agentId - Agent ID
   */
  clearCache(agentId) {
    if (agentId) {
      this.cache.delete(agentId);
    }
  }
  
  /**
   * Get cache stats
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    const stats = {};
    for (const [agentId, cache] of this.cache) {
      stats[agentId] = cache.length;
    }
    return {
      totalAgents: this.cache.size,
      totalRecords: Object.values(stats).reduce((a, b) => a + b, 0),
      byAgent: stats,
    };
  }
}

// Export singleton instance
const captureFileWriter = new CaptureFileWriter();

module.exports = { CaptureFileWriter, captureFileWriter };
export {};
