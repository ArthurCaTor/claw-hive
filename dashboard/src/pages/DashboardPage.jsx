import React from 'react';
// Dashboard Page
import { useAgentStore } from '../stores';
import { AgentGrid, AgentCard } from '../components/agents';
import { useEffect } from 'react';

export function DashboardPage() {
  const { agents, fetchAgents, selectedAgent, selectAgent } = useAgentStore();

  useEffect(() => {
    const interval = fetchAgents();
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: '24px', fontWeight: 600 }}>
        Dashboard
      </h1>
      
      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>Total Agents</div>
          <div style={{ fontSize: '28px', fontWeight: 700 }}>{agents.length}</div>
        </div>
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>Working</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#22c55e' }}>
            {agents.filter(a => a.status === 'working').length}
          </div>
        </div>
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>Idle</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#94a3b8' }}>
            {agents.filter(a => a.status === 'idle').length}
          </div>
        </div>
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>Total Tokens</div>
          <div style={{ fontSize: '28px', fontWeight: 700 }}>
            {agents.reduce((sum, a) => sum + (a.tokens_used || 0), 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Agents Grid */}
      <h2 style={{ margin: '0 0 16px', fontSize: '16px', color: '#94a3b8' }}>Agents</h2>
      <AgentGrid 
        selectedAgent={selectedAgent} 
        onSelectAgent={selectAgent}
        columns={3}
      />
    </div>
  );
}

export default DashboardPage;
