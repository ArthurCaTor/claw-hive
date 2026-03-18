// @ts-nocheck
/**
 * Message Optimizer Service
 * 
 * ACTIVE MODE: Optimizes message content BEFORE sending to LLM.
 * 
 * IMPORTANT: This service does NOT decide which LLM to use!
 * It only optimizes the message content (system prompt, history, etc.)
 * 
 * Optimizations:
 * - Truncate old conversation history
 * - Compress system prompts
 * - Token budget enforcement
 */

class MessageOptimizer {
  constructor() {
    this.config = {
      enabled: false, // Disabled by default (Passive Mode)
      maxHistoryMessages: 20,
      maxSystemPromptTokens: 4000,
      maxTotalTokens: 100000,
      compressHistory: true,
    };
    
    console.log('[MessageOptimizer] Initialized (Active Mode:', this.config.enabled ? 'ON' : 'OFF', ')');
  }

  isEnabled() {
    return this.config.enabled;
  }

  setEnabled(enabled) {
    this.config.enabled = enabled;
    console.log('[MessageOptimizer] Active Mode:', enabled ? 'ENABLED' : 'DISABLED');
  }

  getConfig() {
    return { ...this.config };
  }

  updateConfig(updates) {
    Object.assign(this.config, updates);
  }

  optimize(body) {
    const result = {
      optimized: false,
      originalTokens: this.estimateTokens(body),
      optimizedTokens: 0,
      tokensSaved: 0,
      changes: [],
    };

    if (!this.config.enabled) {
      result.optimizedTokens = result.originalTokens;
      return { body, result };
    }

    const optimizedBody = { ...body };

    // 1. Truncate history
    if (this.config.compressHistory && optimizedBody.messages) {
      const originalCount = optimizedBody.messages.length;
      if (originalCount > this.config.maxHistoryMessages) {
        const keepFirst = 2;
        const keepLast = this.config.maxHistoryMessages - keepFirst;
        
        optimizedBody.messages = [
          ...optimizedBody.messages.slice(0, keepFirst),
          { role: 'system', content: `[... ${originalCount - this.config.maxHistoryMessages} earlier messages truncated ...]` },
          ...optimizedBody.messages.slice(-keepLast),
        ];
        
        result.changes.push(`Truncated messages: ${originalCount} → ${optimizedBody.messages.length}`);
        result.optimized = true;
      }
    }

    // 2. Compress system prompt (if too long)
    if (optimizedBody.system) {
      const systemTokens = this.estimateTokens({ content: optimizedBody.system });
      if (systemTokens > this.config.maxSystemPromptTokens) {
        const maxChars = this.config.maxSystemPromptTokens * 4;
        optimizedBody.system = optimizedBody.system.slice(0, maxChars) + '\n[... truncated ...]';
        result.changes.push(`Truncated system prompt: ${systemTokens} → ~${this.config.maxSystemPromptTokens} tokens`);
        result.optimized = true;
      }
    }

    result.optimizedTokens = this.estimateTokens(optimizedBody);
    result.tokensSaved = result.originalTokens - result.optimizedTokens;

    return { body: optimizedBody, result };
  }

  estimateTokens(obj) {
    const str = JSON.stringify(obj);
    return Math.ceil(str.length / 4);
  }
}

const messageOptimizer = new MessageOptimizer();

module.exports = { MessageOptimizer, messageOptimizer };
