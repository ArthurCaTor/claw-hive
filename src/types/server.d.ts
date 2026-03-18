// Type definitions for server.ts

interface Agent {
  agent_id: string;
  name: string;
  role: string;
  avatar: string;
  color: string;
  model: string;
  status: string;
  task: string;
  output: string | null;
  heartbeat: string;
  tokens_used: number;
  updated_at: number;
}

interface AgentStore {
  [agentId: string]: Agent;
}

interface ConfigPath {
  path: string;
  workspace: string;
}

interface GetStats {
  (): {
    total_agents: number;
    working: number;
    idle: number;
    total_tokens: number;
  };
}
