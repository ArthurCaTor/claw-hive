// AgentGrid component
// Grid of agent cards with fetch

import { useState, useEffect } from 'react';
import { AgentCard } from './AgentCard';

// Get API base URL
const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:8080';

export function AgentGrid({ 
  selectedAgent, 
  onSelectAgent,
  compact = false,
  columns = 3 
}) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAgents();
    // Poll for updates every 15 seconds
    const interval = setInterval(fetchAgents, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/agents`);
      if (!res.ok) throw new Error('Failed to fetch agents');
      const data = await res.json();
      setAgents(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && agents.length === 0) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '200px',
        color: '#64748b' 
      }}>
        Loading agents...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '200px',
        color: '#ef4444' 
      }}>
        Error: {error}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '200px',
        color: '#64748b' 
      }}>
        No agents found
      </div>
    );
  }

  const gridStyle = compact 
    ? { display: 'flex', flexDirection: 'column', gap: '8px' }
    : { 
        display: 'grid', 
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: '16px' 
      };

  return (
    <div style={gridStyle}>
      {agents.map((agent) => (
        <AgentCard
          key={agent.agent_id}
          agent={agent}
          selected={selectedAgent?.agent_id === agent.agent_id}
          onClick={onSelectAgent}
          compact={compact}
        />
      ))}
    </div>
  );
}

// Hook for agent data
export function useAgents() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/agents`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setAgents(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, []);

  return { agents, loading, error, refresh };
}

export default AgentGrid;
