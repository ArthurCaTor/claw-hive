# 🦞 Claw-Hive

> Multi-Agent LLM Gateway with Debug Proxy & Monitoring

A sophisticated system for managing multiple AI agents across different LLM providers (MiniMax, OpenAI, Anthropic), with built-in debugging, cost tracking, and real-time monitoring capabilities.

## ✨ Features

### 🔄 Multi-Provider Support
- **MiniMax** (M2.5, M2.7)
- **OpenAI** (GPT-4o, GPT-4-turbo)
- **Anthropic** (Claude Sonnet, Claude Opus)

### 📊 Monitoring & Analytics
- **Token Tracking** - Real-time token usage per model and agent
- **Cost Calculator** - Automatic cost computation with configurable pricing
- **Prometheus Metrics** - `/metrics` endpoint for Grafana integration
- **Alert System** - Configurable alerts for latency, errors, rate limits

### 🛠️ Debugging Tools
- **Proxy Passive Mode** - Transparent request/response capture
- **SSE Streaming** - Real-time event capture
- **Search & Filter** - Full-text search across captures
- **Export** - JSON/CSV export for analysis

### ⚡ Performance
- **30+ Concurrent Agents** - Scale tested
- **Rate Limiting** - 1000 req/min per IP
- **In-Memory Caching** - Fast access to recent captures

## 🚀 Quick Start

### Prerequisites
- Node.js 22+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/ArthurCaTor/claw-hive.git
cd claw-hive

# Install dependencies
npm install

# Start the server
node src/server.js
```

The dashboard will be available at `http://localhost:8080`

### Starting with Proxy

```bash
# Start proxy service
./start_proxy.sh start

# Check status
./start_proxy.sh status
```

## 📁 Project Structure

```
claw-hive/
├── src/
│   ├── server.ts              # Main server entry point
│   ├── routes/                # API routes
│   │   ├── debug-proxy-routes.ts
│   │   ├── cost-routes.ts
│   │   ├── llm-tracker-routes.ts
│   │   ├── alert-routes.ts
│   │   ├── optimizer-routes.ts
│   │   └── ...
│   ├── services/             # Business logic
│   │   ├── llm-proxy.ts
│   │   ├── token-aggregator.ts
│   │   ├── cost-calculator.ts
│   │   ├── llm-tracker.ts
│   │   ├── alert-service.ts
│   │   ├── message-optimizer.ts
│   │   └── ...
│   └── utils/
│       ├── rate-limiter.ts
│       ├── config-validator.ts
│       └── ...
├── dashboard/                # React dashboard (TypeScript)
│   └── src/
│       ├── pages/           # Dashboard pages
│       ├── components/       # Reusable components
│       └── stores/          # Zustand state
├── tests/
│   ├── unit.test.js       # API unit tests
│   └── scale.test.js      # 30-agent load test
├── docs/                   # Documentation
│   ├── API_REFERENCE.md
│   ├── GRAFANA_SETUP.md
│   └── SYSTEM_ARCHITECTURE.svg
└── public/                 # Static files
```

## 🔌 API Reference

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/debug-proxy/status` | GET | Proxy status |
| `/api/debug-proxy/start` | POST | Start proxy |
| `/api/debug-proxy/captures` | GET | List captures (paginated) |
| `/api/debug-proxy/search` | GET | Search captures |

### Statistics & Cost

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/stats/tokens` | GET | Token statistics |
| `/api/cost/summary` | GET | Cost breakdown |
| `/api/cost/pricing` | GET/POST | Manage pricing |

### Monitoring

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/llm-tracker/agents` | GET | Agent LLM states |
| `/api/alerts` | GET | List alerts |
| `/metrics` | GET | Prometheus metrics |

### Active Mode

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/optimizer/config` | GET/POST | Optimizer config |
| `/api/optimizer/enable` | POST | Enable active mode |

See [API_REFERENCE.md](docs/API_REFERENCE.md) for complete documentation.

## 📊 Monitoring

### Prometheus Integration

Add to `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'claw-hive'
    static_configs:
      - targets: ['localhost:8080']
    metrics_path: '/metrics'
```

### Grafana Dashboard

Import `docs/grafana-dashboard.json` into Grafana for:
- Real-time token usage
- Cost tracking
- Alert monitoring
- Latency histograms

See [GRAFANA_SETUP.md](docs/GRAFANA_SETUP.md) for details.

## 🧪 Testing

```bash
# Run all tests
npm test

# Unit tests
node tests/unit.test.js

# Scale test (30 agents)
node tests/scale.test.js
```

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8080 | Server port |
| `NODE_ENV` | development | Environment |
| `LOG_LEVEL` | info | Log verbosity |

### Rate Limiting

Default: 1000 requests per minute per IP.

To adjust, edit `src/utils/rate-limiter.ts`:
```typescript
const DEFAULT_MAX_REQUESTS = 1000;
```

## 📜 License

MIT

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## 📚 Documentation

- [API Reference](docs/API_REFERENCE.md)
- [Grafana Setup](docs/GRAFANA_SETUP.md)
- [System Architecture](docs/SYSTEM_ARCHITECTURE.svg)
- [Project Status](docs/PROJECT_STATUS.md)

---

Built with ❤️ for multi-agent LLM systems
