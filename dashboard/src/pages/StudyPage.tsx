import React, { useState, useRef, useEffect, useCallback } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#4F46E5',
    primaryTextColor: '#fff',
    lineColor: '#94A3B8',
    background: '#0f172a',
  },
  flowchart: { 
    useMaxWidth: false,
    htmlLabels: true,
    curve: 'basis',
  },
  sequence: {
    useMaxWidth: false,
    diagramMarginX: 20,
    diagramMarginY: 20,
    actorMargin: 80,
    width: 180,
    height: 50,
    boxMargin: 10,
    boxTextMargin: 5,
    noteMargin: 10,
    messageMargin: 40,
  },
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
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<HTMLDivElement>(null);

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
    setScale(1);
    setPosition({ x: 0, y: 0 });
    
    fetch(`${API_BASE}/api/study/diagrams/${selectedItem.id}`)
      .then(res => res.json())
      .then(data => {
        setDiagram(data.mermaid || null);
        setLoading(false);
      })
      .catch(() => {
        setDiagram(null);
        setLoading(false);
      });
  }, [selectedItem]);

  useEffect(() => {
    if (!diagram || !svgRef.current) return;

    const render = async () => {
      try {
        const id = `mermaid-${Date.now()}`;
        svgRef.current!.innerHTML = `<div class="mermaid">${diagram}</div>`;
        const { svg } = await mermaid.render(id, diagram);
        svgRef.current!.innerHTML = svg;
        autoFit();
      } catch (err) {
        console.error('Mermaid render error:', err);
        if (svgRef.current) {
          svgRef.current.innerHTML = `<pre style="color: red; text-align: left; overflow: auto;">Error: ${err}</pre>`;
        }
      }
    };

    render();
  }, [diagram]);

  const autoFit = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;
    const svg = svgRef.current.querySelector('svg');
    if (!svg) return;
    const containerWidth = containerRef.current.clientWidth - 48;
    const svgWidth = svg.clientWidth || svgRef.current.clientWidth;
    if (svgWidth > containerWidth) {
      const newScale = (containerWidth / svgWidth) * 0.95;
      setScale(Math.max(0.3, newScale));
    }
  }, []);

  const handleZoomIn = () => setScale(s => Math.min(s + 0.25, 3));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.25, 0.3));
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({ x: e.clientX - startPos.x, y: e.clientY - startPos.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setScale(s => Math.min(s + 0.1, 3));
    } else {
      setScale(s => Math.max(s - 0.1, 0.3));
    }
  };

  useEffect(() => {
    const handleResize = () => autoFit();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [autoFit]);

  const renderTree = () => {
    return Object.entries(tree).map(([category, items]) => (
      <div key={category} style={{ marginBottom: '20px' }}>
        <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', fontFamily: 'monospace' }}>
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
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: '#0d1117' }}>
      <div style={{ width: '260px', background: '#0f172a', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #1e293b' }}>
          <h2 style={{ color: '#fff', margin: 0, fontSize: '20px' }}>📚 OpenClaw Study</h2>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
          {renderTree()}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedItem && (
          <div style={{ padding: '16px 24px', background: '#0f172a', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div>
              <h2 style={{ color: '#fff', margin: 0, fontSize: '20px' }}>{selectedItem.title}</h2>
              <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
                Layer {selectedItem.layer}
                {selectedItem.lastUpdated && <> · Updated {new Date(selectedItem.lastUpdated).toLocaleDateString()}</>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={handleZoomOut} style={{ padding: '8px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '16px' }}>−</button>
              <span style={{ color: '#fff', minWidth: '50px', textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
              <button onClick={handleZoomIn} style={{ padding: '8px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '16px' }}>+</button>
              <button onClick={handleReset} style={{ padding: '8px 12px', background: '#4F46E5', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '12px' }}>Reset</button>
            </div>
          </div>
        )}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          style={{
            flex: 1,
            padding: '24px',
            overflow: 'hidden',
            cursor: isDragging ? 'grabbing' : 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {loading ? (
            <div style={{ color: '#94a3b8' }}>Loading diagram...</div>
          ) : diagram ? (
            <div
              ref={svgRef}
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                maxWidth: '100%',
                maxHeight: '100%',
              }}
            />
          ) : (
            <div style={{ textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
              <p>Select a module from the left to view diagram</p>
            </div>
          )}
        </div>
        {selectedItem && (
          <div style={{ padding: '12px 24px', background: '#0f172a', borderTop: '1px solid #1e293b', color: '#64748b', fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
            <span>🖱️ Drag to pan · 🔄 Scroll to zoom · +/- to resize</span>
            {selectedItem.description && <span>{selectedItem.description}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export default StudyPage;
