# Claw-Hive Enhancement Proposal
## Based on oa-cli Best Practices

**Author**: Claude CaBot (Coder Agent)
**Date**: 2026-03-18
**Version**: 1.0

---

## Executive Summary

This proposal outlines enhancements to Claw-Hive by incorporating key ideas from **oa-cli** (OpenClaw Operational Analytics), while maintaining Claw-Hive's strengths in LLM monitoring.

### Goals
1. Add **Cron Job Monitoring** - Track if scheduled tasks actually succeed
2. Add **Agent Activity Tracking** - Know which agents are actually working
3. Add **Local SQLite Storage** - Lightweight alternative to PostgreSQL
4. Add **Operational Dashboard** - Unified view of system health
5. Keep existing **LLM Cost Monitoring** - Claw-Hive's core strength

---

## Architecture Comparison

### Current Claw-Hive
```
OpenClaw → LLM Proxy → Captures → JSONL Files → Sync Worker → PostgreSQL
                                                     ↓
                                              Dashboard (Web)
```

### Enhanced Claw-Hive (with oa-cli ideas)
```
┌─────────────────────────────────────────────────────────────────────┐
│                     OpenClaw Data Sources                          │
├─────────────────────────────────────────────────────────────────────┤
│  LLM Proxy     → captures/*.jsonl    (LLM calls, tokens, cost)    │
│  Cron Jobs     → cron/runs/*.jsonl  (job execution results)       │
│  Sessions      → sessions/*.jsonl    (agent activity)              │
│  Memory        → memory/*.md         (agent learnings)              │
└─────────────────────────────────────────────────────────────────────┘
                    ↓                         ↓
        ┌───────────────────┐    ┌───────────────────────┐
        │  LLM Analytics     │    │  Ops Analytics        │
        │  (Current)         │    │  (New - oa-cli style) │
        │  - Token tracking  │    │  - Cron reliability   │
        │  - Cost calc       │    │  - Agent health        │
        │  - Provider switch  │    │  - Memory discipline   │
        └───────────────────┘    └───────────────────────┘
                    ↓                         ↓
        ┌─────────────────────────────────────────────────┐
        │              Unified Dashboard                   │
        │  • LLM Stats Tab   • Cron Jobs Tab   • Health Tab │
        └─────────────────────────────────────────────────┘
```

---

## New Features

### Feature 1: Cron Job Monitoring

**Inspired by**: oa-cli's "Cron Reliability" goal

#### Data Source
```
~/.openclaw/cron/
├── jobs.json          # Job definitions with schedules
└── runs/
    ├── daily-report.jsonl   # Run history per job
    └── backup-task.jsonl
```

#### New API Endpoints
```
GET  /api/cron/jobs              # List all cron jobs
GET  /api/cron/jobs/:id         # Get specific job details
GET  /api/cron/jobs/:id/runs    # Get run history
GET  /api/cron/reliability      # Overall reliability stats
```

#### Database Schema
```sql
CREATE TABLE cron_jobs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    schedule TEXT,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE cron_runs (
    id SERIAL PRIMARY KEY,
    job_id TEXT REFERENCES cron_jobs(id),
    status TEXT,           -- 'success', 'failed', 'missed'
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    error_message TEXT
);
```

#### Dashboard Page
```
┌─────────────────────────────────────────────────┐
│  Cron Jobs                            [Refresh] │
├─────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌─────────┐ │
│  │ Reliability  │ │ Active Jobs  │ │ Failed  │ │
│  │   83.3%      │ │     6        │ │    2    │ │
│  └──────────────┘ └──────────────┘ └─────────┘ │
│                                                  │
│  Job Name        │ Schedule      │ Last Run    │
│  ────────────────────────────────────────────────│
│  daily-report    │ 0 7 * * *    │ ✓ 2h ago   │
│  backup-task     │ 0 */4 * * *  │ ✗ 1h ago   │
└─────────────────────────────────────────────────┘
```

---

### Feature 2: Agent Activity Tracking

**Inspired by**: oa-cli's "Team Health" goal

#### Data Sources
```
~/.openclaw/
├── agents/              # Agent configurations
├── sessions/            # Active session data
└── memory/             # Agent memory files
```

#### New API Endpoints
```
GET  /api/agents/activity       # All agents' recent activity
GET  /api/agents/:id/health     # Single agent health
GET  /api/agents/:id/memory     # Agent memory stats
```

