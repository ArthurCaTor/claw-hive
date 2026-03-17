// @ts-nocheck
// Recording routes
// Extracted from server.js
const fs = require('fs');
const path = require('path');
const { Application } = require('express');

interface RecordingStore {
  getStatus: () => any;
  startRecording: (name: string) => any;
  stopRecording: () => any;
  start: () => Promise<unknown>;
  stop: () => Promise<unknown>;
  getRecordings: () => unknown[];
  getRecording: (id: string) => unknown;
}

interface ResolveResult {
  filepath?: string;
  recordingsDir?: string;
  error?: string;
}

// Helper function to get recordings directory
function getRecordingsDir(): string {
  return path.join(__dirname, '..', 'recordings');
}

// Helper to validate and resolve recording filepath
function resolveRecordingPath(filename: string): ResolveResult {
  if (!filename || filename.includes('..') || filename.includes('~') || filename.includes('/')) {
    return { error: 'Invalid filename' };
  }
  
  const recordingsDir = getRecordingsDir();
  const filepath = path.join(recordingsDir, filename);
  
  if (!filepath.startsWith(recordingsDir)) {
    return { error: 'Invalid path' };
  }
  
  return { filepath, recordingsDir };
}

export default function recordingRoutes(app: Application, { recordingStore }: { recordingStore: RecordingStore }): void {
  // Recording status
  app.get('/api/recording/status', (req, res) => {
    const status = recordingStore.getStatus();
    res.json({ recording: status });
  });

  // Start recording
  app.post('/api/recording/start', (req, res) => {
    const { name } = req.body || {};
    const result = recordingStore.startRecording(name);
    res.json(result);
  });

  // Stop recording
  app.post('/api/recording/stop', (req, res) => {
    const result = recordingStore.stopRecording();
    if (result) {
      res.json(result);
    } else {
      res.status(400).json({ error: 'No active recording' });
    }
  });

  // List recordings
  app.get('/api/recordings', (req, res) => {
    const recordingsDir = getRecordingsDir();
    if (!fs.existsSync(recordingsDir)) {
      res.json({ total: 0, recordings: [] });
      return;
    }

    try {
      const files = fs.readdirSync(recordingsDir)
        .filter(f => f.endsWith('.json') && f.startsWith('recording-'))
        .sort()
        .reverse()
        .slice(0, 50);

      const recordings = files.map(filename => {
        try {
          const content = fs.readFileSync(path.join(recordingsDir, filename), 'utf-8');
          const parsed = JSON.parse(content);
          return {
            id: parsed.id,
            name: parsed.name,
            filename,
            started_at: parsed.started_at,
            stopped_at: parsed.stopped_at,
            duration_seconds: parsed.duration_seconds,
            event_count: parsed.event_count,
            token_total: parsed.token_total,
            session_ids: parsed.session_ids,
            notes: parsed.notes || '',
          };
        } catch (e) {
          return { filename, error: 'Parse error' };
        }
      });

      res.json({ total: recordings.length, recordings });
    } catch (e) {
      res.json({ total: 0, recordings: [], error: "Failed to list recordings" });
    }
  });

  // Get single recording
  app.get('/api/recordings/:filename', (req, res) => {
    const { filename } = req.params;
    const resolved = resolveRecordingPath(filename);
    
    if (resolved.error) {
      return res.status(400).json({ error: resolved.error });
    }
    
    if (!fs.existsSync(resolved.filepath)) {
      res.status(404).json({ error: 'Recording not found' });
      return;
    }

    try {
      const content = fs.readFileSync(resolved.filepath, 'utf-8');
      res.json(JSON.parse(content));
    } catch (e) {
      res.status(500).json({ error: "Failed to process recording" });
    }
  });

  // Update recording notes
  app.patch('/api/recordings/:filename', (req, res) => {
    const { filename } = req.params;
    const { notes } = req.body || {};
    
    const resolved = resolveRecordingPath(filename);
    
    if (resolved.error) {
      return res.status(400).json({ error: resolved.error });
    }
    
    if (!fs.existsSync(resolved.filepath)) {
      res.status(404).json({ error: 'Recording not found' });
      return;
    }

    try {
      const content = fs.readFileSync(resolved.filepath, 'utf-8');
      const parsed = JSON.parse(content);
      parsed.notes = notes || '';
      fs.writeFileSync(resolved.filepath, JSON.stringify(parsed, null, 2));
      res.json({ success: true, notes: parsed.notes });
    } catch (e) {
      res.status(500).json({ error: "Failed to process recording" });
    }
  });

  // Delete recording
  app.delete('/api/recordings/:filename', (req, res) => {
    const { filename } = req.params;
    
    const resolved = resolveRecordingPath(filename);
    
    if (resolved.error) {
      return res.status(400).json({ error: resolved.error });
    }
    
    if (!fs.existsSync(resolved.filepath)) {
      res.status(404).json({ error: 'Recording not found' });
      return;
    }

    try {
      fs.unlinkSync(resolved.filepath);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to process recording" });
    }
  });
};
