// Memory routes
// Extracted from server.js
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = function(app) {
  // Get list of memory files
  app.get('/api/memory', (req, res) => {
    const memoryPaths = [
      path.join(os.homedir(), '.openclaw', 'workspace-memory'),
      path.join(os.homedir(), '.openclaw', 'workspace-coder', 'memory'),
      path.join(os.homedir(), '.openclaw', 'workspace-nova', 'memory'),
      path.join(os.homedir(), '.openclaw', 'workspace-scout', 'memory'),
    ];
    
    const memories = [];
    
    for (const memPath of memoryPaths) {
      if (fs.existsSync(memPath)) {
        try {
          const files = fs.readdirSync(memPath);
          const wsName = path.basename(path.dirname(memPath));
          
          for (const file of files) {
            if (file.endsWith('.md')) {
              const filePath = path.join(memPath, file);
              const stats = fs.statSync(filePath);
              memories.push({
                id: `${wsName}/${file.replace('.md', '')}`,
                workspace: wsName,
                filename: file,
                path: filePath,
                size: stats.size,
                modified: stats.mtime.toISOString(),
              });
            }
          }
        } catch (e) {
          console.error('Error reading memory path:', memPath, e.message);
        }
      }
    }
    
    memories.sort((a, b) => new Date(b.modified) - new Date(a.modified));
    
    res.json({
      timestamp: new Date().toISOString(),
      memories: memories.slice(0, 50),
    });
  });

  // Get specific memory file content
  app.get('/api/memory/*', (req, res) => {
    let id = req.params[0];
    
    // Security: prevent path traversal
    if (id && (id.includes('..') || id.includes('~'))) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    
    if (id && id.includes('/')) {
      id = id.split('/').pop();
    }
    
    // Additional validation: only allow alphanumeric and hyphens
    if (id && !/^[a-zA-Z0-9\-]+$/.test(id)) {
      return res.status(400).json({ error: 'Invalid memory ID' });
    }
    
    const memoryPaths = [
      path.join(os.homedir(), '.openclaw', 'workspace-memory'),
      path.join(os.homedir(), '.openclaw', 'workspace-coder', 'memory'),
      path.join(os.homedir(), '.openclaw', 'workspace-nova', 'memory'),
      path.join(os.homedir(), '.openclaw', 'workspace-scout', 'memory'),
    ];
    
    for (const memPath of memoryPaths) {
      const filePath = path.join(memPath, `${id}.md`);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          res.json({
            id,
            path: filePath,
            content,
          });
          return;
        } catch (e) {
          res.json({ error: e.message });
          return;
        }
      }
    }
    
    res.json({ error: 'Memory file not found' });
  });
};
