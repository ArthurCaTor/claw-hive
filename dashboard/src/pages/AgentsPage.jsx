import React from 'react';
// Agents Page
import { AgentGrid, useAgents } from '../components/agents';
import { useEffect } from 'react';

export function AgentsPage() {
  const { agents, loading, error, refresh } = useAgents();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>Agents</h1>
        <button onClick={refresh} style={{
          background: '#3b82f6',
          color: '#fff',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '6px',
          cursor: 'pointer',
        }}>
          Refresh
        </button>
      </div>
      
      {loading && agents.length === 0 ? (
        <div style={{ color: '#64748b' }}>Loading...</div>
      ) : error ? (
        <div style={{ color: '#ef4444' }}>Error: {error}</div>
      ) : (
        <AgentGrid columns={3} />
      )}
    </div>
  );
}

export default AgentsPage;
