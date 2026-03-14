// Recording Store - Save SSE events to JSON files
const fs = require('fs');
const path = require('path');

const RECORDINGS_DIR = path.join(__dirname, '..', '..', 'recordings');

class RecordingStore {
  constructor() {
    this.stream = null;
    this.seq = 0;
    this.startedAt = null;
    this.currentFile = '';
    this.tokenTotal = 0;
    this.sessionIds = new Set();
    this.isFirstEvent = true;
    this.recordingId = '';
    this.recordingName = '';
  }

  ensureDir() {
    if (!fs.existsSync(RECORDINGS_DIR)) {
      fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
    }
  }

  getNextId() {
    this.ensureDir();
    const files = fs.readdirSync(RECORDINGS_DIR).filter(f => f.endsWith('.json'));
    if (files.length === 0) return '001';
    const nums = files.map(f => parseInt(f.match(/recording-(\d+)/)?.[1] || '0', 10));
    return String(Math.max(...nums) + 1).padStart(3, '0');
  }

  startRecording(name = '') {
    this.ensureDir();
    
    const now = new Date();
    this.startedAt = now;
    this.seq = 0;
    this.isFirstEvent = true;
    this.tokenTotal = 0;
    this.sessionIds.clear();
    this.recordingId = this.getNextId();
    this.recordingName = name || `Recording #${parseInt(this.recordingId, 10)}`;

    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}-${pad(now.getHours())}h${pad(now.getMinutes())}m`;
    const filename = `recording-${this.recordingId}-${dateStr}.json`;
    this.currentFile = path.join(RECORDINGS_DIR, filename);

    const header = {
      id: this.recordingId,
      name: this.recordingName,
      started_at: now.toISOString(),
      stopped_at: null,
      duration_seconds: null,
      event_count: 0,
      token_total: 0,
      session_ids: [],
      notes: '',
    };

    this.stream = fs.createWriteStream(this.currentFile, { flags: 'w' });
    const headerStr = JSON.stringify(header, null, 2);
    this.stream.write(headerStr.slice(0, -2) + ',\n "events": [\n');

    console.log('[Recording] Started:', filename);
    return { id: this.recordingId, name: this.recordingName, filename };
  }

  appendEvent(event) {
    if (!this.stream) return;

    if (event.type === 'context_usage' && event.data?.tokens_used) {
      this.tokenTotal = event.data.tokens_used;
    }
    if (event.session_id) {
      this.sessionIds.add(event.session_id);
    }

    const entry = {
      seq: this.seq++,
      type: event.type,
      received_at: new Date().toISOString(),
      session_id: event.session_id || null,
      data: event.data || event,
    };

    const comma = this.isFirstEvent ? '' : ',';
    this.isFirstEvent = false;
    this.stream.write(` ${comma}${JSON.stringify(entry)}\n`);
  }

  stopRecording() {
    if (!this.stream || !this.startedAt) return null;

    const stoppedAt = new Date();
    const duration = Math.round((stoppedAt.getTime() - this.startedAt.getTime()) / 1000);

    this.stream.write(' ]\n}\n');
    this.stream.end();
    this.stream = null;

    // Read back and update summary
    try {
      const content = fs.readFileSync(this.currentFile, 'utf-8');
      const parsed = JSON.parse(content);
      parsed.stopped_at = stoppedAt.toISOString();
      parsed.duration_seconds = duration;
      parsed.event_count = this.seq;
      parsed.token_total = this.tokenTotal;
      parsed.session_ids = [...this.sessionIds];
      fs.writeFileSync(this.currentFile, JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.error('[Recording] Error updating summary:', e);
    }

    console.log('[Recording] Stopped:', path.basename(this.currentFile), this.seq, 'events');
    return {
      filename: path.basename(this.currentFile),
      event_count: this.seq,
      duration_seconds: duration,
      token_total: this.tokenTotal
    };
  }

  isRecording() {
    return this.stream !== null;
  }

  getStatus() {
    if (!this.isRecording()) return null;
    return {
      id: this.recordingId,
      name: this.recordingName,
      filename: path.basename(this.currentFile),
      duration_seconds: Math.round((Date.now() - this.startedAt?.getTime()) / 1000),
      event_count: this.seq,
    };
  }
}

const recordingStore = new RecordingStore();
module.exports = { recordingStore };
