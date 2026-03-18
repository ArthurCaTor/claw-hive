import React, { useState, useEffect } from 'react';

function MetricsPage() {
  const [metrics, setMetrics] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchMetrics() {
    try {
      const res = await fetch('/metrics');
      const text = await res.text();
      setMetrics(text);
      setLoading(false);
    } catch (err) {
      setMetrics('# Error loading metrics');
      setLoading(false);
    }
  }

  return (
    <div style={{ color: '#fff' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>📊 Prometheus Metrics</h1>
      
      <div style={{ 
        background: '#1e293b', 
        borderRadius: '8px', 
        padding: '16px',
        fontFamily: 'monospace',
        fontSize: '12px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        maxHeight: '70vh',
        overflow: 'auto'
      }}>
        {loading ? 'Loading...' : metrics}
      </div>
      
      <div style={{ marginTop: '16px', color: '#94a3b8', fontSize: '14px' }}>
        <p>Metrics endpoint: <code style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '4px' }}>/metrics</code></p>
        <p>Auto-refreshes every 5 seconds</p>
      </div>
    </div>
  );
}

export default MetricsPage;
