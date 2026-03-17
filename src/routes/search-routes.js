// Search routes
// Extracted from server.js
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = function(app, { agentStore }) {
  // Cross-agent search
  app.get('/api/search', (req, res) => {
    const { q } = req.query;
    const query = (q || '').toLowerCase();
    
    // Input validation: limit query length
    if (query.length > 200) {
      return res.status(400).json({ error: 'Query too long (max 200 characters)' });
    }
    
    if (!query) {
      res.json({ query: '', results: { agents: [], memory: [], files: [] } });
      return;
    }
    
    const results = {
      agents: [],
      memory: [],
      files: [],
    };
    
    // Search in agents
    const agents = Object.values(agentStore);
    results.agents = agents.filter(a => 
      a.name?.toLowerCase().includes(query) ||
      a.agent_id?.toLowerCase().includes(query) ||
      a.task?.toLowerCase().includes(query) ||
      a.output?.toLowerCase().includes(query)
    ).map(a => ({
      type: 'agent',
      id: a.agent_id,
      name: a.name,
      description: a.task || a.status,
    }));
    
    // Search in memory files
    const memoryPaths = [
      { base: path.join(os.homedir(), '.openclaw', 'workspace-coder', 'memory'), workspace: 'coder' },
      { base: path.join(os.homedir(), '.openclaw', 'workspace-nova', 'memory'), workspace: 'nova' },
      { base: path.join(os.homedir(), '.openclaw', 'workspace-scout', 'memory'), workspace: 'scout' },
      { base: path.join(os.homedir(), '.openclaw', 'workspace-memory'), workspace: 'memory' },
    ];
    
    for (const mp of memoryPaths) {
      if (fs.existsSync(mp.base)) {
        try {
          const files = fs.readdirSync(mp.base);
          for (const file of files) {
            if (file.endsWith('.md')) {
              const filePath = path.join(mp.base, file);
              try {
                const content = fs.readFileSync(filePath, 'utf8');
                if (content.toLowerCase().includes(query)) {
                  results.memory.push({
                    type: 'memory',
                    id: `${mp.workspace}/${file.replace('.md', '')}`,
                    name: file,
                    workspace: mp.workspace,
                    snippet: content.substring(0, 200).replace(/[#*`]/g, ''),
                  });
                }
              } catch (e) {
                // Skip files we can't read
              }
            }
          }
        } catch (e) {
          // Skip directories we can't read
        }
      }
    }
    
    res.json({
      query,
      results,
      total: results.agents.length + results.memory.length + results.files.length,
    });
  });
};
