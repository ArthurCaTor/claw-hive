# oa-cli 深度研究分析

**项目**: https://github.com/Amyssjj/Agent_Exploration/tree/main/CLIs/oa-cli
**研究日期**: 2026-03-18

---

## 一、项目结构分析

### 1.1 目录结构

```
oa-cli/
├── src/oa/
│   ├── cli.py           # CLI 命令行入口 (oa init, collect, serve, status)
│   ├── server.py        # Dashboard HTTP 服务器 (localhost:3456)
│   ├── core/
│   │   ├── config.py   # 配置管理 (YAML)
│   │   ├── scanner.py  # OpenClaw 扫描 (检测 agents, cron jobs)
│   │   ├── schema.py   # SQLite Schema 定义
│   │   └── tracing.py # OTel-compatible 分布式追踪
│   ├── pipelines/       # 数据收集管道 (可扩展)
│   └── dashboard/
│       ├── app.js     # Dashboard 前端逻辑
│       ├── index.html  # Dashboard HTML
│       └── style.css   # Dashboard 样式
├── dashboard-src/     # React 源码 (可选)
├── templates/         # 配置模板
└── test-project/     # 测试数据
```

### 1.2 核心模块详解

#### 1.2.1 OpenClawScanner (scanner.py)

负责**自动发现** OpenClaw 安装中的资源：

```python
class OpenClawScanner:
    def scan(self) -> ScanResult:
        # 1. 读取 cron/jobs.json → 发现所有 cron jobs
        # 2. 扫描 sessions/ 目录 → 发现 agents 和最后活跃时间
        # 3. 读取 agents/ 目录 → 补充 agent 配置
```

**关键数据源**:
- `~/.openclaw/cron/jobs.json` - Cron job 定义
- `~/.openclaw/sessions/*.json` - Agent 会话文件
- `~/.openclaw/agents/` - Agent 配置目录

#### 1.2.2 SQLite Schema (schema.py)

**4 张核心表**:

```sql
-- 目标指标: 每日目标值
CREATE TABLE goal_metrics (
    date, goal, metric, value, unit, breakdown
);

-- Cron 运行结果: 每个时隙的执行状态
CREATE TABLE cron_runs (
    id, date, cron_name, slot_time, status, job_id, run_id, error
);

-- 每日 Agent 活跃: 每个 Agent 的每日快照
CREATE TABLE daily_agent_activity (
    id, date, agent_id, session_count, memory_logged, last_active
);

-- OTel 追踪: 分布式追踪跨度
CREATE TABLE spans (
    span_id, trace_id, parent_span_id, name, service, status,
    start_time, end_time, duration_ms, attributes, events
);
```

#### 1.2.3 Tracing Module (tracing.py)

**轻量级 OTel 实现，零外部依赖**:

```python
class Tracer:
    def __init__(self, service: str, db_path: str):
        # 支持 TRACEPARENT 环境变量 (W3C 标准)
        # 自动管理 span 父子关系栈
        
    @contextmanager
    def span(self, name: str):
        # 自动记录 duration_ms
        # 支持嵌套 span
        # flush() 写入 SQLite
```

**W3C Trace Context 兼容**:
- 32-char hex trace_id (128-bit)
- 16-char hex span_id (64-bit)
- traceparent 格式: `00-{trace_id}-{span_id}-01`

#### 1.2.4 Pipelines (可扩展)

**内置 Goals**:

