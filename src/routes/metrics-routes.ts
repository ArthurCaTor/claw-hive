/**
 * @file src/routes/metrics-routes.js
 * @description Prometheus metrics endpoint
 * Prometheus 指标端点
 */
const promClient = require('prom-client');

// Create a Registry
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// HTTP request counter
const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

// HTTP request duration
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// Agent count gauge
const agentCount = new promClient.Gauge({
  name: 'claw_hive_agents_total',
  help: 'Total number of active agents',
  registers: [register],
});

// LLM API calls counter
const llmCallsTotal = new promClient.Counter({
  name: 'claw_hive_llm_calls_total',
  help: 'Total number of LLM API calls',
  labelNames: ['provider', 'model'],
  registers: [register],
});

// Cost accumulated
const costTotal = new promClient.Gauge({
  name: 'claw_hive_cost_total_dollars',
  help: 'Total cost in dollars',
  registers: [register],
});

/**
 * Middleware to track HTTP metrics
 * 中间件：追踪 HTTP 指标
 */
function metricsMiddleware(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path || 'unknown';
    
    httpRequestsTotal.inc({
      method: req.method,
      route: route,
      status: res.statusCode,
    });
    
    httpRequestDuration.observe({
      method: req.method,
      route: route,
      status: res.statusCode,
    }, duration);
  });
  
  next();
}

/**
 * Get all metrics
 * 获取所有指标
 */
async function getMetrics(req, res) {
  try {
    const metrics = await register.metrics();
    res.set('Content-Type', register.contentType);
    res.set('Content-Encoding', 'identity');
    res.send(metrics);
  } catch (err) {
    res.status(500).send(err.message);
  }
}

/**
 * Update agent count
 * 更新 Agent 数量
 */
function updateAgentCount(count) {
  agentCount.set(count);
}

/**
 * Record LLM call
 * 记录 LLM 调用
 */
function recordLLMCall(provider, model) {
  llmCallsTotal.inc({ provider, model });
}

/**
 * Update cost total
 * 更新总成本
 */
function updateCostTotal(cost) {
  costTotal.set(cost);
}

module.exports = {
  register,
  metricsMiddleware,
  getMetrics,
  updateAgentCount,
  recordLLMCall,
  updateCostTotal,
};
