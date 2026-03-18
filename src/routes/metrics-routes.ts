// @ts-nocheck
/**
 * Prometheus Metrics Routes
 */

const express = require('express');
const router = express.Router();
const promClient = require('prom-client');

const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

/**
 * GET /metrics
 * Prometheus metrics endpoint
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await register.metrics();
    res.set('Content-Type', register.contentType);
    res.send(metrics);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;
