// @ts-nocheck
/**
 * LLM Tracker Service
 * 
 * Tracks which LLM each agent is using, detects switches,
 * and records usage history.
 */

const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');

const HISTORY_DIR = path.join(process.cwd(), 'data', 'llm-history');
const MAX_HISTORY_PER_AGENT = 100;

class LLMTracker extends EventEmitter {
  constructor() {
    super();
    this.agentStates = new Map();
    this.providerStats = new Map();
    
    // Ensure history directory exists
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
    
    // Load existing history
    this.loadHistory();
    
    console.log('[LLMTracker] Initialized');
  }

  /**
   * Track a request and detect LLM switches
   */
  trackRequest(agentId, provider, model, requestId, latency, tokens, error) {
    const timestamp = new Date().toISOString();
    
    // Get or create agent state
    let state = this.agentStates.get(agentId);
    if (!state) {
      state = {
        currentProvider: provider,
        currentModel: model,
        lastSeen: timestamp,
        history: [],
        switches: [],
        totalRequests: 0,
      };
      this.agentStates.set(agentId, state);
    }
    
    // Detect LLM switch
    if (state.currentProvider !== provider || state.currentModel !== model) {
      const switchEvent = {
        timestamp,
        fromProvider: state.currentProvider,
        fromModel: state.currentModel,
        toProvider: provider,
        toModel: model,
        requestId,
      };
      
      state.switches.push(switchEvent);
      
      // Emit switch event for dashboard
      this.emit('llm-switch', {
        agentId,
        ...switchEvent,
      });
      
      console.log(
        `[LLMTracker] Agent ${agentId} switched: ` +
        `${state.currentModel} → ${model}`
      );
      
      // Update current
      state.currentProvider = provider;
      state.currentModel = model;
    }
    
    // Record usage
    state.history.push({
      provider,
      model,
      timestamp,
      requestId,
    });
    
    // Trim history
    if (state.history.length > MAX_HISTORY_PER_AGENT) {
      state.history = state.history.slice(-MAX_HISTORY_PER_AGENT);
    }
    
    state.lastSeen = timestamp;
    state.totalRequests++;
    
    // Update provider stats
    this.updateProviderStats(provider, latency, tokens, error);
    
    // Persist periodically
    if (state.totalRequests % 10 === 0) {
      this.saveHistory();
    }
  }

  /**
   * Update provider statistics
   */
  updateProviderStats(provider, latency, tokens, error) {
    let stats = this.providerStats.get(provider);
    if (!stats) {
      stats = {
        provider,
        requestCount: 0,
        tokenCount: 0,
        errorCount: 0,
        avgLatency: 0,
        lastUsed: new Date().toISOString(),
      };
      this.providerStats.set(provider, stats);
    }
    
    stats.requestCount++;
    stats.lastUsed = new Date().toISOString();
    
    if (tokens) {
      stats.tokenCount += (tokens.input || 0) + (tokens.output || 0);
    }
    
    if (error) {
      stats.errorCount++;
    }
    
    if (latency) {
      // Rolling average
      stats.avgLatency = Math.round(
        (stats.avgLatency * (stats.requestCount - 1) + latency) / stats.requestCount
      );
    }
  }

  /**
   * Get state for an agent
   */
  getAgentState(agentId) {
    return this.agentStates.get(agentId);
  }

  /**
   * Get all agent states
   */
  getAllAgentStates() {
    const result = {};
    for (const [agentId, state] of this.agentStates) {
      result[agentId] = state;
    }
    return result;
  }

  /**
   * Get recent switches across all agents
   */
  getRecentSwitches(limit = 20) {
    const allSwitches = [];
    
    for (const [agentId, state] of this.agentStates) {
      for (const sw of state.switches) {
        allSwitches.push({ ...sw, agentId });
      }
    }
    
    // Sort by timestamp descending
    allSwitches.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    return allSwitches.slice(0, limit);
  }

  /**
   * Get provider statistics
   */
  getProviderStats() {
    return Array.from(this.providerStats.values());
  }

  /**
   * Save history to file
   */
  saveHistory() {
    try {
      const data = {
        agentStates: Object.fromEntries(this.agentStates),
        providerStats: Object.fromEntries(this.providerStats),
        savedAt: new Date().toISOString(),
      };
      
      const filepath = path.join(HISTORY_DIR, 'llm-tracker-state.json');
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('[LLMTracker] Failed to save history:', err.message);
    }
  }

  /**
   * Load history from file
   */
  loadHistory() {
    try {
      const filepath = path.join(HISTORY_DIR, 'llm-tracker-state.json');
      
      if (fs.existsSync(filepath)) {
        const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
        
        if (data.agentStates) {
          for (const [agentId, state] of Object.entries(data.agentStates)) {
            this.agentStates.set(agentId, state);
          }
        }
        
        if (data.providerStats) {
          for (const [provider, stats] of Object.entries(data.providerStats)) {
            this.providerStats.set(provider, stats);
          }
        }
        
        console.log(`[LLMTracker] Loaded ${this.agentStates.size} agent states`);
      }
    } catch (err) {
      console.warn('[LLMTracker] Could not load history:', err.message);
    }
  }

  /**
   * Clear all tracking data
   */
  getProviderFromModel(model) {
    // Extract provider from model string
    // e.g., "minimax-portal/MiniMax-M2.1" → "minimax"
    // e.g., "anthropic/claude-sonnet-4" → "anthropic"
    // e.g., "openai/gpt-4o" → "openai"
    
    if (!model) return 'unknown';
    
    if (model.includes('/')) {
      return model.split('/')[0];
    }
    
    // Handle bare model names
    if (model.startsWith('gpt-')) return 'openai';
    if (model.startsWith('claude-')) return 'anthropic';
    if (model.startsWith('MiniMax')) return 'minimax';
    
    return 'unknown';
  }
  
  clear() {
    this.agentStates.clear();
    this.providerStats.clear();
    console.log('[LLMTracker] Cleared all tracking data');
  }
}

const llmTracker = new LLMTracker();

module.exports = { LLMTracker, llmTracker };
