// Health check routes
// Extracted from server.js

module.exports = function(app) {
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      openclaw_accessible: true,
    });
  });
};
