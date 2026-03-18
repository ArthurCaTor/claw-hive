// @ts-nocheck
/**
 * Export Routes
 * 
 * Export captures and statistics to various formats.
 */

const express = require('express');
const router = express.Router();
const { llmProxy } = require('../services/llm-proxy');
const { costCalculator } = require('../services/cost-calculator');
const { tokenAggregator } = require('../services/token-aggregator');

/**
 * GET /api/export/captures/json
 * Export captures as JSON
 */
router.get('/api/export/captures/json', (req, res) => {
  const captures = llmProxy.getCaptures();
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="captures-${Date.now()}.json"`);
  
  res.json({
    exportedAt: new Date().toISOString(),
    count: captures.length,
    captures,
  });
});

/**
 * GET /api/export/captures/csv
 * Export captures as CSV
 */
router.get('/api/export/captures/csv', (req, res) => {
  const captures = llmProxy.getCaptures();
  
  const headers = [
    'id',
    'timestamp',
    'model',
    'status',
    'latency_ms',
    'input_tokens',
    'output_tokens',
    'total_tokens',
    'message_count',
    'tool_count',
  ];
  
  const rows = captures.map(c => [
    c.id,
    c.timestamp,
    c.request?.body?.model || 'unknown',
    c.response?.status || 0,
    c.latency_ms || 0,
    c.tokens?.input || 0,
    c.tokens?.output || 0,
    (c.tokens?.input || 0) + (c.tokens?.output || 0),
    c.request?.body?.messages?.length || 0,
    c.request?.body?.tools?.length || 0,
  ]);
  
  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="captures-${Date.now()}.csv"`);
  res.send(csv);
});

/**
 * GET /api/export/cost-report
 * Export cost report as JSON
 */
router.get('/api/export/cost-report', (req, res) => {
  const costSummary = costCalculator.getCostSummary();
  const tokenStats = tokenAggregator.getStats();
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="cost-report-${Date.now()}.json"`);
  
  res.json({
    exportedAt: new Date().toISOString(),
    cost: costSummary,
    tokens: tokenStats,
  });
});

/**
 * GET /api/export/captures/:id
 * Export single capture
 */
router.get('/api/export/captures/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const capture = llmProxy.getCapture(id);
  
  if (!capture) {
    return res.status(404).json({ error: 'Capture not found' });
  }
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="capture-${id}.json"`);
  res.json(capture);
});

module.exports = router;
