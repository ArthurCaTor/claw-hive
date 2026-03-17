// Sidebar component
import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/agents', label: 'Agents', icon: '🤖' },
  { path: '/providers', label: 'Providers', icon: '🔌' },
  { path: '/captures', label: 'Captures', icon: '📝' },
  { path: '/cost', label: 'Cost', icon: '💰' },
  { path: '/stream', label: 'Context Stream', icon: '📡' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

export function Sidebar() {
  return (
    <nav style={{
      width: '220px',
      height: '100vh',
      background: '#0f172a',
      borderRight: '1px solid #1e293b',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px 0',
    }}>
      {/* Logo */}
      <div style={{
        padding: '0 20px 20px',
        borderBottom: '1px solid #1e293b',
        marginBottom: '16px',
      }}>
        <h1 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>
          🦷 Claw-Hive
        </h1>
        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
          OpenClaw Dashboard
        </div>
      </div>

      {/* Nav Items */}
      <div style={{ flex: 1 }}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 20px',
              color: isActive ? '#fff' : '#94a3b8',
              background: isActive ? '#1e293b' : 'transparent',
              textDecoration: 'none',
              fontSize: '14px',
              transition: 'all 0.2s ease',
              borderLeft: isActive ? '3px solid #3b82f6' : '3px solid transparent',
            })}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid #1e293b',
        fontSize: '11px',
        color: '#64748b',
      }}>
        v1.0.0 • Phase 3
      </div>
    </nav>
  );
}

export default Sidebar;
