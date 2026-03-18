// @ts-nocheck
/**
 * LLM Tracker Routes
 */

const express = require('express');
const router = express.Router();
const { llmTracker } = require('../services/llm-tracker');

/**
 * GET /api/llm-tracker/agents
 * Get all agent LLM states
 */
router.get('/api/llm-tracker/agents', (req, res) => {
  res.json({
    success: true,
    agents: llmTracker.getAllAgentStates(),
  });
});

/**
 * GET /api/llm-tracker/agents/:id
 * Get LLM state for specific agent
 */
router.get('/api/llm-tracker/agents/:id', (req, res) => {
  const state = llmTracker.getAgentState(req.params.id);
  if (!state) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  res.json({ success: true, ...state });
});

/**
 * GET /api/llm-tracker/switches
 * Get recent LLM switches
 */
router.get('/api/llm-tracker/switches', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const switches = llmTracker.getRecentSwitches(limit);
  res.json({
    success: true,
    count: switches.length,
    switches,
  });
});

/**
 * GET /api/llm-tracker/providers
 * Get provider statistics
 */
router.get('/api/llm-tracker/providers', (req, res) => {
  res.json({
    success: true,
    providers: llmTracker.getProviderStats(),
  });
});

/**
 * GET /api/llm-tracker/stream
 * SSE stream for LLM switch events
 */
router.get('/api/llm-tracker/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const onSwitch = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  llmTracker.on('llm-switch', onSwitch);
  
  req.on('close', () => {
    llmTracker.off('llm-switch', onSwitch);
  });
});

module.exports = router;
