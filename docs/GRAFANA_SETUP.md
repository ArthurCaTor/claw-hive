# Grafana Dashboard Setup

## Quick Start

### 1. Add Prometheus Data Source

1. Go to Grafana → Configuration → Data Sources
2. Add Prometheus
3. URL: `http://localhost:9090` (or your Prometheus server)
4. Save & Test

### 2. Import Dashboard

**Option A: JSON Import**
1. Go to Dashboards → Import
2. Upload `grafana-dashboard.json`
3. Select Prometheus data source
4. Click Import

**Option B: Copy JSON**
1. Go to Dashboards → + New → Import
2. Paste contents of `grafana-dashboard.json`
3. Select data source
4. Click Import

## Dashboard Panels

| Panel | Description | Metrics |
|-------|-------------|---------|
| Proxy Running | Shows if proxy is active | `claw_hive_proxy_running` |
| Total LLM Calls | Total API calls | `claw_hive_proxy_total_calls` |
| Total Tokens | Input + Output tokens | `claw_hive_tokens_*_total` |
| Alerts | Unacknowledged alerts | `claw_hive_alerts_unacknowledged` |
| LLM Calls Over Time | Request rate | `rate(claw_hive_proxy_total_calls[5m])` |
| Tokens Over Time | Token rate | `rate(claw_hive_tokens_*_total[5m])` |
| Alerts by Level | Alert breakdown | `claw_hive_alerts_by_level` |
| Memory Usage | Heap memory | `claw_hive_memory_heap_used_bytes` |
| Total Cost | Accumulated cost | `claw_hive_cost_total_usd` |

## Prometheus Configuration

Add to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'claw-hive'
    static_configs:
      - targets: ['localhost:8080']
    metrics_path: '/metrics'
```

## Metrics Endpoint

Claw-Hive exposes metrics at:
```
http://localhost:8080/metrics
```

This endpoint returns Prometheus-compatible metrics in text format.