| Goal | 指标 | 数据源 |
|-------|------|--------|
| Cron Reliability | success_rate, missed_triggers | cron/runs/*.jsonl |
| Team Health | active_agent_count, memory_discipline | sessions/, memory/ |

**自定义 Pipeline**:

```python
class ContentQuality(Pipeline):
    goal_id = "content_quality"
    
    def collect(self, date: str) -> list[Metric]:
        # 读取文件、API 等数据源
        return [Metric("approval_rate", rate, unit="%")]
```

---

## 二、关键特性分析

### 2.1 零依赖哲学

**oa-cli 核心依赖**: 只有 Python 3.10+

**为何能做到**:
- 自己实现 tracing (不用 opentelemetry-sdk)
- 使用内置 sqlite3
- 简单 HTTP 服务器 (不用 Flask/FastAPI)
- 原生文件系统操作 (不用 pathlib 高级特性)

### 2.2 配置文件格式

```yaml
# config.yaml (auto-generated)
openclaw_home: ~/.openclaw

agents:
  - id: researcher
    name: Researcher
  - id: writer
    name: Writer

goals:
  - id: cron_reliability
    builtin: true
    metrics:
      - name: success_rate
        unit: "%"
        healthy: 95
        warning: 80
```

### 2.3 Dashboard 功能

**页面结构**:
- Goal Cards - 显示每个目标的健康状态
- Time-series Charts - 历史趋势图
- Mechanism Tab - 追踪链路查看器

**实时更新**: 自动刷新 Dashboard

### 2.4 CLI 命令

| 命令 | 功能 |
|------|------|
| `oa init` | 自动发现 OpenClaw，初始化项目 |
| `oa collect` | 运行所有数据收集管道 |
| `oa collect --goal G1` | 运行指定管道 |
| `oa serve` | 启动 Dashboard (localhost:3456) |
| `oa status` | 终端显示目标健康状态 |
| `oa cron show` | 显示建议的 cron 调度 |
| `oa doctor` | 检查系统依赖 |

---

## 三、与 Claw-Hive 对比

### 3.1 功能矩阵

| 功能 | oa-cli | Claw-Hive | 差异分析 |
|------|--------|-----------|----------|
| **数据源** | | | |
| OpenClaw cron jobs | ✅ | ❌ | oa-cli 读取 cron/jobs.json |
| Agent sessions | ✅ | ❌ | oa-cli 扫描 sessions/ |
| Agent memory | ✅ | ❌ | oa-cli 检查 memory/ |
| LLM 调用记录 | ❌ | ✅ | Claw-Hive HTTP 代理劫持 |
| **存储** | | | |
| SQLite | ✅ | ❌ | oa-cli 使用轻量 SQLite |
| PostgreSQL | ❌ | ✅ | Claw-Hive 使用 PostgreSQL |
| JSONL 文件 | ✅ | ✅ | 都支持 |
| **监控** | | | |
| Cron 可靠性 | ✅ | ❌ | oa-cli 独有 |
| Agent 活跃度 | ✅ | ❌ | oa-cli 独有 |
| LLM Token/Cost | ❌ | ✅ | Claw-Hive 独有 |
| Provider 切换 | ❌ | ✅ | Claw-Hive 独有 |
| **告警** | | | |
| 阈值告警 | ✅ | ✅ | 都支持 |
| WebSocket 推送 | ❌ | ✅ | Claw-Hive 支持 |
| **追踪** | | | |
| OTel-compatible | ✅ | ❌ | oa-cli 内置 tracing |
| Span 存储 | ✅ | ❌ | oa-cli 存储到 SQLite |

### 3.2 技术栈对比

| 技术 | oa-cli | Claw-Hive |
|------|--------|-----------|
| 语言 | Python 3.10+ | TypeScript |
| Web 框架 | 原生 HTTP (简化) | Express.js |
| 数据库 | SQLite | PostgreSQL |
| 前端 | 原生 JS + CSS | React + TypeScript |
| 构建工具 | 无 | Vite |
| 进程管理 | 无 | PM2 |

### 3.3 架构对比

```
oa-cli:
OpenClaw Files → Scanner → Pipelines → SQLite → Dashboard
                    ↓
               Tracing (OTel)

Claw-Hive:
OpenClaw → LLM Proxy → Captures → JSONL → Sync Worker → PostgreSQL
                                                       ↓
                                               Dashboard (React)
```

---

## 四、Claw-Hive 可以借鉴的功能

### 4.1 必须借鉴 (优先级高)

#### F1: OpenClaw Cron Job 监控

**oa-cli 实现**:
```python
# 读取 cron/jobs.json
jobs = json.load(open("~/.openclaw/cron/jobs.json"))
for job in jobs["jobs"]:
    # 解析 schedule
    # 计算 expected runs
```

**Claw-Hive 需要**:
```typescript
// src/services/cron-monitor.ts
interface CronJob {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
}

// 读取 ~/.openclaw/cron/jobs.json
// 读取 ~/.openclaw/cron/runs/*.jsonl
// 计算成功率
```

#### F2: Agent 活跃度追踪

**oa-cli 实现**:
```python
# 扫描 sessions/ 目录
sessions_dir = Path("~/.openclaw/sessions")
for path in sessions_dir.glob("agent:*:*.json"):
    agent_id = extract_agent_id(path.name)
    mtime = path.stat().st_mtime
```

**Claw-Hive 需要**:
```typescript
// src/services/agent-health.ts
interface AgentHealth {
  agentId: string;
  lastActive: Date;
  sessionCount: number;
  memoryDiscipline: boolean;
}
```

#### F3: 轻量级 OTel 追踪

**oa-cli 实现**:
```python
# tracing.py - 200行代码实现
class Tracer:
    def span(self, name):
        # 自动管理父子关系
        # 写入 SQLite
```

**Claw-Hive 需要**:
```typescript
// src/utils/tracing.ts
interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  durationMs: number;
  attributes: Record<string, any>;
}
```

### 4.2 应该借鉴 (优先级中)

#### F4: 自定义 Pipeline 扩展

**oa-cli 实现**:
```python
class Pipeline:
    goal_id: str
    def collect(self, date: str) -> list[Metric]:
        raise NotImplementedError
```

**Claw-Hive 需要**:
```typescript
// src/services/pipeline.ts
interface Pipeline {
  id: string;
  name: string;
  collect(date: string): Promise<Metric[]>;
}
```

#### F5: 健康度阈值配置

**oa-cli 实现**:
```yaml
goals:
  - id: cron_reliability
    metrics:
      - name: success_rate
        healthy: 95   # 绿色阈值
        warning: 80   # 黄色阈值
```

**Claw-Hive 需要**:
```typescript
// 告警规则增加 healthy/warning 配置
interface AlertRule {
  id: string;
  metric: string;
  healthy: number;
  warning: number;
  critical: number;
}
```

### 4.3 可以借鉴 (优先级低)

#### F6: Dashboard 追踪 Tab

展示数据流的完整链路 (从数据源到存储)

#### F7: CLI 增强

- `oa status` → 终端显示概览
- `oa doctor` → 检查依赖

---

## 五、详细二次开发方案

### 5.1 新增服务

| 服务 | 文件 | 功能 |
|------|------|------|
| OpenClawScanner | `src/services/openclaw-scanner.ts` | 发现 OpenClaw agents, cron jobs |
| CronMonitor | `src/services/cron-monitor.ts` | Cron job 可靠性追踪 |
| AgentHealthTracker | `src/services/agent-health.ts` | Agent 活跃度追踪 |
| TracingService | `src/utils/tracing.ts` | 轻量级 OTel 追踪 |
| PipelineRegistry | `src/services/pipeline-registry.ts` | 自定义 pipeline 注册 |

### 5.2 新增 API

```
GET  /api/openclaw/status        # OpenClaw 状态
GET  /api/cron/jobs             # Cron jobs 列表
GET  /api/cron/jobs/:id         # 单个 job 详情
GET  /api/cron/jobs/:id/runs    # job 运行历史
GET  /api/cron/reliability       # 可靠性统计
GET  /api/agents/health          # Agent 健康状态
GET  /api/agents/:id/activity    # 单个 Agent 活跃度
GET  /api/traces                 # 追踪列表
GET  /api/traces/:traceId        # 单个追踪详情
```

### 5.3 新增数据库表 (PostgreSQL)

```sql
-- Agent 活跃度快照
CREATE TABLE agent_snapshots (
    id SERIAL PRIMARY KEY,
    agent_id TEXT NOT NULL,
    snapshot_date DATE NOT NULL,
    session_count INTEGER DEFAULT 0,
    memory_entries INTEGER DEFAULT 0,
    last_active_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(agent_id, snapshot_date)
);

-- Cron job 定义缓存
CREATE TABLE cron_jobs_cache (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    schedule_expr TEXT,
    enabled BOOLEAN DEFAULT true,
    last_seen_at TIMESTAMP DEFAULT NOW()
);

-- OTel 追踪跨度
CREATE TABLE traces (
    trace_id TEXT NOT NULL,
    span_id TEXT NOT NULL,
    parent_span_id TEXT,
    service_name TEXT NOT NULL,
    operation_name TEXT NOT NULL,
    status TEXT DEFAULT 'ok',
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration_ms REAL,
    attributes JSONB,
    events JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_traces_trace_id ON traces(trace_id);
CREATE INDEX idx_traces_start_time ON traces(start_time);
```

### 5.4 新增 Dashboard 页面

| 页面 | 路由 | 功能 |
|------|------|------|
| OpsOverview | `/ops` | 运维总览 (Cron + Agent + LLM) |
| CronJobs | `/cron-jobs` | Cron job 监控 |
| TeamHealth | `/team-health` | Agent 健康状态 |
| Traces | `/traces` | 追踪链路查看 |

---

## 六、实施路线图

### Phase 1: 核心基础设施 (Week 1)

1. **OpenClawScanner** - 发现 OpenClaw agents/cron jobs
2. **TracingService** - 轻量级 OTel 实现
3. **数据库表** - 新增 3 张表

### Phase 2: Cron 监控 (Week 2)

1. **CronMonitor Service** - 可靠性追踪
2. **API 路由** - `/api/cron/*`
3. **Dashboard 页面** - CronJobs

### Phase 3: Agent 健康 (Week 3)

1. **AgentHealthTracker Service** - 活跃度追踪
2. **API 路由** - `/api/agents/health`
3. **Dashboard 页面** - TeamHealth

### Phase 4: 统一视图 (Week 4)

1. **OpsOverview** - 综合 Dashboard
2. **PipelineRegistry** - 可扩展 pipeline

---

## 七、风险与挑战

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| OpenClaw 文件格式变化 | 功能失效 | 版本检测 + 优雅降级 |
| 重复数据 | 存储浪费 | 使用 UNIQUE 约束 |
| 性能 | 扫描大文件慢 | 流式读取 + 缓存 |
| 与现有功能重叠 | 开发浪费 | 复用现有架构 |

---

## 八、结论

oa-cli 是一个**专注于运维监控**的轻量级工具，核心优势在于:

1. **零依赖** - 纯 Python，无外部库
2. **SQLite** - 轻量级存储
3. **OTel 追踪** - 完整的数据流可见性
4. **自动发现** - 无需配置即可使用

**Claw-Hive 应该借鉴**:
- OpenClaw cron job 监控
- Agent 活跃度追踪
- 轻量级 OTel 追踪
- 健康度阈值配置

**Claw-Hive 保持优势**:
- LLM 调用监控 (Token/Cost)
- 实时 WebSocket 推送
- PostgreSQL 存储
- 完整的 Web Dashboard

---

*研究完成*
