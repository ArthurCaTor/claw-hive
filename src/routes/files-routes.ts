// Files routes
// Extracted from server.js
import { Application } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Helper function to get workspace paths
function getWorkspacePaths() {
  return {
    nova: path.join(os.homedir(), '.openclaw', 'workspace-nova'),
    coder: path.join(os.homedir(), '.openclaw', 'workspace-coder'),
    scout: path.join(os.homedir(), '.openclaw', 'workspace-scout'),
    memory: path.join(os.homedir(), '.openclaw', 'workspace-memory'),
  };
}

// Helper function to validate and resolve file path within workspace
function resolveWorkspacePath(workspace, reqPath) {
  const workspacePaths = getWorkspacePaths();
  const basePath = workspacePaths[workspace] || workspacePaths.coder;
  const targetPath = reqPath ? path.join(basePath, reqPath) : basePath;
  
  // Security: ensure path is within workspace
  if (!targetPath.startsWith(basePath)) {
    return { error: 'Path outside workspace' };
  }
  
  return { basePath, targetPath };
}

export default function filesRoutes(app: Application): void {
  // List files in workspace
  app.get('/api/files', (req, res) => {
    const reqPath = req.query.path;
    const workspace = req.query.workspace;
    
    // Security: prevent path traversal
    if (reqPath && (String(reqPath).includes('..') || String(reqPath).includes('~'))) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    
    const resolved = resolveWorkspacePath(workspace, reqPath);
    if (resolved.error) {
      return res.status(400).json({ error: resolved.error });
    }
    
    const { targetPath } = resolved;
    
    if (!fs.existsSync(targetPath)) {
      res.json({ error: 'Path not found' });
      return;
    }
    
    try {
      const items = fs.readdirSync(targetPath, { withFileTypes: true });
      const files = items.map(item => ({
        name: item.name,
        type: item.isDirectory() ? 'directory' : 'file',
        path: reqPath || '',
        size: item.isDirectory() ? 0 : fs.statSync(path.join(targetPath, item.name)).size,
        modified: fs.statSync(path.join(targetPath, item.name)).mtime.toISOString(),
      }));
      
      res.json({
        workspace,
        path: reqPath || '/',
        items: files,
      });
    } catch (e) {
      res.json({ error: 'Failed to read file list' });
    }
  });

  // Get file content
  app.get('/api/files/content', (req, res) => {
    const { workspace, path: filePath } = req.query;
    
    // Security: prevent path traversal
    if (filePath && (String(filePath).includes('..') || String(filePath).includes('~'))) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    
    const resolved = resolveWorkspacePath(workspace, filePath);
    if (resolved.error) {
      return res.status(400).json({ error: resolved.error });
    }
    
    const { targetPath } = resolved;
    
    if (!fs.existsSync(targetPath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    
    try {
      const content = fs.readFileSync(targetPath, 'utf8');
      res.json({
        workspace,
        path: filePath,
        content,
        size: fs.statSync(targetPath).size,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
};
