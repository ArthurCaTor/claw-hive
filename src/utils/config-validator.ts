/**
 * @file src/utils/config-validator.ts
 * @description Runtime configuration validation
 * 运行时配置验证
 * 
 * Validates OpenClaw config structure on load
 * 在加载时验证 OpenClaw 配置结构
 */

interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface AgentConfig {
  agent_id?: string;
  id?: string;
  name?: string;
  identity?: {
    name?: string;
    emoji?: string;
  };
  model?: string;
  workspace?: string;
  subagents?: string[];
}

interface Config {
  agents?: {
    list?: AgentConfig[];
    defaults?: Record<string, unknown>;
  };
  channels?: {
    list?: unknown[];
  };
  openclaw?: {
    port?: string | number;
    dir?: string;
  };
  env?: {
    vars?: Record<string, string>;
  };
  heartbeat?: {
    every?: string;
  };
  compaction?: {
    mode?: string;
  };
}

/**
 * Validate config structure
 * @param config - Config object to validate
 * @returns Validation result
 */
function validateConfig(config: unknown): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required top-level fields
  if (!config) {
    return { valid: false, errors: ['Config is null or undefined'], warnings: [] };
  }
  
  const cfg = config as Config;
  
  // Check agents section
  if (!cfg.agents) {
    warnings.push('No agents section in config');
  } else if (cfg.agents.list) {
    if (!Array.isArray(cfg.agents.list)) {
      errors.push('agents.list must be an array');
    } else {
      // Validate each agent
      cfg.agents.list.forEach((agent, idx) => {
        // Accept both 'id' and 'agent_id'
        const agentId = agent.agent_id || agent.id;
        if (!agentId) {
          errors.push(`agents.list[${idx}]: missing id/agent_id`);
        }
        // Warn if name is missing but prefer identity.name
        if (!agent.name && !agent.identity?.name) {
          warnings.push(`agents.list[${idx}]: missing name`);
        }
      });
    }
  }
  
  // Check channels section
  if (!cfg.channels) {
    warnings.push('No channels section in config');
  } else if (cfg.channels.list) {
    if (!Array.isArray(cfg.channels.list)) {
      errors.push('channels.list must be an array');
    }
  }
  
  // Validate port settings
  if (cfg.openclaw?.port) {
    const port = parseInt(String(cfg.openclaw.port));
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push('openclaw.port must be between 1 and 65535');
    }
  }
  
  // Validate paths
  if (cfg.openclaw?.dir) {
    if (typeof cfg.openclaw.dir !== 'string') {
      errors.push('openclaw.dir must be a string');
    }
  }
  
  const valid = errors.length === 0;
  
  if (!valid) {
    console.error('[ConfigValidator] Config validation failed', { errors, warnings });
  } else if (warnings.length > 0) {
    console.warn('[ConfigValidator] Config has warnings', { warnings });
  }
  
  return { valid, errors, warnings };
}

/**
 * Validate agent update request
 * @param data - Update data
 * @returns Validation result
 */
function validateAgentUpdate(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  const d = data as Record<string, unknown>;
  
  if (!d.agent_id) {
    errors.push('agent_id is required');
  }
  
  // Model must be string if provided
  if (d.model !== undefined && typeof d.model !== 'string') {
    errors.push('model must be a string');
  }
  
  // Status must be valid if provided
  const validStatuses = ['idle', 'working', 'paused', 'stopped'];
  if (d.status && !validStatuses.includes(String(d.status))) {
    errors.push(`status must be one of: ${validStatuses.join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate cron job config
 * @param job - Cron job config
 * @returns Validation result
 */
function validateCronJob(job: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  const j = job as Record<string, unknown>;
  
  if (!j.schedule) {
    errors.push('schedule is required');
  }
  
  if (!j.payload) {
    errors.push('payload is required');
  }
  
  // Validate schedule type
  const validScheduleTypes = ['at', 'every', 'cron'];
  if (j.schedule && typeof j.schedule === 'object' && !validScheduleTypes.includes(String((j.schedule as Record<string, unknown>).kind))) {
    errors.push(`schedule.kind must be one of: ${validScheduleTypes.join(', ')}`);
  }
  
  // Validate payload type
  const validPayloadTypes = ['systemEvent', 'agentTurn'];
  if (j.payload && typeof j.payload === 'object' && !validPayloadTypes.includes(String((j.payload as Record<string, unknown>).kind))) {
    errors.push(`payload.kind must be one of: ${validPayloadTypes.join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export { validateConfig, validateAgentUpdate, validateCronJob };
export type { ConfigValidationResult, Config, AgentConfig };
