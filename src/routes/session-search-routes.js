// Session Search routes
// Extracted from server.js

module.exports = function(app, { agentStore }) {
  // Session Search Endpoint
  app.get('/api/sessions/search', (req, res) => {
    const { q } = req.query;
    const query = (q || '').toLowerCase();
    
    // Get all sessions from agentStore
    const sessions = Object.values(agentStore).map(agent => ({
      agent_id: agent.agent_id,
      name: agent.name,
      role: agent.role,
      avatar: agent.avatar,
      color: agent.color,
      status: agent.status,
      task: agent.task,
      output: agent.output,
      model: agent.model,
      heartbeat: agent.heartbeat,
      tokens_used: agent.tokens_used,
      updated_at: agent.updated_at,
    }));
    
    // Filter by query if provided
    let results = sessions;
    if (query) {
      results = sessions.filter(s => 
        (s.name && s.name.toLowerCase().includes(query)) ||
        (s.task && s.task.toLowerCase().includes(query)) ||
        (s.output && s.output.toLowerCase().includes(query)) ||
        (s.agent_id && s.agent_id.toLowerCase().includes(query)) ||
        (s.role && s.role.toLowerCase().includes(query))
      );
    }
    
    res.json({
      query,
      total: results.length,
      sessions: results,
    });
  });
};
