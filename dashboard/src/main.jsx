import React from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import './index.css';
import DashboardPage from './pages/DashboardPage';
import AgentsPage from './pages/AgentsPage';
import ProvidersPage from './pages/ProvidersPage';
import CapturesPage from './pages/CapturesPage';
import CostPage from './pages/CostPage';
import StreamPage from './pages/StreamPage';
import SettingsPage from './pages/SettingsPage';

function NavLink({ to, label }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link to={to} style={{
      display: 'block',
      padding: '10px 12px',
      color: isActive ? '#fff' : '#94a3b8',
      background: isActive ? '#1e293b' : 'transparent',
      textDecoration: 'none',
      borderRadius: '6px',
      marginBottom: '4px',
    }}>
      {label}
    </Link>
  );
}

function NewApp() {
  const location = useLocation();
  
  // Render the page based on current path
  let PageComponent = DashboardPage;
  if (location.pathname === '/agents') PageComponent = AgentsPage;
  else if (location.pathname === '/providers') PageComponent = ProvidersPage;
  else if (location.pathname === '/captures') PageComponent = CapturesPage;
  else if (location.pathname === '/cost') PageComponent = CostPage;
  else if (location.pathname === '/stream') PageComponent = StreamPage;
  else if (location.pathname === '/settings') PageComponent = SettingsPage;
  
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d1117' }}>
      <nav style={{ width: '220px', background: '#0f172a', borderRight: '1px solid #1e293b', padding: '16px' }}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <img src="/vite.svg" alt="🦞" width="90" height="90" style={{ borderRadius: '8px' }} />
            <span style={{ color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>Claw Hive</span>
          </div>
        </div>
        <NavLink to="/" label="Dashboard" />
        <NavLink to="/agents" label="Agents" />
        <NavLink to="/providers" label="Providers" />
        <NavLink to="/captures" label="Captures" />
        <NavLink to="/cost" label="Cost" />
        <NavLink to="/stream" label="Context Stream" />
        <NavLink to="/settings" label="Settings" />
      </nav>
      <main style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
        <PageComponent />
      </main>
    </div>
  );
}

function AppWithRouter() {
  return (
    <BrowserRouter>
      <NewApp />
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppWithRouter />
  </StrictMode>,
);
