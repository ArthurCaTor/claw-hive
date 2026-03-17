import React from 'react';
// ProviderStatus component
// Shows which LLM each agent is using + switch events

import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:8080';

export function ProviderStatus() {
  const [current, setCurrent] = useState({});
  const [switches, setSwitches] = useState([]);
  const [health, setHealth] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [currRes, switchRes, healthRes] = await Promise.all([
        fetch(`${API_BASE}/api/llms/current`),
        fetch(`${API_BASE}/api/llms/switches`),
        fetch(`${API_BASE}/api/llms/health`),
      ]);

      const currData = await currRes.json();
      const switchData = await switchRes.json();
      const healthData = await healthRes.json();

      setCurrent(currData.agents || {});
      setSwitches(switchData.switches || []);
      setHealth(healthData.providers || {});
      setLoading(false);
    } catch (err) {
      console.error('ProviderStatus fetch error:', err);
      setLoading(false);
    }
  };

  const providerColors = {
    minimax: '#f97316',
    anthropic: '#a855f7',
    openai: '#10b981',
    google: '#3b82f6',
    'open-source': '#6366f1',
    unknown: '#64748b',
  };

  if (loading) {
    return <div style={{ color: '#64748b' }}>Loading provider status...</div>;
  }

  const agents = Object.entries(current);
  const providerStats = {};

  // Count agents per provider
  agents.forEach(([agentId, info]) => {
    const provider = info.provider || 'unknown';
    providerStats[provider] = (providerStats[provider] || 0) + 1;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Provider Stats */}
      <div>
        <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#94a3b8' }}>
          Active Providers
        </h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {Object.entries(providerStats).map(([provider, count]) => (
            <div
              key={provider}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: '#1e293b',
                border: '1px solid #334155',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: providerColors[provider] || providerColors.unknown,
                }}
              />
              <span style={{ fontWeight: 500, color: '#e2e8f0', textTransform: 'capitalize' }}>
                {provider}
              </span>
              <span style={{ color: '#64748b', fontSize: '12px' }}>({count})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Agents by Provider */}
      <div>
        <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#94a3b8' }}>
          Agents by Provider
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
          {agents.map(([agentId, info]) => (
            <div
              key={agentId}
              style={{
                padding: '12px',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
              }}
            >
              <div style={{ fontWeight: 500, color: '#e2e8f0', marginBottom: '4px' }}>
                {agentId}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                <span style={{ color: providerColors[info.provider] || providerColors.unknown }}>
                  {info.provider}
                </span>
                {' / '}
                <span style={{ fontFamily: 'monospace' }}>{info.model}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Switch Events */}
      {switches.length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#94a3b8' }}>
            Recent LLM Switches
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {switches.slice(0, 10).map((sw, idx) => (
              <div
                key={idx}
                style={{
                  padding: '10px 12px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  fontSize: '13px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 500, color: '#e2e8f0' }}>{sw.agentId}</span>
                  <span style={{ color: providerColors[sw.from?.provider] || '#64748b' }}>
                    {sw.from?.model}
                  </span>
                  <span style={{ color: '#64748b' }}>→</span>
                  <span style={{ color: providerColors[sw.to?.provider] || '#64748b' }}>
                    {sw.to?.model}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  {new Date(sw.timestamp).toLocaleString()} • {sw.trigger}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Health Metrics */}
      {Object.keys(health).length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#94a3b8' }}>
            Provider Health
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
            {Object.entries(health).map(([provider, metrics]) => (
              <div
                key={provider}
                style={{
                  padding: '12px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                }}
              >
                <div style={{ fontWeight: 500, color: '#e2e8f0', marginBottom: '8px', textTransform: 'capitalize' }}>
                  {provider}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div>Calls: {metrics.calls}</div>
                  <div>Error Rate: {metrics.errorRate}%</div>
                  <div>Latency: P50={metrics.p50}ms P95={metrics.p95}ms</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProviderStatus;
