import React from 'react';
// AgentCard component
// Individual agent display card

export function AgentCard({ 
  agent, 
  onClick, 
  selected = false,
  compact = false 
}) {
  const statusColors = {
    working: { bg: '#22c55e20', color: '#22c55e', text: 'Working' },
    idle: { bg: '#6b728020', color: '#9ca3af', text: 'Idle' },
    paused: { bg: '#f59e0b20', color: '#f59e0b', text: 'Paused' },
    stopped: { bg: '#ef444420', color: '#ef4444', text: 'Stopped' },
  };

  const status = statusColors[agent.status] || statusColors.idle;

  if (compact) {
    return (
      <div
        onClick={() => onClick?.(agent)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '8px 12px',
          background: selected ? '#3b82f620' : '#1e293b',
          border: `1px solid ${selected ? '#3b82f6' : '#334155'}`,
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        <span style={{ fontSize: '20px' }}>{agent.emoji || '🤖'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: '14px', color: '#e2e8f0' }}>
            {agent.name || agent.agent_id}
          </div>
          <div style={{ fontSize: '12px', color: status.color }}>
            {status.text}
          </div>
        </div>
        <div style={{
          padding: '2px 8px',
          borderRadius: '4px',
          background: status.bg,
          color: status.color,
          fontSize: '11px',
          fontWeight: 500,
        }}>
          {agent.model?.split('/').pop() || '—'}
        </div>
      </div>
    );
  }

  // Full card
  return (
    <div
      onClick={() => onClick?.(agent)}
      style={{
        background: '#1e293b',
        border: `1px solid ${selected ? '#3b82f6' : '#334155'}`,
        borderRadius: '12px',
        padding: '16px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: '#3b82f620',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
        }}>
          {agent.emoji || '🤖'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '16px', color: '#e2e8f0' }}>
            {agent.name || agent.agent_id}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
            {agent.agent_id}
          </div>
        </div>
        <div style={{
          padding: '4px 10px',
          borderRadius: '6px',
          background: status.bg,
          color: status.color,
          fontSize: '12px',
          fontWeight: 500,
        }}>
          {status.text}
        </div>
      </div>

      {/* Info grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
        <div>
          <div style={{ color: '#64748b', marginBottom: '2px' }}>Model</div>
          <div style={{ color: '#e2e8f0', fontFamily: 'monospace', fontSize: '12px' }}>
            {agent.model?.split('/').pop() || '—'}
          </div>
        </div>
        <div>
          <div style={{ color: '#64748b', marginBottom: '2px' }}>Tokens</div>
          <div style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>
            {agent.tokens_used?.toLocaleString() || 0}
          </div>
        </div>
      </div>

      {/* Current task */}
      {agent.task && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #334155' }}>
          <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '4px' }}>Current Task</div>
          <div style={{ fontSize: '13px', color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {agent.task}
          </div>
        </div>
      )}
    </div>
  );
}

export default AgentCard;
