import React from 'react';
// Layout component
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function Layout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d1117' }}>
      <Sidebar />
      <main style={{
        flex: 1,
        padding: '24px',
        overflow: 'auto',
        color: '#e2e8f0',
      }}>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