#### Database Schema
```sql
CREATE TABLE agent_activity (
    id SERIAL PRIMARY KEY,
    agent_id TEXT NOT NULL,
    last_active_at TIMESTAMP,
    session_count INTEGER DEFAULT 0,
    memory_entries INTEGER DEFAULT 0
);
```

#### Dashboard Page
```
┌─────────────────────────────────────────────────┐
│  Team Health                                   │
├─────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌─────────┐ │
│  │ Active Today │ │ Memory Rate   │ │ Sessions│ │
│  │     3/4      │ │    50%       │ │   12    │ │
│  └──────────────┘ └──────────────┘ └─────────┘ │
│                                                  │
│  Agent      │ Status      │ Last Active │ Memory│
│  ────────────────────────────────────────────────│
│  researcher  │ 🟢 Active   │ 2h ago      │  ✓   │
│  writer      │ 🟡 Idle     │ 1d ago      │  ✗   │
│  reviewer    │ 🟢 Active   │ 3h ago      │  ✓   │
└─────────────────────────────────────────────────┘
```

---

### Feature 3: Lightweight SQLite Storage

**Inspired by**: oa-cli's "zero dependencies" philosophy

#### Why SQLite?
| PostgreSQL | SQLite |
|-----------|--------|
| Requires separate server | File-based, no server |
| User/password auth | File permissions only |
| Complex setup | `pip install` or `npm install` |
| Good for multi-user | Perfect for single-user |

#### Architecture
```
┌─────────────────┐
│  Sync Worker    │
│  (Node.js)     │
└────────┬────────┘
         │
         ├──→ PostgreSQL (for complex queries)
         │
         └──→ SQLite (for local/lightweight)
```

#### SQLite Schema (Mirror of PostgreSQL)
```sql
-- Lightweight mirror of PostgreSQL schema
CREATE TABLE captures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT,
    model TEXT,
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE cron_jobs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    schedule TEXT,
    enabled INTEGER DEFAULT 1
);

CREATE TABLE cron_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT REFERENCES cron_jobs(id),
    status TEXT,
    started_at TEXT,
    completed_at TEXT
);

CREATE TABLE agent_activity (
    agent_id TEXT PRIMARY KEY,
    last_active_at TEXT,
    session_count INTEGER DEFAULT 0
);
```

---

### Feature 4: Operational Dashboard (Unified)

**Inspired by**: oa-cli's "live dashboard"

#### New Dashboard Pages

| Page | Content |
|------|---------|
| **Dashboard** | Overview with key metrics |
| **LLM Stats** | Token usage, costs, providers (existing) |
| **Cron Jobs** | Job reliability, run history (NEW) |
| **Team Health** | Agent activity, memory (NEW) |
| **Captures** | LLM call details (existing) |
| **Metrics** | Prometheus graphs (existing) |

#### Unified Overview
```
┌─────────────────────────────────────────────────────────────┐
│  Claw-Hive Overview                    [Last: 5m ago] 🔄   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌─────────┐ │
│  │ LLM Cost   │ │ Cron       │ │ Agents     │ │ Captures│ │
│  │ $12.45    │ │ Reliability │ │ Active     │ │ Today   │ │
│  │ today     │ │ 83.3%      │ │ 3/4        │ │ 156     │ │
│  └────────────┘ └────────────┘ └────────────┘ └─────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           24-Hour Activity Timeline                  │   │
│  │  ████████████░░░░░░░░░███████████████░░░░░░░░░░░░  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Recent Issues                                               │
│  • backup-task failed at 14:00 (connection timeout)          │
│  • writer agent idle for 1d (no recent sessions)             │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)

#### 1.1 Add SQLite Support
```typescript
// src/services/sqlite-store.ts
import Database from 'better-sqlite3';

export class SQLiteStore {
  private db: Database.Database;
  
  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initSchema();
  }
  
  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS captures (...)
      CREATE TABLE IF NOT EXISTS cron_jobs (...)
      CREATE TABLE IF NOT EXISTS cron_runs (...)
      CREATE TABLE IF NOT EXISTS agent_activity (...)
    `);
  }
}
```

#### 1.2 Create Sync Worker for OpenClaw Files
```typescript
// src/services/openclaw-sync.ts
export class OpenClawSync {
  private watcher: chokidar.FSWatcher;
  
  // Watch cron/runs/*.jsonl
  // Watch sessions/*.jsonl
  // Watch memory/*.md
}
```

### Phase 2: Cron Monitoring (Week 2)

