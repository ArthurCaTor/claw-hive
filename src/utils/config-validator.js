/**
 * @file src/utils/config-validator.js
 * @description Runtime configuration validation
 * 运行时配置验证
 * 
 * Validates OpenClaw config structure on load
 * 在加载时验证 OpenClaw 配置结构
 */

const { logger } = require('./logger');

/**
 * Validate config structure
 * @param {object} config - Config object to validate
 * @returns {object} { valid: boolean, errors: string[], warnings: string[] }
 */
function validateConfig(config) {
  const errors = [];
  const warnings = [];
  
  // Required top-level fields
  if (!config) {
    return { valid: false, errors: ['Config is null or undefined'], warnings: [] };
  }
  
  // Check agents section
  if (!config.agents) {
    warnings.push('No agents section in config');
  } else if (config.agents.list) {
    if (!Array.isArray(config.agents.list)) {
      errors.push('agents.list must be an array');
    } else {
      // Validate each agent
      config.agents.list.forEach((agent, idx) => {
        if (!agent.agent_id) {
          errors.push(`agents.list[${idx}]: missing agent_id`);
        }
        if (!agent.name) {
          warnings.push(`agents.list[${idx}]: missing name`);
        }
      });
    }
  }
  
  // Check channels section
  if (!config.channels) {
    warnings.push('No channels section in config');
  } else if (config.channels.list) {
    if (!Array.isArray(config.channels.list)) {
      errors.push('channels.list must be an array');
    }
  }
  
  // Validate port settings
  if (config.openclaw?.port) {
    const port = parseInt(config.openclaw.port);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push('openclaw.port must be between 1 and 65535');
    }
  }
  
  // Validate paths
  if (config.openclaw?.dir) {
    if (typeof config.openclaw.dir !== 'string') {
      errors.push('openclaw.dir must be a string');
    }
  }
  
  const valid = errors.length === 0;
  
  if (!valid) {
    logger.error({ errors, warnings }, '[ConfigValidator] Config validation failed');
  } else if (warnings.length > 0) {
    logger.warn({ warnings }, '[ConfigValidator] Config has warnings');
  }
  
  return { valid, errors, warnings };
}

/**
 * Validate agent update request
 * @param {object} data - Update data
 * @returns {object} { valid: boolean, errors: string[] }
 */
function validateAgentUpdate(data) {
  const errors = [];
  
  if (!data.agent_id) {
    errors.push('agent_id is required');
  }
  
  // Model must be string if provided
  if (data.model !== undefined && typeof data.model !== 'string') {
    errors.push('model must be a string');
  }
  
  // Status must be valid if provided
  const validStatuses = ['idle', 'working', 'paused', 'stopped'];
  if (data.status && !validStatuses.includes(data.status)) {
    errors.push(`status must be one of: ${validStatuses.join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate cron job config
 * @param {object} job - Cron job config
 * @returns {object} { valid: boolean, errors: string[] }
 */
function validateCronJob(job) {
  const errors = [];
  
  if (!job.schedule) {
    errors.push('schedule is required');
  }
  
  if (!job.payload) {
    errors.push('payload is required');
  }
  
  // Validate schedule type
  const validScheduleTypes = ['at', 'every', 'cron'];
  if (job.schedule?.kind && !validScheduleTypes.includes(job.schedule.kind)) {
    errors.push(`schedule.kind must be one of: ${validScheduleTypes.join(', ')}`);
  }
  
  // Validate payload type
  const validPayloadTypes = ['systemEvent', 'agentTurn'];
  if (job.payload?.kind && !validPayloadTypes.includes(job.payload.kind)) {
    errors.push(`payload.kind must be one of: ${validPayloadTypes.join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  validateConfig,
  validateAgentUpdate,
  validateCronJob
};
