import React from 'react';
import {
  IconShieldLock,
  IconAlertCircle,
  IconShieldCheck,
  IconLoader,
} from '@tabler/icons-react';
import type { ThreatLevel } from '../types';

interface ChatSimulationProps {
  score: number;
  level: ThreatLevel;
  isStreaming?: boolean;
}

const HighRiskIntervention: React.FC<{ score: number }> = ({ score }) => (
  <div className="intervention-wrapper">
    <div className="intervention-banner">
      <div className="intervention-banner-left">
        <IconShieldLock size={14} />
        <span>ShadowSense Agentic Shield Active</span>
      </div>
      <span className="text-mono" style={{ fontSize: 9 }}>Blocked</span>
    </div>
    <div className="intervention-body">
      <div className="intervention-title">Shield Block Applied (Trust Score: {score})</div>
      <div className="intervention-desc">
        This buyer demonstrates patterns matching session-credential theft. We have flagged a file mismatch.
      </div>
      <div className="intervention-actions">
        <button className="inter-btn-white">Report Scam</button>
        <button className="inter-btn-accent">Bypass Warning</button>
      </div>
    </div>
  </div>
);

const AdvisoryIntervention: React.FC = () => (
  <div
    className="intervention-wrapper"
    style={{ background: '#fffcfa', borderColor: 'var(--color-warn-primary)' }}
  >
    <div className="intervention-banner" style={{ background: 'var(--color-warn-primary)' }}>
      <div className="intervention-banner-left">
        <IconAlertCircle size={14} />
        <span>ShadowSense Advisory Active</span>
      </div>
      <span className="text-mono" style={{ fontSize: 9, cursor: 'pointer' }}>Dismiss ×</span>
    </div>
    <div className="intervention-body">
      <div className="intervention-desc" style={{ color: '#633e14', marginBottom: 0 }}>
        <b>Caution:</b> This client is requesting communication movement. Keeping channels on-platform ensures terms enforcement.
      </div>
    </div>
  </div>
);

const ClearBadge: React.FC<{ score: number }> = ({ score }) => (
  <div className="floating-mini-badge">
    <IconShieldCheck size={14} />
    <span>ShadowSense Checked: Safe Client ({score}/100)</span>
  </div>
);

const StreamingBadge: React.FC = () => (
  <div
    className="floating-mini-badge"
    style={{ background: '#eeedfe', borderColor: '#7b61ff55', color: '#3c3489' }}
  >
    <IconLoader size={14} className="spin-icon" />
    <span>ShadowSense Multi-Agent Consensus Stream Active...</span>
  </div>
);

export const ChatSimulation: React.FC<ChatSimulationProps> = ({ score, level, isStreaming }) => {
  return (
    <div className="phone-mockup">
      <div className="phone-browser-bar">
        <div className="phone-window-dots">
          <div className="dot-node red" />
          <div className="dot-node yellow" />
          <div className="dot-node green" />
        </div>
        <div className="browser-url-input">
          <IconShieldCheck size={12} style={{ color: '#1dbf73' }} />
          https://www.fiverr.com/inbox/scam_tester_client
        </div>
      </div>

      <div className="chat-space">
        <div className="chat-bubble bubble-inbound">
          Hello, I saw your Fiverr profile and want to hire you immediately for high-paying recurring design projects.
        </div>

        {/* Dynamic intervention based on state */}
        {isStreaming ? (
          <StreamingBadge />
        ) : level === 'high-risk' ? (
          <HighRiskIntervention score={score} />
        ) : level === 'advisory' ? (
          <AdvisoryIntervention />
        ) : (
          <ClearBadge score={score} />
        )}

        {level !== 'clear' && !isStreaming && (
          <div className="chat-bubble bubble-inbound">
            Please download this brief as soon as possible. We need to finish this within 3 hours or I'll pick another candidate: logo_brief.zip
          </div>
        )}

        <div className="chat-bubble bubble-outbound">
          {level === 'high-risk'
            ? 'Thank you for the message. I will review the documents and let you know!'
            : level === 'advisory'
            ? "I prefer to keep all chats within Fiverr. Happy to continue here!"
            : "Thanks! Would love to hear more about it. Please share the brief whenever ready."}
        </div>
      </div>
    </div>
  );
};
