// @ts-nocheck

const _express = require('express');
const _cors = require('cors');
const _compression = require('compression');
const _ws = require('ws');
const _path = require('path');
const _os = require('os');
const _child = require('child_process');
const _fs = require('fs');

const { createRateLimiter } = require('./utils/rate-limiter');
const { logger, child } = require('./utils/logger');
const { validateConfig, validateAgentUpdate, validateCronJob } = require('./utils/config-validator');
const swaggerSpec = require('./utils/openapi-spec');
const swaggerUi = require('swagger-ui-express');

const _debugService = require('./services/debug-service');
const _sessionWatcher = require('./services/session-watcher');
const _recordingStore = require('./services/recording-store');
const { openclawReader } = require('./services/openclaw-reader');
const { llmTracker } = require('./services/llm-tracker');

const app = _express();
const PORT = process.env.OPENCLAW_DASHBOARD_PORT || process.env.PORT || 8080;

process.on('uncaughtException', (err: any) => {
  logger.fatal({ err: err.message, stack: err.stack }, '[FATAL] Uncaught Exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  logger.error({ reason }, '[ERROR] Unhandled Rejection');
});

app.use(_cors());
app.use(_compression({
  filter: (req: any, res: any) => {
    if (req.path.includes('context-stream') || req.path.includes('debug-proxy/stream')) {
      return false;
    }
    return _compression.filter(req, res);
  }
}));
app.use(_express.json({ limit: '10mb' }));

app.use((req: any, res: any, next: any) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 500 || req.path.startsWith('/api')) {
      logger.info({ method: req.method, path: req.path, status: res.statusCode, duration }, '[HTTP]');
    }
  });
  next();
});

// Load route files
const routeFiles = [
  './routes/health-routes',
  './routes/model-routes',
  './routes/skills-routes',
  './routes/channel-routes',
  './routes/log-routes',
  './routes/memory-routes',
  './routes/search-routes',
  './routes/session-search-routes',
  './routes/recording-routes',
  './routes/openclaw-routes',
  './routes/agent-routes',
  './routes/stats-routes',
  './routes/system-routes',
  './routes/debug-proxy-routes',
  './routes/files-routes',
  './routes/metrics-routes'
];

for (const routeFile of routeFiles) {
  try {
    const routeModule = require(routeFile);
    if (routeModule.router) app.use('/api', routeModule.router);
    else if (routeModule.default) app.use('/api', routeModule.default);
  } catch (err: any) {
    logger.warn({ err: err.message, routeFile }, '[Route] Failed to load');
  }
}

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Static files
const STATIC_DIR = process.env.STATIC_DIR || _path.join(__dirname, '../public');
if (_fs.existsSync(STATIC_DIR)) {
  app.use(_express.static(STATIC_DIR));
  app.get('/', (req: any, res: any) => res.sendFile(_path.join(STATIC_DIR, 'index.html')));
  app.get('/legacy', (req: any, res: any) => res.sendFile(_path.join(STATIC_DIR, 'legacy.html')));
}

// WebSocket
const wss = new _ws.Server({ noServer: true });
wss.on('connection', (ws: any) => {
  logger.info('[WebSocket] Client connected');
  ws.on('message', (message: any) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'subscribe') {
        // Handle subscription
      }
    } catch {}
  });
});

const _http = require('http');
const server = _http.createServer(app);
server.on('upgrade', (request: any, socket: any, head: any) => {
  if (request.url.startsWith('/ws')) {
    wss.handleUpgrade(request, socket, head, (ws: any) => wss.emit('connection', ws, request));
  }
});

server.listen(PORT, () => {
  logger.info({ PORT, STATIC_DIR }, '[Server] Started');
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = { app, server };
