import React, { useState, useEffect, useRef, createContext, useContext } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:${window.location.port || '8080'}`;
const WS_URL = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:${window.location.port || '8080'}/ws`;

// Theme Context
const ThemeContext = createContext();

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "dark";
  });

  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.body.style.background = theme === "dark" ? "#080c14" : "#f8fafc";
    document.body.style.color = theme === "dark" ? "#e2e8f0" : "#1e293b";
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

function useTheme() {
  return useContext(ThemeContext);
}

// Theme configs
const themes = {
  dark: {
    bg: "#080c14",
    card: "rgba(255,255,255,0.03)",
    border: "rgba(255,255,255,0.08)",
    text: "#e2e8f0",
    textMuted: "#94a3b8",
    accent: "#3b82f6",
  },
  light: {
    bg: "#f8fafc",
    card: "rgba(0,0,0,0.03)",
    border: "rgba(0,0,0,0.08)",
    text: "#1e293b",
    textMuted: "#64748b",
    accent: "#3b82f6",
  },
};

// Pulse indicator
function Pulse({ color, active }) {
  const c = color || "#60a5fa";
  return (
    <span style={{ position: "relative", display: "inline-block", width: 10, height: 10 }}>
      <span style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: active ? c : "#374151",
        animation: active ? "ping 1.4s cubic-bezier(0,0,0.2,1) infinite" : "none",
        opacity: 0.4,
      }} />
      <span style={{ position: "absolute", inset: 1, borderRadius: "50%", background: active ? c : "#64748b" }} />
    </span>
  );
}

// Theme toggle button
function ThemeToggle({ theme, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        background: "transparent",
        border: "1px solid rgba(255,255,255,0.2)",
        borderRadius: 8,
        padding: "6px 12px",
        cursor: "pointer",
        fontSize: 16,
        marginLeft: 8,
      }}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}

// Agent Card
function AgentCard({ agent, selected, onClick, theme }) {
  const t = themes[theme];
  const isWorking = agent.status === "working";
  const isError = agent.status === "error";
  const color = agent.color || "#60a5fa";
  const statusColor = isError ? "#ef4444" : isWorking ? color : "#64748b";
  const statusLabel = isError ? "Error" : isWorking ? "Working" : "Idle";

  return (
    <div onClick={() => onClick(agent)} style={{
      background: selected ? "rgba(255,255,255,0.06)" : t.card,
      border: `1px solid ${selected ? color + "55" : t.border}`,
      borderRadius: 12, padding: "18px 20px", cursor: "pointer",
      transition: "all 0.2s", position: "relative", overflow: "hidden",
    }}>
      {isWorking && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          animation: "shimmer 2s infinite",
        }} />
      )}
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, fontSize: 24,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `${color}18`, border: `1px solid ${color}33`, flexShrink: 0,
        }}>{agent.avatar || "🤖"}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ color: t.text, fontWeight: 700, fontSize: 15, fontFamily: "monospace" }}>
              {agent.name}
            </span>
            <Pulse color={color} active={isWorking} />
          </div>
          <div style={{ color: t.textMuted, fontSize: 12 }}>{agent.role}</div>
        </div>
        <div style={{
          fontSize: 12, fontFamily: "monospace", fontWeight: 600,
          color: statusColor, background: `${statusColor}15`,
          border: `1px solid ${statusColor}30`, borderRadius: 6, padding: "3px 8px",
        }}>{statusLabel}</div>
      </div>
      {/* Info rows */}
      <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "6px 12px", fontSize: 12 }}>
        <span style={{ color: t.textMuted }}>Model</span>
        <span style={{ color: t.textMuted, fontFamily: "monospace", fontSize: 11 }}>
          {agent.model || "—"}
        </span>
        <span style={{ color: t.textMuted }}>Status</span>
        <span style={{ 
          color: agent.status === 'working' ? '#4ade80' : agent.status === 'error' ? '#ef4444' : '#94a3b8',
          fontFamily: "monospace", fontSize: 12, fontWeight: 600 
        }}>
          {agent.status === 'working' ? 'Working' : agent.status === 'error' ? 'Error' : 'Waiting for work'}
        </span>
        <span style={{ color: t.textMuted }}>Task</span>
        <span style={{ color: t.text, fontSize: 12, lineHeight: 1.5 }}>
          {agent.output ? agent.output.slice(0, 100) + (agent.output.length > 100 ? "..." : "") : "—"}
        </span>
        <span style={{ color: t.textMuted }}>Heartbeat</span>
        <span style={{ fontSize: 12, fontFamily: "monospace",
          color: agent.heartbeat === "online" ? "#4ade80" : "#ef4444" }}>
          {agent.heartbeat === "online" ? "● Connected" : "○ Disconnected"}
        </span>
      </div>
    </div>
  );
}

