// CostBreakdown component
// Shows cost by model, today vs all-time

import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:8080';

export function CostBreakdown() {
  const [costData, setCostData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCost();
    const interval = setInterval(fetchCost, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchCost = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cost`);
      const data = await res.json();
      setCostData(data);
    } catch (err) {
      console.error('Cost fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ color: '#64748b' }}>Loading cost data...</div>;
  }

  if (!costData) {
    return <div style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>No cost data available</div>;
  }

  // Simple table for now
  const byModel = costData.by_model || {};
  const total = costData.total || 0;

  const models = Object.entries(byModel);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Total */}
      <div style={{
        background: '#1e293b',
        borderRadius: '12px',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Total Cost</div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#22c55e' }}>
            ${total.toFixed(4)}
          </div>
        </div>
        <div style={{ textAlign: 'right', color: '#64748b', fontSize: '12px' }}>
          <div>Last updated: {new Date(costData.timestamp).toLocaleString()}</div>
          <div>Data from captures</div>
        </div>
      </div>

      {/* By Model Table */}
      <div>
        <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#94a3b8' }}>
          Cost by Model
        </h3>
        {models.length === 0 ? (
          <div style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>
            No cost data by model
          </div>
        ) : (
          <div style={{ 
            background: '#1e293b', 
            borderRadius: '8px', 
            overflow: 'hidden',
            border: '1px solid #334155'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155' }}>
                  <th style={{ textAlign: 'left', padding: '12px', color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>Model</th>
                  <th style={{ textAlign: 'right', padding: '12px', color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>Cost</th>
                  <th style={{ textAlign: 'right', padding: '12px', color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>Calls</th>
                </tr>
              </thead>
              <tbody>
                {models.map(([model, data]) => (
                  <tr key={model} style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '13px' }}>
                      {model}
                    </td>
                    <td style={{ textAlign: 'right', padding: '12px', fontWeight: 600, color: '#22c55e' }}>
                      ${(data.cost || 0).toFixed(4)}
                    </td>
                    <td style={{ textAlign: 'right', padding: '12px', color: '#94a3b8' }}>
                      {data.calls || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Estimate */}
      <div style={{
        background: '#1e293b',
        borderRadius: '8px',
        padding: '16px',
        border: '1px solid #334155',
      }}>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
          📊 Cost Projection
        </div>
        <div style={{ fontSize: '13px', color: '#e2e8f0' }}>
          Based on ${total.toFixed(4)} captured so far, monthly projection is approximately:
          <span style={{ color: '#22c55e', fontWeight: 600, marginLeft: '8px' }}>
            ${(total * 30).toFixed(2)}/month
          </span>
        </div>
      </div>
    </div>
  );
}

export default CostBreakdown;
