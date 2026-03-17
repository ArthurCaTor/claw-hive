// CaptureDetail component
// View LLM call captures with collapsible JSON

import { useState, useEffect } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:8080';

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
            <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Collapse' : 'Expand'}
            </Button>
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

export function CaptureList({ onSelectCapture }) {
  const [captures, setCaptures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCaptures();
    const interval = setInterval(fetchCaptures, 5000);
    return () => clearInterval(interval);
  }, []);

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

  if (loading) {
    return <div style={{ color: '#64748b' }}>Loading captures...</div>;
  }

  if (captures.length === 0) {
    return <div style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>No captures yet</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '400px', overflow: 'auto' }}>
      {captures.map((capture) => (
        <div
          key={capture.id}
          onClick={() => onSelectCapture(capture)}
          style={{
            padding: '8px 12px',
            background: '#1e293b',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '12px',
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
          <span style={{ color: '#94a3b8', flex: 1, fontFamily: 'monospace' }}>
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
  );
}

export function CaptureDetail({ capture, onClose }) {
  if (!capture) return null;

  return (
    <Modal isOpen={!!capture} onClose={onClose} title={`Capture #${capture.id}`} size="lg">
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <div style={{ background: '#0d1117', padding: '12px', borderRadius: '8px' }}>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Status</div>
          <div style={{ 
            fontSize: '16px', 
            fontWeight: 600,
            color: capture.status >= 200 && capture.status < 300 ? '#22c55e' : '#ef4444'
          }}>
            {capture.status}
          </div>
        </div>
        <div style={{ background: '#0d1117', padding: '12px', borderRadius: '8px' }}>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Latency</div>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>{capture.latency_ms}ms</div>
        </div>
        <div style={{ background: '#0d1117', padding: '12px', borderRadius: '8px' }}>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Input Tokens</div>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>{capture.tokens?.input || 0}</div>
        </div>
        <div style={{ background: '#0d1117', padding: '12px', borderRadius: '8px' }}>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Output Tokens</div>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>{capture.tokens?.output || 0}</div>
        </div>
      </div>

      {/* Model */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Model</div>
        <div style={{ fontFamily: 'monospace', fontSize: '13px' }}>{capture.model}</div>
      </div>

      {/* Request Body */}
      <JsonViewer 
        title="Request Body" 
        data={capture.request?.body} 
      />

      {/* Response Body */}
      <JsonViewer 
        title="Response Body" 
        data={capture.response?.body} 
      />
    </Modal>
  );
}

// Combined component
export function CaptureViewer() {
  const [selectedCapture, setSelectedCapture] = useState(null);

  return (
    <div>
      <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#94a3b8' }}>
        Recent Captures
      </h3>
      <CaptureList onSelectCapture={setSelectedCapture} />
      <CaptureDetail 
        capture={selectedCapture} 
        onClose={() => setSelectedCapture(null)} 
      />
    </div>
  );
}

export default CaptureViewer;
