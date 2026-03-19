import React, { useState, useEffect } from 'react';

// Study data structure
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

export function StudyPage() {
  const [selectedItem, setSelectedItem] = useState<StudyItem | null>(null);
  const [tree, setTree] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [mermaidRendered, setMermaidRendered] = useState(false);

  useEffect(() => {
    fetchStudyTree();
  }, []);

  useEffect(() => {
    if (selectedItem?.mermaid) {
      renderMermaid();
    }
  }, [selectedItem]);

  const fetchStudyTree = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/study/tree`);
      if (res.ok) {
        const data = await res.json();
        setTree(data);
      } else {
        // Use default tree if API not available
        setTree(getDefaultTree());
      }
    } catch {
      setTree(getDefaultTree());
    }
    setLoading(false);
  };

  const renderMermaid = async () => {
    if (!selectedItem?.mermaid) return;
    
    setMermaidRendered(false);
    
    // Wait for DOM update
    await new Promise(r => setTimeout(r, 100));
    
    const { default: mermaid } = await import('mermaid');
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      flowchart: { curve: 'basis' },
    });
    
    const id = `mermaid-${Date.now()}`;
    const element = document.getElementById('mermaid-container');
    if (element) {
      element.innerHTML = `<div class="mermaid">${selectedItem.mermaid}</div>`;
      try {
        await mermaid.run({ nodes: [element.querySelector('.mermaid')] });
        setMermaidRendered(true);
      } catch (e) {
        console.error('Mermaid render error:', e);
      }
    }
  };

  const renderTree = () => {
    return Object.entries(tree).map(([category, items]) => (
      <div key={category} style={{ marginBottom: '20px' }}>
        <div style={{ 
          color: '#94a3b8', 
          fontSize: '12px', 
          fontWeight: 'bold',
          marginBottom: '8px',
          textTransform: 'uppercase'
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
              padding: '8px 12px',
              marginBottom: '4px',
              background: selectedItem?.id === item.id ? '#1e293b' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: selectedItem?.id === item.id ? '#fff' : '#94a3b8',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            {item.title}
          </button>
        ))}
      </div>
    ));
  };

  const getDefaultTree = () => ({
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
  });

  return (
    <div style={{ display: 'flex', gap: '24px' }}>
      {/* Left Sidebar - Tree Navigation */}
      <div style={{ 
        width: '280px', 
        background: '#0f172a', 
        borderRadius: '12px', 
        padding: '16px',
        maxHeight: 'calc(100vh - 150px)',
        overflow: 'auto'
      }}>
        <h2 style={{ color: '#fff', margin: '0 0 16px 0', fontSize: '18px' }}>
          📚 Study
        </h2>
        {loading ? (
          <div style={{ color: '#94a3b8' }}>Loading...</div>
        ) : (
          renderTree()
        )}
      </div>

      {/* Main Content - Diagram */}
      <div style={{ flex: 1 }}>
        {selectedItem ? (
          <div>
            {/* Header */}
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ color: '#fff', margin: '0 0 8px 0' }}>
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
                    Updated: {selectedItem.lastUpdated}
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
              <div id="mermaid-container" style={{ 
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '300px'
              }}>
                {!mermaidRendered && !selectedItem.mermaid && (
                  <div style={{ color: '#64748b', textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
                    <p>Analysis pending...</p>
                    <p style={{ fontSize: '12px', maxWidth: '400px', margin: '16px auto' }}>
                      This diagram will be auto-generated from OpenClaw source code analysis.
                    </p>
                  </div>
                )}
                {!mermaidRendered && selectedItem.mermaid && (
                  <div style={{ color: '#94a3b8' }}>Rendering diagram...</div>
                )}
              </div>
            </div>

            {/* Source Files */}
            {selectedItem.sourceFiles && selectedItem.sourceFiles.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <h3 style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>
                  Source Files
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {selectedItem.sourceFiles.map((file, i) => (
                    <span key={i} style={{ 
                      background: '#1e293b',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: '#94a3b8',
                      fontFamily: 'monospace'
                    }}>
                      {file}
                    </span>
                  ))}
                </div>
              </div>
            )}

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
            padding: '48px',
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
