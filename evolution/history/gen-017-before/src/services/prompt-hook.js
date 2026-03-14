// Prompt Hook - Runtime patching to intercept LLM prompts
const { RollbackManager } = require('./rollback-manager');
const { ModuleDiscoverer } = require('./module-discoverer');
const { PromptStore } = require('./prompt-store');

class PromptHook {
  constructor(rollbackMgr, store) {
    this.active = false;
    this.originalFn = null;
    this.targetModulePath = null;
    this.targetExportName = null;
    this.messagesRecorded = 0;
    this.startedAt = null;
    this.healthCheckInterval = null;
    this.rollbackMgr = rollbackMgr;
    this.store = store;
  }

  async start() {
    if (this.active) {
      return { success: true, method: 'already_active' };
    }

    // Step 1: Find target module
    const openclawRoot = ModuleDiscoverer.resolveOpenClawRoot();
    const discovery = await ModuleDiscoverer.findAppendMessageModule(openclawRoot);

    if (!discovery.found || !discovery.modulePath) {
      console.warn('[PromptHook] appendMessage not found, proxy mode not implemented yet');
      return { success: false, method: 'proxy_required' };
    }

    if (!discovery.isWritable) {
      console.warn('[PromptHook] appendMessage not writable');
      return { success: false, method: 'proxy_required' };
    }

    // Step 2: Create rollback snapshot
    await this.rollbackMgr.createSnapshot('debug-mode-start', [discovery.modulePath]);

    // Step 3: Inject hook
    try {
      const mod = require(discovery.modulePath);
      this.originalFn = mod[discovery.exportName];
      this.targetModulePath = discovery.modulePath;
      this.targetExportName = discovery.exportName;

      const self = this;

      // Wrap original function
      mod[discovery.exportName] = async function(...args) {
        try {
          self.recordMessage(args);
        } catch (err) {
          console.error('[PromptHook] Record error:', err);
        }

        const result = await self.originalFn.apply(this, args);

        try {
          self.recordResponse(result);
        } catch (err) {
          console.error('[PromptHook] Record response error:', err);
        }

        return result;
      };

      this.active = true;
      this.startedAt = new Date().toISOString();
      this.messagesRecorded = 0;

      // Start heartbeat check
      this.startHealthCheck();

      console.log(`[PromptHook] Started via runtime patch on ${discovery.exportName}`);

      return { success: true, method: 'runtime_patch' };
    } catch (err) {
      console.error('[PromptHook] Injection failed:', err.message);
      await this.rollbackMgr.rollback();
      return { success: false, method: 'proxy_required', error: err.message };
    }
  }

  async stop() {
    if (!this.active) {
      return { success: true, messagesRecorded: 0 };
    }

    // Stop heartbeat
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Restore original function
    if (this.targetModulePath && this.targetExportName && this.originalFn) {
      try {
        const mod = require(this.targetModulePath);
        mod[this.targetExportName] = this.originalFn;
      } catch (err) {
        console.error('[PromptHook] Error restoring:', err);
        await this.rollbackMgr.rollback();
      }
    }

    const total = this.messagesRecorded;
    this.active = false;
    this.originalFn = null;
    this.targetModulePath = null;
    this.targetExportName = null;
    this.startedAt = null;

    console.log(`[PromptHook] Stopped. Total: ${total} messages`);

    return { success: true, messagesRecorded: total };
  }

  getStatus() {
    return {
      active: this.active,
      method: this.active ? 'runtime_patch' : 'none',
      messagesRecorded: this.messagesRecorded,
      startedAt: this.startedAt,
      targetModule: this.targetModulePath,
    };
  }

  recordMessage(args) {
    const [sessionFile, message] = args;

    const record = {
      timestamp: new Date().toISOString(),
      direction: 'input',
      session_file: sessionFile,
      role: message?.role || 'unknown',
      content: message?.content || null,
      tokens_estimate: this.estimateTokens(message?.content),
    };

    this.store.write(record);
    this.messagesRecorded++;
  }

  recordResponse(result) {
    if (!result) return;

    const record = {
      timestamp: new Date().toISOString(),
      direction: 'output',
      role: 'assistant',
      content: typeof result === 'string' ? result : result?.content || result?.text || null,
      tokens_estimate: this.estimateTokens(result?.content || result?.text),
    };

    this.store.write(record);
    this.messagesRecorded++;
  }

  estimateTokens(content) {
    if (!content) return null;
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    return Math.ceil(text.length / 3);
  }

  startHealthCheck() {
    this.healthCheckInterval = setInterval(async () => {
      if (!this.active || !this.targetModulePath) return;

      try {
        const mod = require(this.targetModulePath);
        const currentFn = mod[this.targetExportName];

        if (currentFn !== this.originalFn) {
          console.warn('[PromptHook] Hook removed, re-injecting...');
          await this.start();
        }
      } catch (err) {
        console.error('[PromptHook] Health check failed:', err);
      }
    }, 5000);
  }
}

module.exports = { PromptHook };
