// @ts-nocheck
/**
 * Structured Logger using Pino
 */
const pino = require('pino');

const logger = pino({
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

/**
 * Create a child logger with bindings
 * @param {object} bindings - Key-value pairs to add to all logs
 */
function child(bindings: Record<string, any>): any {
  return logger.child(bindings);
}

module.exports = { logger, child };
