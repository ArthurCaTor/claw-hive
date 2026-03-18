// @ts-nocheck
/**
 * Cost Routes
 * 
 * API endpoints for cost calculation and tracking.
 */

const express = require('express');
const router = express.Router();
const { costCalculator } = require('../services/cost-calculator');

/**
 * GET /api/cost/summary
 * Get cost summary
 */
router.get('/api/cost/summary', (req, res) => {
  try {
    const summary = costCalculator.getCostSummary();
    res.json({
      success: true,
      ...summary,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/cost/pricing
 * Get all pricing
 */
router.get('/api/cost/pricing', (req, res) => {
  res.json({
    success: true,
    pricing: costCalculator.getAllPricing(),
  });
});

/**
 * POST /api/cost/pricing
 * Update pricing for a model
 */
router.post('/api/cost/pricing', (req, res) => {
  try {
    const { model, input, output } = req.body;
    
    if (!model || typeof input !== 'number' || typeof output !== 'number') {
      return res.status(400).json({ 
        success: false, 
        error: 'Required: model (string), input (number), output (number)' 
      });
    }
    
    costCalculator.setPricing(model, input, output);
    res.json({ success: true, model, input, output });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
