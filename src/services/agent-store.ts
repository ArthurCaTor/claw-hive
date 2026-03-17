/**
 * @file src/services/agent-store.ts
 * @description Agent state management — extracted from server.js
 *              Agent 状态管理 — 从 server.js 中提取
 *
 * Manages the in-memory agent store. Single source of truth for agent status.
 * 管理内存中的 Agent 存储。Agent 状态的唯一真相来源。
 */


const { logger } = require('../utils/logger');

class AgentStore {
  private agents: Map<string, Agent> = new Map();

  /**
   * Initialize or update an agent from config defaults
   * 从配置默认值初始化或更新 Agent
   */
  initFromConfig(agentId: string, defaults: AgentDefaults): void {
    const existing = this.agents.get(agentId);
    this.agents.set(agentId, {
      agent_id: agentId,
      name: defaults.name || agentId,
      role: defaults.role || 'Agent',
      avatar: defaults.avatar || '🤖',
      color: defaults.color || '#60a5fa',
      model: existing?.model || defaults.model || 'unknown',
      registered_at: existing?.registered_at,
      status: 'idle',
      task: 'Waiting for task',
      output: null,
      heartbeat: existing?.heartbeat || 'online',
      tokens_used: existing?.tokens_used || 0,
      updated_at: Date.now(),
      updated_at_iso: new Date().toISOString(),
    });
  }

  /**
   * Update agent from a live session
   * 从实时 session 更新 Agent
   */
  updateFromSession(agentId: string, update: {
    status: AgentStatus;
    task: string;
    output: string | null;
    model: string;
    modelSource: 'session' | 'config';
    tokensUsed: number;
  }): void {
    const old = this.agents.get(agentId);
    if (!old) return;

    const now = Date.now();
    this.agents.set(agentId, {
      ...old,
      status: update.status,
      task: update.task,
      output: update.output,
      model: update.model,
      model_source: update.modelSource,
      heartbeat: 'online',
      tokens_used: update.tokensUsed,
      updated_at: now,
      updated_at_iso: new Date(now).toISOString(),
    });
  }

  /**
   * Register a new agent via API
   * 通过 API 注册新 Agent
   */
  register(agentId: string, data: Partial<Agent>): void {
    this.agents.set(agentId, {
      agent_id: agentId,
      name: data.name || agentId,
      role: data.role || 'Agent',
      avatar: data.avatar || '🤖',
      color: data.color || '#60a5fa',
      model: data.model || 'unknown',
      status: 'idle',
      task: 'Waiting for task',
      output: null,
      heartbeat: 'online',
      tokens_used: 0,
      registered_at: new Date().toISOString(),
      updated_at: Date.now(),
      updated_at_iso: new Date().toISOString(),
    });
  }

  /**
   * Update agent status via API
   * 通过 API 更新 Agent 状态
   */
  updateStatus(agentId: string, update: Partial<Agent>): void {
    const existing = this.agents.get(agentId);
    const now = Date.now();
    const merged = {
      ...(existing || {}),
      ...update,
      agent_id: agentId,
      updated_at: now,
      updated_at_iso: new Date(now).toISOString(),
    } as Agent;
    this.agents.set(agentId, merged);
  }

  /**
   * Execute lifecycle control action
   * 执行生命周期控制操作
   */
  control(action: AgentControlAction): { success: boolean; message: string } {
    const agent = this.agents.get(action.agent_id);
    if (!agent) {
      return { success: false, message: `Agent ${action.agent_id} not found` };
    }

    switch (action.action) {
      case 'pause':
        agent.status = 'paused';
        agent.task = 'Paused by user';
        break;
      case 'resume':
        agent.status = 'working';
        agent.task = 'Resumed';
        break;
      case 'restart':
        agent.status = 'working';
        agent.task = 'Restarting...';
        agent.output = '';
        break;
      case 'stop':
        agent.status = 'stopped';
        agent.task = 'Stopped by user';
        break;
    }

    return { success: true, message: `Agent ${action.agent_id} ${action.action}` };
  }

  /**
   * Set agent model
   * 设置 Agent 模型
   */
  setModel(agentId: string, model: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    agent.model = model;
    return true;
  }

  // ============================================
  // Query Methods — 查询方法
  // ============================================

  get(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  getAll(): Agent[] {
    return Array.from(this.agents.values());
  }

  has(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  getUpdatedAt(agentId: string): number | undefined {
    return this.agents.get(agentId)?.updated_at;
  }

  getStats(): DashboardStats {
    const agents = this.getAll();
    const working = agents.filter(a => a.status === 'working').length;
    return {
      total_agents: agents.length,
      working,
      idle: agents.length - working,
      total_tokens: agents.reduce((sum, a) => sum + (a.tokens_used || 0), 0),
    };
  }
}

export const agentStore = new AgentStore();
