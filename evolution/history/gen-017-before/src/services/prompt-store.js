// Prompt Store - Record LLM prompts and responses
const fs = require('fs-extra');
const path = require('path');

class PromptStore {
  constructor(agentName, sessionId) {
    this.sessionId = sessionId || `session-${Date.now()}`;
    this.agentName = agentName;
    this.baseDir = path.join(
      process.env.HOME || '~',
      '.claw-hive',
      'recordings',
      agentName,
      this.sessionId
    );
    
    fs.ensureDirSync(this.baseDir);
    
    this.sequenceNum = 0;
    
    // Flush buffer every 2 seconds
    this.flushInterval = setInterval(() => this.flush(), 2000);
    
    console.log(`[PromptStore] Initialized: ${this.baseDir}`);
  }

  write(record) {
    this.sequenceNum++;
    const filename = `prompt-${String(this.sequenceNum).padStart(4, '0')}.json`;
    
    // Real-time write for UI display
    fs.writeJsonSync(
      path.join(this.baseDir, filename),
      record,
      { spaces: 2 }
    );

    // Buffer for batch write
    if (!this.buffer) this.buffer = [];
    this.buffer.push(record);
  }

  flush() {
    if (!this.buffer || this.buffer.length === 0) return;

    const summaryFile = path.join(this.baseDir, 'session.jsonl');
    const lines = this.buffer.map(r => JSON.stringify(r)).join('\n') + '\n';

    fs.appendFileSync(summaryFile, lines);
    this.buffer = [];
  }

  readAll() {
    const files = fs.readdirSync(this.baseDir)
      .filter(f => f.startsWith('prompt-') && f.endsWith('.json'))
      .sort();

    const records = [];
    for (const file of files) {
      try {
        const record = fs.readJsonSync(path.join(this.baseDir, file));
        records.push(record);
      } catch (e) {}
    }
    return records;
  }

  // Reconstruct full context window
  async reconstructContextWindow() {
    const records = this.readAll();
    const inputs = records.filter(r => r.direction === 'input');

    let systemPrompt = null;
    const messages = [];
    const tools = [];

    for (const record of inputs) {
      if (record.body?.messages) {
        for (const msg of record.body.messages) {
          if (msg.role === 'system') {
            systemPrompt = msg.content;
          } else {
            messages.push(msg);
          }
        }
        if (record.body.tools) {
          tools.push(...record.body.tools);
        }
      } else if (record.role) {
        if (record.role === 'system') {
          systemPrompt = record.content;
        } else {
          messages.push({ role: record.role, content: record.content });
        }
      }
    }

    const totalText = [
      systemPrompt || '',
      ...messages.map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content)),
    ].join('');

    return {
      system_prompt: systemPrompt,
      messages,
      tools: [...new Set(tools.map(JSON.stringify))].map(JSON.parse),
      total_tokens_estimate: Math.ceil(totalText.length / 3),
    };
  }

  close() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }

  getSessionDir() {
    return this.baseDir;
  }
}

module.exports = { PromptStore };
