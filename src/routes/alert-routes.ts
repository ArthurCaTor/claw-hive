// @ts-nocheck
/**
 * Alert Routes
 */

const express = require('express');
const router = express.Router();
const { alertService } = require('../services/alert-service');

/**
 * GET /api/alerts
 * Get alerts
 */
router.get('/api/alerts', (req, res) => {
  const { level, type, acknowledged, limit } = req.query;
  
  const alerts = alertService.getAlerts({
    level,
    type,
    acknowledged: acknowledged === 'true' ? true : acknowledged === 'false' ? false : undefined,
    limit: limit ? parseInt(limit) : undefined,
  });
  
  res.json({
    success: true,
    count: alerts.length,
    alerts,
  });
});

/**
 * GET /api/alerts/summary
 * Get alert summary
 */
router.get('/api/alerts/summary', (req, res) => {
  res.json({
    success: true,
    ...alertService.getSummary(),
  });
});

/**
 * POST /api/alerts/:id/acknowledge
 * Acknowledge an alert
 */
router.post('/api/alerts/:id/acknowledge', (req, res) => {
  const success = alertService.acknowledgeAlert(req.params.id);
  res.json({ success });
});

/**
 * POST /api/alerts/acknowledge-all
 * Acknowledge all alerts
 */
router.post('/api/alerts/acknowledge-all', (req, res) => {
  const count = alertService.acknowledgeAll();
  res.json({ success: true, acknowledged: count });
});

/**
 * DELETE /api/alerts
 * Clear all alerts
 */
router.delete('/api/alerts', (req, res) => {
  const count = alertService.clearAlerts();
  res.json({ success: true, cleared: count });
});

/**
 * GET /api/alerts/rules
 * Get alert rules
 */
router.get('/api/alerts/rules', (req, res) => {
  res.json({
    success: true,
    rules: alertService.getRules(),
  });
});

/**
 * PUT /api/alerts/rules/:id
 * Update a rule
 */
router.put('/api/alerts/rules/:id', (req, res) => {
  const success = alertService.updateRule(req.params.id, req.body);
  res.json({ success });
});

/**
 * GET /api/alerts/stream
 * SSE stream for real-time alerts
 */
router.get('/api/alerts/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const onAlert = (alert) => {
    res.write(`data: ${JSON.stringify(alert)}\n\n`);
  };

  alertService.on('alert', onAlert);
  
  req.on('close', () => {
    alertService.off('alert', onAlert);
  });
});

module.exports = router;
