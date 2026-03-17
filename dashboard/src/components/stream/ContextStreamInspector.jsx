import React from 'react';
// ContextStreamInspector component - Original style with Agent/Session selectors

import { useState, useEffect, useRef } from 'react';

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:8080';

export function ContextStreamInspector() {
  const [events, setEvents] = useState([]);
  const [agents, setAgents] = useState([]);
  const [sessions, setSessions] = useState({});
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filters, setFilters] = useState({
    message: true,
    thinking: true,
    tool_use: true,
    thinking_level_change: true,
    custom: true,
    compaction: true,
    error: true,
  });
  const containerRef = useRef(null);

  // Fetch agents and sessions on mount
  useEffect(() => {
    fetchAgents();
    fetchSessions();
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/agents`);
      const data = await res.json();
      const agentList = Array.isArray(data) ? data : [];
      setAgents(agentList);
      if (agentList.length > 0 && !selectedAgent) {
        setSelectedAgent(agentList[0].agent_id || agentList[0].name);
      }
    } catch (err) {
      console.error('Fetch agents error:', err);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/sessions`);
      const data = await res.json();
      setSessions(data);
    } catch (err) {
      console.error('Fetch sessions error:', err);
    }
  };

  // Connect to SSE for current agent/session
  useEffect(() => {
    if (!selectedAgent || !selectedSession) return;

    const eventSource = new EventSource(`${API_BASE}/api/sessions/${selectedAgent}/${selectedSession}/watch`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setEvents((prev) => [...prev, data].slice(-500));
        if (containerRef.current && autoScroll) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      } catch (err) {}
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  }, [selectedAgent, selectedSession, autoScroll]);

  // Filter events
  const filteredEvents = events.filter(e => {
    const type = e.type || e.data?.type || 'unknown';
    if (type === 'message') {
      const subtype = e.data?.type || 'message';
      if (subtype === 'thinking') return filters.thinking;
      if (subtype === 'tool_use') return filters.tool_use;
      return filters.message;
    }
    if (type === 'thinking_level_change') return filters.thinking_level_change;
    if (type === 'custom') return filters.custom;
    if (type === 'compaction') return filters.compaction;
    if (type === 'error') return filters.error;
    return true;
  });

  const agentSessions = sessions[selectedAgent] || [];

  return (
    <div style={{ display: 'flex', height: '100%', gap: '16px' }}>
      {/* Left sidebar - Agent/Session selectors + Filters */}
      <div style={{ width: '200px', flexShrink: 0 }}>
        {/* Agent selector */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>AGENT</div>
          <select
            value={selectedAgent}
            onChange={(e) => { setSelectedAgent(e.target.value); setSelectedSession(''); setEvents([]); }}
            style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#e2e8f0', fontSize: '12px' }}
          >
            {agents.map(a => (
              <option key={a.agent_id} value={a.agent_id}>{a.name || a.agent_id}</option>
            ))}
          </select>
        </div>

        {/* Session selector */}
        {selectedAgent && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>SESSION</div>
            <select
              value={selectedSession}
              onChange={(e) => { setSelectedSession(e.target.value); setEvents([]); }}
              style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#e2e8f0', fontSize: '12px' }}
            >
              <option value="">Select session...</option>
              {agentSessions.map(s => (
                <option key={s.sessionId} value={s.sessionId}>
                  {s.sessionId?.slice(0, 12)}... ({new Date(s.mtime).toLocaleTimeString()})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Filters */}
        <div>
          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>FILTERS</div>
          {Object.entries(filters).map(([key, enabled]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setFilters(f => ({ ...f, [key]: e.target.checked }))}
              />
              {key.replace('_', ' ')}
            </label>
          ))}
        </div>

        {/* Auto-scroll toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '16px', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}>
          <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
          Auto-scroll
        </label>
      </div>

      {/* Main events list */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          background: '#0d1117',
          borderRadius: '8px',
          border: '1px solid #334155',
          overflow: 'auto',
          padding: '12px',
        }}
      >
        {filteredEvents.length === 0 ? (
          <div style={{ color: '#64748b', textAlign: 'center', padding: '40px' }}>
            {selectedAgent && selectedSession ? 'Waiting for events...' : 'Select agent and session'}
          </div>
        ) : (
          filteredEvents.map((event, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedEvent(event)}
              style={{
                padding: '8px',
                marginBottom: '4px',
                borderRadius: '4px',
                cursor: 'pointer',
                borderLeft: `3px solid ${
                  event.type === 'error' ? '#ef4444' :
                  event.data?.type === 'thinking' ? '#f59e0b' :
                  event.data?.type === 'tool_use' ? '#eab308' :
                  event.data?.role === 'user' ? '#3b82f6' :
                  event.data?.role === 'assistant' ? '#22c55e' : '#64748b'
                }`,
                background: selectedEvent === event ? '#1e293b' : 'transparent',
              }}
            >
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {new Date(event.timestamp || event.received_at).toLocaleTimeString()}
                {' '}(event.type || event.data?.type || 'event')
              </div>
              <pre style={{ margin: '4px 0 0', fontSize: '11px', fontFamily: 'monospace', color: '#e2e8f0', whiteSpace: 'pre-wrap', maxHeight: '60px', overflow: 'hidden' }}>
                {JSON.stringify(event.data || event, null, 2).slice(0, 200)}
              </pre>
            </div>
          ))
        )}
      </div>

      {/* Details panel */}
      {selectedEvent && (
        <div style={{ width: '400px', flexShrink: 0, background: '#1e293b', borderRadius: '8px', padding: '12px', overflow: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontWeight: 600 }}>Details</div>
            <button onClick={() => setSelectedEvent(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '18px' }}>×</button>
          </div>
          <pre style={{ fontSize: '11px', fontFamily: 'monospace', color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(selectedEvent, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default ContextStreamInspector;
