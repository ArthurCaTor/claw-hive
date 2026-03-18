# CLAW-HIVE API Reference
**Version**: 2.0  
**Date**: March 18, 2026  
**Status**: ✅ Complete

---

## Table of Contents

1. [Debug Proxy](#debug-proxy)
2. [Token Statistics](#token-statistics)
3. [Cost Calculator](#cost-calculator)
4. [LLM Tracker](#llm-tracker)
5. [Alerts](#alerts)
6. [Export](#export)

---

## Debug Proxy

### GET /api/debug-proxy/status
Get proxy status.

```bash
curl http://localhost:8080/api/debug-proxy/status
```

**Response:**
```json
{
  "running": true,
  "port": 8999,
  "startedAt": "2026-03-18T16:55:32.597Z",
  "totalCalls": 4,
  "capturesCount": 4,
  "uptimeSeconds": 567
}
```

### POST /api/debug-proxy/start
Start the proxy service.

```bash
curl -X POST http://localhost:8080/api/debug-proxy/start
```

### POST /api/debug-proxy/stop
Stop the proxy service.

```bash
curl -X POST http://localhost:8080/api/debug-proxy/stop
```

### GET /api/debug-proxy/captures
Get captures with pagination.

```bash
curl "http://localhost:8080/api/debug-proxy/captures?page=1&limit=20&model=MiniMax"
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | int | 1 | Page number |
| limit | int | 20 | Items per page |
| model | string | all | Filter by model |
| status | int | all | Filter by HTTP status |

**Response:**
```json
{
  "captures": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 4,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

### GET /api/debug-proxy/search
Search captures.

```bash
curl "http://localhost:8080/api/debug-proxy/search?q=hello&limit=10"
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| q | string | required | Search query |
| fields | string | all | Comma-separated fields |
| limit | int | 50 | Max results |

---

## Token Statistics

### GET /api/stats/tokens
Get aggregated token statistics from captures.

```bash
curl http://localhost:8080/api/stats/tokens
```

**Response:**
```json
{
  "success": true,
  "totalInputTokens": 104591,
  "totalOutputTokens": 1186,
  "totalTokens": 105777,
  "averageInputTokens": 26147,
  "averageOutputTokens": 296,
  "captureCount": 4,
  "byModel": {
    "MiniMax-M2.7": {
      "input": 104591,
      "output": 1186,
      "count": 4
    }
  },
  "byHour": {
    "2026-03-18T16": {
      "input": 104591,
      "output": 1186,
      "count": 4
    }
  },
  "timestamp": "2026-03-18T17:05:00.000Z"
}
```

---

## Cost Calculator

### GET /api/cost/summary
Get cost summary based on token usage.

```bash
curl http://localhost:8080/api/cost/summary
```

**Response:**
```json
{
  "success": true,
  "totalCost": 0.0765,
  "totalInputCost": 0.0732,
  "totalOutputCost": 0.0033,
  "byModel": [
    {
      "model": "MiniMax-M2.7",
      "inputTokens": 104591,
      "outputTokens": 1186,
      "inputCost": 0.0732,
      "outputCost": 0.0033,
      "totalCost": 0.0765,
      "requestCount": 4
    }
  ],
  "byDay": {
    "2026-03-18": 0.0765
  },
  "currency": "USD",
  "timestamp": "2026-03-18T17:05:00.000Z"
}
```

### GET /api/cost/pricing
Get all pricing configurations.

```bash
curl http://localhost:8080/api/cost/pricing
```

### POST /api/cost/pricing
Update pricing for a model.

```bash
curl -X POST http://localhost:8080/api/cost/pricing \
  -H "Content-Type: application/json" \
  -d '{"model": "MiniMax-M2.7", "input": 0.70, "output": 2.80}'
```

---

## LLM Tracker

### GET /api/llm-tracker/agents
Get all agent LLM states.

```bash
curl http://localhost:8080/api/llm-tracker/agents
```

### GET /api/llm-tracker/providers
Get provider statistics.

```bash
curl http://localhost:8080/api/llm-tracker/providers
```

**Response:**
```json
{
  "success": true,
  "providers": [
    {
      "provider": "minimax-portal",
      "requestCount": 4,
      "tokenCount": 105777,
      "errorCount": 0,
      "avgLatency": 2500,
      "lastUsed": "2026-03-18T17:05:00.000Z"
    }
  ]
}
```

### GET /api/llm-tracker/switches
Get recent LLM switches.

```bash
curl "http://localhost:8080/api/llm-tracker/switches?limit=20"
```

### GET /api/llm-tracker/stream
SSE stream for real-time LLM switch events.

```bash
curl http://localhost:8080/api/llm-tracker/stream
```

---

## Alerts

### GET /api/alerts
Get all alerts.

```bash
curl "http://localhost:8080/api/alerts?level=warning&limit=50"
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| level | string | info/warning/error/critical |
| type | string | Alert type |
| acknowledged | bool | Filter by acknowledged status |
| limit | int | Max results |

### GET /api/alerts/summary
Get alert summary.

```bash
curl http://localhost:8080/api/alerts/summary
```

**Response:**
```json
{
  "success": true,
  "total": 0,
  "unacknowledged": 0,
  "byLevel": {},
  "byType": {}
}
```

### POST /api/alerts/:id/acknowledge
Acknowledge an alert.

```bash
curl -X POST http://localhost:8080/api/alerts/alert-1/acknowledge
```

### POST /api/alerts/acknowledge-all
Acknowledge all alerts.

```bash
curl -X POST http://localhost:8080/api/alerts/acknowledge-all
```

### GET /api/alerts/rules
Get alert rules.

```bash
curl http://localhost:8080/api/alerts/rules
```

### GET /api/alerts/stream
SSE stream for real-time alerts.

```bash
curl http://localhost:8080/api/alerts/stream
```

---

## Export

### GET /api/export/captures/json
Export captures as JSON.

```bash
curl http://localhost:8080/api/export/captures/json -o captures.json
```

### GET /api/export/captures/csv
Export captures as CSV.

```bash
curl http://localhost:8080/api/export/captures/csv -o captures.csv
```

### GET /api/export/cost-report
Export cost report.

```bash
curl http://localhost:8080/api/export/cost-report -o cost-report.json
```

### GET /api/export/captures/:id
Export single capture.

```bash
curl http://localhost:8080/api/export/captures/1 -o capture-1.json
```

---

## Pricing Reference

| Model | Input ($/1M) | Output ($/1M) |
|-------|---------------|----------------|
| MiniMax-M2.7 | $0.70 | $2.80 |
| MiniMax-M2.5 | $0.70 | $2.80 |
| claude-sonnet-4 | $3.00 | $15.00 |
| claude-opus-4 | $15.00 | $75.00 |
| gpt-4o | $5.00 | $15.00 |
| gpt-4-turbo | $10.00 | $30.00 |

---

## Alert Rules

| Rule ID | Level | Trigger |
|---------|-------|---------|
| high-latency | warning | Latency > 10s |
| very-high-latency | error | Latency > 30s |
| api-error | error | HTTP 5xx |
| rate-limit | warning | HTTP 429 |
| high-tokens | warning | Single request > 100k tokens |

---

*Document Version: 2.0*  
*Generated: 2026-03-18*
