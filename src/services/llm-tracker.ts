/**
 * @file src/services/llm-tracker.ts
 * @description LLM Tracker — observes which LLM each agent uses
 * LLM 跟踪器 — 观察每个 Agent 使用哪个 LLM
 *
 * IMPORTANT: This is TRACKING, not ROUTING.
 * 重要：这是跟踪，不是路由。OpenClaw 决定 LLM，我们只观察。
 */
import { EventEmitter } from 'events';

interface LLMSwitchEvent {
  agentId: string;
  from: { provider: string; model: string };
  to: { provider: string; model: string };
  timestamp: string;
  trigger: 'error' | 'manual';
}

interface AgentLLMInfo {
  provider: string;
  model: string;
  lastSeen: Date;
}

interface HealthMetrics {
  calls: number;
  errors: number;
  latencies: number[];
  lastCall: string | null;
}

interface LLMTrackerStats {
  totalAgents: number;
  totalSwitches: number;
  byProvider: Record<string, number>;
}

class LLMTracker extends EventEmitter {
  private agentLLMs: Map<string, AgentLLMInfo>;
  private switchHistory: LLMSwitchEvent[];
  private MAX_HISTORY: number;
  private healthMetrics: Map<string, HealthMetrics>;

  constructor() {
    super();
    this.agentLLMs = new Map();
    this.switchHistory = [];
    this.MAX_HISTORY = 500;
    this.healthMetrics = new Map();
    
    console.log('LLMTracker initialized');
  }

  /**
   * Track an agent's LLM usage
   * 跟踪 Agent 的 LLM 使用
   * @param agentId - Agent ID
   * @param provider - LLM provider (e.g., 'minimax', 'anthropic', 'openai')
   * @param model - Model name
   * @param hadError - Whether there was an error that triggered this switch
   */
  track(agentId: string, provider: string, model: string, hadError = false): void {
    const prev = this.agentLLMs.get(agentId);
    const now = new Date();

    if (prev && (prev.provider !== provider || prev.model !== model)) {
      const switchEvent: LLMSwitchEvent = {
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
      
      console.log('[LLMTracker] LLM switch detected', { 
        agentId, 
        from: switchEvent.from, 
        to: switchEvent.to,
        trigger: switchEvent.trigger 
      });
      
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
   * @returns Map of agentId → { provider, model, lastSeen }
   */
  getCurrentLLMs(): Record<string, { provider: string; model: string; lastSeen: string }> {
    const result: Record<string, { provider: string; model: string; lastSeen: string }> = {};
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
   * @param agentId - Optional agent ID to filter by
   * @param limit - Maximum number of events to return
   * @returns Switch events
   */
  getSwitchHistory(agentId?: string, limit = 50): LLMSwitchEvent[] {
    let history = this.switchHistory;
    if (agentId) {
      history = history.filter(e => e.agentId === agentId);
    }
    return history.slice(-limit);
  }

  /**
   * Clear history for an agent
   * 清除某个 Agent 的历史
   * @param agentId - Agent ID
   */
  clearHistory(agentId: string): void {
    if (agentId) {
      this.switchHistory = this.switchHistory.filter(e => e.agentId !== agentId);
    }
  }

  /**
   * Get statistics
   * 获取统计信息
   * @returns Stats
   */
  getStats(): LLMTrackerStats {
    const providers: Record<string, number> = {};
    for (const [, info] of this.agentLLMs) {
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
   * @param model - Model name
   * @returns Provider
   */
  getProviderFromModel(model: string): string {
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
   * @param provider - Provider name
   * @param latencyMs - Response latency in ms
   * @param success - Whether the call succeeded
   */
  recordCall(provider: string, latencyMs: number, success = true): void {
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
   * @param provider - Provider name
   * @returns Health metrics
   */
  getHealthMetrics(provider: string): {
    calls: number;
    errors: number;
    errorRate: number;
    latencies: number[];
    p50: number;
    p95: number;
    p99: number;
    lastCall: string | null;
  } {
    const metrics = this.healthMetrics.get(provider);
    if (!metrics) {
      return { calls: 0, errors: 0, errorRate: 0, latencies: [], p50: 0, p95: 0, p99: 0, lastCall: null };
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
   * @returns All health metrics
   */
  getAllHealthMetrics(): Record<string, ReturnType<LLMTracker['getHealthMetrics']>> {
    const result: Record<string, ReturnType<LLMTracker['getHealthMetrics']>> = {};
    for (const provider of this.healthMetrics.keys()) {
      result[provider] = this.getHealthMetrics(provider);
    }
    return result;
  }
}

const llmTracker = new LLMTracker();
export { LLMTracker, llmTracker };
