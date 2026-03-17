// @ts-nocheck
// Recording Store - TypeScript version
class RecordingStore {
  private recordings = new Map();
  private activeRecording = null;

  getStatus() {
    return { active: this.activeRecording, count: this.recordings.size };
  }

  startRecording(name) {
    this.activeRecording = name;
    this.recordings.set(name, { name, startTime: Date.now(), status: 'recording' });
    return { success: true, name };
  }

  stopRecording() {
    if (this.activeRecording) {
      const rec = this.recordings.get(this.activeRecording);
      if (rec) rec.status = 'stopped';
      this.activeRecording = null;
    }
    return { success: true };
  }

  getRecording(name) {
    return this.recordings.get(name);
  }

  listRecordings() {
    return Array.from(this.recordings.values());
  }
}

const recordingStore = new RecordingStore();
module.exports = { recordingStore, RecordingStore };
