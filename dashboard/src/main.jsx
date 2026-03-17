import React from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import DashboardPage from './pages/DashboardPage';
import AgentsPage from './pages/AgentsPage';
import ProvidersPage from './pages/ProvidersPage';
import CapturesPage from './pages/CapturesPage';
import CostPage from './pages/CostPage';
import StreamPage from './pages/StreamPage';
import SettingsPage from './pages/SettingsPage';

function NewApp() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d1117' }}>
      <nav style={{ width: '220px', background: '#0f172a', borderRight: '1px solid #1e293b', padding: '16px' }}>
        <h2 style={{ color: '#fff', marginBottom: '20px' }}>🦷 Claw-Hive</h2>
        <NavLink to="/new/" label="Dashboard" />
        <NavLink to="/new/agents" label="Agents" />
        <NavLink to="/new/providers" label="Providers" />
        <NavLink to="/new/captures" label="Captures" />
        <NavLink to="/new/cost" label="Cost" />
        <NavLink to="/new/stream" label="Context Stream" />
        <NavLink to="/new/settings" label="Settings" />
        <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #1e293b' }}>
          <Link to="/" style={{ color: '#64748b', fontSize: '12px', textDecoration: 'none' }}>← Legacy Dashboard</Link>
        </div>
      </nav>
      <main style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/providers" element={<ProvidersPage />} />
          <Route path="/captures" element={<CapturesPage />} />
          <Route path="/cost" element={<CostPage />} />
          <Route path="/stream" element={<StreamPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}

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

function AppWithRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/new/*" element={<NewApp />} />
        <Route path="/legacy" element={<App />} />
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppWithRouter />
  </StrictMode>,
);
