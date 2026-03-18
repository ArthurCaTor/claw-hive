// @ts-nocheck
/**
 * Optimizer Routes
 */

const express = require('express');
const router = express.Router();
const { messageOptimizer } = require('../services/message-optimizer');

/**
 * GET /api/optimizer/config
 * Get optimizer config
 */
router.get('/api/optimizer/config', (req, res) => {
  res.json({
    success: true,
    config: messageOptimizer.getConfig(),
  });
});

/**
 * POST /api/optimizer/config
 * Update optimizer config
 */
router.post('/api/optimizer/config', (req, res) => {
  messageOptimizer.updateConfig(req.body);
  res.json({
    success: true,
    config: messageOptimizer.getConfig(),
  });
});

/**
 * POST /api/optimizer/enable
 * Enable Active Mode
 */
router.post('/api/optimizer/enable', (req, res) => {
  messageOptimizer.setEnabled(true);
  res.json({ success: true, enabled: true });
});

/**
 * POST /api/optimizer/disable
 * Disable Active Mode (back to Passive)
 */
router.post('/api/optimizer/disable', (req, res) => {
  messageOptimizer.setEnabled(false);
  res.json({ success: true, enabled: false });
});

/**
 * POST /api/optimizer/preview
 * Preview optimization without applying
 */
router.post('/api/optimizer/preview', (req, res) => {
  const wasEnabled = messageOptimizer.isEnabled();
  messageOptimizer.setEnabled(true);
  
  const { body, result } = messageOptimizer.optimize(req.body);
  
  messageOptimizer.setEnabled(wasEnabled);
  
  res.json({
    success: true,
    result,
  });
});

module.exports = router;
