import React, { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#4F46E5',
    primaryTextColor: '#fff',
    lineColor: '#94A3B8',
  },
  flowchart: { curve: 'basis', htmlLabels: true },
  securityLevel: 'loose',
});

interface StudyItem {
  id: string;
  title: string;
  category: string;
  layer: number;
  mermaid?: string;
  description?: string;
  sourceFiles?: string[];
  lastUpdated?: string;
}

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:8080';

const DEFAULT_TREE = {
  '📐 System Overview': [
    { id: 'system-overview', title: 'System Architecture Overview', layer: 0, category: 'system' }
  ],
  '📦 Core Modules': [
    { id: 'agent-lifecycle', title: 'Agent Lifecycle', layer: 1, category: 'modules' },
    { id: 'tool-system', title: 'Tool System', layer: 1, category: 'modules' },
    { id: 'provider-layer', title: 'Provider Layer', layer: 1, category: 'modules' },
    { id: 'session-memory', title: 'Session & Memory', layer: 1, category: 'modules' },
    { id: 'config-system', title: 'Config System', layer: 1, category: 'modules' }
  ],
  '🔗 Module Interactions': [
    { id: 'full-lifecycle', title: 'Full Request Lifecycle', layer: 3, category: 'interactions' }
  ]
};

export function StudyPage() {
  const [selectedItem, setSelectedItem] = useState<StudyItem | null>(null);
  const [tree, setTree] = useState<any>(DEFAULT_TREE);
  const [diagram, setDiagram] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const mermaidRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/study/tree`)
      .then(res => res.json())
      .then(data => setTree(data))
      .catch(() => setTree(DEFAULT_TREE));
  }, []);

  useEffect(() => {
    if (!selectedItem) {
      setDiagram(null);
      return;
    }

    setLoading(true);
    fetch(`${API_BASE}/api/study/diagrams/${selectedItem.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.mermaid) {
          setDiagram(data.mermaid);
        } else {
          setDiagram(null);
        }
        setLoading(false);
      })
      .catch(() => {
        setDiagram(null);
        setLoading(false);
      });
  }, [selectedItem]);

  useEffect(() => {
    if (!diagram || !mermaidRef.current) return;

    const renderDiagram = async () => {
      try {
        const id = `mermaid-${Date.now()}`;
        const definition = diagram;
        
        mermaidRef.current!.innerHTML = `<div class="mermaid">${definition}</div>`;
        
        const { svg } = await mermaid.render(id, definition);
        mermaidRef.current!.innerHTML = svg;
      } catch (err) {
        console.error('Mermaid render error:', err);
        if (mermaidRef.current) {
          mermaidRef.current.innerHTML = `<pre style="color: red">Error: ${err}</pre>`;
        }
      }
    };

    renderDiagram();
  }, [diagram]);

  const renderTree = () => {
    return Object.entries(tree).map(([category, items]) => (
      <div key={category} style={{ marginBottom: '20px' }}>
        <div style={{ 
          color: '#94a3b8', 
          fontSize: '11px', 
          fontWeight: 'bold',
          marginBottom: '8px',
          textTransform: 'uppercase',
          fontFamily: 'monospace'
        }}>
          {category}
        </div>
        {(items as StudyItem[]).map(item => (
          <button
            key={item.id}
            onClick={() => setSelectedItem(item)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '10px 12px',
              marginBottom: '4px',
              background: selectedItem?.id === item.id ? '#1e293b' : 'transparent',
              border: selectedItem?.id === item.id ? '1px solid #4F46E5' : '1px solid transparent',
              borderRadius: '6px',
              color: selectedItem?.id === item.id ? '#fff' : '#94a3b8',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            {item.title}
          </button>
        ))}
      </div>
    ));
  };

  return (
    <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 120px)' }}>
      {/* Left Sidebar - Tree Navigation */}
      <div style={{ 
        width: '280px', 
        background: '#0f172a', 
        borderRadius: '12px', 
        padding: '16px',
        overflow: 'auto'
      }}>
        <h2 style={{ color: '#fff', margin: '0 0 16px 0', fontSize: '18px' }}>
          📚 Study
        </h2>
        {renderTree()}
      </div>

      {/* Main Content - Diagram */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {selectedItem ? (
          <div>
            {/* Header */}
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ color: '#fff', margin: '0 0 8px 0', fontSize: '24px' }}>
                {selectedItem.title}
              </h2>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ 
                  background: '#1e293b', 
                  padding: '4px 8px', 
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#94a3b8'
                }}>
                  Layer {selectedItem.layer}
                </span>
                {selectedItem.lastUpdated && (
                  <span style={{ color: '#64748b', fontSize: '12px' }}>
                    Updated: {new Date(selectedItem.lastUpdated).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            {/* Mermaid Container */}
            <div style={{ 
              background: '#0f172a', 
              borderRadius: '12px', 
              padding: '24px',
              minHeight: '400px'
            }}>
              {loading ? (
                <div style={{ color: '#94a3b8', textAlign: 'center', padding: '100px' }}>
                  Loading diagram...
                </div>
              ) : diagram ? (
                <div 
                  ref={mermaidRef}
                  style={{ display: 'flex', justifyContent: 'center' }}
                />
              ) : (
                <div style={{ color: '#64748b', textAlign: 'center', padding: '100px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
                  <p>Diagram pending generation</p>
                  <p style={{ fontSize: '12px', marginTop: '16px' }}>
                    This module will be auto-generated from OpenClaw source analysis.
                  </p>
                </div>
              )}
            </div>

            {/* Description */}
            {selectedItem.description && (
              <div style={{ marginTop: '20px', color: '#94a3b8', fontSize: '14px' }}>
                {selectedItem.description}
              </div>
            )}
          </div>
        ) : (
          <div style={{ 
            background: '#0f172a', 
            borderRadius: '12px', 
            padding: '100px',
            textAlign: 'center',
            color: '#64748b'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📊</div>
            <h3 style={{ color: '#94a3b8', margin: '0 0 8px 0' }}>
              Select a topic to view
            </h3>
            <p>Choose a module from the left sidebar to view its architecture diagram</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default StudyPage;
