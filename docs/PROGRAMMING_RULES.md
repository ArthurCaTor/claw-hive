# CLAW-HIVE Programming Rules

## 1. No Hard Coding - Always Read from Config

All data must be dynamically read from `openclaw.json` configuration file. Never hard code values that can be configured.

### Required Dynamic Sources:
- **Agents** → `config.agents.list[]`
- **Models** → `config.agents.defaults.models[]`
- **Pricing** → `config.pricing` (optional, fallback to default)
- **Rate Limits** → `config.rateLimits` (optional, fallback to default)
- **Cron Jobs** → `config.heartbeat`, `config.compaction`, `config.env.vars`
- **Workspaces** → `config.agents.defaults.workspace`

### Fallback Pattern:
```javascript
// Read from config
let value = {};
const configPath = findConfigPath();
if (configPath) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    value = config.yourKey || {};
  } catch (e) {}
}

// Fallback to default if not in config
if (Object.keys(value).length === 0) {
  value = DEFAULT_VALUE;
}
```

### Never Hard Code:
- ❌ Model names (MiniMax, Claude, GPT)
- ❌ Pricing rates
- ❌ API rate limits
- ❌ Agent list
- ❌ Workspace paths

### Always Read Dynamically:
- ✅ Read from `openclaw.json`
- ✅ Read from environment variables
- ✅ Read from database if available

---

## 2. Theme System

Support both light and dark themes. Use semantic colors:
- `t.text` - Main text color
- `t.textMuted` - Muted/secondary text
- `t.bg` - Background color
- `t.bgSecondary` - Secondary background
- `t.border` - Border color
- `t.primary` - Primary accent color

---

## 3. Responsive Layout

- Header: Fixed at top, sticky position
- Sidebar: Independent scrolling
- Main content: Independent scrolling
- Mobile: Not priority for v1

---

## 4. API Endpoints Pattern

All endpoints return JSON with this structure:
```javascript
{
  total: number,
  items: [],
  // or
  error: string
}
```

---

## 5. Build & Deploy

- Use `npm run build` for production
- Output goes to `public/` folder
- Serve via `node src/server.js` on port 3000
