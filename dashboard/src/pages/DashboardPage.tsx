import { useState, useEffect, useCallback } from 'react';
import { useWebSocket, useAgentsWebSocket } from '../hooks';

export function DashboardPage() {
  const { agents: wsAgents, connected } = useAgentsWebSocket();
  const [stats, setStats] = useState<any>(null);

  // Handle WebSocket messages for real-time updates
  const handleMessage = useCallback((msg: any) => {
    if (msg.type === 'agents_update') {
      setStats(msg.stats);
    }
  }, []);

  useWebSocket(handleMessage);

  const workingCount = wsAgents.filter((a: any) => a.status === 'working').length;
  const idleCount = wsAgents.filter((a: any) => a.status === 'idle').length;
  const totalTokens = wsAgents.reduce((sum: number, a: any) => sum + (a.tokens_used || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>
          Dashboard
        </h1>
        <div style={{ 
          padding: '4px 12px', 
          borderRadius: '16px',
          background: connected ? '#22c55e' : '#ef4444',
          color: '#fff',
          fontSize: '12px'
        }}>
          {connected ? '● Live' : '○ Reconnecting...'}
        </div>
      </div>
      
      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="Total Agents" value={wsAgents.length} />
        <StatCard label="Working" value={workingCount} color="#22c55e" />
        <StatCard label="Idle" value={idleCount} />
        <StatCard label="Total Tokens" value={totalTokens.toLocaleString()} />
      </div>

      {/* Agents Grid */}
      <div style={{ marginBottom: '16px', color: '#94a3b8', fontSize: '16px', fontWeight: 500 }}>
        Agents ({wsAgents.length})
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {wsAgents.map((agent: any) => (
          <AgentCard key={agent.id || agent.agent_id} agent={agent} />
        ))}
        {wsAgents.length === 0 && (
          <div style={{ 
            padding: '40px', 
            textAlign: 'center', 
            color: '#94a3b8',
            background: '#1e293b',
            borderRadius: '12px'
          }}>
            No agents connected
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px' }}>
      <div style={{ fontSize: '12px', color: '#94a3b8' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: 700, color: color || '#fff' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: any }) {
  const statusColor = agent.status === 'working' ? '#22c55e' : '#94a3b8';
  
  return (
    <div style={{ 
      background: '#1e293b', 
      padding: '16px', 
      borderRadius: '12px',
      borderLeft: `4px solid ${statusColor}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontWeight: 600 }}>{agent.name || agent.agent_id}</span>
        <span style={{ 
          fontSize: '12px', 
          padding: '2px 8px', 
          borderRadius: '8px',
          background: agent.status === 'working' ? '#22c55e20' : '#94a3b820',
          color: statusColor
        }}>
          {agent.status || 'idle'}
        </span>
      </div>
      <div style={{ fontSize: '12px', color: '#94a3b8' }}>
        {agent.model || 'No model'}
      </div>
      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
        Tokens: {agent.tokens_used?.toLocaleString() || 0}
      </div>
    </div>
  );
}

export default DashboardPage;
