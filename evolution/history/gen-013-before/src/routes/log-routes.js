// Log routes
// Extracted from server.js
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = function(app) {
  // Get list of log files
  app.get('/api/logs', (req, res) => {
    const logPaths = [
      { path: path.join(os.homedir(), '.openclaw'), name: 'OpenClaw' },
      { path: '/var/log', name: 'System' },
    ];
    
    const logs = [];
    
    for (const logPath of logPaths) {
      if (fs.existsSync(logPath.path)) {
        try {
          const files = fs.readdirSync(logPath.path);
          for (const file of files) {
            if (file.endsWith('.log') || file === 'syslog' || file === 'auth.log') {
              const filePath = path.join(logPath.path, file);
              try {
                const stats = fs.statSync(filePath);
                if (stats.isFile()) {
                  logs.push({
                    id: `${logPath.name}/${file}`,
                    name: file,
                    category: logPath.name,
                    path: filePath,
                    size: stats.size,
                    modified: stats.mtime.toISOString(),
                  });
                }
              } catch (e) {
                // Skip files we can't access
              }
            }
          }
        } catch (e) {
          console.error('Error reading log path:', logPath.path, e.message);
        }
      }
    }
    
    logs.sort((a, b) => new Date(b.modified) - new Date(a.modified));
    
    res.json({
      timestamp: new Date().toISOString(),
      logs: logs.slice(0, 30),
    });
  });

  // Get specific log file content
  app.get('/api/logs/*', (req, res) => {
    const id = req.params[0];
    const [category, ...nameParts] = id.split('/');
    const name = nameParts.join('/');
    
    let logPath;
    if (category === 'OpenClaw') {
      logPath = path.join(os.homedir(), '.openclaw', name);
    } else if (category === 'System') {
      logPath = path.join('/var/log', name);
    }
    
    if (logPath && fs.existsSync(logPath)) {
      try {
        const content = fs.readFileSync(logPath, 'utf8');
        const lines = content.split('\n');
        const lastLines = lines.slice(-500).join('\n');
        
        res.json({
          id,
          content: lastLines,
          totalLines: lines.length,
          showingLines: Math.min(500, lines.length),
        });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    } else {
      res.status(404).json({ error: 'Log file not found' });
    }
  });
};
