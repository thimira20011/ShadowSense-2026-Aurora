import React from 'react';
import {
  IconFolder,
  IconGauge,
  IconBroadcast,
  IconAlertTriangle,
} from '@tabler/icons-react';

export const TechSpecCards: React.FC = () => {
  return (
    <div className="specs-grid">
      <div className="spec-card">
        <div className="spec-card-title">
          <IconFolder size={16} /> Directory Structure
        </div>
        <div className="spec-card-body">
          Configure Member 2's components exactly as follows:
          <br />
          <code>src/content/index.ts</code> — DOM Entry
          <br />
          <code>src/content/ChatOverlay.tsx</code> — Shield Injections
          <br />
          <code>src/content/JobListingBadge.tsx</code> — Pre-Engagement
          <br />
          <code>src/popup/App.tsx</code> — Popup Controller
          <br />
          <code>src/popup/TrustGauge.tsx</code> — Dynamic Gauge Circle
        </div>
      </div>

      <div className="spec-card">
        <div className="spec-card-title">
          <IconGauge size={16} /> Dynamic Circle Math
        </div>
        <div className="spec-card-body">
          To drive the SVG dashoffset smoothly, use:
          <br />
          <code>const radius = 24;</code>
          <br />
          <code>const circumference = 2 * Math.PI * radius;</code>
          <br />
          <code>const offset = circumference - (score / 100) * circumference;</code>
          <br />
          This resolves rendering inconsistencies and ensures needle transitions scale precisely.
        </div>
      </div>

      <div className="spec-card">
        <div className="spec-card-title">
          <IconBroadcast size={16} /> SSE WebSocket Contract
        </div>
        <div className="spec-card-body">
          Do not poll. Subscribe to the persistent state machine streams:
          <br />
          <code>ws://localhost:8000/api/stream</code>
          <br />
          The JSON responses should dispatch intermediate agent progress tokens immediately to
          populate individual cards.
        </div>
      </div>

      <div className="spec-card">
        <div className="spec-card-title">
          <IconAlertTriangle size={16} /> Safe Intervention Rule
        </div>
        <div className="spec-card-body">
          <b>Rule:</b> Do not intercept native Fiverr click handles directly to prevent platform bot
          flags. Wrap suspicious inputs with custom CSS position coordinates, and destroy DOM
          bindings instantly on "Override + Proceed".
        </div>
      </div>
    </div>
  );
};
