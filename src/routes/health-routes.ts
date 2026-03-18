// @ts-nocheck
// Health check routes
// Extracted from server.js
const { Application, Request, Response } = require('express');

/**
 * Health check route module
 * @param app - Express application
 */
module.exports = function healthRoutes(app: Application): void {
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      openclaw_accessible: true,
    });
  });
}
