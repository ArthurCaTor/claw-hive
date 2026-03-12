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
          fontSize: 11, fontFamily: "monospace", fontWeight: 600,
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
          fontFamily: "monospace", fontSize: 11, fontWeight: 600 
        }}>
          {agent.status === 'working' ? 'Working' : agent.status === 'error' ? 'Error' : 'Waiting for work'}
        </span>
        <span style={{ color: t.textMuted }}>Task</span>
        <span style={{ color: t.text, fontSize: 11, lineHeight: 1.5 }}>
          {agent.output ? agent.output.slice(0, 100) + (agent.output.length > 100 ? "..." : "") : "—"}
        </span>
        <span style={{ color: t.textMuted }}>Heartbeat</span>
        <span style={{ fontSize: 11, fontFamily: "monospace",
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
        <div style={{ color: t.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
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
            <div style={{ color: t.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
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
                <div style={{ fontSize: 9, color: t.textMuted, marginBottom: 4 }}>Today</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e', fontFamily: 'monospace' }}>
                  ${costData.breakdown.today?.cost || '0.00'}
                </div>
                <div style={{ fontSize: 9, color: t.textMuted, marginTop: 2 }}>
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
                <div style={{ fontSize: 9, color: t.textMuted, marginBottom: 4 }}>All Time</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#3b82f6', fontFamily: 'monospace' }}>
                  ${costData.breakdown.all_time?.cost || '0.00'}
                </div>
                <div style={{ fontSize: 9, color: t.textMuted, marginTop: 2 }}>
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
                <div style={{ fontSize: 9, color: t.textMuted, marginBottom: 4 }}>Projected</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', fontFamily: 'monospace' }}>
                  ${costData.breakdown.projected_monthly?.cost || '0.00'}
                </div>
                <div style={{ fontSize: 9, color: t.textMuted, marginTop: 2 }}>
                  /month
                </div>
              </div>
            </div>
            
            {/* By Model */}
            {Object.entries(costData.by_model || {}).map(([model, data]) => (
              <div key={model} style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${t.border}` }}>
                <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>{model}</div>
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
            <div style={{ color: t.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
              Rate Limits
            </div>
            {rateLimitData.models.map((model) => (
              <div key={model.model} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${t.border}` }}>
                <div style={{ fontSize: 12, color: t.text, marginBottom: 6 }}>{model.model}</div>
                
                {/* RPM Usage */}
                <div style={{ marginBottom: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
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
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
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
        <div style={{ color: t.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
          Active Now
        </div>
        {active.length === 0 && <div style={{ color: t.textMuted, fontSize: 12 }}>No active agents</div>}
        {active.map(a => (
          <div key={a.agent_id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Pulse color={a.color || "#60a5fa"} active />
            <span style={{ color: t.textMuted, fontSize: 13, fontFamily: "monospace" }}>{a.name}</span>
            <span style={{ color: t.textMuted, fontSize: 11, marginLeft: "auto" }}>Live</span>
          </div>
        ))}
        {idle.map(a => (
          <div key={a.agent_id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#374151", display: "inline-block" }} />
            <span style={{ color: t.textMuted, fontSize: 13, fontFamily: "monospace" }}>{a.name}</span>
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
          <div style={{ color: t.textMuted, fontSize: 11, marginBottom: 6 }}>Status</div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 12px", borderRadius: 6,
            background: isWorking ? `${color}20` : "#374151",
            color: isWorking ? color : t.textMuted,
            fontWeight: 600, fontSize: 13,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: isWorking ? color : "#64748b" }} />
            {isWorking ? "Working" : "Idle"}
          </div>
        </div>

        {/* Heartbeat */}
        <div style={{ background: "rgba(0,0,0,0.1)", padding: 16, borderRadius: 8 }}>
          <div style={{ color: t.textMuted, fontSize: 11, marginBottom: 6 }}>Heartbeat</div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 12px", borderRadius: 6,
            background: agent.heartbeat === "online" ? "#22c55e20" : "#ef444420",
            color: agent.heartbeat === "online" ? "#22c55e" : "#ef4444",
            fontWeight: 600, fontSize: 13,
          }}>
            {agent.heartbeat === "online" ? "🟢 Online" : "🔴 Offline"}
          </div>
        </div>

        {/* Current Task */}
        <div style={{ background: "rgba(0,0,0,0.1)", padding: 16, borderRadius: 8, gridColumn: "span 2" }}>
          <div style={{ color: t.textMuted, fontSize: 11, marginBottom: 6 }}>Current Task</div>
          <div style={{ color: t.text, fontSize: 14 }}>{agent.task || "—"}</div>
        </div>

        {/* Task Detail */}
        <div style={{ background: "rgba(0,0,0,0.1)", padding: 16, borderRadius: 8, gridColumn: "span 2" }}>
          <div style={{ color: t.textMuted, fontSize: 11, marginBottom: 6 }}>Task Detail</div>
          <div style={{ color: t.textMuted, fontSize: 13, lineHeight: 1.5 }}>{agent.output || "—"}</div>
        </div>

        {/* Token Usage */}
        <div style={{ background: "rgba(0,0,0,0.1)", padding: 16, borderRadius: 8 }}>
          <div style={{ color: t.textMuted, fontSize: 11, marginBottom: 6 }}>Token Usage</div>
          <div style={{ color: t.text, fontSize: 14, fontFamily: "monospace" }}>
            {(agent.tokens_used || 0).toLocaleString()}
          </div>
        </div>

        {/* Agent ID */}
        <div style={{ background: "rgba(0,0,0,0.1)", padding: 16, borderRadius: 8 }}>
          <div style={{ color: t.textMuted, fontSize: 11, marginBottom: 6 }}>Agent ID</div>
          <div style={{ color: t.text, fontSize: 14, fontFamily: "monospace" }}>{agent.agent_id}</div>
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
        <div style={{ color: t.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
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
                marginBottom: 4, padding: '6px 8px',
                borderRadius: 6,
                background: t.bgSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>📁 {workspace}</span>
              <span style={{ fontSize: 10, color: t.textMuted }}>
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
                <div style={{ fontSize: 11, color: t.text, fontFamily: 'monospace' }}>
                  📄 {mem.filename}
                </div>
                <div style={{ fontSize: 9, color: t.textMuted, marginTop: 1 }}>
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
        <div style={{ color: t.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
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
                marginBottom: 4, padding: '6px 8px',
                borderRadius: 6,
                background: t.bgSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>📁 {category}</span>
              <span style={{ fontSize: 10, color: t.textMuted }}>
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
                <div style={{ fontSize: 11, color: t.text, fontFamily: 'monospace' }}>
                  📄 {log.name}
                </div>
                <div style={{ fontSize: 9, color: t.textMuted, marginTop: 1 }}>
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
              color: t.text, fontSize: 11, fontFamily: 'monospace', 
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
            fontSize: 14,
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
                      fontSize: 10,
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
                  <div style={{ fontSize: 11, color: t.textMuted, fontFamily: 'monospace' }}>
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
                  <div style={{ fontSize: 11, color: t.textMuted }}>Agent</div>
                  <div style={{ color: t.text, fontWeight: 600, fontSize: 16 }}>
                    {selectedSession.name}
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Status</div>
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
                  <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Heartbeat</div>
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
                <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Role</div>
                <div style={{ color: t.text }}>{selectedSession.role || 'Agent'}</div>
              </div>
              
              <div>
                <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Model</div>
                <div style={{ color: t.text, fontFamily: 'monospace', fontSize: 12 }}>{selectedSession.model}</div>
              </div>
              
              <div>
                <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Tokens Used</div>
                <div style={{ color: t.text, fontFamily: 'monospace' }}>{(selectedSession.tokens_used || 0).toLocaleString()}</div>
              </div>
              
              <div>
                <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Current Task</div>
                <div style={{ color: t.text, fontSize: 13 }}>{selectedSession.task || '—'}</div>
              </div>
              
              <div>
                <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Output</div>
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
                  <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Last Updated</div>
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
                fontSize: 13,
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
              <div style={{ marginTop: 8, fontSize: 11, color: t.textMuted }}>
                Press <kbd style={{ background: t.bgSecondary, padding: '2px 6px', borderRadius: 4 }}>Esc</kbd> to close • <kbd style={{ background: t.bgSecondary, padding: '2px 6px', borderRadius: 4 }}>Enter</kbd> to select
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
              {cmdKResults.agents.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: t.textMuted, padding: '8px 12px', textTransform: 'uppercase' }}>
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
                <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, marginBottom: 6, color: t.text }}>Agent Overview</h1>
                <p style={{ color: t.textMuted, fontSize: 13, margin: 0 }}>
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
