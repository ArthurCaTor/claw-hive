import React from 'react';
// Captures Page - Full Proxy functionality
import { useState, useEffect, useRef } from 'react';

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:8080';

function ResizablePane({ children, ...props }) {
  return <div {...props}>{children}</div>;
}

function JsonViewer({ data, title, maxHeight = '300px' }) {
  const [expanded, setExpanded] = useState(false);
  
  if (!data) return <div style={{ color: '#64748b', fontSize: '12px' }}>No data</div>;
  
  const json = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const isLong = json.length > 500;
  
  return (
    <div style={{ marginBottom: '12px' }}>
      {title && (
        <div style={{ 
          fontSize: '12px', 
          fontWeight: 600, 
          color: '#94a3b8', 
          marginBottom: '6px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {title}
          {isLong && (
            <button 
              onClick={() => setExpanded(!expanded)}
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: '#64748b', 
                cursor: 'pointer',
                fontSize: '11px'
              }}
            >
              {expanded ? 'Collapse' : 'Expand'}
            </button>
          )}
        </div>
      )}
      <pre style={{
        background: '#0d1117',
        borderRadius: '6px',
        padding: '12px',
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#e2e8f0',
        overflow: 'auto',
        maxHeight: expanded ? 'none' : maxHeight,
        margin: 0,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}>
        {json}
      </pre>
    </div>
  );
}

export function CapturesPage() {
  const [status, setStatus] = useState(null);
  const [captures, setCaptures] = useState([]);
  const [selectedCapture, setSelectedCapture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingCapture, setLoadingCapture] = useState(false);
  const [error, setError] = useState(null);
  const [leftWidth, setLeftWidth] = useState(350);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  // Mouse drag handlers for resizable pane
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.max(250, Math.min(600, e.clientX - rect.left));
      setLeftWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/debug-proxy/status`);
      const data = await res.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchCaptures = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/debug-proxy/captures?limit=50`);
      const data = await res.json();
      setCaptures(data.captures || data || []);
    } catch (err) {
      console.error('Fetch captures error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCapture = async (id) => {
    setLoadingCapture(true);
    try {
      const res = await fetch(`${API_BASE}/api/debug-proxy/captures/${id}`);
      const data = await res.json();
      setSelectedCapture(data);
    } catch (err) {
      console.error('Failed to fetch capture:', err);
    } finally {
      setLoadingCapture(false);
    }
  };

  // Initial data fetch + SSE for real-time updates
  useEffect(() => {
    fetchStatus();
    fetchCaptures();
    
    // SSE for real-time captures
    const eventSource = new EventSource(`${API_BASE}/api/debug-proxy/stream`);
    eventSource.onmessage = (e) => {
      try {
        const newCapture = JSON.parse(e.data);
        setCaptures(prev => {
          // Avoid duplicates
          const exists = prev.find(c => c.id === newCapture.id);
          if (exists) return prev;
          return [newCapture, ...prev].slice(0, 50);
        });
      } catch (err) {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    const interval = setInterval(() => {
      fetchStatus();
    }, 5000);
    
    return () => {
      clearInterval(interval);
      eventSource.close();
    };
  }, []);

  const exportCapture = (capture) => {
    if (!capture) return;
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const filename = `${capture.request?.body?.model || 'api-call'}-${timestamp}-${capture.id}.md`;
    
    const content = `# API Call #${capture.id}

## Summary
- **Status**: ${capture.response?.status}
- **Latency**: ${capture.latency_ms}ms
- **Model**: ${capture.request?.body?.model || 'unknown'}
- **Timestamp**: ${new Date(capture.timestamp).toLocaleString()}

## Request
\`\`\`json
${JSON.stringify(capture.request?.body, null, 2)}
\`\`\`

## Response
\`\`\`json
${JSON.stringify(capture.response?.body, null, 2)}
\`\`\`
`;
    
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isRunning = status?.running === true;

  return (
    <div>
      {/* Compact Status Bar */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '12px',
        padding: '8px 12px',
        background: '#1e293b',
        borderRadius: '6px',
        border: '1px solid #334155'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            background: isRunning ? '#22c55e' : '#ef4444',
            boxShadow: isRunning ? '0 0 6px #22c55e' : 'none'
          }} />
          <span style={{ fontWeight: 600, fontSize: '13px' }}>
            Proxy {isRunning ? 'Running' : 'Stopped'}
          </span>
          <span style={{ color: '#64748b', fontSize: '12px' }}>
            {status?.capturesCount || 0} captures
          </span>
        </div>
        
        <button
          onClick={() => { fetchStatus(); fetchCaptures(); }}
          style={{
            padding: '4px 8px',
            borderRadius: '4px',
            border: '1px solid #334155',
            background: 'transparent',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: '11px',
          }}
        >
          🔄
        </button>
      </div>

      {error && (
        <div style={{ 
          padding: '12px', 
          background: '#7f1d1d', 
          borderRadius: '6px', 
          color: '#fecaca',
          marginBottom: '16px',
          fontSize: '12px'
        }}>
          Error: {error}
        </div>
      )}

      {/* Captures List */}
      <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#94a3b8' }}>
        Recent Captures
      </h3>
      
      {loading ? (
        <div style={{ color: '#64748b' }}>Loading captures...</div>
      ) : captures.length === 0 ? (
        <div style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>
          No captures recorded yet.
        </div>
      ) : (
        <div ref={containerRef} style={{ display: 'flex', gap: '0px', height: 'calc(100vh - 100px)' }}>
          {/* Left: Captures list */}
          <div style={{ 
            width: leftWidth, 
            flexShrink: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '2px', 
              height: '100%', 
              overflow: 'auto' 
            }}>
              {captures.map((capture) => (
                <div
                  key={capture.id}
                  onClick={() => fetchCapture(capture.id)}
                  style={{
                    padding: '4px 8px',
                    background: selectedCapture?.id === capture.id ? '#3b82f620' : '#1e293b',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '11px',
                    border: selectedCapture?.id === capture.id ? '1px solid #3b82f6' : '1px solid transparent',
                  }}
                >
                  <span style={{ color: '#64748b', minWidth: '30px' }}>#{capture.id}</span>
                  <span style={{ 
                    color: capture.status >= 200 && capture.status < 300 ? '#22c55e' : '#ef4444',
                    fontWeight: 500,
                    minWidth: '40px'
                  }}>
                    {capture.status}
                  </span>
                  <span style={{ color: '#94a3b8', flex: 1, fontFamily: 'monospace', fontSize: '11px' }}>
                    {capture.model || 'unknown'}
                  </span>
                  <span style={{ color: '#64748b' }}>
                    {capture.latency_ms}ms
                  </span>
                  <span style={{ color: '#64748b' }}>
                    {capture.tokens?.input}→{capture.tokens?.output}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Resize handle */}
          <div 
            onMouseDown={handleMouseDown}
            style={{ 
              width: '6px', 
              cursor: 'col-resize',
              background: isDragging ? '#3b82f6' : '#334155',
              transition: 'background 0.2s',
              flexShrink: 0,
              borderRadius: '3px',
              margin: '0 2px'
            }}
            title="Drag to resize"
          />

          {/* Capture Detail */}
          {selectedCapture && (
            <div style={{ 
              flex: 1, 
              minWidth: '300px',
              background: '#1e293b', 
              borderRadius: '8px', 
              padding: '12px',
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {loadingCapture ? (
                <div style={{ color: '#64748b' }}>Loading...</div>
              ) : (
                <>
                  {/* Request Body with inline export */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ 
                      fontSize: '12px', 
                      fontWeight: 600, 
                      color: '#94a3b8', 
                      marginBottom: '6px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span>Request Body</span>
                      <button
                        onClick={() => exportCapture(selectedCapture)}
                        style={{
                          padding: '2px 6px',
                          borderRadius: '3px',
                          border: 'none',
                          background: '#334155',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          fontSize: '10px',
                        }}
                      >
                        📥 Export
                      </button>
                    </div>
                    <pre style={{
                      background: '#0d1117',
                      borderRadius: '6px',
                      padding: '12px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      color: '#e2e8f0',
                      overflow: 'auto',
                      maxHeight: '300px',
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}>
                      {JSON.stringify(selectedCapture.request?.body || selectedCapture.request, null, 2)}
                    </pre>
                  </div>

                  {/* Response Body */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ 
                      fontSize: '12px', 
                      fontWeight: 600, 
                      color: '#94a3b8', 
                      marginBottom: '6px'
                    }}>
                      Response Body
                    </div>
                    <pre style={{
                      background: '#0d1117',
                      borderRadius: '6px',
                      padding: '12px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      color: '#e2e8f0',
                      overflow: 'auto',
                      maxHeight: '300px',
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}>
                      {JSON.stringify(selectedCapture.response?.body || selectedCapture.response, null, 2)}
                    </pre>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CapturesPage;
