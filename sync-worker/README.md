# Sync Worker

Monitors JSONL files and syncs data to PostgreSQL.

## Setup

```bash
cd sync-worker
npm install
```

## Configuration

Set environment variable:
```bash
export DATABASE_URL=postgresql://user:pass@localhost:5432/claw_hive
```

## Usage

```bash
# Start
node index.js

# Or from claw-hive root
node sync-worker/index.js
```

## Management via fix-proxy.sh

```bash
# Start
./fix-proxy.sh sync-start

# Stop
./fix-proxy.sh sync-stop

# Status
./fix-proxy.sh sync-status
```

## How it works

1. **Initial Scan** - Reads all existing JSONL files
2. **File Watch** - Uses chokidar to watch for changes
3. **Batch Insert** - Buffers 100 records or 5 seconds, whichever comes first
4. **Checkpoint** - Saves position in `.sync-checkpoint.json` for resume

## Checkpoint

The worker saves its position in `.sync-checkpoint.json`. On restart, it continues from where it left off.

## Logs

Logs are written to `/tmp/sync-worker.log` when started via fix-proxy.sh
