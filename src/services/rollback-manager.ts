// Rollback Manager - Backup and restore OpenClaw files
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

const BASE_DIR = path.join(process.env.HOME || '~', '.claw-hive');
const BACKUP_DIR = path.join(BASE_DIR, 'backups');

class RollbackManager {
  constructor() {
    this.baseDir = BASE_DIR;
    this.backupDir = BACKUP_DIR;
    this.manifest = this.loadManifest();
    fs.ensureDirSync(this.backupDir);
  }

  loadManifest() {
    const manifestPath = path.join(this.backupDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      return fs.readJsonSync(manifestPath);
    }
    return {
      version: 1,
      snapshots: [],
      active_debug_session: null,
    };
  }

  saveManifest() {
    fs.writeJsonSync(
      path.join(this.backupDir, 'manifest.json'),
      this.manifest,
      { spaces: 2 }
    );
  }

  generateSnapshotId() {
    return new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);
  }

  async hashFile(filePath) {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async getOpenClawVersion() {
    try {
      const pkgPath = require.resolve('openclaw/package.json');
      const pkg = await fs.readJson(pkgPath);
      return pkg.version || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  // 创建快照 - 在修改任何文件之前必须调用
  async createSnapshot(reason, files) {
    const id = this.generateSnapshotId();
    const snapshotDir = path.join(this.backupDir, id);
    const filesDir = path.join(snapshotDir, 'files');
    await fs.ensureDir(filesDir);

    const backedUpFiles = [];

    for (const filePath of files) {
      if (!fs.existsSync(filePath)) {
        console.warn(`[Rollback] File not found, skipping: ${filePath}`);
        continue;
      }

      const relativePath = path.relative('/', filePath);
      const backupPath = path.join(filesDir, relativePath);

      await fs.ensureDir(path.dirname(backupPath));
      await fs.copy(filePath, backupPath);

      const hash = await this.hashFile(filePath);
      const stats = await fs.stat(filePath);

      backedUpFiles.push({
        original_path: filePath,
        backup_path: relativePath,
        sha256: hash,
        size_bytes: stats.size,
      });
    }

    const openclawVersion = await this.getOpenClawVersion();

    const meta = {
      id,
      created_at: new Date().toISOString(),
      reason,
      openclaw_version: openclawVersion,
      files_backed_up: backedUpFiles,
      patches_applied: [],
      rollback_status: 'pending',
    };

    await fs.writeJson(
      path.join(snapshotDir, 'snapshot-meta.json'),
      meta,
      { spaces: 2 }
    );

    // Update latest symlink
    const latestLink = path.join(this.backupDir, 'latest');
    if (fs.existsSync(latestLink)) {
      await fs.remove(latestLink);
    }
    await fs.symlink(snapshotDir, latestLink);

    // Update manifest
    this.manifest.snapshots.push({
      id,
      reason,
      created_at: meta.created_at,
      rollback_status: 'pending',
    });
    await this.saveManifest();

    console.log(`[Rollback] Snapshot created: ${id} (${backedUpFiles.length} files)`);
    return id;
  }

  // 回滚到指定快照
  async rollback(snapshotId) {
    const id = snapshotId || this.getLatestSnapshotId();
    if (!id) {
      return { success: false, filesRestored: 0, errors: ['No snapshots found'] };
    }

    const snapshotDir = path.join(this.backupDir, id);
    const metaPath = path.join(snapshotDir, 'snapshot-meta.json');

    if (!fs.existsSync(metaPath)) {
      return { success: false, filesRestored: 0, errors: [`Snapshot not found: ${id}`] };
    }

    const meta = await fs.readJson(metaPath);
    const errors = [];
    let filesRestored = 0;

    for (const file of meta.files_backed_up) {
      const backupFullPath = path.join(snapshotDir, 'files', file.backup_path);

      try {
        if (!fs.existsSync(backupFullPath)) {
          errors.push(`Backup file missing: ${file.backup_path}`);
          continue;
        }

        const backupHash = await this.hashFile(backupFullPath);
        if (backupHash !== file.sha256) {
          errors.push(`Hash mismatch for ${file.backup_path}`);
          continue;
        }

        await fs.copy(backupFullPath, file.original_path, { overwrite: true });
        filesRestored++;
        console.log(`[Rollback] Restored: ${file.original_path}`);
      } catch (err) {
        errors.push(`Failed to restore ${file.original_path}: ${err.message}`);
      }
    }

    meta.rollback_status = 'rolled_back';
    await fs.writeJson(metaPath, meta, { spaces: 2 });

    const entry = this.manifest.snapshots.find(s => s.id === id);
    if (entry) entry.rollback_status = 'rolled_back';
    this.manifest.active_debug_session = null;
    await this.saveManifest();

    const success = errors.length === 0;
    console.log(`[Rollback] ${success ? 'SUCCESS' : 'PARTIAL'}: ${filesRestored} files restored, ${errors.length} errors`);

    return { success, filesRestored, errors };
  }

  // 回滚所有 pending 快照
  async rollbackAll() {
    const pending = this.manifest.snapshots
      .filter(s => s.rollback_status === 'pending')
      .reverse();

    for (const snapshot of pending) {
      await this.rollback(snapshot.id);
    }
  }

  getLatestSnapshotId() {
    const pending = this.manifest.snapshots.filter(s => s.rollback_status === 'pending');
    return pending.length > 0 ? pending[pending.length - 1].id : null;
  }

  listSnapshots() {
    return [...this.manifest.snapshots].reverse();
  }

  // 清理过期快照（超过7天且已回滚）
  async cleanup(maxAgeDays = 7) {
    const cutoff = Date.now() - maxAgeDays * 86400000;
    let removed = 0;

    for (const snapshot of [...this.manifest.snapshots]) {
      if (
        snapshot.rollback_status === 'rolled_back' &&
        new Date(snapshot.created_at).getTime() < cutoff
      ) {
        const dir = path.join(this.backupDir, snapshot.id);
        await fs.remove(dir);
        this.manifest.snapshots = this.manifest.snapshots.filter(s => s.id !== snapshot.id);
        removed++;
      }
    }

    if (removed > 0) await this.saveManifest();
    return removed;
  }
}

const rollbackManager = new RollbackManager();
module.exports = { RollbackManager: rollbackManager };
