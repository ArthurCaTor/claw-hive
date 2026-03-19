import { Application } from 'express';
import * as fs from 'fs';
import * as path from 'path';

function study2Routes(app: Application): void {
  const STUDY2_DIR = path.join(process.env.HOME || '/home/arthur', '.claw-hive', 'study2');

  // Ensure directory exists
  if (!fs.existsSync(STUDY2_DIR)) {
    fs.mkdirSync(STUDY2_DIR, { recursive: true });
  }

  // Default navigation structure
  const DEFAULT_NAV = {
    categories: [
      {
        id: 'stories',
        name: '📖 故事',
        icon: 'book',
        items: [
          { id: 'story-system-startup', name: 'OpenClaw 启动了', story: 'story-system-startup' },
          { id: 'story-telegram-message', name: '我在 Telegram 发了一条消息', story: 'story-telegram-message' },
          { id: 'story-tool-call', name: 'Agent 调用了一个工具', story: 'story-tool-call' },
        ]
      },
      {
        id: 'architecture',
        name: '🏗️ 架构',
        icon: 'grid',
        items: [
          { id: 'module-agent', name: 'Agent Engine', module: 'agent-engine' },
          { id: 'module-provider', name: 'Provider Layer', module: 'provider-layer' },
          { id: 'module-tool', name: 'Tool System', module: 'tool-system' },
        ]
      },
      {
        id: 'interfaces',
        name: '🔌 接口',
        icon: 'code',
        items: [
          { id: 'data-message', name: 'Message', data: 'message' },
          { id: 'data-session', name: 'Session', data: 'session' },
        ]
      },
      {
        id: 'config',
        name: '🎮 配置',
        icon: 'settings',
        items: [
          { id: 'config-model', name: 'LLM Model', config: 'model' },
          { id: 'exp-console-log', name: '加 console.log', experiment: 'add-console-log' },
        ]
      }
    ]
  };

  // GET /api/study2/nav - Navigation structure
  app.get('/api/study2/nav', (req, res) => {
    try {
      const navPath = path.join(STUDY2_DIR, '_meta', 'nav.json');
      if (fs.existsSync(navPath)) {
        return res.json(JSON.parse(fs.readFileSync(navPath, 'utf-8')));
      }
      res.json(DEFAULT_NAV);
    } catch (err) {
      res.json(DEFAULT_NAV);
    }
  });

  // GET /api/study2/stories - List all stories
  app.get('/api/study2/stories', (req, res) => {
    try {
      const storiesDir = path.join(STUDY2_DIR, 'stories');
      const stories = [];
      
      if (fs.existsSync(storiesDir)) {
        const files = fs.readdirSync(storiesDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
          const story = JSON.parse(fs.readFileSync(path.join(storiesDir, file), 'utf-8'));
          stories.push({
            id: story.id,
            title: story.title,
            trigger: story.trigger,
            characters: story.characters,
            key_insight: story.key_insight
          });
        }
      }
      
      res.json({ stories });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load stories' });
    }
  });

  // GET /api/study2/stories/:id - Get single story
  app.get('/api/study2/stories/:id', (req, res) => {
    try {
      const { id } = req.params;
      const storyPath = path.join(STUDY2_DIR, 'stories', `${id}.json`);
      
      if (fs.existsSync(storyPath)) {
        const story = JSON.parse(fs.readFileSync(storyPath, 'utf-8'));
        return res.json(story);
      }
      
      // Try markdown version
      const mdPath = path.join(STUDY2_DIR, 'stories', `${id}.md`);
      if (fs.existsSync(mdPath)) {
        return res.json({ 
          id, 
          title: id.replace(/-/g, ' '),
          content: fs.readFileSync(mdPath, 'utf-8'),
          format: 'markdown'
        });
      }
      
      res.status(404).json({ error: 'Story not found' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load story' });
    }
  });

  // GET /api/study2/architecture/modules - List modules
  app.get('/api/study2/architecture/modules', (req, res) => {
    try {
      const modulesDir = path.join(STUDY2_DIR, 'architecture', 'modules');
      const modules = [];
      
      if (fs.existsSync(modulesDir)) {
        const files = fs.readdirSync(modulesDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
          const mod = JSON.parse(fs.readFileSync(path.join(modulesDir, file), 'utf-8'));
          modules.push({
            id: mod.id,
            name: mod.name,
            icon: mod.icon,
            one_line: mod.one_line
          });
        }
      }
      
      res.json({ modules });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load modules' });
    }
  });

  // GET /api/study2/architecture/modules/:id - Get single module
  app.get('/api/study2/architecture/modules/:id', (req, res) => {
    try {
      const { id } = req.params;
      const modulePath = path.join(STUDY2_DIR, 'architecture', 'modules', `${id}.json`);
      
      if (fs.existsSync(modulePath)) {
        const mod = JSON.parse(fs.readFileSync(modulePath, 'utf-8'));
        return res.json(mod);
      }
      
      res.status(404).json({ error: 'Module not found' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load module' });
    }
  });

  // GET /api/study2/interfaces/data - List data objects
  app.get('/api/study2/interfaces/data', (req, res) => {
    try {
      const dataDir = path.join(STUDY2_DIR, 'interfaces', 'data');
      const dataObjects = [];
      
      if (fs.existsSync(dataDir)) {
        const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
          const obj = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf-8'));
          dataObjects.push({
            id: obj.id,
            name: obj.name,
            nickname: obj.nickname,
            what_is_it: obj.what_is_it
          });
        }
      }
      
      res.json({ dataObjects });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load data objects' });
    }
  });

  // GET /api/study2/interfaces/data/:id - Get single data passport
  app.get('/api/study2/interfaces/data/:id', (req, res) => {
    try {
      const { id } = req.params;
      const dataPath = path.join(STUDY2_DIR, 'interfaces', 'data', `${id}.json`);
      
      if (fs.existsSync(dataPath)) {
        const obj = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
        return res.json(obj);
      }
      
      res.status(404).json({ error: 'Data object not found' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load data object' });
    }
  });

  // GET /api/study2/config/experiments - List experiments
  app.get('/api/study2/config/experiments', (req, res) => {
    try {
      const expDir = path.join(STUDY2_DIR, 'config', 'experiments');
      const experiments = [];
      
      if (fs.existsSync(expDir)) {
        const files = fs.readdirSync(expDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
          const exp = JSON.parse(fs.readFileSync(path.join(expDir, file), 'utf-8'));
          experiments.push({
            id: exp.id,
            title: exp.title,
            difficulty: exp.difficulty,
            time: exp.time,
            goal: exp.goal
          });
        }
      }
      
      res.json({ experiments });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load experiments' });
    }
  });

  // GET /api/study2/config/experiments/:id - Get single experiment
  app.get('/api/study2/config/experiments/:id', (req, res) => {
    try {
      const { id } = req.params;
      const expPath = path.join(STUDY2_DIR, 'config', 'experiments', `${id}.json`);
      
      if (fs.existsSync(expPath)) {
        const exp = JSON.parse(fs.readFileSync(expPath, 'utf-8'));
        return res.json(exp);
      }
      
      res.status(404).json({ error: 'Experiment not found' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load experiment' });
    }
  });

  // GET /api/study2/progress - Get learning progress
  app.get('/api/study2/progress', (req, res) => {
    try {
      const progressPath = path.join(STUDY2_DIR, 'progress.json');
      if (fs.existsSync(progressPath)) {
        return res.json(JSON.parse(fs.readFileSync(progressPath, 'utf-8')));
      }
      res.json({ completedStories: [], completedModules: [], notes: [] });
    } catch (err) {
      res.json({ completedStories: [], completedModules: [], notes: [] });
    }
  });

  // POST /api/study2/progress/complete - Mark item as complete
  app.post('/api/study2/progress/complete', (req, res) => {
    try {
      const { type, id } = req.body;
      const progressPath = path.join(STUDY2_DIR, 'progress.json');
      
      let progress = { completedStories: [], completedModules: [], notes: [] };
      if (fs.existsSync(progressPath)) {
        progress = JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
      }
      
      if (type === 'story') {
        if (!progress.completedStories.includes(id)) {
          progress.completedStories.push(id);
        }
      } else if (type === 'module') {
        if (!progress.completedModules.includes(id)) {
          progress.completedModules.push(id);
        }
      }
      
      fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
      res.json({ status: 'ok', progress });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update progress' });
    }
  });

  // GET /api/study2 - Main page data
  app.get('/api/study2', (req, res) => {
    res.json({
      welcome: {
        title: '📚 OpenClaw 学习中心',
        subtitle: '通过故事和实验深入理解系统',
        study1Url: '/study'
      }
    });
  });
}

module.exports = study2Routes;
