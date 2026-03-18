# PostgreSQL 数据库集成分析

## 当前状态

### 数据存储

| 数据类型 | 存储位置 | 格式 | 限制 |
|----------|----------|------|------|
| Captures | 内存 | JSON | 100条 |
| Sessions | openclaw.json | JSONL | 无限制 |
| Events | openclaw.json | JSONL | 无限制 |
| Long-term memory | JSON | JSON | 无限制 |

### 问题

1. **Captures 在内存中** - 重启丢失
2. **Sessions 分散在多处** - 难以查询
3. **无法聚合统计** - 跨时间范围查询困难

---

## PostgreSQL 集成方案

### 目标

```
Captures → PostgreSQL
Sessions → PostgreSQL  
Metrics → PostgreSQL
```

### 表结构设计

```sql
-- Captures 表
CREATE TABLE captures (
    id SERIAL PRIMARY KEY,
    agent_id TEXT NOT NULL,
    model TEXT,
    provider TEXT,
    tokens_in INT DEFAULT 0,
    tokens_out INT DEFAULT 0,
    latency_ms INT,
    status_code INT,
    request_json JSONB,
    response_json JSONB,
    cost_usd DECIMAL(10,6),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_captures_agent ON captures(agent_id);
CREATE INDEX idx_captured_at ON captures(created_at);
CREATE INDEX idx_model ON captures(model);

-- LLM Tracker 表
CREATE TABLE llm_switches (
    id SERIAL PRIMARY KEY,
    agent_id TEXT NOT NULL,
    from_provider TEXT,
    from_model TEXT,
    to_provider TEXT,
    to_model TEXT,
    switched_at TIMESTAMP DEFAULT NOW()
);

-- Cost Summary (daily)
CREATE TABLE cost_daily (
    date DATE PRIMARY KEY,
    total_cost DECIMAL(12,6),
    total_tokens_in BIGINT,
    total_tokens_out BIGINT,
    model_costs JSONB
);
```

### 实现计划

**Phase 1: Captures 表**
```typescript
// 新建 pg-store.ts
class PostgresCaptureStore implements CaptureStore {
  async add(capture) { /* INSERT */ }
  async getCaptures(limit, offset) { /* SELECT */ }
}
```

**Phase 2: 迁移现有数据**
```bash
pg_dump captures > backup.json
```

**Phase 3: 聚合视图**
```sql
CREATE VIEW model_costs AS
SELECT model, SUM(cost_usd) GROUP BY model;
```

### 依赖

```json
{
  "pg": "^8.11",
  "knex": "^3.0"  // SQL builder
}
```

### 风险

| 风险 | 缓解 |
|------|--------|
| 迁移丢数据 | 先备份再迁移 |
| 连接池耗尽 | 配置连接池 |
| 查询慢 | 加索引 |

---

## 建议

1. **先做 Captures 表**
2. **用 Knex 或 Prisma ORM**
3. **保留内存缓存 + PG 持久化**
4. **按需写入 (batch insert)
