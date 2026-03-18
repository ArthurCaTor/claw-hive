/**
 * Structured Logger using Pino
 * 使用 Pino 的结构化日志
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
 * 带绑定的子日志器
 * @param {object} bindings - Key-value pairs to add to all logs
 * @returns {pino.Logger} Child logger
 */
function child(bindings) {
  return logger.child(bindings);
}

module.exports = { logger, child };
