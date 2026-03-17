import React from 'react';
// Settings Page
export function SettingsPage() {
  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: '24px', fontWeight: 600 }}>
        Settings
      </h1>
      
      <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', maxWidth: '600px' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '16px', color: '#94a3b8' }}>API Configuration</h2>
        
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Backend URL</div>
          <code style={{ background: '#0d1117', padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }}>
            http://localhost:8080
          </code>
        </div>
        
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Frontend URL</div>
          <code style={{ background: '#0d1117', padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }}>
            http://localhost:3000
          </code>
        </div>
        
        <div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Version</div>
          <code style={{ background: '#0d1117', padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }}>
            Phase 3 (Development)
          </code>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
