// ============================================
// API Types — API 类型定义
// ============================================

export interface Agent {
  agent_id: string;
  name: string;
  role: string;
  avatar: string;
  color: string;
  status: 'working' | 'idle' | 'paused' | 'stopped';
  task: string;
  output: string | null;
  model: string;
  model_source?: 'session' | 'config';
  heartbeat: string;
  tokens_used: number;
  registered_at?: string;
  updated_at: number;
  updated_at_iso: string;
}

export interface CaptureRecord {
  id: number;
  timestamp: string;
  agent: string;
  provider: string;
  model: string;
  request: {
    method: string;
    path: string;
    headers: Record<string, string>;
    body: any;
    tokens: number;
  };
  response: {
    status: number;
    body: any;
    tokens: number;
  } | null;
  latency_ms: number;
  tokens: { input: number; output: number };
  cost?: number;
  error?: string;
}

export interface LLMSwitchEvent {
  agentId: string;
  from: { provider: string; model: string };
  to: { provider: string; model: string };
  timestamp: string;
  trigger: 'error' | 'manual';
}

export interface ProviderHealth {
  provider: string;
  calls: number;
  errors: number;
  errorRate: number;
  p50: number;
  p95: number;
  p99: number;
  lastCall: string | null;
}

export interface CostResult {
  total: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
}

export interface SessionInfo {
  sessionId: string;
  agent: string;
  mtime: string;
  ageMs: number;
  size: number;
  messageCount: number;
  preview: string | null;
}

export interface ProxyStatus {
  running: boolean;
  port: number;
  startedAt: string | null;
  totalCalls: number;
  uptimeSeconds: number;
}

export interface DebugSession {
  id: string;
  agentId: string;
  startedAt: string;
  status: 'active' | 'paused' | 'stopped';
}

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  lastRun: string | null;
  nextRun: string | null;
}

export interface Recording {
  id: string;
  name: string;
  startedAt: string;
  stoppedAt: string | null;
  duration: number;
  eventCount: number;
}
