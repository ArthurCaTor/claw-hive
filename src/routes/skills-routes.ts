// @ts-nocheck
// Skills routes
// Extracted from server.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Application } = require('express');

interface Skill {
  id: string;
  name: string;
  description: string;
  emoji: string;
}

module.exports = function skillsRoutes(app: Application): void {
  // Get available skills
  app.get('/api/skills', (req, res) => {
    const nodePath = execSync('npm root -g', { encoding: 'utf8' }).trim();
    const skillsDir = path.join(nodePath, 'openclaw', 'skills');
    
    if (!fs.existsSync(skillsDir)) {
      res.json({ total: 0, skills: [], error: 'Skills directory not found' });
      return;
    }
    
    try {
      const skillDirs = fs.readdirSync(skillsDir).filter(f => {
        const stat = fs.statSync(path.join(skillsDir, f));
        return stat.isDirectory();
      });
      
      const skills: Skill[] = skillDirs.map(skillId => {
        const skillPath = path.join(skillsDir, skillId, 'SKILL.md');
        if (!fs.existsSync(skillPath)) {
          return { id: skillId, name: skillId, description: '', emoji: '🛠️' };
        }
        
        try {
          const content = fs.readFileSync(skillPath, 'utf8');
          const frontMatch = content.match(/^---\n([\s\S]*?)\n---/);
          if (frontMatch) {
            const nameMatch = frontMatch[1].match(/name:\s*"([^"]+)"/);
            const descMatch = frontMatch[1].match(/description:\s*"([^"]+)"/);
            const emojiMatch = frontMatch[1].match(/emoji:\s*"([^"]+)"/);
            
            return {
              id: skillId,
              name: nameMatch ? nameMatch[1] : skillId,
              description: descMatch ? descMatch[1] : '',
              emoji: emojiMatch ? emojiMatch[1] : '🛠️',
            };
          }
          return { id: skillId, name: skillId, description: '', emoji: '🛠️' };
        } catch (e) {
          return { id: skillId, name: skillId, description: '', emoji: '🛠️' };
        }
      });
      
      res.json({ total: skills.length, skills });
    } catch (e) {
      res.json({ total: 0, skills: [], error: String(e) });
    }
  });
};
