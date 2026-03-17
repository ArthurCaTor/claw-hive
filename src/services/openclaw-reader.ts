/**
 * @file src/services/openclaw-reader.ts
 * @description Read OpenClaw data directly from files - NO CLI calls!
 * 直接从文件读取 OpenClaw 数据 - 不调用 CLI！
 * 
 * PROBLEM: Calling `openclaw` CLI spawns new Node.js processes (~50-100MB each).
 * Dashboard polling every 5 seconds causes process accumulation.
 * 
 * SOLUTION: Read directly from OpenClaw's data files.
 * No process spawning, instant response, zero overhead.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

interface CacheEntry<T> {
  data: T;
  time: number;
}

interface OpenClawPaths {
  config: string;
  agents: string;
  sessions: string;
  logs: string;
}

class OpenClawReader {
  private openclawHome: string;
  private paths: OpenClawPaths;
  private cache: {
    config: unknown | null;
    configTime: number;
  };
  private cacheTTL: number;

  constructor() {
    this.openclawHome = process.env.OPENCLAW_HOME || path.join(os.homedir(), '.openclaw');
    
    this.paths = {
      config: path.join(this.openclawHome, 'config.json'),
      agents: path.join(this.openclawHome, 'agents'),
      sessions: path.join(this.openclawHome, 'sessions'),
      logs: path.join(this.openclawHome, 'logs'),
    };
    
    this.cache = {
      config: null,
      configTime: 0,
    };
    
    this.cacheTTL = 5000;
    
    console.log(`[OpenClawReader] Initialized at ${this.openclawHome}`);
  }

  /**
   * Get all agents
   */
  async getAgents() {
    try {
      const agentsDir = this.paths.agents;
      
      if (!fs.existsSync(agentsDir)) {
        console.warn(`[OpenClawReader] Agents directory not found: ${agentsDir}`);
        return [];
      }
      
      const entries = await fs.promises.readdir(agentsDir, { withFileTypes: true });
      const agents = [];
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const agentData = await this._readAgentData(entry.name);
          if (agentData) {
            agents.push(agentData);
          }
        }
      }
      
      return agents;
    } catch (error) {
      console.error('[OpenClawReader] Error reading agents:', error.message);
      return [];
    }
  }

  /**
   * Get a specific agent
   */
  async getAgent(agentId) {
    return this._readAgentData(agentId);
  }

  /**
   * Get all sessions (from all agents)
   */
  async getSessions(options: any = {}) {
    try {
      const sessions = [];
      
      // Read sessions from each agent directory
      const agentsDir = this.paths.agents;
      
      if (!fs.existsSync(agentsDir)) {
        return [];
      }
      
      const agentEntries = await fs.promises.readdir(agentsDir, { withFileTypes: true });
      
      for (const agentEntry of agentEntries) {
        if (!agentEntry.isDirectory()) continue;
        
        const agentId = agentEntry.name;
        const agentSessionsDir = path.join(agentsDir, agentId, 'sessions');
        
        if (!fs.existsSync(agentSessionsDir)) continue;
        
        const sessionFiles = await fs.promises.readdir(agentSessionsDir);
        
        for (const file of sessionFiles) {
          if (!file.endsWith('.jsonl')) continue;
          
          const sessionId = file.replace('.jsonl', '').replace('.jsonl.lock', '');
          const sessionData = await this._readSessionFromAgent(agentId, sessionId);
          
          if (sessionData) {
            if (options.agentId && (sessionData as any).agent !== options.agentId) {
              continue;
            }
            sessions.push(sessionData);
          }
        }
      }
      
      // Sort by mtime (newest first)
      sessions.sort((a, b) => {
        const timeA = new Date(a.mtime || 0).getTime();
        const timeB = new Date(b.mtime || 0).getTime();
        return timeB - timeA;
      });
      
      return sessions;
    } catch (error) {
      console.error('[OpenClawReader] Error reading sessions:', error.message);
      return [];
    }
  }

  /**
   * Get a specific session
   */
  async getSession(sessionId) {
    return this._readSessionData(sessionId);
  }

  /**
   * Get session messages (JSONL)
   */
  async getSessionMessages(sessionId, limit = 100) {
    try {
      const messagesFile = path.join(this.paths.sessions, sessionId, 'messages.jsonl');
      
      if (!fs.existsSync(messagesFile)) {
        return [];
      }
      
      const content = await fs.promises.readFile(messagesFile, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      
      const messages = [];
      for (const line of lines.slice(-limit)) {
        try {
          messages.push(JSON.parse(line));
        } catch (e) {
          // Skip malformed lines
        }
      }
      
      return messages;
    } catch (error) {
      console.error(`[OpenClawReader] Error reading messages for ${sessionId}:`, error.message);
      return [];
    }
  }

  /**
   * Get OpenClaw configuration
   */
  async getConfig() {
    try {
      const now = Date.now();
      
      if (this.cache.config && (now - this.cache.configTime) < this.cacheTTL) {
        return this.cache.config;
      }
      
      if (!fs.existsSync(this.paths.config)) {
        return {};
      }
      
      const content = await fs.promises.readFile(this.paths.config, 'utf-8');
      const config = JSON.parse(content);
      
      this.cache.config = config;
      this.cache.configTime = now;
      
      return config;
    } catch (error) {
      console.error('[OpenClawReader] Error reading config:', error.message);
      return {};
    }
  }

  /**
   * Get system status
   */
  async getStatus() {
    try {
      const [agents, sessions] = await Promise.all([
        this.getAgents(),
        this.getSessions(),
      ]);
      
      return {
        healthy: true,
        agentCount: agents.length,
        sessionCount: sessions.length,
        openclawHome: this.openclawHome,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get combined dashboard data (single call)
   */
  async getDashboardData() {
    const startTime = Date.now();
    
    const [agents, sessions, config] = await Promise.all([
      this.getAgents(),
      this.getSessions(),
      this.getConfig(),
    ]);
    
    const duration = Date.now() - startTime;
    
    return {
      agents,
      sessions,
      config,
      status: {
        healthy: true,
        agentCount: agents.length,
        sessionCount: sessions.length,
      },
      timestamp: new Date().toISOString(),
      fetchDuration: duration,
    };
  }

  /**
   * Read agent data from directory
   */
  async _readAgentData(agentId) {
    try {
      const agentDir = path.join(this.paths.agents, agentId);
      
      if (!fs.existsSync(agentDir)) {
        return null;
      }
      
      const stats = await fs.promises.stat(agentDir);
      
      // Try to read agent.json
      const agentFile = path.join(agentDir, 'agent.json');
      if (fs.existsSync(agentFile)) {
        const content = await fs.promises.readFile(agentFile, 'utf-8');
        const data = JSON.parse(content);
        return { id: agentId, ...data };
      }
      
      return {
        id: agentId,
        name: agentId,
        createdAt: stats.birthtime.toISOString(),
        updatedAt: stats.mtime.toISOString(),
      };
    } catch (error) {
      console.warn(`[OpenClawReader] Error reading agent ${agentId}:`, error.message);
      return null;
    }
  }

  /**
   * Read session data from agent directory
   */
  async _readSessionData(sessionId, agentId = null) {
    try {
      // If agentId is provided, read from that agent's sessions
      if (agentId) {
        return this._readSessionFromAgent(agentId, sessionId);
      }
      
      // Otherwise, search in all agents
      const agentsDir = this.paths.agents;
      const agentEntries = await fs.promises.readdir(agentsDir, { withFileTypes: true });
      
      for (const agentEntry of agentEntries) {
        if (!agentEntry.isDirectory()) continue;
        
        const result = await this._readSessionFromAgent(agentEntry.name, sessionId);
        if (result) return result;
      }
      
      return null;
    } catch (error) {
      console.warn(`[OpenClawReader] Error reading session ${sessionId}:`, error.message);
      return null;
    }
  }

  /**
   * Read session data from agent directory
   */
  async _readSessionFromAgent(agentId, sessionId) {
    try {
      const sessionFile = path.join(this.paths.agents, agentId, 'sessions', `${sessionId}.jsonl`);
      
      if (!fs.existsSync(sessionFile)) {
        return null;
      }
      
      const stats = await fs.promises.stat(sessionFile);
      
      // Get first line as preview
      const content = await fs.promises.readFile(sessionFile, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      let preview = null;
      
      if (lines.length > 0) {
        try {
          const firstMsg = JSON.parse(lines[0]);
          preview = firstMsg.role || firstMsg.type || 'unknown';
        } catch (e) {}
      }
      
      // Calculate ageMs (time since last modification)
      const now = Date.now();
      const mtimeMs = new Date(stats.mtime).getTime();
      const ageMs = now - mtimeMs;
      
      return {
        sessionId,
        agent: agentId,
        mtime: stats.mtime.toISOString(),
        ageMs,
        size: stats.size,
        messageCount: lines.length,
        preview,
      };
    } catch (error) {
      return null;
    }
  }
}

const openclawReader = new OpenClawReader();

module.exports = { OpenClawReader, openclawReader };

export { OpenClawReader, openclawReader };
