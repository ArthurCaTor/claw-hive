/**
 * @file src/services/llm-tracker.js
 * @description LLM Tracker — observes which LLM each agent uses
 * LLM 跟踪器 — 观察每个 Agent 使用哪个 LLM
 *
 * IMPORTANT: This is TRACKING, not ROUTING.
 * 重要：这是跟踪，不是路由。OpenClaw 决定 LLM，我们只观察。
 */
const { EventEmitter } = require('events');
const { logger } = require('../utils/logger');

class LLMTracker extends EventEmitter {
  constructor() {
    super();
    this.agentLLMs = new Map(); // agentId → { provider, model, lastSeen }
    this.switchHistory = []; // { agentId, from, to, timestamp, trigger }
    this.MAX_HISTORY = 500;
    
    // Health metrics per provider
    this.healthMetrics = new Map(); // provider → { calls, errors, latencies: [], lastCall }
    
    logger.info('LLMTracker initialized');
  }

  /**
   * Track an agent's LLM usage
   * 跟踪 Agent 的 LLM 使用
   * @param {string} agentId - Agent ID
   * @param {string} provider - LLM provider (e.g., 'minimax', 'anthropic', 'openai')
   * @param {string} model - Model name
   * @param {boolean} hadError - Whether there was an error that triggered this switch
   */
  track(agentId, provider, model, hadError = false) {
    const prev = this.agentLLMs.get(agentId);
    const now = new Date();

    if (prev && (prev.provider !== provider || prev.model !== model)) {
      const switchEvent = {
        agentId,
        from: { provider: prev.provider, model: prev.model },
        to: { provider, model },
        timestamp: now.toISOString(),
        trigger: hadError ? 'error' : 'manual',
      };
      
      this.switchHistory.push(switchEvent);
      if (this.switchHistory.length > this.MAX_HISTORY) {
        this.switchHistory = this.switchHistory.slice(-this.MAX_HISTORY);
      }
      
      logger.info({ 
        agentId, 
        from: switchEvent.from, 
        to: switchEvent.to,
        trigger: switchEvent.trigger 
      }, '[LLMTracker] LLM switch detected');
      
      this.emit('llm-switch', switchEvent);
    }

    this.agentLLMs.set(agentId, { 
      provider, 
      model, 
      lastSeen: now 
    });
  }

  /**
   * Get current LLM for all tracked agents
   * 获取所有已跟踪 Agent 的当前 LLM
   * @returns {Object} Map of agentId → { provider, model, lastSeen }
   */
  getCurrentLLMs() {
    const result = {};
    for (const [id, info] of this.agentLLMs) {
      result[id] = { 
        provider: info.provider, 
        model: info.model, 
        lastSeen: info.lastSeen.toISOString() 
      };
    }
    return result;
  }

  /**
   * Get LLM switch history
   * 获取 LLM 切换历史
   * @param {string} [agentId] - Optional agent ID to filter by
   * @param {number} [limit=50] - Maximum number of events to return
   * @returns {Array} Switch events
   */
  getSwitchHistory(agentId, limit = 50) {
    let history = this.switchHistory;
    if (agentId) {
      history = history.filter(e => e.agentId === agentId);
    }
    return history.slice(-limit);
  }

  /**
   * Clear history for an agent
   * 清除某个 Agent 的历史
   * @param {string} agentId - Agent ID
   */
  clearHistory(agentId) {
    if (agentId) {
      this.switchHistory = this.switchHistory.filter(e => e.agentId !== agentId);
    }
  }

  /**
   * Get statistics
   * 获取统计信息
   * @returns {Object} Stats
   */
  getStats() {
    const providers = {};
    for (const [agentId, info] of this.agentLLMs) {
      providers[info.provider] = (providers[info.provider] || 0) + 1;
    }
    
    return {
      totalAgents: this.agentLLMs.size,
      totalSwitches: this.switchHistory.length,
      byProvider: providers,
    };
  }

  /**
   * Extract provider from model name
   * 从模型名称推断提供商
   * @param {string} model - Model name
   * @returns {string} Provider
   */
  getProviderFromModel(model) {
    if (!model || model === 'unknown') return 'unknown';
    const lower = model.toLowerCase();
    if (lower.includes('claude')) return 'anthropic';
    if (lower.includes('gpt-4') || lower.includes('gpt-3.5') || lower.includes('o1') || lower.includes('o3')) return 'openai';
    if (lower.includes('minimax') || lower.includes('abab')) return 'minimax';
    if (lower.includes('gemini')) return 'google';
    if (lower.includes('llama') || lower.includes('mistral') || lower.includes('qwen')) return 'open-source';
    return 'unknown';
  }

  // ============================================================
  // Health Tracking - Per-provider metrics
  // 健康追踪 — 每个提供商的指标
  // ============================================================

  /**
   * Record a call for health tracking
   * @param {string} provider - Provider name
   * @param {number} latencyMs - Response latency in ms
   * @param {boolean} success - Whether the call succeeded
   */
  recordCall(provider, latencyMs, success = true) {
    if (!provider || provider === 'unknown') return;
    
    let metrics = this.healthMetrics.get(provider);
    if (!metrics) {
      metrics = { calls: 0, errors: 0, latencies: [], lastCall: null };
      this.healthMetrics.set(provider, metrics);
    }
    
    metrics.calls++;
    if (!success) metrics.errors++;
    metrics.latencies.push(latencyMs);
    metrics.lastCall = new Date().toISOString();
    
    // Keep only last 1000 latencies for P50/P95/P99
    if (metrics.latencies.length > 1000) {
      metrics.latencies = metrics.latencies.slice(-1000);
    }
  }

  /**
   * Get health metrics for a provider
   * @param {string} provider - Provider name
   * @returns {object} Health metrics
   */
  getHealthMetrics(provider) {
    const metrics = this.healthMetrics.get(provider);
    if (!metrics) {
      return { calls: 0, errors: 0, errorRate: 0, latencies: [], p50: 0, p95: 0, p99: 0 };
    }
    
    const latencies = metrics.latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
    
    return {
      calls: metrics.calls,
      errors: metrics.errors,
      errorRate: metrics.calls > 0 ? Math.round((metrics.errors / metrics.calls) * 10000) / 100 : 0,
      latencies: latencies.slice(-100),
      p50: Math.round(p50),
      p95: Math.round(p95),
      p99: Math.round(p99),
      lastCall: metrics.lastCall,
    };
  }

  /**
   * Get health metrics for all providers
   * @returns {object} All health metrics
   */
  getAllHealthMetrics() {
    const result = {};
    for (const provider of this.healthMetrics.keys()) {
      result[provider] = this.getHealthMetrics(provider);
    }
    return result;
  }
}

const llmTracker = new LLMTracker();
module.exports = { LLMTracker, llmTracker };
