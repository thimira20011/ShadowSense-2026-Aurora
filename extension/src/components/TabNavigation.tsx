import React from 'react';

type TabId = 'workspace' | 'preengagement' | 'techspec';

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string; emoji: string }[] = [
  { id: 'workspace', label: 'Interactive Chat Simulation', emoji: '💬' },
  { id: 'preengagement', label: 'Pre-Engagement Injections', emoji: '🔍' },
  { id: 'techspec', label: 'File Structure & Technical Spec', emoji: '📐' },
];

export const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="tabs">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`tab${activeTab === tab.id ? ' active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.emoji} {tab.label}
        </button>
      ))}
    </div>
  );
};

export type { TabId };