// Sidebar
function Sidebar({ agents, stats, costData, rateLimitData, theme }) {
  const t = themes[theme];
  const active = agents.filter(a => a.status === "working");
  const idle = agents.filter(a => a.status !== "working");

  return (
    <div style={{
      width: 240, flexShrink: 0,
      borderLeft: `1px solid ${t.border}`,
      padding: "20px 16px", display: "flex", flexDirection: "column", gap: 24,
      overflowY: "auto",
    }}>
      {/* Stats */}
      <div>
        <div style={{ color: t.textMuted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
          Cluster Stats
        </div>
        {[
          ["Total Agents", stats.total_agents],
          ["Working", stats.working],
          ["Idle", stats.idle],
          ["Offline", stats.offline],
          ["Total Tokens", (stats.total_tokens || 0).toLocaleString()],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: t.textMuted, fontSize: 12 }}>{k}</span>
            <span style={{ color: t.text, fontSize: 12, fontFamily: "monospace" }}>{v}</span>
          </div>
        ))}

        {/* Cost Analysis - Trio Cards */}
        {costData && costData.breakdown && (
          <div style={{ marginTop: 16 }}>
            <div style={{ color: t.textMuted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
              Cost Analysis
            </div>
            
            {/* Cost Trio Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div style={{ 
                padding: '10px 8px', 
                borderRadius: 8, 
                background: '#22c55e15',
                border: '1px solid #22c55e30',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 4 }}>Today</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#22c55e', fontFamily: 'monospace' }}>
                  ${costData.breakdown.today?.cost || '0.00'}
                </div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                  {(costData.breakdown.today?.tokens || 0).toLocaleString()} tok
                </div>
              </div>
              
              <div style={{ 
                padding: '10px 8px', 
                borderRadius: 8, 
                background: '#3b82f615',
                border: '1px solid #3b82f630',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 4 }}>All Time</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6', fontFamily: 'monospace' }}>
                  ${costData.breakdown.all_time?.cost || '0.00'}
                </div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                  {(costData.breakdown.all_time?.tokens || 0).toLocaleString()} tok
                </div>
              </div>
              
              <div style={{ 
                padding: '10px 8px', 
                borderRadius: 8, 
                background: '#f59e0b15',
                border: '1px solid #f59e0b30',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 4 }}>Projected</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', fontFamily: 'monospace' }}>
                  ${costData.breakdown.projected_monthly?.cost || '0.00'}
                </div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                  /month
                </div>
              </div>
            </div>
            
            {/* By Model */}
            {Object.entries(costData.by_model || {}).map(([model, data]) => (
              <div key={model} style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${t.border}` }}>
                <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 4 }}>{model}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                  <span style={{ color: t.textMuted }}>Tokens</span>
                  <span style={{ color: t.text, fontFamily: "monospace" }}>{(data.tokens || 0).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Rate Limit Monitoring */}
        {rateLimitData && rateLimitData.models && rateLimitData.models.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ color: t.textMuted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
              Rate Limits
            </div>
            {rateLimitData.models.map((model) => (
              <div key={model.model} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${t.border}` }}>
                <div style={{ fontSize: 12, color: t.text, marginBottom: 6 }}>{model.model}</div>
                
                {/* RPM Usage */}
                <div style={{ marginBottom: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                    <span style={{ color: t.textMuted }}>RPM</span>
                    <span style={{ color: t.text, fontFamily: "monospace" }}>{model.rpm_used}/{model.limits.rpm}</span>
                  </div>
                  <div style={{ height: 4, background: t.border, borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ 
                      height: "100%", 
                      width: `${Math.min(model.rpm_percent, 100)}%`,
                      background: model.rpm_percent > 80 ? "#ef4444" : model.rpm_percent > 50 ? "#f59e0b" : "#22c55e",
                    }} />
                  </div>
                </div>
                
                {/* TPM Usage */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                    <span style={{ color: t.textMuted }}>TPM</span>
                    <span style={{ color: t.text, fontFamily: "monospace" }}>{(model.total_tokens || 0).toLocaleString()}/{model.limits.tpm.toLocaleString()}</span>
                  </div>
                  <div style={{ height: 4, background: t.border, borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ 
                      height: "100%", 
                      width: `${Math.min(model.tpm_percent, 100)}%`,
                      background: model.tpm_percent > 80 ? "#ef4444" : model.tpm_percent > 50 ? "#f59e0b" : "#22c55e",
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Active Agents */}
      <div>
        <div style={{ color: t.textMuted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
          Active Now
        </div>
        {active.length === 0 && <div style={{ color: t.textMuted, fontSize: 12 }}>No active agents</div>}
        {active.map(a => (
          <div key={a.agent_id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Pulse color={a.color || "#60a5fa"} active />
            <span style={{ color: t.textMuted, fontSize: 12, fontFamily: "monospace" }}>{a.name}</span>
            <span style={{ color: t.textMuted, fontSize: 12, marginLeft: "auto" }}>Live</span>
          </div>
        ))}
        {idle.map(a => (
          <div key={a.agent_id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#374151", display: "inline-block" }} />
            <span style={{ color: t.textMuted, fontSize: 12, fontFamily: "monospace" }}>{a.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Detail Panel
function AgentDetailPanel({ agent, onClose, theme }) {
  const t = themes[theme];
  if (!agent) return null;

  const isWorking = agent.status === "working";
  const color = agent.color || "#60a5fa";

  return (
    <div style={{
      background: t.card, border: `1px solid ${color}33`,
      borderRadius: 12, padding: "20px 24px", marginBottom: 24,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, fontSize: 28,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: `${color}18`, border: `1px solid ${color}33`,
          }}>
            {agent.avatar || "🤖"}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: t.text }}>
              {agent.name}
            </div>
            <div style={{ color: t.textMuted, fontSize: 13 }}>
              {agent.role}
            </div>
          </div>
        </div>
        <span onClick={onClose} style={{ color: t.textMuted, cursor: "pointer", fontSize: 24, lineHeight: 1 }}>×</span>
      </div>

      {/* Info grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        {/* Status */}
        <div style={{ background: "rgba(0,0,0,0.1)", padding: 16, borderRadius: 8 }}>
          <div style={{ color: t.textMuted, fontSize: 12, marginBottom: 6 }}>Status</div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 12px", borderRadius: 6,
            background: isWorking ? `${color}20` : "#374151",
            color: isWorking ? color : t.textMuted,
            fontWeight: 600, fontSize: 12,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: isWorking ? color : "#64748b" }} />
            {isWorking ? "Working" : "Idle"}
          </div>
        </div>

        {/* Heartbeat */}
        <div style={{ background: "rgba(0,0,0,0.1)", padding: 16, borderRadius: 8 }}>
          <div style={{ color: t.textMuted, fontSize: 12, marginBottom: 6 }}>Heartbeat</div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 12px", borderRadius: 6,
            background: agent.heartbeat === "online" ? "#22c55e20" : "#ef444420",
            color: agent.heartbeat === "online" ? "#22c55e" : "#ef4444",
            fontWeight: 600, fontSize: 12,
          }}>
            {agent.heartbeat === "online" ? "🟢 Online" : "🔴 Offline"}
          </div>
        </div>

        {/* Current Task */}
        <div style={{ background: "rgba(0,0,0,0.1)", padding: 16, borderRadius: 8, gridColumn: "span 2" }}>
          <div style={{ color: t.textMuted, fontSize: 12, marginBottom: 6 }}>Current Task</div>
          <div style={{ color: t.text, fontSize: 14 }}>{agent.task || "—"}</div>
        </div>

        {/* Task Detail */}
        <div style={{ background: "rgba(0,0,0,0.1)", padding: 16, borderRadius: 8, gridColumn: "span 2" }}>
          <div style={{ color: t.textMuted, fontSize: 12, marginBottom: 6 }}>Task Detail</div>
          <div style={{ color: t.textMuted, fontSize: 12, lineHeight: 1.5 }}>{agent.output || "—"}</div>
        </div>

        {/* Token Usage */}
        <div style={{ background: "rgba(0,0,0,0.1)", padding: 16, borderRadius: 8 }}>
          <div style={{ color: t.textMuted, fontSize: 12, marginBottom: 6 }}>Token Usage</div>
          <div style={{ color: t.text, fontSize: 12, fontFamily: "monospace" }}>
            {(agent.tokens_used || 0).toLocaleString()}
          </div>
        </div>

        {/* Agent ID */}
        <div style={{ background: "rgba(0,0,0,0.1)", padding: 16, borderRadius: 8 }}>
          <div style={{ color: t.textMuted, fontSize: 12, marginBottom: 6 }}>Agent ID</div>
          <div style={{ color: t.text, fontSize: 12, fontFamily: "monospace" }}>{agent.agent_id}</div>
        </div>
      </div>
    </div>
  );
}

// Main App
// Memory Viewer Panel
function MemoryViewer({ memoryId, onClose, theme }) {
  const [content, setContent] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const t = themes[theme];
  
  React.useEffect(() => {
    if (memoryId) {
      setLoading(true);
      fetch(`${API_BASE}/api/memory/${memoryId}`)
        .then(r => r.json())
        .then(data => {
          setContent(data.content);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [memoryId]);
  
  if (!memoryId) return null;
  
  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 500,
      background: t.bg, borderLeft: `1px solid ${t.border}`,
      padding: 20, overflow: 'auto', zIndex: 100,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: t.text }}>Memory: {memoryId}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.text, fontSize: 20, cursor: 'pointer' }}>×</button>
      </div>
      {loading ? (
        <div style={{ color: t.textMuted }}>Loading...</div>
      ) : (
        <pre style={{ 
          color: t.text, fontSize: 12, fontFamily: 'monospace', 
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          background: t.bgSecondary, padding: 16, borderRadius: 8,
        }}>
          {content}
        </pre>
      )}
    </div>
  );
}

// Memory Page - Full page view
// Cron Page with Jobs and History tabs
function CronPage({ theme }) {
  const t = themes[theme];
  const [activeTab, setActiveTab] = React.useState('jobs');
  const [cronJobs, setCronJobs] = React.useState([]);
  const [cronHistory, setCronHistory] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`${API_BASE}/api/cron`)
      .then(r => r.json())
      .then(d => setCronJobs(d.jobs || []))
      .catch(console.error);
    
    fetch(`${API_BASE}/api/cron/history`)
      .then(r => r.json())
      .then(d => setCronHistory(d.runs || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const runJob = (jobId) => {
    fetch(`${API_BASE}/api/cron/${jobId}/run`, { method: 'POST' })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          alert('Job triggered!');
          // Refresh history
          fetch(`${API_BASE}/api/cron/history`)
            .then(r => r.json())
            .then(d => setCronHistory(d.runs || []));
        }
      })
      .catch(console.error);
  };

  return (
    <div style={{ color: t.text }}>
      <h2 style={{ color: t.text, marginBottom: 20 }}>⏰ Cron Jobs</h2>
      
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: `1px solid ${t.border}`, paddingBottom: 12 }}>
        {['jobs', 'history'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 6,
              background: activeTab === tab ? t.accent : 'transparent',
              color: activeTab === tab ? 'white' : t.textMuted,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {tab === 'jobs' ? '📋 Jobs' : '📜 History'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: t.textMuted }}>Loading...</div>
      ) : activeTab === 'jobs' ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {cronJobs.length === 0 ? (
            <div style={{ color: t.textMuted }}>No cron jobs configured</div>
          ) : cronJobs.map(job => (
            <div key={job.id} style={{ 
              background: t.card, 
              border: `1px solid ${t.border}`, 
              borderRadius: 8, 
              padding: 16 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, color: t.text }}>{job.name}</div>
                  <div style={{ fontSize: 12, color: t.textMuted, fontFamily: 'monospace' }}>{job.schedule}</div>
                </div>
                <button
                  onClick={() => runJob(job.id)}
                  style={{
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: 6,
                    background: t.accent,
                    color: 'white',
                    cursor: 'pointer',
                  }}
                >
                  ▶ Run
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {cronHistory.length === 0 ? (
            <div style={{ color: t.textMuted }}>No history yet</div>
          ) : cronHistory.map((run, i) => (
            <div key={i} style={{ 
              background: t.card, 
              border: `1px solid ${t.border}`, 
              borderRadius: 8, 
              padding: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <span style={{ fontWeight: 500, color: t.text }}>{run.name}</span>
                <span style={{ fontSize: 12, color: t.textMuted, marginLeft: 12 }}>
                  {new Date(run.timestamp).toLocaleString()}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ 
                  color: run.status === 'success' ? '#22c55e' : '#ef4444',
                  fontSize: 12,
                }}>
                  {run.status === 'success' ? '✅ Success' : '❌ Error'}
                </span>
                <span style={{ fontSize: 12, color: t.textMuted, fontFamily: 'monospace' }}>
                  {run.duration}ms
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilesPage({ theme }) {
  const t = themes[theme];
  const [files, setFiles] = React.useState([]);
  const [currentPath, setCurrentPath] = React.useState('');
  const [workspace, setWorkspace] = React.useState('coder');
  const [loading, setLoading] = React.useState(false);

  const loadFiles = (ws, path = '') => {
    setLoading(true);
    fetch(`${API_BASE}/api/files?workspace=${ws}&path=${encodeURIComponent(path)}`)
      .then(r => r.json())
      .then(d => {
        setFiles(d.files || []);
        setCurrentPath(path);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  React.useEffect(() => {
    loadFiles(workspace);
  }, [workspace]);

  const navigate = (folder) => {
    const newPath = currentPath ? `${currentPath}/${folder}` : folder;
    loadFiles(workspace, newPath);
  };

  const goUp = () => {
    const parts = currentPath.split('/');
    parts.pop();
    loadFiles(workspace, parts.join('/'));
  };

  return (
    <div style={{ color: t.text }}>
      <h2 style={{ color: t.text, marginBottom: 20 }}>📂 File Browser</h2>
      
      {/* Workspace selector */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        {['nova', 'coder', 'scout'].map(ws => (
          <button
            key={ws}
            onClick={() => setWorkspace(ws)}
            style={{
              padding: '6px 12px',
              border: 'none',
              borderRadius: 6,
              background: workspace === ws ? t.accent : t.card,
              color: workspace === ws ? 'white' : t.text,
              cursor: 'pointer',
            }}
          >
            {ws}
          </button>
        ))}
      </div>

      {/* Current path */}
      <div style={{ 
        background: t.card, 
        border: `1px solid ${t.border}`, 
        borderRadius: 8, 
        padding: 12,
        marginBottom: 12,
        fontFamily: 'monospace',
        fontSize: 12,
        color: t.textMuted,
      }}>
        ~/.openclaw/workspace-{workspace}/{currentPath}
      </div>

      {/* Back button */}
      {currentPath && (
        <button
          onClick={goUp}
          style={{
            padding: '6px 12px',
            border: `1px solid ${t.border}`,
            borderRadius: 6,
            background: 'transparent',
            color: t.text,
            cursor: 'pointer',
            marginBottom: 12,
          }}
        >
          ← Go Up
        </button>
      )}

      {/* Files list */}
      {loading ? (
        <div style={{ color: t.textMuted }}>Loading...</div>
      ) : (
        <div style={{ display: 'grid', gap: 4 }}>
          {files.map(file => (
            <div
              key={file.name}
              onClick={() => file.isDirectory && navigate(file.name)}
              style={{ 
                padding: '10px 12px',
                borderRadius: 6,
                cursor: file.isDirectory ? 'pointer' : 'default',
                background: t.card,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>{file.isDirectory ? '📁' : '📄'}</span>
              <span style={{ color: t.text }}>{file.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchPage({ theme }) {
  const t = themes[theme];
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState([]);
  const [searching, setSearching] = React.useState(false);

  const doSearch = (q) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    fetch(`${API_BASE}/api/search?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(d => setResults(d.results || []))
      .catch(console.error)
      .finally(() => setSearching(false));
  };

  return (
    <div style={{ color: t.text }}>
      <h2 style={{ color: t.text, marginBottom: 20 }}>🔎 Cross-Agent Search</h2>
      
      {/* Search input */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            doSearch(e.target.value);
          }}
          placeholder="Search across all sessions..."
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: t.card,
            color: t.text,
            fontSize: 12,
          }}
        />
      </div>

      {/* Results */}
      {searching ? (
        <div style={{ color: t.textMuted }}>Searching...</div>
      ) : results.length === 0 ? (
        query && <div style={{ color: t.textMuted }}>No results found</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {results.map((result, i) => (
            <div key={i} style={{ 
              background: t.card, 
              border: `1px solid ${t.border}`, 
              borderRadius: 8, 
              padding: 16 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: t.textMuted }}>{result.agent}</span>
                <span style={{ color: t.border }}>|</span>
                <span style={{ fontWeight: 500, color: t.text }}>{result.session}</span>
              </div>
              <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>
                {result.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ModelsPage({ theme }) {
  const t = themes[theme];
  const [agents, setAgents] = React.useState([]);
  const [modelsConfig, setModelsConfig] = React.useState(null);

  React.useEffect(() => {
    fetch(`${API_BASE}/api/agents`)
      .then(r => r.json())
      .then(setAgents)
      .catch(console.error);
    
    fetch(`${API_BASE}/api/config/models`)
      .then(r => r.json())
      .then(setModelsConfig)
      .catch(console.error);
  }, []);

  const availableModels = [
    { id: 'MiniMax-M2.5', name: 'MiniMax M2.5', provider: 'minimax' },
    { id: 'MiniMax-M2.1', name: 'MiniMax M2.1', provider: 'minimax' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic' },
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  ];

  return (
    <div style={{ color: t.text }}>
      <h2 style={{ color: t.text, marginBottom: 20 }}>🤖 Model Configuration</h2>
      
      <div style={{ display: 'grid', gap: 16 }}>
        {agents.map(agent => (
          <div key={agent.agent_id} style={{ 
            background: t.card, 
            border: `1px solid ${t.border}`, 
            borderRadius: 8, 
            padding: 16 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>{agent.avatar}</span>
              <div>
                <div style={{ fontWeight: 600, color: t.text }}>{agent.name}</div>
                <div style={{ fontSize: 12, color: t.textMuted }}>{agent.agent_id}</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: t.textMuted }}>Current Model:</span>
              <select 
                value={agent.model || 'MiniMax-M2.5'}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: `1px solid ${t.border}`,
                  background: t.bg,
                  color: t.text,
                }}
              >
                {availableModels.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChannelsPage({ theme }) {
  const t = themes[theme];
  const [channels, setChannels] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`${API_BASE}/api/config/channels`)
      .then(r => r.json())
      .then(d => setChannels(d.channels || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const defaultChannels = [
    { id: 'telegram', name: 'Telegram', icon: '✉️', enabled: true },
    { id: 'discord', name: 'Discord', icon: '🎮', enabled: false },
    { id: 'slack', name: 'Slack', icon: '💬', enabled: false },
    { id: 'telegram', name: 'Signal', icon: '🔒', enabled: false },
  ];

  return (
    <div style={{ color: t.text }}>
      <h2 style={{ color: t.text, marginBottom: 20 }}>📱 Channel Configuration</h2>
      
      {loading ? (
        <div style={{ color: t.textMuted }}>Loading...</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {defaultChannels.map(channel => (
            <div key={channel.id} style={{ 
              background: t.card, 
              border: `1px solid ${t.border}`, 
              borderRadius: 8, 
              padding: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>{channel.icon}</span>
                <div>
                  <div style={{ fontWeight: 600, color: t.text }}>{channel.name}</div>
                  <div style={{ fontSize: 12, color: t.textMuted }}>ID: {channel.id}</div>
                </div>
              </div>
              <div style={{ 
                padding: '4px 12px', 
                borderRadius: 12,
                background: channel.enabled ? '#22c55e20' : '#374151',
                color: channel.enabled ? '#22c55e' : t.textMuted,
                fontSize: 12,
                fontWeight: 500,
              }}>
                {channel.enabled ? '✅ Enabled' : '○ Disabled'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SkillsPage({ theme }) {
  const t = themes[theme];
  const [skills, setSkills] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`${API_BASE}/api/skills`)
      .then(r => r.json())
      .then(d => setSkills(d.skills || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ color: t.text }}>
      <h2 style={{ color: t.text, marginBottom: 20 }}>🔧 Skills Manager</h2>
      
      {loading ? (
        <div style={{ color: t.textMuted }}>Loading...</div>
      ) : skills.length === 0 ? (
        <div style={{ 
          background: t.card, 
          border: `1px solid ${t.border}`, 
          borderRadius: 8, 
          padding: 24,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🛠️</div>
          <div style={{ color: t.textMuted }}>No skills installed</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 8 }}>
            Skills are located in ~/.openclaw/skills/
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {skills.map(skill => (
            <div key={skill.name} style={{ 
              background: t.card, 
              border: `1px solid ${t.border}`, 
              borderRadius: 8, 
              padding: 16 
            }}>
              <div style={{ fontWeight: 600, color: t.text, marginBottom: 8 }}>
                {skill.icon || '🔧'} {skill.name}
              </div>
              <div style={{ fontSize: 12, color: t.textMuted }}>
                {skill.description || 'No description'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Debug Proxy Page - LLM Request Interceptor
function DebugProxyPage({ theme }) {
  const t = themes[theme];
  const [status, setStatus] = React.useState(null);
  const [captures, setCaptures] = React.useState([]);
  const [selectedCapture, setSelectedCapture] = React.useState(null);
  const [captureDetail, setCaptureDetail] = React.useState(null);
  const [activeTab, setActiveTab] = React.useState('system');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [dividerPos, setDividerPos] = React.useState(50); // percentage
  const dividerRef = React.useRef(null);
  const isDragging = React.useRef(false);

  // Fetch status
  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/debug-proxy/status`);
      const data = await res.json();
      setStatus(data);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };

  // Fetch captures list
  const fetchCaptures = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/debug-proxy/captures`);
      const data = await res.json();
      setCaptures(data);
    } catch (e) {
      console.error('Failed to fetch captures:', e);
    }
  };

  // Fetch capture detail
  const fetchCaptureDetail = async (id) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/debug-proxy/captures/${id}`);
      const data = await res.json();
      setCaptureDetail(data);
    } catch (e) {
      console.error('Failed to fetch capture:', e);
    }
    setLoading(false);
  };

  // Start proxy
  const startProxy = async () => {
    try {
      await fetch(`${API_BASE}/api/debug-proxy/start`, { method: 'POST' });
      fetchStatus();
    } catch (e) {
      setError(e.message);
    }
  };

  // Stop proxy
  const stopProxy = async () => {
    try {
      await fetch(`${API_BASE}/api/debug-proxy/stop`, { method: 'POST' });
      fetchStatus();
    } catch (e) {
      setError(e.message);
    }
  };

  // Divider drag handlers
  const handleMouseDown = () => { isDragging.current = true; };
  const handleMouseUp = () => { isDragging.current = false; };
  const handleMouseMove = (e) => {
    if (!isDragging.current || !dividerRef.current) return;
    const container = dividerRef.current.parentElement;
    const rect = container.getBoundingClientRect();
    const percent = ((e.clientX - rect.left) / rect.width) * 100;
    setDividerPos(Math.min(Math.max(percent, 20), 80));
  };
  React.useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Initial load
  React.useEffect(() => {
    fetchStatus();
    fetchCaptures();
  }, []);

  // SSE for real-time updates
  React.useEffect(() => {
    if (!status?.running) return;
    
    const sse = new EventSource(`${API_BASE}/api/debug-proxy/stream`);
    sse.onmessage = (event) => {
      const summary = JSON.parse(event.data);
      setCaptures(prev => [summary, ...prev]);
    };
    sse.onerror = () => sse.close();
    
    return () => sse.close();
  }, [status?.running]);

  // Poll status every 5s
  React.useEffect(() => {
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Format uptime
  const formatUptime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Get status color
  const getStatusColor = (code) => {
    if (code >= 200 && code < 300) return '#22c55e';
    if (code >= 400 && code < 500) return '#eab308';
    return '#ef4444';
  };

  // Full width and height, no margins
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 12, width: '100%', boxSizing: 'border-box' }}>
      {/* 1. Status Panel - Top - Horizontal layout */}
      <div style={{ 
        background: t.card, 
        border: `1px solid ${t.border}`, 
        borderRadius: 8, 
        padding: '8px 12px',
        marginBottom: 8,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>PROXY</span>
          {status?.running ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#22c55e', fontSize: 12 }}>
                :{status.port}
            </span>
          ) : (
            <span style={{ color: '#64748b', fontSize: 12 }}>Stopped</span>
          )}
        </div>
        {status?.running && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: t.textMuted, fontSize: 12 }}>
            <span>C: {status.totalCalls}</span>
            <span>{formatUptime(status.uptimeSeconds)}</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 4 }}>
            {status?.running ? (
              <button onClick={stopProxy} style={{
                background: '#dc2626', color: 'white', border: 'none', padding: '4px 8px',
                borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 500,
              }}>⏹</button>
            ) : (
              <button onClick={startProxy} style={{
                background: '#22c55e', color: 'white', border: 'none', padding: '4px 8px',
                borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 500,
              }}>▶</button>
            )}
            <button onClick={() => { fetchStatus(); fetchCaptures(); }} style={{
              background: 'transparent', color: t.textMuted, border: `1px solid ${t.border}`,
              padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12,
            }}>🔄</button>
        </div>
      </div>

      {/* 2 & 3: Calls List + Detail - Side by Side with Resizable Divider */}
      <div ref={dividerRef} style={{ flex: 1, display: 'flex', gap: 4, overflow: 'hidden' }}>
        {/* 2. API Calls List - auto-fit columns */}
        <div style={{ width: `${dividerPos}%`, minWidth: 200, background: t.card, border: `1px solid ${t.border}`, borderRadius: 8, padding: 6, overflow: 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>API CALLS</div>
          {captures.length === 0 ? (
            <div style={{ color: t.textMuted, fontSize: 12, textAlign: 'center', padding: 8 }}>
              {status?.running ? 'No captures' : 'Start proxy'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {captures.map((call) => (
                <div key={call.id} onClick={() => { setSelectedCapture(call.id); fetchCaptureDetail(call.id); }} style={{
                  background: selectedCapture === call.id ? t.bgSecondary : 'rgba(0,0,0,0.2)',
                  border: `1px solid ${selectedCapture === call.id ? t.accent : t.border}`,
                  borderRadius: 3,
                  padding: '3px 6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 11,
                  whiteSpace: 'nowrap',
                }}>
                  <span style={{ color: t.textMuted, minWidth: 24 }}>#{call.id}</span>
                  <span style={{ color: t.textMuted, minWidth: 70 }}>{new Date(call.timestamp).toLocaleTimeString()}</span>
                  <span style={{ color: getStatusColor(call.status), fontWeight: 600, minWidth: 28 }}>{call.status}</span>
                  <span style={{ color: t.textMuted, minWidth: 45 }}>{call.latency_ms}ms</span>
                  <span style={{ color: t.textMuted }}>{call.tokens?.input}→{call.tokens?.output}</span>
                </div>
              ))}

            </div>
          )}
        </div>

        {/* Resizable Divider */}
        <div 
          onMouseDown={handleMouseDown}
          style={{ 
            width: 6, 
            cursor: 'col-resize', 
            background: t.border, 
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: 2, height: 20, background: t.textMuted, borderRadius: 1, opacity: 0.5 }} />
        </div>

        {/* 3. Capture Detail */}
        <div style={{ width: `${100 - dividerPos}%`, background: t.card, border: `1px solid ${t.border}`, borderRadius: 8, padding: 6, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedCapture && captureDetail ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>#{captureDetail.id}</span>
                <button onClick={() => { setSelectedCapture(null); setCaptureDetail(null); }} style={{
                  background: 'transparent', color: t.textMuted, border: 'none', cursor: 'pointer', fontSize: 12,
                }}>✕</button>
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                {['system', 'messages', 'tools', 'raw'].map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: 'none',
                    background: activeTab === tab ? t.accent : 'transparent',
                    color: activeTab === tab ? 'white' : t.textMuted,
                    cursor: 'pointer',
                    fontSize: 12,
                  }}>
                    {tab === 'messages' ? `Msg(${captureDetail.request?.body?.messages?.length || 0})` : 
                     tab === 'tools' ? `Tool(${captureDetail.request?.body?.tools?.length || 0})` : tab}
                  </button>
                ))}
              </div>
              <div style={{ background: '#0d1117', borderRadius: 4, padding: 8, fontSize: 12, fontFamily: 'monospace', overflow: 'auto', flex: 1 }}>
                {activeTab === 'system' && (
                  <div style={{ color: '#e2e8f0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {Array.isArray(captureDetail.request?.body?.system) 
                      ? captureDetail.request.body.system.map((block, i) => block.type === 'text' ? block.text : '').join('\n')
                      : captureDetail.request?.body?.system || '(none)'}
                  </div>
                )}
                {activeTab === 'messages' && (
                  <div style={{ color: '#e2e8f0' }}>
                    {captureDetail.request?.body?.messages?.slice(0, 10).map((msg, i) => (
                      <div key={i} style={{ marginBottom: 5, paddingBottom: 4, borderBottom: '1px solid #30363d' }}>
                        <span style={{ color: msg.role === 'user' ? '#58a6ff' : '#f0883e', fontWeight: 600 }}>{msg.role}</span>
                        <div style={{ color: '#c9d1d9', marginTop: 2 }}>
                          {Array.isArray(msg.content) ? msg.content.filter(b => b.type === 'text').map(b => b.text || '').join('\n') : msg.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {activeTab === 'tools' && (
                  <div style={{ color: '#e2e8f0' }}>
                    {captureDetail.request?.body?.tools?.slice(0, 5).map((tool, i) => (
                      <div key={i} style={{ marginBottom: 5, paddingBottom: 4, borderBottom: '1px solid #30363d' }}>
                        <span style={{ color: '#7ee787' }}>▶ {tool.name}</span>
                        <div style={{ color: '#8b949e' }}>{tool.description}</div>
                      </div>
                    ))}
                  </div>
                )}
                {activeTab === 'raw' && (
                  <div style={{ color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(captureDetail.request?.body, null, 2)}
                  </div>
                )}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: t.textMuted }}>
                {captureDetail.response?.body?.assistant_text?.slice(0, 200) || '(no response)'}...
              </div>
            </>
          ) : (
            <div style={{ color: t.textMuted, fontSize: 12, textAlign: 'center', padding: 20 }}>
              Select a call to view
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ContextPage({ contextEvents, setContextEvents, recordingStatus, setRecordingStatus, recordingsList, setRecordingsList, theme }) {
  const t = themes[theme];
  const [selectedAgent, setSelectedAgent] = React.useState('');
  const [selectedSession, setSelectedSession] = React.useState('');
  const [agents, setAgents] = React.useState({});
  const [autoScroll, setAutoScroll] = React.useState(true);
  const [view, setView] = React.useState('live');
  const [filters, setFilters] = React.useState({
    message: true,
    thinking: true,
    tool_use: true,
    thinking_level_change: true,
    tool_use: true,
    custom: true,
    compaction: true,
    error: true,
  });
  const eventListRef = React.useRef(null);

  // Auto-scroll to bottom when new events arrive
  React.useEffect(() => {
    if (autoScroll && eventListRef.current) {
      eventListRef.current.scrollTop = eventListRef.current.scrollHeight;
    }
  }, [contextEvents, autoScroll]);

  // Fetch agents and sessions
  React.useEffect(() => {
    fetch(`${API_BASE}/api/sessions`)
      .then(r => r.json())
      .then(data => {
        setAgents(data);
        const agentList = Object.keys(data);
        if (agentList.length > 0 && !selectedAgent) {
          const agent = agentList[0];
          setSelectedAgent(agent);
          if (data[agent].length > 0) {
            setSelectedSession(data[agent][0].sessionId);
          }
        }
      })
      .catch(console.error);
  }, []);

  // Load session events when selection changes
  React.useEffect(() => {
    if (!selectedAgent || !selectedSession) return;
    fetch(`${API_BASE}/api/sessions/${selectedAgent}/${selectedSession}`)
      .then(r => r.json())
      .then(data => {
        if (data.events) {
          setContextEvents(data.events.slice(-500));
        }
      })
      .catch(console.error);
    fetch(`${API_BASE}/api/sessions/${selectedAgent}/${selectedSession}/watch`, { method: 'POST' })
      .catch(console.error);
  }, [selectedAgent, selectedSession]);

  // Connect to SSE
  React.useEffect(() => {
    if (view !== 'live') return;
    const eventSource = new EventSource(`${API_BASE}/api/context-stream`);
    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setContextEvents(prev => [...prev, data].slice(-500));
        if (autoScroll && eventListRef.current) {
          eventListRef.current.scrollTop = eventListRef.current.scrollHeight;
        }
      } catch (err) {}
    };
    eventSource.onerror = () => eventSource.close();
    
    const pollRecording = setInterval(() => {
      fetch(`${API_BASE}/api/recording/status`)
        .then(r => r.json())
        .then(d => setRecordingStatus(d.recording))
        .catch(() => {});
    }, 2000);
    
    fetch(`${API_BASE}/api/recordings`)
      .then(r => r.json())
      .then(d => setRecordingsList(d.recordings || []))
      .catch(() => {});
    
    return () => { eventSource.close(); clearInterval(pollRecording); };
  }, [view, autoScroll]);

  const extractContent = (event) => {
    const msg = event.message || event.data?.message || event.data || event;
    if (!msg?.content) return '';
    
    const content = msg.content;
    
    // Handle array content
    if (Array.isArray(content)) {
      // Extract text blocks
      const texts = content
        .filter(b => b.type === 'text' && b.text)
        .map(b => b.text);
      
      // If no text blocks, try thinking blocks
      if (texts.length === 0) {
        const thinkings = content
          .filter(b => b.type === 'thinking' && b.thinking)
          .map(b => '💭 ' + b.thinking);
        return thinkings.join('\n\n');
      }
      
      return texts.join('\n');
    }
    
    // Handle string content
    if (typeof content === 'string') return content;
    
    return JSON.stringify(content);
  };

  const extractRole = (event) => {
    const msg = event.message || event.data?.message || event.data || event;
    return msg?.role || 'unknown';
  };

  const extractUsage = (event) => {
    const msg = event.message || event.data?.message || event.data || event;
    return msg?.usage || null;
  };

  const filteredEvents = contextEvents.filter(e => {
    const type = e.type;
    if (type === 'message') {
      const subType = e.data?.type;
      if (subType === 'thinking') return filters.thinking;
      if (subType === 'tool_use') return filters.tool_use;
      return filters.message;
    }
    if (type === 'thinking_level_change') return filters.thinking_level_change;
    if (type === 'custom') return filters.custom;
    if (type === 'compaction') return filters.compaction;
    return filters[type] !== false;
  });

  const startRecording = () => {
    fetch(`${API_BASE}/api/recording/start`, { method: 'POST' })
      .then(r => r.json())
      .then(d => setRecordingStatus(d))
      .catch(console.error);
  };

  const stopRecording = () => {
    fetch(`${API_BASE}/api/recording/stop`, { method: 'POST' })
      .then(r => r.json())
      .then(d => { setRecordingStatus(null); fetch(`${API_BASE}/api/recordings`).then(r => r.json()).then(d => setRecordingsList(d.recordings || [])).catch(() => {}); })
      .catch(console.error);
  };

  const renderEvent = (event, idx) => {
    const type = event.type;
    const time = new Date(event.timestamp || event.received_at).toLocaleTimeString();
    
    if (type === 'session') {
      return (
        <div key={idx} style={{ textAlign: 'center', padding: '8px', color: t.textMuted, borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, margin: '8px 0', fontSize: 10 }}>
         ━━━ SESSION {event.id?.slice(0, 8)} ━━━ {time}
        </div>
      );
    }
    
    if (type === 'message' && extractRole(event) === 'user') {
      return (
        <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: 8 }}>
          <div style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: 12, background: '#2d4a7a', color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', fontSize: 12, lineHeight: 1.5 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>👤 user {time}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace" }}>{extractContent(event)}</div>
          </div>
        </div>
      );
    }
    
    if (type === 'message' && extractRole(event) === 'assistant') {
      const usage = extractUsage(event);
      return (
        <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ maxWidth: '85%', padding: '10px 14px', borderRadius: 12, background: t.bgSecondary || '#1e2a3a', color: t.text, fontSize: 12, lineHeight: 1.5 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 3, display: 'flex', gap: 8 }}>
              <span>🤖 assistant</span>
              <span>{time}</span>
              {usage && <span style={{ color: '#22c55e' }}>${usage.cost?.total || 0}</span>}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace" }}>{extractContent(event)}</div>
          </div>
        </div>
      );
    }
    
    if (type === 'message' && event.data?.type === 'thinking') {
      return (
        <div key={idx} style={{ padding: '6px 10px', marginBottom: 5, borderRadius: 6, background: 'rgba(100,100,100,0.2)', border: '1px dashed #666', fontSize: 12, color: '#9ca3af' }}>
          💭 thinking {time}
        </div>
      );
    }
    
    if (type === 'message' && event.data?.type === 'tool_use') {
      const tool = event.data?.name || event.data?.tool || 'tool';
      const input = event.data?.input || '';
      return (
        <div key={idx} style={{ padding: 8, marginBottom: 5, borderRadius: 6, background: '#1f2937', color: '#e5e7eb', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
          <div style={{ marginBottom: 3, color: '#fbbf24' }}>🔧 {tool} {time}</div>
          <div style={{ color: '#9ca3af', whiteSpace: 'pre-wrap' }}>{typeof input === 'string' ? input : JSON.stringify(input, null, 2)}</div>
        </div>
      );
    }
    
    if (type === 'error') {
      return (
        <div key={idx} style={{ padding: 10, marginBottom: 5, borderRadius: 6, background: '#7f1d1d', color: '#fecaca', fontSize: 11 }}>
          ⚠️ ERROR {time}
          <div>{event.message || event.data?.message || 'Unknown error'}</div>
        </div>
      );
    }
    
    if (type === 'custom') {
      const customType = event.customType || 'custom';
      const data = event.data || {};
      return (
        <div key={idx} style={{ padding: 8, marginBottom: 5, borderRadius: 6, background: '#1e3a5f', color: '#93c5fd', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
          <div style={{ marginBottom: 4 }}>⚙️ {customType} {time}</div>
          {Object.keys(data).length > 0 && (
            <div style={{ color: '#9ca3af', whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(data, null, 2)}
            </div>
          )}
        </div>
      );
    }
    
    if (type === 'compaction') {
      const summary = event.summary || '';
      return (
        <div key={idx} style={{ padding: 8, marginBottom: 5, borderRadius: 6, background: '#3f2f2f', color: '#d4a574', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
          <div style={{ marginBottom: 4 }}>🗜️ compaction {time}</div>
          {summary && (
            <div style={{ color: '#9ca3af', whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
              {summary.slice(0, 500)}...
            </div>
          )}
        </div>
      );
    }
    
    if (type === 'thinking_level_change') {
      return (
        <div key={idx} style={{ padding: '6px 10px', marginBottom: 5, borderRadius: 6, background: 'rgba(100,100,100,0.2)', border: '1px dashed #666', fontSize: 12, color: '#9ca3af' }}>
          💭 thinking_level_change: {event.thinkingLevel} {time}
        </div>
      );
    }
    
    return (
      <div key={idx} style={{ padding: 6, marginBottom: 3, fontSize: 12, color: t.textMuted, fontFamily: 'monospace' }}>
        [{type}] {time}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: t.text }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { id: 'live', label: '📡 Live' },
            { id: 'recordings', label: '📂 Recordings' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setView(tab.id)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: view === tab.id ? t.accent : 'transparent', color: view === tab.id ? 'white' : t.textMuted, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
              {tab.label}
            </button>
          ))}
        </div>
        {view === 'live' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {recordingStatus ? (
              <button onClick={stopRecording} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer', fontSize: 11 }}>
                ⏹ Stop ({recordingStatus.event_count})
              </button>
            ) : (
              <button onClick={startRecording} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#22c55e', color: 'white', cursor: 'pointer', fontSize: 11 }}>
                ⏺ Record
              </button>
            )}
            <span style={{ fontSize: 12, color: t.textMuted }}>{contextEvents.length} events</span>
          </div>
        )}
      </div>

      {view === 'live' ? (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left Panel */}
          <div style={{ width: 200, borderRight: `1px solid ${t.border}`, padding: 12, background: t.bgSecondary || '#1a1a2e', overflowY: 'auto', fontSize: 11 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: t.textMuted, marginBottom: 3, fontWeight: 500 }}>AGENT</div>
              <select value={selectedAgent} onChange={e => { setSelectedAgent(e.target.value); const sessions = agents[e.target.value]; if (sessions?.length > 0) setSelectedSession(sessions[0].sessionId); }} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.bg, color: t.text, fontSize: 11 }}>
                {Object.keys(agents).map(agent => <option key={agent} value={agent}>{agent}</option>)}
              </select>
            </div>
            {selectedAgent && agents[selectedAgent] && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: t.textMuted, marginBottom: 3, fontWeight: 500 }}>SESSION</div>
                <select value={selectedSession} onChange={e => setSelectedSession(e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.bg, color: t.text, fontSize: 11 }}>
                  {agents[selectedAgent].map(s => <option key={s.sessionId} value={s.sessionId}>{s.sessionId.slice(0, 12)}...</option>)}
                </select>
              </div>
            )}
            {selectedAgent && selectedSession && (
              <div style={{ marginBottom: 16, color: '#22c55e', fontSize: 10 }}>● Watching: {selectedAgent}/{selectedSession.slice(0, 8)}...</div>
            )}
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: t.textMuted, marginBottom: 5, fontWeight: 500 }}>FILTERS</div>
              {Object.entries(filters).map(([key, val]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, color: t.text }}>
                  <input type="checkbox" checked={val} onChange={e => setFilters(f => ({...f, [key]: e.target.checked}))} />
                  {key.replace('_', ' ')}
                </label>
              ))}
            </div>
            <div>
              <div style={{ color: t.textMuted, marginBottom: 5, fontWeight: 500 }}>AUTO-SCROLL</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: t.text }}>
                <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} />
                Enabled
              </label>
            </div>
          </div>
          
          {/* Main List */}
          <div ref={eventListRef} style={{ flex: 1, padding: 12, overflowY: 'auto', minHeight: '300px' }}>
            {filteredEvents.length === 0 ? (
              <div style={{ textAlign: 'center', color: t.textMuted, padding: 40 }}>Waiting for events...</div>
            ) : (
              filteredEvents.map((e, i) => renderEvent(e, i))
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 16 }}>📂 Recordings</div>
          {recordingsList.length === 0 ? (
            <div style={{ color: t.textMuted }}>No recordings yet</div>
          ) : (
            recordingsList.map(rec => (
              <div key={rec.filename} style={{ padding: 12, marginBottom: 5, borderRadius: 8, background: t.bgSecondary, border: `1px solid ${t.border}` }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{rec.name}</div>
                <div style={{ fontSize: 12, color: t.textMuted }}>
                  {rec.started_at && new Date(rec.started_at).toLocaleString()}
                  {rec.duration_seconds && ` • ${Math.floor(rec.duration_seconds/60)}m ${rec.duration_seconds%60}s`}
                  {rec.event_count && ` • ${rec.event_count} events`}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
function MemoryPage({ memoryData, selectedMemoryId, onSelectMemory, theme }) {
  const [memoryContent, setMemoryContent] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [expandedFolders, setExpandedFolders] = React.useState({}); // Track expanded folders
  const [editMode, setEditMode] = React.useState(false);
  const [editContent, setEditContent] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const t = themes[theme];
  
  // Group memories by workspace
  const groupedMemories = React.useMemo(() => {
    if (!memoryData?.memories) return {};
    const groups = {};
    for (const mem of memoryData.memories) {
      const ws = mem.workspace || 'other';
      if (!groups[ws]) groups[ws] = [];
      groups[ws].push(mem);
    }
    return groups;
  }, [memoryData]);
  
  // Toggle folder expand/collapse
  const toggleFolder = (workspace) => {
    setExpandedFolders(prev => ({
      ...prev,
      [workspace]: !prev[workspace]
    }));
  };
  
  // Fetch content when selected
  React.useEffect(() => {
    if (selectedMemoryId) {
      setLoading(true);
      fetch(`${API_BASE}/api/memory/${selectedMemoryId}`)
        .then(r => r.json())
        .then(data => {
          setMemoryContent(data.content);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setMemoryContent(null);
    }
  }, [selectedMemoryId]);
  
  return (
    <div style={{ display: 'flex', height: '100%', gap: 16 }}>
      {/* Memory List */}
      <div style={{ width: 280, flexShrink: 0, overflowY: 'auto', paddingRight: 8 }}>
        <div style={{ color: t.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
          Memory Files ({memoryData?.memories?.length || 0})
        </div>
        
        {Object.entries(groupedMemories).map(([workspace, mems]) => (
          <div key={workspace} style={{ marginBottom: 8 }}>
            {/* Folder - Clickable to expand/collapse */}
            <div 
              onClick={() => toggleFolder(workspace)}
              style={{ 
                cursor: 'pointer',
                fontSize: 12, fontWeight: 600, color: t.text, 
                marginBottom: 3, padding: '6px 8px',
                borderRadius: 6,
                background: t.bgSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>📁 {workspace}</span>
              <span style={{ fontSize: 12, color: t.textMuted }}>
                {expandedFolders[workspace] ? '▼' : '▶'}
              </span>
            </div>
            
            {/* Files inside folder - only show if expanded */}
            {expandedFolders[workspace] && mems.map(mem => (
              <div 
                key={mem.id}
                onClick={() => onSelectMemory(mem.id)}
                style={{
                  cursor: 'pointer',
                  padding: '6px 10px',
                  marginBottom: 2,
                  marginLeft: 12,
                  borderRadius: 4,
                  background: selectedMemoryId === mem.id ? t.bgSecondary : 'transparent',
                  border: selectedMemoryId === mem.id ? `1px solid ${t.primary}` : 'none',
                }}
              >
                <div style={{ fontSize: 12, color: t.text, fontFamily: 'monospace' }}>
                  📄 {mem.filename}
                </div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 1 }}>
                  {(mem.size / 1024).toFixed(1)} KB
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      
      {/* Content View */}
      <div style={{ flex: 1, overflow: 'auto', background: t.bgSecondary, borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column' }}>
        {selectedMemoryId ? (
          loading ? (
            <div style={{ color: t.textMuted }}>Loading...</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: t.textMuted, fontFamily: 'monospace' }}>
                  {selectedMemoryId}
                </div>
                <button
                  onClick={() => {
                    if (editMode) {
                      // Save
                      setSaving(true);
                      fetch(`${API_BASE}/api/memory/${selectedMemoryId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content: editContent })
                      })
                      .then(r => r.json())
                      .then(data => {
                        setMemoryContent(editContent);
                        setEditMode(false);
                        setSaving(false);
                      })
                      .catch(() => setSaving(false));
                    } else {
                      setEditContent(memoryContent);
                      setEditMode(true);
                    }
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: editMode ? '#22c55e' : t.bg,
                    color: editMode ? 'white' : t.text,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {saving ? 'Saving...' : editMode ? '💾 Save' : '✏️ Edit'}
                </button>
              </div>
              {editMode ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  style={{
                    flex: 1,
                    background: t.bg,
                    color: t.text,
                    border: `1px solid ${t.border}`,
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 12,
                    fontFamily: 'monospace',
                    resize: 'none',
                    outline: 'none',
                  }}
                />
              ) : (
                <pre style={{ 
                  color: t.text, fontSize: 12, fontFamily: 'monospace', 
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
                  flex: 1,
                }}>
                  {memoryContent}
                </pre>
              )}
            </>
          )
        ) : (
          <div style={{ color: t.textMuted, textAlign: 'center', marginTop: 100 }}>
            ← Select a memory file to view its content
          </div>
        )}
      </div>
    </div>
  );
}

// Log Page - Full page view
function LogPage({ logData, selectedLogId, onSelectLog, theme }) {
  const [logContent, setLogContent] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [expandedFolders, setExpandedFolders] = React.useState({});
  const t = themes[theme];
  
  // Group logs by category
  const groupedLogs = React.useMemo(() => {
    if (!logData?.logs) return {};
    const groups = {};
    for (const log of logData.logs) {
      const cat = log.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(log);
    }
    return groups;
  }, [logData]);
  
  // Toggle folder
  const toggleFolder = (cat) => {
    setExpandedFolders(prev => ({ ...prev, [cat]: !prev[cat] }));
  };
  
  // Fetch content when selected
  React.useEffect(() => {
    if (selectedLogId) {
      setLoading(true);
      fetch(`${API_BASE}/api/logs/${selectedLogId}`)
        .then(r => r.json())
        .then(data => {
          setLogContent(data.content);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setLogContent(null);
    }
  }, [selectedLogId]);
  
  return (
    <div style={{ display: 'flex', height: '100%', gap: 16 }}>
      {/* Log List */}
      <div style={{ width: 280, flexShrink: 0, overflowY: 'auto', paddingRight: 8 }}>
        <div style={{ color: t.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
          Log Files ({logData?.logs?.length || 0})
        </div>
        
        {Object.entries(groupedLogs).map(([category, logs]) => (
          <div key={category} style={{ marginBottom: 8 }}>
            {/* Folder */}
            <div 
              onClick={() => toggleFolder(category)}
              style={{ 
                cursor: 'pointer',
                fontSize: 12, fontWeight: 600, color: t.text, 
                marginBottom: 3, padding: '6px 8px',
                borderRadius: 6,
                background: t.bgSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>📁 {category}</span>
              <span style={{ fontSize: 12, color: t.textMuted }}>
                {expandedFolders[category] ? '▼' : '▶'}
              </span>
            </div>
            
            {/* Files */}
            {expandedFolders[category] && logs.map(log => (
              <div 
                key={log.id}
                onClick={() => onSelectLog(log.id)}
                style={{
                  cursor: 'pointer',
                  padding: '6px 10px',
                  marginBottom: 2,
                  marginLeft: 12,
                  borderRadius: 4,
                  background: selectedLogId === log.id ? t.bgSecondary : 'transparent',
                  border: selectedLogId === log.id ? `1px solid ${t.primary}` : 'none',
                }}
              >
                <div style={{ fontSize: 12, color: t.text, fontFamily: 'monospace' }}>
                  📄 {log.name}
                </div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 1 }}>
                  {(log.size / 1024).toFixed(1)} KB
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      
      {/* Content View */}
      <div style={{ flex: 1, overflow: 'auto', background: t.bgSecondary, borderRadius: 8, padding: 16 }}>
        {selectedLogId ? (
          loading ? (
            <div style={{ color: t.textMuted }}>Loading...</div>
          ) : (
            <pre style={{ 
              color: t.text, fontSize: 12, fontFamily: 'monospace', 
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0
            }}>
              {logContent}
            </pre>
          )
        ) : (
          <div style={{ color: t.textMuted, textAlign: 'center', marginTop: 100 }}>
            ← Select a log file to view its content
          </div>
        )}
      </div>
    </div>
  );
}

// Sessions Page - Search agent sessions
function SessionsPage({ agents, searchQuery, onSearch, searchResults, theme }) {
  const t = themes[theme];
  const [selectedSession, setSelectedSession] = React.useState(null);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* Search Bar */}
      <div style={{ display: 'flex', gap: 12 }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search sessions by name, task, or output..."
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: t.bgSecondary,
            color: t.text,
            fontSize: 12,
            outline: 'none',
          }}
        />
      </div>
      
      {/* Results and Detail */}
      <div style={{ flex: 1, display: 'flex', gap: 16, overflow: 'hidden' }}>
        {/* Session List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {searchResults?.sessions?.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {searchResults.sessions.map(session => (
                <div
                  key={session.agent_id}
                  onClick={() => setSelectedSession(session)}
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    background: t.bgSecondary,
                    border: selectedSession?.agent_id === session.agent_id ? `1px solid ${t.primary}` : `1px solid ${t.border}`,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, color: t.text, fontFamily: 'monospace' }}>
                      {session.name}
                    </span>
                    <span style={{
                      fontSize: 12,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: session.status === 'working' ? '#22c55e20' : '#374151',
                      color: session.status === 'working' ? '#22c55e' : t.textMuted,
                    }}>
                      {session.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 4 }}>
                    {session.task || 'No task'}
                  </div>
                  <div style={{ fontSize: 12, color: t.textMuted, fontFamily: 'monospace' }}>
                    {session.model}
                  </div>
                </div>
              ))}
            </div>
          ) : searchQuery ? (
            <div style={{ textAlign: 'center', color: t.textMuted, padding: 40 }}>
              No sessions found for "{searchQuery}"
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: t.textMuted, padding: 40 }}>
              Enter a search query to find sessions
            </div>
          )}
        </div>
        
        {/* Session Detail Panel */}
        {selectedSession && (
          <div style={{ 
            width: 400, 
            background: t.bgSecondary, 
            borderRadius: 8, 
            padding: 20,
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: t.text }}>Session Details</h3>
              <button 
                onClick={() => setSelectedSession(null)}
                style={{ background: 'none', border: 'none', color: t.text, fontSize: 20, cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  fontSize: 32, 
                  width: 48, height: 48, 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: (selectedSession.color || '#60a5fa') + '20',
                  borderRadius: 12 
                }}>
                  {selectedSession.avatar || '🤖'}
                </div>
                <div>
                  <div style={{ fontSize: 12, color: t.textMuted }}>Agent</div>
                  <div style={{ color: t.text, fontWeight: 600, fontSize: 16 }}>
                    {selectedSession.name}
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 4 }}>Status</div>
                  <span style={{
                    fontSize: 12,
                    padding: '4px 8px',
                    borderRadius: 4,
                    background: selectedSession.status === 'working' ? '#22c55e20' : '#374151',
                    color: selectedSession.status === 'working' ? '#22c55e' : t.textMuted,
                  }}>
                    {selectedSession.status}
                  </span>
                </div>
                
                <div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 4 }}>Heartbeat</div>
                  <span style={{
                    fontSize: 12,
                    padding: '4px 8px',
                    borderRadius: 4,
                    background: selectedSession.heartbeat === 'online' ? '#22c55e20' : '#ef444420',
                    color: selectedSession.heartbeat === 'online' ? '#22c55e' : '#ef4444',
                  }}>
                    {selectedSession.heartbeat || 'unknown'}
                  </span>
                </div>
              </div>
              
              <div>
                <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 4 }}>Role</div>
                <div style={{ color: t.text }}>{selectedSession.role || 'Agent'}</div>
              </div>
              
              <div>
                <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 4 }}>Model</div>
                <div style={{ color: t.text, fontFamily: 'monospace', fontSize: 12 }}>{selectedSession.model}</div>
              </div>
              
              <div>
                <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 4 }}>Tokens Used</div>
                <div style={{ color: t.text, fontFamily: 'monospace' }}>{(selectedSession.tokens_used || 0).toLocaleString()}</div>
              </div>
              
              <div>
                <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 4 }}>Current Task</div>
                <div style={{ color: t.text, fontSize: 13 }}>{selectedSession.task || '—'}</div>
              </div>
              
              <div>
                <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 4 }}>Output</div>
                <div style={{ 
                  color: t.textMuted, 
                  fontSize: 12, 
                  background: t.bg, 
                  padding: 12, 
                  borderRadius: 6,
                  maxHeight: 200,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                }}>
                  {selectedSession.output || '—'}
                </div>
              </div>
              
              {selectedSession.updated_at && (
                <div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 4 }}>Last Updated</div>
                  <div style={{ color: t.textMuted, fontSize: 12 }}>
                    {new Date(selectedSession.updated_at).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AppContent() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [agents, setAgents] = useState([]);
  const [stats, setStats] = useState({});
  const [selected, setSelected] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [apiError, setApiError] = useState(false);
  const [costData, setCostData] = useState(null);
  
  // Context/Recording state
  const [contextEvents, setContextEvents] = useState([]);
  const [recordingStatus, setRecordingStatus] = useState(null);
  const [recordingsList, setRecordingsList] = useState([]);
  const [rateLimitData, setRateLimitData] = useState(null);
  const [memoryData, setMemoryData] = useState(null);
  const [selectedMemoryId, setSelectedMemoryId] = useState(null);
  const [selectedLogId, setSelectedLogId] = useState(null);
  const [cmdKOpen, setCmdKOpen] = useState(false);
  const [cmdKQuery, setCmdKQuery] = useState('');
  const [cmdKResults, setCmdKResults] = useState({ agents: [], memory: [], logs: [] });
  const [logData, setLogData] = useState(null);
  const [sessionSearchQuery, setSessionSearchQuery] = useState('');
  const [sessionResults, setSessionResults] = useState(null);
  const [selectedMemory, setSelectedMemory] = useState(null);
  const wsRef = useRef(null);
  const { theme, toggleTheme } = useTheme();
  const t = themes[theme];

  // Fetch data immediately
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [agentsRes, statsRes] = await Promise.all([
          fetch(`${API_BASE}/api/agents`),
          fetch(`${API_BASE}/api/stats`),
        ]);
        const agentsData = await agentsRes.json();
        const statsData = await statsRes.json();
        setAgents(agentsData);
        setStats(statsData);
        setLastUpdate(new Date());
        setApiError(false);
      } catch (e) {
        console.error("Fetch error:", e);
        setApiError(true);
      }
    };
    fetchData();
    
    // Fetch cost data
    fetch(`${API_BASE}/api/cost`)
      .then(r => r.json())
      .then(setCostData)
      .catch(console.error);
    
    // Fetch rate limit data
    fetch(`${API_BASE}/api/rate-limits`)
      .then(r => r.json())
      .then(setRateLimitData)
      .catch(console.error);
    
    // Fetch memory data
    fetch(`${API_BASE}/api/memory`)
      .then(r => r.json())
      .then(setMemoryData)
      .catch(console.error);
    
    // Fetch log data
    fetch(`${API_BASE}/api/logs`)
      .then(r => r.json())
      .then(setLogData)
      .catch(console.error);
    
    // Fetch recording status
    fetch(`${API_BASE}/api/recording/status`)
      .then(r => r.json())
      .then(d => setRecordingStatus(d.recording))
      .catch(console.error);
    
    // Fetch recordings list
    fetch(`${API_BASE}/api/recordings`)
      .then(r => r.json())
      .then(d => setRecordingsList(d.recordings || []))
      .catch(console.error);
    
    // Search sessions function
    const searchSessions = (query) => {
      setSessionSearchQuery(query);
      fetch(`${API_BASE}/api/sessions/search?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(setSessionResults)
        .catch(console.error);
    };
    
    // WS 断线时的保底轮询
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  // WebSocket connection
  useEffect(() => {
    const connectWS = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected");
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "init" || data.type === "agents_update") {
            setAgents(data.agents);
            setStats(data.stats);
            setLastUpdate(new Date(data.timestamp));
          }
        } catch (e) {
          console.error("WS message error:", e);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        // Retry after 3 seconds
        setTimeout(connectWS, 3000);
      };
      
      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    };

    connectWS();
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, []);

  const apiStatus = wsConnected ? "Live" : apiError ? "Error" : "Polling";
  const apiStatusColor = wsConnected ? "#4ade80" : apiError ? "#ef4444" : "#f59e0b";

  // Cmd+K global search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdKOpen(true);
      }
      if (e.key === 'Escape') {
        setCmdKOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Search when Cmd+K query changes
  useEffect(() => {
    if (cmdKQuery && cmdKOpen) {
      // Search agents
      const agentResults = agents.filter(a => 
        a.name?.toLowerCase().includes(cmdKQuery.toLowerCase()) ||
        a.task?.toLowerCase().includes(cmdKQuery.toLowerCase()) ||
        a.agent_id?.toLowerCase().includes(cmdKQuery.toLowerCase())
      );
      setCmdKResults({ agents: agentResults, memory: [], logs: [] });
    } else {
      setCmdKResults({ agents: [], memory: [], logs: [] });
    }
  }, [cmdKQuery, cmdKOpen, agents]);

  return (
    <div style={{
      height: "100vh", background: t.bg, color: t.text,
      fontFamily: "'Noto Sans SC', 'DM Sans', sans-serif", display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Noto+Sans+SC:wght@400;500;700&display=swap');
        @keyframes ping { 75%,100% { transform:scale(2); opacity:0; } }
        @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:rgba(128,128,128,0.3);border-radius:2px}
        * { box-sizing: border-box; }
      `}</style>

      {/* Header - Fixed at top */}
      <div style={{
        borderBottom: `1px solid ${t.border}`, padding: "0 24px", height: 52,
        display: "flex", alignItems: "center", gap: 16, background: "rgba(0,0,0,0.02)",
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", boxShadow: "0 0 8px #3b82f6" }} />
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: 0.5, color: t.text }}>Claw Hive</span>
        </div>
        
        {/* Navigation Tabs */}
        <div style={{ marginLeft: 24, display: 'flex', gap: 4 }}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: '📊' },
            { id: 'memory', label: 'Memory', icon: '📁' },
            { id: 'logs', label: 'Logs', icon: '📜' },
            { id: 'sessions', label: 'Sessions', icon: '🔍' },
            { id: 'cron', label: 'Cron', icon: '⏰' },
            { id: 'files', label: 'Files', icon: '📂' },
            { id: 'search', label: 'Search', icon: '🔎' },
            { id: 'models', label: 'Models', icon: '🤖' },
            { id: 'channels', label: 'Channels', icon: '📱' },
            { id: 'skills', label: 'Skills', icon: '🔧' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setCurrentPage(tab.id)}
              style={{
                background: currentPage === tab.id ? t.bgSecondary : 'transparent',
                border: 'none',
                padding: '6px 14px',
                borderRadius: 6,
                cursor: 'pointer',
                color: currentPage === tab.id ? t.text : t.textMuted,
                fontSize: 12,
                fontWeight: currentPage === tab.id ? 600 : 400,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
        
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        
        {/* Context Stream Button */}
        <button
          onClick={() => setCurrentPage('context')}
          style={{
            padding: '6px 12px',
            marginLeft: 8,
            borderRadius: 6,
            border: 'none',
            background: currentPage === 'context' ? t.accent : 'transparent',
            color: currentPage === 'context' ? 'white' : t.textMuted,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          📡 Context
        </button>
        
        {/* Debug Proxy Button */}
        <button
          onClick={() => setCurrentPage('proxy')}
          style={{
            padding: '6px 12px',
            marginLeft: 8,
            borderRadius: 6,
            border: 'none',
            background: currentPage === 'proxy' ? t.accent : 'transparent',
            color: currentPage === 'proxy' ? 'white' : t.textMuted,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          🔌 Proxy
        </button>
        
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          {lastUpdate && (
            <span style={{ color: t.textMuted, fontSize: 11 }}>
              Updated: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <span style={{ width: 8, height: 8, borderRadius: "50%", display: "inline-block",
            background: apiStatusColor, boxShadow: `0 0 8px ${apiStatusColor}` }} />
          <span style={{ color: apiStatusColor, fontSize: 12, fontWeight: 600 }}>
            {apiStatus} {wsConnected ? "🟢" : "🟠"}
          </span>
        </div>
      </div>

      {/* Body */}
      {/* Cmd+K Search Modal */}
      {cmdKOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', paddingTop: 100,
        }} onClick={() => setCmdKOpen(false)}>
          <div style={{
            width: 600, maxHeight: 500,
            background: t.bg, borderRadius: 12, border: `1px solid ${t.border}`,
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: 16, borderBottom: `1px solid ${t.border}` }}>
              <input
                autoFocus
                type="text"
                value={cmdKQuery}
                onChange={e => setCmdKQuery(e.target.value)}
                placeholder="Search agents, memory, logs..."
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 8,
                  border: `1px solid ${t.border}`, background: t.bgSecondary,
                  color: t.text, fontSize: 16, outline: 'none',
                }}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: t.textMuted }}>
                Press <kbd style={{ background: t.bgSecondary, padding: '2px 6px', borderRadius: 4 }}>Esc</kbd> to close • <kbd style={{ background: t.bgSecondary, padding: '2px 6px', borderRadius: 4 }}>Enter</kbd> to select
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
              {cmdKResults.agents.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: t.textMuted, padding: '8px 12px', textTransform: 'uppercase' }}>
                    Agents
                  </div>
                  {cmdKResults.agents.map(agent => (
                    <div
                      key={agent.agent_id}
                      onClick={() => {
                        setCurrentPage('dashboard');
                        setSelected(agent);
                        setCmdKOpen(false);
                      }}
                      style={{
                        padding: '12px 16px', cursor: 'pointer', borderRadius: 8,
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = t.bgSecondary}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontSize: 24 }}>{agent.avatar || '🤖'}</span>
                      <div>
                        <div style={{ fontWeight: 600, color: t.text }}>{agent.name}</div>
                        <div style={{ fontSize: 12, color: t.textMuted }}>{agent.task}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!cmdKQuery && (
                <div style={{ textAlign: 'center', color: t.textMuted, padding: 40 }}>
                  Type to search across all data
                </div>
              )}
              {cmdKQuery && cmdKResults.agents.length === 0 && (
                <div style={{ textAlign: 'center', color: t.textMuted, padding: 40 }}>
                  No results found
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {currentPage === 'dashboard' ? (
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, marginBottom: 5, color: t.text }}>Agent Overview</h1>
                <p style={{ color: t.textMuted, fontSize: 12, margin: 0 }}>
                  Real-time status, tasks, and heartbeat for all OpenClaw Agents
                </p>
              </div>

              {agents.length === 0 ? (
                <div style={{ textAlign: "center", color: t.textMuted, padding: "80px 0", fontSize: 14 }}>
                  {apiError ? "⚠️ Cannot connect to API, please check service" : "Waiting for agent data..."}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
                  {agents.map(agent => (
                    <AgentCard
                      key={agent.agent_id}
                      agent={agent}
                      selected={selected?.agent_id === agent.agent_id}
                      onClick={setSelected}
                      theme={theme}
                    />
                  ))}
                </div>
              )}

              <AgentDetailPanel agent={selected} onClose={() => setSelected(null)} theme={theme} />
              {selectedMemory && (
                <MemoryViewer memoryId={selectedMemory} onClose={() => setSelectedMemory(null)} theme={theme} />
              )}
            </div>

            <Sidebar agents={agents} stats={stats} costData={costData} rateLimitData={rateLimitData} theme={theme} />
          </>
        ) : currentPage === 'memory' ? (
          <div style={{ flex: 1, padding: "24px 28px", overflow: "hidden" }}>
            <MemoryPage 
              memoryData={memoryData} 
              selectedMemoryId={selectedMemoryId}
              onSelectMemory={setSelectedMemoryId}
              theme={theme}
            />
          </div>
        ) : currentPage === 'sessions' ? (
          <div style={{ flex: 1, padding: "24px 28px", overflow: "hidden" }}>
            <SessionsPage 
              agents={agents}
              searchQuery={sessionSearchQuery}
              onSearch={(q) => {
                setSessionSearchQuery(q);
                fetch(`${API_BASE}/api/sessions/search?q=${encodeURIComponent(q)}`)
                  .then(r => r.json())
                  .then(setSessionResults)
                  .catch(console.error);
              }}
              searchResults={sessionResults}
              theme={theme}
            />
          </div>
        ) : currentPage === 'cron' ? (
          <div style={{ flex: 1, padding: "24px 28px", overflow: "auto" }}>
            <CronPage theme={theme} />
          </div>
        ) : currentPage === 'files' ? (
          <div style={{ flex: 1, padding: "24px 28px", overflow: "auto" }}>
            <FilesPage theme={theme} />
          </div>
        ) : currentPage === 'search' ? (
          <div style={{ flex: 1, padding: "24px 28px", overflow: "auto" }}>
            <SearchPage theme={theme} />
          </div>
        ) : currentPage === 'models' ? (
          <div style={{ flex: 1, padding: "24px 28px", overflow: "auto" }}>
            <ModelsPage theme={theme} />
          </div>
        ) : currentPage === 'channels' ? (
          <div style={{ flex: 1, padding: "24px 28px", overflow: "auto" }}>
            <ChannelsPage theme={theme} />
          </div>
        ) : currentPage === 'skills' ? (
          <div style={{ flex: 1, padding: "24px 28px", overflow: "hidden" }}>
            <SkillsPage theme={theme} />
          </div>
        ) : currentPage === 'context' ? (
          <div style={{ flex: 1, padding: 0, overflow: "hidden" }}>
            <ContextPage 
              contextEvents={contextEvents}
              setContextEvents={setContextEvents}
              recordingStatus={recordingStatus}
              setRecordingStatus={setRecordingStatus}
              recordingsList={recordingsList}
              setRecordingsList={setRecordingsList}
              theme={theme}
            />
          </div>
        ) : currentPage === 'proxy' ? (
          <div style={{ flex: 1, padding: "24px 28px", overflow: "hidden" }}>
            <DebugProxyPage theme={theme} />
          </div>
        ) : (
          <div style={{ flex: 1, padding: "24px 28px", overflow: "hidden" }}>
            <LogPage 
              logData={logData} 
              selectedLogId={selectedLogId}
              onSelectLog={setSelectedLogId}
              theme={theme}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
