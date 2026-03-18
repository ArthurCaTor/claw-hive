// @ts-nocheck
/**
 * Structured Logger using Pino
 * 使用 Pino 的结构化日志
 */
const pino = require('pino');

const _logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { 
      colorize: true, 
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    },
  } : undefined,
  base: { service: 'claw-hive', pid: process.pid },
});

function child(bindings: Record<string, unknown>) {
  return _logger.child(bindings);
}

module.exports = { logger: _logger, child };
