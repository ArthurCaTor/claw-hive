/**
 * @file src/routes/openclaw-routes.js
 * @description API routes for OpenClaw data using direct file reading
 * 使用直接文件读取的 OpenClaw 数据 API 路由
 */

const express = require('express');
const router = express.Router();

const { openclawReader } = require('../services/openclaw-reader');

/**
 * GET /api/openclaw/agents
 */
router.get('/agents', async (req, res) => {
  try {
    const agents = await openclawReader.getAgents();
    res.json({ success: true, agents, count: agents.length });
  } catch (error) {
    console.error('[API] Error getting agents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/openclaw/agents/:id
 */
router.get('/agents/:id', async (req, res) => {
  try {
    const agent = await openclawReader.getAgent(req.params.id);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }
    res.json({ success: true, agent });
  } catch (error) {
    console.error('[API] Error getting agent:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/openclaw/sessions
 */
router.get('/sessions', async (req, res) => {
  try {
    const { agent } = req.query;
    const sessions = await openclawReader.getSessions({ agentId: agent });
    res.json({ success: true, sessions, count: sessions.length });
  } catch (error) {
    console.error('[API] Error getting sessions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/openclaw/sessions/:id
 */
router.get('/sessions/:id', async (req, res) => {
  try {
    const session = await openclawReader.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    res.json({ success: true, session });
  } catch (error) {
    console.error('[API] Error getting session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/openclaw/sessions/:id/messages
 */
router.get('/sessions/:id/messages', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const messages = await openclawReader.getSessionMessages(req.params.id, limit);
    res.json({ success: true, messages, count: messages.length });
  } catch (error) {
    console.error('[API] Error getting messages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/openclaw/status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await openclawReader.getStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    console.error('[API] Error getting status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/openclaw/dashboard
 * Single call for all dashboard data
 */
router.get('/dashboard', async (req, res) => {
  try {
    const data = await openclawReader.getDashboardData();
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('[API] Error getting dashboard data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
