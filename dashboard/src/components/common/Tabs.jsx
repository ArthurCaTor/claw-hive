import React from 'react';
// Tabs component
// Tab navigation

import { useState } from 'react';

export function Tabs({ 
  tabs, 
  defaultTab, 
  onChange,
  variant = 'line'
}) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const activeContent = tabs.find((t) => t.id === activeTab)?.content;

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  };

  const tabListStyle = {
    display: 'flex',
    gap: '4px',
    borderBottom: variant === 'line' ? '1px solid #334155' : 'none',
    paddingBottom: variant === 'line' ? '0' : '8px',
    flexWrap: 'wrap',
  };

  const tabStyle = (isActive) => ({
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    borderRadius: variant === 'pills' ? '6px' : '0',
    background: variant === 'pills' && isActive ? '#3b82f6' : 'transparent',
    color: isActive ? '#fff' : '#94a3b8',
    border: 'none',
    transition: 'all 0.2s ease',
    position: 'relative',
    ...(variant === 'line' && isActive && {
      borderBottom: '2px solid #3b82f6',
      marginBottom: '-1px',
    }),
  });

  const contentStyle = {
    flex: 1,
    overflow: 'auto',
    paddingTop: '16px',
  };

  return (
    <div style={containerStyle}>
      <div style={tabListStyle}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            style={tabStyle(activeTab === tab.id)}
          >
            {tab.icon && <span style={{ marginRight: '6px' }}>{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>
      <div style={contentStyle}>
        {activeContent}
      </div>
    </div>
  );
}

export default Tabs;
