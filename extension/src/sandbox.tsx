import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { SandboxHeader } from './components/SandboxHeader';
import { SystemStateTester } from './components/SystemStateTester';
import { TabNavigation } from './components/TabNavigation';
import type { TabId } from './components/TabNavigation';
import { PopupPanel } from './components/PopupPanel';
import { ChatSimulation } from './components/ChatSimulation';
import { GigListingCards } from './components/GigListingCards';
import { TechSpecCards } from './components/TechSpecCards';
import { useSimulation } from './hooks/useSimulation';
import './styles/variables.css';
import './styles/sandbox.css';

const SandboxApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('workspace');
  const { state, updateScore, applyPreset, runLiveStream } = useSimulation(22);

  return (
    <div className="container">
      <SandboxHeader />

      <SystemStateTester
        score={state.score}
        isStreaming={state.isStreaming}
        onScoreChange={updateScore}
        onPreset={applyPreset}
        onRunStream={runLiveStream}
      />

      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab 1: Interactive Chat Simulation */}
      {activeTab === 'workspace' && (
        <div className="preview-grid">
          <div>
            <div className="block-label">
              📐 Popup UI Module (340px)
            </div>
            <PopupPanel state={state} messageId="sandbox-preview-001" />
          </div>
          <div>
            <div className="block-label">
              🌐 In-Chat Content-Script Injections (Mock Fiverr Page)
            </div>
            <ChatSimulation
              score={state.score}
              level={state.level}
              isStreaming={state.isStreaming}
            />
          </div>
        </div>
      )}

      {/* Tab 2: Pre-Engagement Injections */}
      {activeTab === 'preengagement' && <GigListingCards />}

      {/* Tab 3: File Structure & Technical Spec */}
      {activeTab === 'techspec' && <TechSpecCards />}
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <SandboxApp />
    </React.StrictMode>
  );
}