#### 2.1 API Routes
```typescript
// src/routes/cron-routes.ts
router.get('/api/cron/jobs', ...);
router.get('/api/cron/jobs/:id', ...);
router.get('/api/cron/jobs/:id/runs', ...);
router.get('/api/cron/reliability', ...);
```

#### 2.2 Dashboard Page
```typescript
// dashboard/src/pages/CronJobsPage.tsx
export function CronJobsPage() {
  // List cron jobs with reliability stats
  // Show recent failures
  // Link to run history
}
```

### Phase 3: Agent Health (Week 3)

#### 3.1 API Routes
```typescript
// src/routes/agent-health-routes.ts
router.get('/api/agents/activity', ...);
router.get('/api/agents/:id/health', ...);
```

#### 3.2 Dashboard Page
```typescript
// dashboard/src/pages/TeamHealthPage.tsx
export function TeamHealthPage() {
  // Agent activity grid
  // Memory discipline stats
  // Session timeline
}
```

### Phase 4: Unified Dashboard (Week 4)

#### 4.1 Update Main Dashboard
```typescript
// dashboard/src/pages/DashboardPage.tsx
export function DashboardPage() {
  // Unified overview with:
  // - LLM cost summary
  // - Cron reliability
  // - Agent health
  // - Recent issues
}
```

#### 4.2 Navigation Updates
```typescript
// dashboard/src/App.tsx
const navItems = [
  { path: '/', label: 'Overview' },
  { path: '/llm-stats', label: 'LLM Stats' },
  { path: '/cron-jobs', label: 'Cron Jobs' },
  { path: '/team-health', label: 'Team Health' },
  // ... existing pages
];
```

---

## File Structure

```
claw-hive/
├── src/
│   ├── services/
│   │   ├── llm-proxy.ts           # Existing
│   │   ├── sqlite-store.ts      # NEW: SQLite storage
│   │   ├── openclaw-sync.ts     # NEW: OpenClaw file sync
│   │   └── ...
│   ├── routes/
│   │   ├── cron-routes.ts        # NEW: Cron monitoring APIs
│   │   ├── agent-health-routes.ts # NEW: Agent health APIs
│   │   └── ...
│   └── server.ts
├── dashboard/
│   └── src/
│       ├── pages/
│       │   ├── CronJobsPage.tsx   # NEW
│       │   ├── TeamHealthPage.tsx  # NEW
│       │   └── DashboardPage.tsx    # ENHANCED
│       └── components/
├── sync-worker/
│   └── index.js                   # Existing
├── ops-worker/                    # NEW: Lightweight sync
│   ├── index.js
│   └── package.json
└── docs/
    └── ENHANCEMENT_PROPOSAL.md
```

---

## Migration Path

### Option A: Add-on (No Breaking Changes)
- Keep existing PostgreSQL Sync Worker
- Add new SQLite-based Ops Worker
- Existing features unchanged

### Option B: Full Migration
- Replace PostgreSQL with SQLite
- Simpler deployment
- Single data source

**Recommendation**: Option A (Add-on) for v3.0, Option B for v3.1

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Cron job monitoring coverage | 100% of defined jobs |
| Agent activity accuracy | Real-time (< 1 min delay) |
| Dashboard load time | < 2 seconds |
| Storage size (SQLite) | < 100MB for 1 year data |

---

## Dependencies

### Current (Keep)
- TypeScript
- Express.js
- React
- Vite
- chokidar
- WebSocket

### New
```json
{
  "better-sqlite3": "^9.0",  // SQLite for Node.js
  "cron-parser": "^4.0"       // Parse cron expressions
}
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Duplicate data storage | Clear separation: LLM → PG, Ops → SQLite |
| Performance with large files | Use streaming reads, chunked processing |
| OpenClaw file format changes | Version detection, graceful degradation |

---

## Conclusion

By incorporating oa-cli's best practices while maintaining Claw-Hive's LLM monitoring strength, we create a **Unified Operational Dashboard** that provides:

1. **Complete visibility** - LLM costs + Cron reliability + Agent health
2. **Zero new infrastructure** - SQLite + existing OpenClaw files
3. **Lightweight deployment** - No PostgreSQL required for basic ops
4. **Extensible** - Easy to add custom metrics

**Estimated timeline**: 4 weeks for full implementation

---

## Next Steps

1. Review and approve this proposal
2. Decide: Option A (Add-on) or Option B (Full Migration)
3. Prioritize phases
4. Start implementation

---

*Prepared by Claude CaBot for Arthur Wang*
*2026-03-18*
