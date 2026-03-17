// Debug Service - Control center for debug mode
const { PromptHook } = require('./prompt-hook');
const { PromptStore } = require('./prompt-store');
const rollbackManager = require('./rollback-manager');

class DebugService {
  constructor(agentName = 'coder') {
    this.agentName = agentName;
    this.store = null;
    this.promptHook = null;
    this.currentMethod = 'none';
    this.rollbackMgr = rollbackManager;
  }

  async start() {
    // Initialize store
    this.store = new PromptStore(this.agentName);

    // Initialize hook
    this.promptHook = new PromptHook(this.rollbackMgr, this.store);

    // Try runtime patch first
    const result = await this.promptHook.start();

    if (result.success) {
      this.currentMethod = 'runtime_patch';
      return result;
    }

    // Fallback to proxy (not implemented yet)
    if (result.method === 'proxy_required') {
      console.log('[DebugService] Runtime patch not available, proxy not implemented yet');
      return { success: false, method: 'proxy_required', error: 'Proxy mode not implemented' };
    }

    return result;
  }

  async stop() {
    if (this.currentMethod === 'runtime_patch' && this.promptHook) {
      const result = await this.promptHook.stop();
      this.currentMethod = 'none';
      if (this.store) {
        this.store.close();
      }
      return result;
    }

    if (this.store) {
      this.store.close();
    }

    return { success: true, messagesRecorded: 0 };
  }

  async emergencyRollback() {
    await this.stop();
    return this.rollbackMgr.rollbackAll();
  }

  getStatus() {
    const hookStatus = this.promptHook ? this.promptHook.getStatus() : null;
    
    return {
      enabled: this.currentMethod !== 'none',
      method: this.currentMethod,
      messagesRecorded: hookStatus?.messagesRecorded || 0,
      startedAt: hookStatus?.startedAt || null,
      sessionId: this.store?.getSessionDir()?.split('/').pop() || null,
    };
  }

  async getRecordings() {
    if (!this.store) return { records: [], contextWindow: null };
    return {
      records: this.store.readAll(),
      contextWindow: await this.store.reconstructContextWindow(),
    };
  }
}

// Singleton instance
const debugService = new DebugService();

module.exports = { DebugService, debugService };
