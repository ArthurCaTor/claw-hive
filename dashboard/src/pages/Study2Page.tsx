import React, { useState, useEffect } from 'react';

interface NavItem {
  id: string;
  name: string;
  story?: string;
  module?: string;
  data?: string;
  config?: string;
  experiment?: string;
}

interface NavCategory {
  id: string;
  name: string;
  items: NavItem[];
}

interface Story {
  id: string;
  title: string;
  trigger: string;
  characters: { name: string; icon: string; description: string }[];
  steps: {
    step: number;
    who: string;
    does: string;
    analogy: string;
    whats_happening: string;
    data_snapshot: string;
    source_hint: string;
  }[];
  key_insight: string;
}

interface Module {
  id: string;
  name: string;
  icon: string;
  one_line: string;
  responsibilities: string[];
  not_responsible_for: string[];
  analogy: string;
  depends_on: string[];
}

interface DataObject {
  id: string;
  name: string;
  nickname: string;
  what_is_it: string;
  looks_like: Record<string, any>;
  real_example: Record<string, any>;
  where_born: string;
  where_dies: string;
  travels_through: string[];
  gotchas: string[];
}

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:8080';

export function Study2Page() {
  const [categories, setCategories] = useState<NavCategory[]>([]);
  const [selectedItem, setSelectedItem] = useState<{ type: string; id: string } | null>(null);
  const [story, setStory] = useState<Story | null>(null);
  const [module, setModule] = useState<Module | null>(null);
  const [dataObj, setDataObj] = useState<DataObject | null>(null);
  const [loading, setLoading] = useState(false);

  // Load navigation
  useEffect(() => {
    fetch(`${API_BASE}/api/study2/nav`)
      .then(res => res.json())
      .then(data => setCategories(data.categories || []))
      .catch(console.error);
  }, []);

  // Load selected content
  useEffect(() => {
    if (!selectedItem) {
      setStory(null);
      setModule(null);
      setDataObj(null);
      return;
    }

    setLoading(true);
    const { type, id } = selectedItem;

    if (type === 'story') {
      fetch(`${API_BASE}/api/study2/stories/${id}`)
        .then(res => res.json())
        .then(data => {
          setStory(data);
          setModule(null);
          setDataObj(null);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else if (type === 'module') {
      fetch(`${API_BASE}/api/study2/architecture/modules/${id}`)
        .then(res => res.json())
        .then(data => {
          setModule(data);
          setStory(null);
          setDataObj(null);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else if (type === 'data') {
      fetch(`${API_BASE}/api/study2/interfaces/data/${id}`)
        .then(res => res.json())
        .then(data => {
          setDataObj(data);
          setStory(null);
          setModule(null);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [selectedItem]);

  const handleItemClick = (item: NavItem) => {
    let type = 'story';
    if (item.module) type = 'module';
    else if (item.data) type = 'data';
    else if (item.story) type = 'story';
    
    setSelectedItem({ type, id: item.story || item.module || item.data || item.id });
  };

  const renderNavItem = (item: NavItem) => (
    <button
      key={item.id}
      onClick={() => handleItemClick(item)}
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
      {item.name}
    </button>
  );

  const renderStory = (story: Story) => (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ color: '#fff', fontSize: '28px', marginBottom: '8px' }}>
          📖 {story.title}
        </h1>
        <div style={{ color: '#64748b', fontSize: '14px' }}>
          <strong style={{ color: '#94a3b8' }}>触发场景：</strong>{story.trigger}
        </div>
      </div>

      {/* Characters */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px', textTransform: 'uppercase' }}>
          👥 角色
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          {story.characters?.map((char, i) => (
            <div key={i} style={{ 
              background: '#1e293b', 
              padding: '12px 16px', 
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '24px' }}>{char.icon}</span>
              <div>
                <div style={{ color: '#fff', fontWeight: 'bold' }}>{char.name}</div>
                <div style={{ color: '#64748b', fontSize: '12px' }}>{char.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Steps Timeline */}
      <div style={{ position: 'relative' }}>
        {/* Vertical line */}
        <div style={{ 
          position: 'absolute', 
          left: '20px', 
          top: 0, 
          bottom: 0, 
          width: '2px', 
          background: '#334155' 
        }} />
        
        {story.steps?.map((step, i) => (
          <div key={i} style={{ 
            position: 'relative', 
            paddingLeft: '60px', 
            marginBottom: '32px' 
          }}>
            {/* Step number circle */}
            <div style={{ 
              position: 'absolute', 
              left: '8px', 
              top: '0',
              width: '24px', 
              height: '24px', 
              borderRadius: '50%',
              background: '#4F46E5',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              {step.step}
            </div>

            {/* Step content */}
            <div style={{ background: '#0f172a', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <span style={{ color: '#4F46E5', fontWeight: 'bold' }}>{step.who}</span>
                <span style={{ color: '#fff' }}>{step.does}</span>
              </div>
              
              {/* Analogy - highlighted */}
              <div style={{ 
                background: '#1e3a5f', 
                borderLeft: '3px solid #3b82f6',
                padding: '12px 16px',
                borderRadius: '0 8px 8px 0',
                marginBottom: '16px'
              }}>
                <div style={{ color: '#93c5fd', fontSize: '12px', marginBottom: '4px' }}>💡 比喻</div>
                <div style={{ color: '#bfdbfe' }}>{step.analogy}</div>
              </div>

              {/* What's happening */}
              <p style={{ color: '#94a3b8', marginBottom: '16px', lineHeight: '1.6' }}>
                {step.whats_happening}
              </p>

              {/* Data snapshot */}
              <div style={{ 
                background: '#0d1117', 
                border: '1px solid #30363d',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '12px'
              }}>
                <div style={{ color: '#7ee787', fontSize: '12px', marginBottom: '8px' }}>📦 数据快照</div>
                <pre style={{ 
                  color: '#c9d1d9', 
                  fontSize: '12px', 
                  fontFamily: 'monospace',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  overflow: 'auto'
                }}>
                  {step.data_snapshot}
                </pre>
              </div>

              {/* Source hint */}
              <div style={{ color: '#64748b', fontSize: '12px' }}>
                🔍 {step.source_hint}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Key Insight */}
      <div style={{ 
        background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
        borderRadius: '12px',
        padding: '24px',
        marginTop: '32px'
      }}>
        <div style={{ color: '#fbbf24', fontSize: '14px', marginBottom: '8px', fontWeight: 'bold' }}>
          🎯 核心洞察
        </div>
        <div style={{ color: '#fff', fontSize: '16px', lineHeight: '1.6' }}>
          {story.key_insight}
        </div>
      </div>
    </div>
  );

  const renderModuleCard = (mod: Module) => (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ color: '#fff', fontSize: '28px', marginBottom: '8px' }}>
        {mod.icon} {mod.name}
      </h1>
      <p style={{ color: '#94a3b8', fontSize: '18px', marginBottom: '32px' }}>
        {mod.one_line}
      </p>

      {/* Responsibilities */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ color: '#4ade80', fontSize: '14px', marginBottom: '16px', textTransform: 'uppercase' }}>
          ✅ 负责什么
        </h3>
        <ul style={{ color: '#fff', paddingLeft: '20px' }}>
          {mod.responsibilities?.map((r, i) => (
            <li key={i} style={{ marginBottom: '8px' }}>{r}</li>
          ))}
        </ul>
      </div>

      {/* Not Responsible For */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ color: '#f87171', fontSize: '14px', marginBottom: '16px', textTransform: 'uppercase' }}>
          ❌ 不负责什么
        </h3>
        <ul style={{ color: '#94a3b8', paddingLeft: '20px' }}>
          {mod.not_responsible_for?.map((r, i) => (
            <li key={i} style={{ marginBottom: '8px' }}>{r}</li>
          ))}
        </ul>
      </div>

      {/* Analogy */}
      <div style={{ 
        background: '#1e293b', 
        borderRadius: '12px', 
        padding: '20px',
        marginBottom: '32px'
      }}>
        <div style={{ color: '#fbbf24', fontSize: '14px', marginBottom: '8px' }}>💡 类比</div>
        <div style={{ color: '#fff', lineHeight: '1.6' }}>{mod.analogy}</div>
      </div>

      {/* Dependencies */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ background: '#0f172a', padding: '16px', borderRadius: '8px' }}>
          <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px' }}>依赖</div>
          <div style={{ color: '#fff' }}>{(mod.depends_on || []).join(', ')}</div>
        </div>
        <div style={{ background: '#0f172a', padding: '16px', borderRadius: '8px' }}>
          <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px' }}>被依赖</div>
          <div style={{ color: '#fff' }}>{(mod.depended_by || []).join(', ')}</div>
        </div>
      </div>
    </div>
  );

  const renderDataPassport = (obj: DataObject) => (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ color: '#fff', fontSize: '28px', marginBottom: '8px' }}>
        📋 {obj.name}
      </h1>
      <p style={{ color: '#94a3b8', fontSize: '16px', marginBottom: '32px' }}>
        {obj.nickname} — {obj.what_is_it}
      </p>

      {/* Looks Like */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px', textTransform: 'uppercase' }}>
          📝 结构
        </h3>
        <pre style={{ 
          background: '#0d1117', 
          border: '1px solid #30363d',
          borderRadius: '8px', 
          padding: '16px',
          color: '#c9d1d9',
          fontSize: '13px',
          fontFamily: 'monospace',
          overflow: 'auto'
        }}>
          {JSON.stringify(obj.looks_like, null, 2)}
        </pre>
      </div>

      {/* Real Example */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px', textTransform: 'uppercase' }}>
          🔍 真实样本
        </h3>
        <pre style={{ 
          background: '#0d1117', 
          border: '1px solid #30363d',
          borderRadius: '8px', 
          padding: '16px',
          color: '#7ee787',
          fontSize: '13px',
          fontFamily: 'monospace',
          overflow: 'auto'
        }}>
          {JSON.stringify(obj.real_example, null, 2)}
        </pre>
      </div>

      {/* Journey */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px', textTransform: 'uppercase' }}>
          🚂 旅程
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {obj.travels_through?.map((step, i) => (
            <React.Fragment key={i}>
              <span style={{ background: '#1e293b', padding: '8px 12px', borderRadius: '6px', color: '#fff', fontSize: '13px' }}>
                {step}
              </span>
              {i < (obj.travels_through?.length || 0) - 1 && <span style={{ color: '#64748b' }}>→</span>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Gotchas */}
      <div style={{ background: '#2d1f1f', borderRadius: '12px', padding: '20px' }}>
        <h3 style={{ color: '#f87171', fontSize: '14px', marginBottom: '16px' }}>
          ⚠️ 容易出错的地方
        </h3>
        <ul style={{ color: '#fca5a5', paddingLeft: '20px' }}>
          {obj.gotchas?.map((g, i) => (
            <li key={i} style={{ marginBottom: '8px' }}>{g}</li>
          ))}
        </ul>
      </div>
    </div>
  );

  const renderWelcome = () => (
    <div style={{ textAlign: 'center', padding: '100px 40px' }}>
      <div style={{ fontSize: '64px', marginBottom: '24px' }}>📚</div>
      <h1 style={{ color: '#fff', fontSize: '32px', marginBottom: '16px' }}>
        OpenClaw 学习中心
      </h1>
      <p style={{ color: '#94a3b8', fontSize: '18px', marginBottom: '32px', maxWidth: '600px', margin: '0 auto 32px' }}>
        通过故事、比喻和动手实验，深入理解 OpenClaw 的内部工作原理
      </p>
      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <a href="/study" style={{ 
          background: '#1e293b', 
          padding: '12px 24px', 
          borderRadius: '8px', 
          color: '#fff',
          textDecoration: 'none'
        }}>
          📊 Study 1 — 流程图
        </a>
        <button style={{ 
          background: '#4F46E5', 
          padding: '12px 24px', 
          borderRadius: '8px', 
          color: '#fff',
          border: 'none',
          cursor: 'pointer'
        }}>
          🚀 开始学习
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0d1117' }}>
      {/* Left Sidebar */}
      <div style={{ 
        width: '280px', 
        background: '#0f172a', 
        borderRight: '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #1e293b' }}>
          <h2 style={{ color: '#fff', margin: '0', fontSize: '18px' }}>
            📚 Study 2
          </h2>
          <p style={{ color: '#64748b', fontSize: '12px', margin: '8px 0 0' }}>
            叙事学习系统
          </p>
        </div>
        
        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
          {categories.map(cat => (
            <div key={cat.id} style={{ marginBottom: '20px' }}>
              <div style={{ 
                color: '#94a3b8', 
                fontSize: '11px', 
                fontWeight: 'bold',
                marginBottom: '8px',
                textTransform: 'uppercase'
              }}>
                {cat.name}
              </div>
              {cat.items.map(renderNavItem)}
            </div>
          ))}
        </div>

        <div style={{ padding: '16px', borderTop: '1px solid #1e293b' }}>
          <a href="/study" style={{ color: '#64748b', fontSize: '12px', textDecoration: 'none' }}>
            ← Study 1: 流程图
          </a>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
        {loading ? (
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: '100px' }}>
            Loading...
          </div>
        ) : story ? (
          renderStory(story)
        ) : module ? (
          renderModuleCard(module)
        ) : dataObj ? (
          renderDataPassport(dataObj)
        ) : (
          renderWelcome()
        )}
      </div>
    </div>
  );
}

export default Study2Page;
