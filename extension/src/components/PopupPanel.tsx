import React, { useState, useEffect } from 'react';
import { TrustGauge }            from './TrustGauge';
import { AgentChips }            from './AgentChips';
import { SafeResponse }          from './SafeResponse';
import { SafeResponseTemplates } from './SafeResponseTemplates';
import { ActionButtons }         from './ActionButtons';
import { AlertOverlay }          from './AlertOverlay';
import { DefenseNarrative }      from './DefenseNarrative';
import {
  IconShieldCheck,
  IconWifiOff,
  IconRadar,
} from '@tabler/icons-react';
import type { SimulationState } from '../types';
import { getStatusLabel, getSuggestedTemplates } from '../types';
import type { OverridePayload } from './AlertOverlay';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PopupPanelProps {
  state: SimulationState;
  messageId?: string;
  platform?: 'fiverr' | 'upwork';
  /** True when no analysis has been performed yet in this session. */
  noScanYet?: boolean;
  /** True when the /health ping to the backend failed. */
  backendOffline?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGaugeCardBg(level: string): string {
  switch (level) {
    case 'high-risk': return 'var(--color-risk-bg)';
    case 'advisory':  return 'var(--color-warn-bg)';
    case 'clear':     return 'var(--color-clear-bg)';
    default:          return 'transparent';
  }
}

function getPillClass(level: string): string {
  switch (level) {
    case 'high-risk': return 'pill pill-red';
    case 'advisory':  return 'pill pill-amber';
    case 'clear':     return 'pill pill-green';
    default:          return 'pill pill-purple';
  }
}

function getBorderColor(level: string): string {
  switch (level) {
    case 'high-risk': return 'var(--color-risk-primary)';
    case 'advisory':  return 'var(--color-warn-primary)';
    case 'clear':     return 'var(--color-clear-primary)';
    default:          return 'var(--color-border-primary)';
  }
}

// ─── Session-scoped dismiss persistence ──────────────────────────────────────

const DISMISSED_KEY = 'ss_dismissed_overlays';

function isDismissedInSession(messageId: string): boolean {
  try {
    const raw = sessionStorage.getItem(DISMISSED_KEY);
    const set: string[] = raw ? JSON.parse(raw) : [];
    return set.includes(messageId);
  } catch {
    return false;
  }
}

function markDismissedInSession(messageId: string): void {
  try {
    const raw = sessionStorage.getItem(DISMISSED_KEY);
    const set: string[] = raw ? JSON.parse(raw) : [];
    if (!set.includes(messageId)) {
      set.push(messageId);
      sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(set));
    }
  } catch {
    // sessionStorage unavailable in some extension contexts — fail silently
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Shown when no message has been scanned yet. */
const NoScanYetState: React.FC<{ platform: 'fiverr' | 'upwork' }> = ({ platform }) => (
  <div className="no-scan-state">
    <div className="no-scan-icon-ring" aria-hidden="true">
      <IconRadar size={28} strokeWidth={1.5} color="var(--color-accent-light)" />
    </div>
    <p className="no-scan-title">Waiting for messages…</p>
    <p className="no-scan-body">
      Open a conversation on{' '}
      <strong>{platform === 'upwork' ? 'Upwork' : 'Fiverr'}</strong> and ShadowSense
      will automatically scan incoming messages for scam signals.
    </p>
  </div>
);

/** Shown when the /health ping failed. */
const OfflineBanner: React.FC = () => (
  <div className="offline-banner" role="alert" aria-live="polite">
    <IconWifiOff size={13} strokeWidth={2} aria-hidden="true" />
    <span>Backend offline — start the ShadowSense server on port 8000</span>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const PopupPanel: React.FC<PopupPanelProps> = ({
  state,
  messageId = 'fiverr-msg-001',
  platform  = 'fiverr',
  noScanYet     = false,
  backendOffline = false,
}) => {
  const { score, level, agents, reasons, suggestedResponse, isStreaming } = state;

  // Persist dismiss so reopening the popup doesn't re-show the overlay
  const [overlayDismissed, setOverlayDismissed] = useState(
    () => isDismissedInSession(messageId)
  );

  // Re-evaluate when messageId changes (new message → show overlay again)
  useEffect(() => {
    setOverlayDismissed(isDismissedInSession(messageId));
  }, [messageId]);

  const handleDismiss = () => {
    markDismissedInSession(messageId);
    setOverlayDismissed(true);
  };

  const handleFeedbackSent = (payload: OverridePayload) => {
    console.log('[ShadowSense] PopupPanel ← feedback event:', payload);
  };

  const templates = state.suggestedTemplates.length > 0
    ? state.suggestedTemplates
    : getSuggestedTemplates(level, platform);

  return (
    <div
      className="ext-popup"
      style={{
        borderColor: isStreaming
          ? 'var(--color-accent-light)'
          : getBorderColor(level),
        transition:  'border-color 0.3s ease',
        position:    'relative',
        overflow:    'visible',
      }}
    >
      {/* ─── AlertOverlay: absolute over popup (advisory banner or high-risk modal) ─ */}
      {!noScanYet && !overlayDismissed && !isStreaming && (
        <AlertOverlay
          score={score}
          level={level}
          messageId={messageId}
          onDismiss={handleDismiss}
          onFeedbackSent={handleFeedbackSent}
        />
      )}

      {/* ─── Offline banner ── */}
      {backendOffline && <OfflineBanner />}

      {/* ─── Header ── */}
      <div className="ext-header">
        <div className="ext-brand">
          <div className="brand-logo-wrap">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="shieldGradPanel" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%"   stopColor="#7b61ff" />
                  <stop offset="100%" stopColor="#4ecdc4" />
                </linearGradient>
              </defs>
              <path
                d="M16 6L8 9V15C8 20.3 11.4 25.2 16 26.5C20.6 25.2 24 20.3 24 15V9L16 6Z"
                stroke="url(#shieldGradPanel)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M13.5 11.5C14.5 10.5 17.5 10.5 18.5 12.5C18.5 14.5 13.5 14.5 13.5 16.5C13.5 18.5 16.5 19.5 18.5 18.5"
                stroke="#ffffff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <div className="ext-brand-title">ShadowSense AI</div>
            <div className="ext-brand-status">
              <span className={`status-dot${isStreaming ? ' pulsing' : ''}`} />
              <span>
                {isStreaming
                  ? 'Scanning message stream…'
                  : noScanYet
                  ? 'Monitoring active'
                  : `Active on ${platform === 'upwork' ? 'Upwork' : 'Fiverr'}`}
              </span>
            </div>
          </div>
        </div>
        {/* Shield icon showing scan status */}
        <div aria-label="Extension active" title="ShadowSense active">
          <IconShieldCheck
            size={18}
            strokeWidth={1.8}
            color={noScanYet ? 'var(--color-text-tertiary)' : 'var(--color-clear-primary)'}
          />
        </div>
      </div>

      {/* ─── No scan yet: show friendly empty state ── */}
      {noScanYet ? (
        <NoScanYetState platform={platform} />
      ) : (
        <>
          {/* ─── Gauge Card ── */}
          <div
            className="gauge-card"
            style={{
              backgroundColor: isStreaming ? 'transparent' : getGaugeCardBg(level),
              transition:       'background-color 0.3s ease',
            }}
          >
            <div className="gauge-row">
              <TrustGauge score={score} level={level} isStreaming={isStreaming} />
              <div className="gauge-info">
                <div className="gauge-title">Client Trust Score</div>
                <div className="gauge-badge-row">
                  <span className="gauge-score-large">
                    {isStreaming ? '--' : score}
                  </span>
                  <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>
                    / 100
                  </span>
                </div>
                <span className={isStreaming ? 'pill pill-purple' : getPillClass(level)}>
                  {isStreaming ? 'Orchestrating…' : getStatusLabel(level)}
                </span>
              </div>
            </div>

            {/* ─── DefenseNarrative — "Why this score?" ── */}
            <DefenseNarrative
              reasons={reasons}
              level={level}
              score={score}
              isStreaming={isStreaming}
              defaultExpanded={level === 'high-risk'}
            />
          </div>

          {/* ─── Agent Chips ── */}
          <AgentChips agents={agents} />

          {/* ─── Suggested Response (primary) ── */}
          <SafeResponse text={suggestedResponse} />

          {/* ─── Response Templates (high-risk / advisory, click-to-copy) ── */}
          {!isStreaming && templates.length > 0 && (
            <SafeResponseTemplates templates={templates} level={level} />
          )}

          {/* ─── Action Buttons (Override / Report) ── */}
          <ActionButtons
            level={level}
            score={score}
            messageId={messageId}
            onOverride={handleDismiss}
          />
        </>
      )}
    </div>
  );
};
