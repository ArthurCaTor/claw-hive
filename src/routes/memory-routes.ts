// Memory routes
// Extracted from server.js
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Application } from 'express';

interface MemoryPath {
  base: string;
  workspace: string;
}

// Helper function to get memory paths
function getMemoryPaths(): MemoryPath[] {
  return [
    { base: path.join(os.homedir(), '.openclaw', 'workspace-memory'), workspace: 'memory' },
    { base: path.join(os.homedir(), '.openclaw', 'workspace-coder', 'memory'), workspace: 'coder' },
    { base: path.join(os.homedir(), '.openclaw', 'workspace-nova', 'memory'), workspace: 'nova' },
    { base: path.join(os.homedir(), '.openclaw', 'workspace-scout', 'memory'), workspace: 'scout' },
  ];
}

// Helper to find memory file
function findMemoryFile(id: string): { filePath: string; workspace: string } | null {
  const memoryPaths = getMemoryPaths();
  
  for (const mp of memoryPaths) {
    const filePath = path.join(mp.base, `${id}.md`);
    if (fs.existsSync(filePath)) {
      return { filePath, workspace: mp.workspace };
    }
  }
  return null;
}

export default function memoryRoutes(app: Application): void {
  // Get list of memory files
  app.get('/api/memory', (req, res) => {
    const memoryPaths = getMemoryPaths();
    const memories = [];
    
    for (const mp of memoryPaths) {
      if (fs.existsSync(mp.base)) {
        try {
          const files = fs.readdirSync(mp.base);
          
          for (const file of files) {
            if (file.endsWith('.md')) {
              const filePath = path.join(mp.base, file);
              const stats = fs.statSync(filePath);
              memories.push({
                id: `${mp.workspace}/${file.replace('.md', '')}`,
                workspace: mp.workspace,
                filename: file,
                path: filePath,
                size: stats.size,
                modified: stats.mtime.toISOString(),
              });
            }
          }
        } catch (e) {
          console.error('Error reading memory path:', mp.base, e.message);
        }
      }
    }
    
    memories.sort((a, b) => (new Date(b.modified).getTime() - new Date(a.modified).getTime()));
    
    res.json({
      timestamp: new Date().toISOString(),
      memories: memories.slice(0, 50),
    });
  });

  // Get specific memory file content
  app.get('/api/memory/*', (req, res) => {
    let id = String(req.params[0]);
    
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
    
    const found = findMemoryFile(id);
    
    if (found) {
      try {
        const content = fs.readFileSync(found.filePath, 'utf8');
        res.json({
          id,
          path: found.filePath,
          content,
        });
      } catch (e) {
        res.json({ error: 'Failed to read memory file' });
      }
    } else {
      res.json({ error: 'Memory file not found' });
    }
  });
};
