import React from 'react';
// ContextStreamInspector - Full original logic with Live/Recordings modes

import { useState, useEffect, useRef } from 'react';

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:8080';

export function ContextStreamInspector() {
  const [events, setEvents] = useState([]);
  const [sessions, setSessions] = useState({});
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [mode, setMode] = useState('live'); // 'live' or 'recordings'
  const [recordingStatus, setRecordingStatus] = useState(null);
  const [recordingsList, setRecordingsList] = useState([]);
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
  const eventSourceRef = useRef(null);

  // Initial data fetch
  useEffect(() => {
    fetchSessions();
    fetchRecordingStatus();
    fetchRecordingsList();
    
    const interval = setInterval(fetchRecordingStatus, 2000);
    return () => {
      clearInterval(interval);
      eventSourceRef.current?.close();
    };
  }, []);

  // Build agents list from sessions and auto-select
  useEffect(() => {
    const availableAgents = Object.keys(sessions);
    if (availableAgents.length > 0 && !selectedAgent) {
      const defaultAgent = availableAgents.includes('coder') ? 'coder' : availableAgents[0];
      setSelectedAgent(defaultAgent);
      const agentSessions = sessions[defaultAgent] || [];
      if (agentSessions.length > 0) {
        setSelectedSession(agentSessions[0].sessionId);
      }
    }
  }, [sessions]);

  // Poll for events based on mode
  useEffect(() => {
    if (mode !== 'live') return;

    // If agent+session selected, poll that session
    if (selectedAgent && selectedSession) {
      fetchSessionEvents();
      const interval = setInterval(fetchSessionEvents, 2000);
      return () => clearInterval(interval);
    } else {
      setEvents([]);
    }
  }, [selectedAgent, selectedSession, mode]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/sessions`);
      const data = await res.json();
      // sessions is already keyed by agent from the API
      setSessions(data);
    } catch (err) {
      console.error('Fetch sessions error:', err);
    }
  };

  const fetchSessionEvents = async () => {
    if (!selectedAgent || !selectedSession) return;
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${selectedAgent}/${selectedSession}`);
      const data = await res.json();
      if (data.events) {
        setEvents(data.events.slice(-500));
      }
    } catch (err) {
      console.error('Fetch session events error:', err);
    }
  };

  const fetchRecordingStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/recording/status`);
      const data = await res.json();
      setRecordingStatus(data.recording);
    } catch (err) {
      console.error('Recording status error:', err);
    }
  };

  const fetchRecordingsList = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/recordings`);
      const data = await res.json();
      setRecordingsList(data.recordings || []);
    } catch (err) {
      console.error('Recordings fetch error:', err);
    }
  };

  const startRecording = async () => {
    try {
      await fetch(`${API_BASE}/api/recording/start`, { method: 'POST' });
      fetchRecordingStatus();
    } catch (err) {
      console.error('Start recording error:', err);
    }
  };

  const stopRecording = async () => {
    try {
      await fetch(`${API_BASE}/api/recording/stop`, { method: 'POST' });
      fetchRecordingStatus();
      fetchRecordingsList();
    } catch (err) {
      console.error('Stop recording error:', err);
    }
  };

  // Filter events
  const filteredEvents = events.filter(event => {
    const type = event.type || 'unknown';
    const role = event.message?.role;
    const dataType = event.data?.type;
    
    if (type === 'message') {
      if (dataType === 'thinking') return filters.thinking;
      if (dataType === 'tool_use') return filters.tool_use;
      return filters.message;
    }
    if (type === 'thinking_level_change') return filters.thinking_level_change;
    if (type === 'custom') return filters.custom;
    if (type === 'compaction') return filters.compaction;
    if (type === 'error') return filters.error;
    return true;
  });

  const agentSessions = sessions[selectedAgent] || [];

  // Render event item
  const renderEvent = (event, idx) => {
    const type = event.type || 'unknown';
    const timestamp = new Date(event.timestamp || event.received_at).toLocaleTimeString();
    const role = event.message?.role || event.data?.role;
    
    let borderColor = '#64748b';
    if (type === 'error') borderColor = '#ef4444';
    else if (event.data?.type === 'thinking') borderColor = '#f59e0b';
    else if (event.data?.type === 'tool_use') borderColor = '#eab308';
    else if (role === 'user') borderColor = '#3b82f6';
    else if (role === 'assistant') borderColor = '#22c55e';
    else if (type === 'session') borderColor = '#64748b';
    else if (type === 'compaction') borderColor = '#d4a574';
    else if (type === 'custom') borderColor = '#93c5fd';

    // Get message content
    const getContent = () => {
      const content = event.message?.content || event.data?.message?.content || [];
      if (Array.isArray(content)) {
        // Extract text content
        const textParts = content.filter(c => c.type === 'text').map(c => c.text).join('\n');
        // Extract thinking content
        const thinkingParts = content.filter(c => c.type === 'thinking').map(c => c.thinking).join('\n');
        return thinkingParts ? `💭 ${thinkingParts}` : textParts;
      }
      return typeof content === 'string' ? content : '';
    };

    // Session divider
    if (type === 'session') {
      return (
        <div key={idx} style={{ textAlign: 'center', padding: '8px', color: '#64748b', borderTop: '1px solid #30363d', borderBottom: '1px solid #30363d', margin: '8px 0', fontSize: '10px' }}>
          ━━━ SESSION {event.id?.slice(0, 8)} ━━━ {timestamp}
        </div>
      );
    }

    // User message
    if (role === 'user') {
      return (
        <div key={idx} onClick={() => setSelectedEvent(event)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: 8 }}>
          <div style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: 12, background: '#2d4a7a', color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', fontSize: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>👤 user {timestamp}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace" }}>{getContent()}</div>
          </div>
        </div>
      );
    }

    // Assistant message
    if (role === 'assistant') {
      const usage = event.message?.usage;
      return (
        <div key={idx} onClick={() => setSelectedEvent(event)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ maxWidth: '85%', padding: '10px 14px', borderRadius: 12, background: '#1e2a3a', color: '#e2e8f0', fontSize: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 3, display: 'flex', gap: 8 }}>
              <span>🤖 assistant</span>
              <span>{timestamp}</span>
              {usage && <span style={{ color: '#22c55e' }}>${usage.cost?.total || 0}</span>}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace" }}>{getContent()}</div>
          </div>
        </div>
      );
    }

    // Thinking
    if (event.data?.type === 'thinking') {
      return (
        <div key={idx} onClick={() => setSelectedEvent(event)} style={{ padding: '6px 10px', marginBottom: 5, borderRadius: 6, background: 'rgba(100,100,100,0.2)', border: '1px dashed #666', fontSize: 12, color: '#9ca3af' }}>
          💭 thinking {timestamp}
        </div>
      );
    }

    // Tool use
    if (event.data?.type === 'tool_use') {
      const toolName = event.data?.name || event.data?.tool || 'tool';
      const toolInput = event.data?.input || '';
      return (
        <div key={idx} onClick={() => setSelectedEvent(event)} style={{ padding: 8, marginBottom: 5, borderRadius: 6, background: '#1f2937', color: '#e5e7eb', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
          <div style={{ marginBottom: 3, color: '#fbbf24' }}>🔧 {toolName} {timestamp}</div>
          <div style={{ color: '#9ca3af', whiteSpace: 'pre-wrap' }}>{typeof toolInput === 'string' ? toolInput : JSON.stringify(toolInput, null, 2)}</div>
        </div>
      );
    }

    // Error
    if (type === 'error') {
      return (
        <div key={idx} style={{ padding: 10, marginBottom: 5, borderRadius: 6, background: '#7f1d1d', color: '#fecaca', fontSize: 11 }}>
          ⚠️ ERROR {timestamp}
          <div>{event.message || event.data?.message || 'Unknown error'}</div>
        </div>
      );
    }

    // Custom
    if (type === 'custom') {
      const customType = event.customType || 'custom';
      const customData = event.data || {};
      return (
        <div key={idx} onClick={() => setSelectedEvent(event)} style={{ padding: 8, marginBottom: 5, borderRadius: 6, background: '#1e3a5f', color: '#93c5fd', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
          <div style={{ marginBottom: 4 }}>⚙️ {customType} {timestamp}</div>
          {Object.keys(customData).length > 0 && (
            <div style={{ color: '#9ca3af', whiteSpace: 'pre-wrap' }}>{JSON.stringify(customData, null, 2)}</div>
          )}
        </div>
      );
    }

    // Compaction
    if (type === 'compaction') {
      return (
        <div key={idx} onClick={() => setSelectedEvent(event)} style={{ padding: 8, marginBottom: 5, borderRadius: 6, background: '#3f2f2f', color: '#d4a574', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
          <div style={{ marginBottom: 4 }}>🗜️ compaction {timestamp}</div>
          {event.summary && (
            <div style={{ color: '#9ca3af', whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>{event.summary.slice(0, 500)}...</div>
          )}
        </div>
      );
    }

    // Thinking level change
    if (type === 'thinking_level_change') {
      return (
        <div key={idx} style={{ padding: '6px 10px', marginBottom: 5, borderRadius: 6, background: 'rgba(100,100,100,0.2)', border: '1px dashed #666', fontSize: 12, color: '#9ca3af' }}>
          💭 thinking_level_change: {event.thinkingLevel} {timestamp}
        </div>
      );
    }

    // Default
    return (
      <div key={idx} onClick={() => setSelectedEvent(event)} style={{ padding: 6, marginBottom: 3, fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>
        [{type}] {timestamp}
      </div>
    );
  };

  // Render Live mode
  const renderLiveMode = () => (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Left sidebar */}
      <div style={{ width: 200, borderRight: '1px solid #30363d', padding: 12, background: '#1a1a2e', overflowY: 'auto', fontSize: 11 }}>
        {/* Agent selector */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: '#64748b', marginBottom: 3, fontWeight: 500 }}>AGENT</div>
          <select
            value={selectedAgent}
            onChange={e => { setSelectedAgent(e.target.value); setSelectedSession(''); setEvents([]); }}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #30363d', background: '#0d1117', color: '#e2e8f0', fontSize: 11 }}
          >
            <option value="">All agents...</option>
            {Object.keys(sessions).map(agent => (
              <option key={agent} value={agent}>{agent}</option>
            ))}
          </select>
        </div>

        {/* Session selector */}
        {selectedAgent && agentSessions.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: '#64748b', marginBottom: 3, fontWeight: 500 }}>SESSION</div>
            <select
              value={selectedSession}
              onChange={e => { setSelectedSession(e.target.value); setEvents([]); }}
              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #30363d', background: '#0d1117', color: '#e2e8f0', fontSize: 11 }}
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

        {/* Watching indicator */}
        {selectedAgent && selectedSession && (
          <div style={{ marginBottom: 16, color: '#22c55e', fontSize: 10 }}>
            ● Watching: {selectedAgent}/{selectedSession.slice(0, 8)}...
          </div>
        )}

        {/* Filters */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ color: '#64748b', marginBottom: 5, fontWeight: 500 }}>FILTERS</div>
          {Object.entries(filters).map(([key, enabled]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, color: '#e2e8f0' }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={e => setFilters(f => ({ ...f, [key]: e.target.checked }))}
              />
              {key.replace('_', ' ')}
            </label>
          ))}
        </div>

        {/* Auto-scroll */}
        <div>
          <div style={{ color: '#64748b', marginBottom: 5, fontWeight: 500 }}>AUTO-SCROLL</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#e2e8f0' }}>
            <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} />
            Enabled
          </label>
        </div>
      </div>

      {/* Events list */}
      <div ref={containerRef} style={{ flex: 1, padding: 12, overflowY: 'auto', minHeight: '300px' }}>
        {filteredEvents.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>Waiting for events...</div>
        ) : (
          filteredEvents.map((event, idx) => renderEvent(event, idx))
        )}
      </div>
    </div>
  );

  // Render Recordings mode
  const renderRecordingsMode = () => (
    <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 16 }}>📂 Recordings</div>
      {recordingsList.length === 0 ? (
        <div style={{ color: '#64748b' }}>No recordings yet</div>
      ) : (
        recordingsList.map(rec => (
          <div key={rec.filename} style={{ padding: 12, marginBottom: 5, borderRadius: 8, background: '#1e2a3a', border: '1px solid #30363d' }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{rec.name}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {rec.started_at && new Date(rec.started_at).toLocaleString()}
              {rec.duration_seconds && ` • ${Math.floor(rec.duration_seconds / 60)}m ${rec.duration_seconds % 60}s`}
              {rec.event_count && ` • ${rec.event_count} events`}
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: '#e2e8f0' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #30363d' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { id: 'live', label: '📡 Live' },
            { id: 'recordings', label: '📂 Recordings' }
          ].map(btn => (
            <button
              key={btn.id}
              onClick={() => setMode(btn.id)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: 'none',
                background: mode === btn.id ? '#3b82f6' : 'transparent',
                color: mode === btn.id ? 'white' : '#64748b',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {mode === 'live' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {recordingStatus ? (
              <button
                onClick={stopRecording}
                style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer', fontSize: 11 }}
              >
                ⏹ Stop ({recordingStatus.event_count})
              </button>
            ) : (
              <button
                onClick={startRecording}
                style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#22c55e', color: 'white', cursor: 'pointer', fontSize: 11 }}
              >
                ⏺ Record
              </button>
            )}
            <span style={{ fontSize: 12, color: '#64748b' }}>{events.length} events</span>
          </div>
        )}
      </div>

      {/* Mode content */}
      {mode === 'live' ? renderLiveMode() : renderRecordingsMode()}

      {/* Details panel */}
      {selectedEvent && (
        <div style={{ position: 'absolute', right: 0, top: 52, bottom: 0, width: 400, background: '#1e2a3a', borderLeft: '1px solid #30363d', padding: 12, overflow: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 600 }}>Details</div>
            <button onClick={() => setSelectedEvent(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 20 }}>×</button>
          </div>
          <pre style={{ fontSize: 11, fontFamily: 'monospace', color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(selectedEvent, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default ContextStreamInspector;
