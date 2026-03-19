import { Application } from 'express';
import * as fs from 'fs';
import * as path from 'path';

function studyRoutes(app: Application): void {
  const STUDY_DIR = path.join(process.env.HOME || '/home/arthur', '.claw-hive', 'study');

  // Ensure directory exists
  if (!fs.existsSync(STUDY_DIR)) {
    fs.mkdirSync(STUDY_DIR, { recursive: true });
  }

  // Default study tree structure
  const DEFAULT_TREE = {
    '📐 System Overview': [
      { id: 'system-overview', title: 'System Architecture Overview', layer: 0, category: 'system' }
    ],
    '📦 Core Modules': [
      { id: 'agent-lifecycle', title: 'Agent Lifecycle', layer: 1, category: 'modules' },
      { id: 'tool-system', title: 'Tool System', layer: 1, category: 'modules' },
      { id: 'provider-layer', title: 'Provider Layer', layer: 1, category: 'modules' },
      { id: 'session-memory', title: 'Session & Memory', layer: 1, category: 'modules' },
      { id: 'config-system', title: 'Config System', layer: 1, category: 'modules' }
    ],
    '🔗 Module Interactions': [
      { id: 'full-lifecycle', title: 'Full Request Lifecycle', layer: 3, category: 'interactions' }
    ]
  };

  // GET /api/study/tree - Return study tree structure
  app.get('/api/study/tree', (req, res) => {
    try {
      const customTreePath = path.join(STUDY_DIR, '_meta', 'tree.json');
      
      if (fs.existsSync(customTreePath)) {
        const customTree = JSON.parse(fs.readFileSync(customTreePath, 'utf-8'));
        return res.json(customTree);
      }
      
      res.json(DEFAULT_TREE);
    } catch (err) {
      console.error('Error loading study tree:', err);
      res.json(DEFAULT_TREE);
    }
  });

  // GET /api/study/diagrams/:id - Get specific diagram
  app.get('/api/study/diagrams/:id', (req, res) => {
    try {
      const { id } = req.params;
      
      const searchPaths = [
        path.join(STUDY_DIR, `${id}.mermaid`),
        path.join(STUDY_DIR, 'system', `${id}.mermaid`),
        path.join(STUDY_DIR, 'modules', id, `${id}.mermaid`),
        path.join(STUDY_DIR, 'interactions', `${id}.mermaid`),
      ];
      
      for (const diagramPath of searchPaths) {
        if (fs.existsSync(diagramPath)) {
          const metaPath = diagramPath.replace('.mermaid', '.meta.json');
          const diagram = fs.readFileSync(diagramPath, 'utf-8');
          
          let meta = {
            id,
            title: id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            lastUpdated: new Date().toISOString()
          };
          
          if (fs.existsSync(metaPath)) {
            meta = { ...meta, ...JSON.parse(fs.readFileSync(metaPath, 'utf-8')) };
          }
          
          return res.json({ ...meta, mermaid: diagram });
        }
      }
      
      res.status(404).json({ error: 'Diagram not found' });
    } catch (err) {
      console.error('Error loading diagram:', err);
      res.status(500).json({ error: 'Internal error' });
    }
  });

  // POST /api/study/refresh - Trigger re-analysis
  app.post('/api/study/refresh', (req, res) => {
    res.json({
      status: 'ok',
      message: 'Analysis refresh triggered',
      note: 'This would trigger OpenClaw source analysis'
    });
  });

  // GET /api/study/changelog - Get changelog
  app.get('/api/study/changelog', (req, res) => {
    try {
      const changelogPath = path.join(STUDY_DIR, '_meta', 'changelog.json');
      
      if (fs.existsSync(changelogPath)) {
        const changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf-8'));
        return res.json(changelog);
      }
      
      res.json([
        { date: new Date().toISOString(), action: 'Initial setup', details: 'Study page created' }
      ]);
    } catch (err) {
      res.status(500).json({ error: 'Internal error' });
    }
  });
}

module.exports = studyRoutes;
