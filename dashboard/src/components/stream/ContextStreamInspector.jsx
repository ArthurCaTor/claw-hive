import React from 'react';
// ContextStreamInspector component
// Real-time event stream from SSE

import { useState, useEffect, useRef } from 'react';
import { Button } from '../common/Button';

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:8080';

export function ContextStreamInspector() {
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const eventSourceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, []);

  const connect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`${API_BASE}/api/context-stream`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnected(true);
    };

    eventSource.onmessage = (event) => {
      if (paused) return;
      
      try {
        const data = JSON.parse(event.data);
        setEvents((prev) => {
          const newEvents = [...prev, data].slice(-100); // Keep last 100
          return newEvents;
        });
        
        // Auto-scroll to bottom
        if (containerRef.current && !paused) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
      eventSource.close();
      // Reconnect after 3s
      setTimeout(connect, 3000);
    };
  };

  const disconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setConnected(false);
  };

  const clearEvents = () => setEvents([]);

  const getEventColor = (event) => {
    const type = event.type || '';
    if (type.includes('error')) return '#ef4444';
    if (type.includes('warning')) return '#f59e0b';
    if (type.includes('agent')) return '#3b82f6';
    return '#22c55e';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: connected ? '#22c55e' : '#ef4444',
          }} />
          <span style={{ fontSize: '13px', color: connected ? '#22c55e' : '#ef4444' }}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        
        <Button 
          size="sm" 
          variant={paused ? 'danger' : 'ghost'} 
          onClick={() => setPaused(!paused)}
        >
          {paused ? '▶ Resume' : '⏸ Pause'}
        </Button>
        
        <Button size="sm" variant="ghost" onClick={clearEvents}>
          🗑 Clear
        </Button>
        
        <Button size="sm" variant="ghost" onClick={disconnect}>
          Disconnect
        </Button>
        
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#64748b' }}>
          {events.length} events
        </span>
      </div>

      {/* Events List */}
      <div 
        ref={containerRef}
        style={{
          flex: 1,
          background: '#0d1117',
          borderRadius: '8px',
          border: '1px solid #334155',
          overflow: 'auto',
          padding: '12px',
          fontFamily: 'monospace',
          fontSize: '12px',
        }}
      >
        {events.length === 0 ? (
          <div style={{ color: '#64748b', textAlign: 'center', padding: '40px' }}>
            {connected ? 'Waiting for events...' : 'Not connected'}
          </div>
        ) : (
          events.map((event, idx) => (
            <div
              key={idx}
              style={{
                padding: '8px',
                marginBottom: '4px',
                borderRadius: '4px',
                background: '#1e293b',
                borderLeft: `3px solid ${getEventColor(event)}`,
              }}
            >
              <div style={{ display: 'flex', gap: '8px', color: '#64748b', fontSize: '11px', marginBottom: '4px' }}>
                <span>{new Date(event.timestamp || Date.now()).toLocaleTimeString()}</span>
                <span style={{ color: getEventColor(event) }}>{event.type || 'event'}</span>
              </div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#e2e8f0' }}>
                {JSON.stringify(event, null, 2).slice(0, 500)}
                {JSON.stringify(event).length > 500 ? '...' : ''}
              </pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ContextStreamInspector;
