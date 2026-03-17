/**
 * @file src/types/index.ts
 * @description Shared type definitions for claw-hive
 *              claw-hive 共享类型定义
 */

// ============================================
// Agent Types — Agent 类型
// ============================================

export type AgentStatus = 'working' | 'idle' | 'paused' | 'stopped';

export interface Agent {
  agent_id: string;
  name: string;
  role: string;
  avatar: string;
  color: string;
  model: string;
  model_source?: 'session' | 'config';
  registered_at?: string;
  status: AgentStatus;
  task: string;
  output: string | null;
  heartbeat: string;
  tokens_used: number;
  updated_at: number;
  updated_at_iso: string;
}

export interface AgentDefaults {
  name: string;
  role: string;
  avatar: string;
  color: string;
  model: string;
}

export interface AgentControlAction {
  agent_id: string;
  action: 'pause' | 'resume' | 'restart' | 'stop';
}

// ============================================
// Capture Types — 捕获类型
// ============================================

export interface CaptureTokens {
  input: number;
  output: number;
}

export interface CaptureRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: any;
}

export interface CaptureResponse {
  status: number;
  body: any;
  tokens: CaptureTokens;
}

export interface CaptureRecord {
  id: number;
  timestamp: string;
  request: CaptureRequest;
  response: CaptureResponse | null;
  latency_ms: number;
  tokens: CaptureTokens;
  provider?: string;
  model?: string;
  cost?: number;
  error?: string;
}

// ============================================
// LLM Types — LLM 类型
// ============================================

export interface LLMSwitchEvent {
  agentId: string;
  from: { provider: string; model: string };
  to: { provider: string; model: string };
  timestamp: string;
  trigger: 'error' | 'manual';
}

export interface ProviderHealth {
  calls: number;
  errors: number;
  errorRate: number;
  p50: number;
  p95: number;
  p99: number;
  lastCall: string | null;
}

// ============================================
// Proxy Types — 代理类型
// ============================================

export interface ProxyStatus {
  running: boolean;
  port: number;
  startedAt: string | null;
  totalCalls: number;
  uptimeSeconds: number;
}

export interface ProxyStartResult {
  success: boolean;
  port: number;
  error?: string;
}

export interface ProxyStopResult {
  success: boolean;
  totalCalls: number;
}

// ============================================
// Session Types — Session 类型
// ============================================

export interface SessionInfo {
  sessionId: string;
  agent: string;
  mtime: string;
  ageMs: number;
  size: number;
  messageCount: number;
  filepath?: string;
  preview: string | null;
}

// ============================================
// Config Types — 配置类型
// ============================================

export interface OpenClawAgentConfig {
  id: string;
  identity?: { name?: string; emoji?: string };
  model?: string;
  workspace?: string;
  subagents?: string[];
}

export interface OpenClawConfig {
  agents?: {
    list?: OpenClawAgentConfig[];
    defaults?: Record<string, any>;
  };
  channels?: Record<string, any>;
  env?: { vars?: Record<string, string> };
  heartbeat?: { every?: string };
  compaction?: { mode?: string };
  pricing?: Record<string, number>;
  rateLimits?: Record<string, any>;
}

// ============================================
// Stats Types — 统计类型
// ============================================

export interface DashboardStats {
  total_agents: number;
  working: number;
  idle: number;
  total_tokens: number;
}
