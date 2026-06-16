import React, { useState } from 'react';
import { IconSend, IconFlag } from '@tabler/icons-react';
import type { ThreatLevel } from '../types';
import type { OverridePayload } from './AlertOverlay';

interface ActionButtonsProps {
  level:       ThreatLevel;
  score?:      number;
  messageId?:  string;
  /** Called after the user successfully overrides (dismisses the alert). */
  onOverride?: () => void;
}

const BACKEND_BASE     = 'http://127.0.0.1:8000';
const FEEDBACK_TIMEOUT = 8_000; // ms

// ─── API helpers ──────────────────────────────────────────────────────────────

/** POST to /api/feedback/override — triggers ChromaDB benign-pattern learning. */
async function postOverride(messageId: string, trustScore: number): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FEEDBACK_TIMEOUT);
  try {
    const res = await fetch(`${BACKEND_BASE}/api/feedback/override`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        analysis_id:  messageId,
        pattern_text: `override:${messageId}`,
        trust_score:  trustScore,
      }),
      signal: controller.signal,
    });
    console.info('[ShadowSense] ActionButtons override sent — HTTP', res.status);
  } finally {
    clearTimeout(timer);
  }
}

/** POST to /api/feedback/ — general accuracy log for false-positive reporting. */
async function postFeedback(payload: OverridePayload): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FEEDBACK_TIMEOUT);
  try {
    const res = await fetch(`${BACKEND_BASE}/api/feedback/`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        analysis_id:       payload.message_id,
        user_feedback:     payload.action,
        was_accurate:      false,
        additional_context: {
          action:      payload.action,
          message_id:  payload.message_id,
          trust_score: payload.trust_score,
          timestamp:   payload.timestamp,
        },
      }),
      signal: controller.signal,
    });
    console.info('[ShadowSense] ActionButtons feedback sent — HTTP', res.status);
  } finally {
    clearTimeout(timer);
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  level,
  score     = 22,
  messageId = 'unknown',
  onOverride,
}) => {
  const [overrideSent,   setOverrideSent]   = useState(false);
  const [reportSent,     setReportSent]     = useState(false);
  const [sendingOver,    setSendingOver]    = useState(false);
  const [sendingReport,  setSendingReport]  = useState(false);
  const [overrideError,  setOverrideError]  = useState(false);
  const [reportError,    setReportError]    = useState(false);

  // Don't render for clear conversations
  if (level === 'clear') return null;

  // ── Override / Dismiss ──
  const handleOverride = async () => {
    setSendingOver(true);
    setOverrideError(false);
    try {
      await postOverride(messageId, score);
      setOverrideSent(true);
      onOverride?.();
    } catch (err) {
      console.warn('[ShadowSense] Override POST failed (offline?):', err);
      setOverrideError(true);
    } finally {
      setSendingOver(false);
    }
  };

  // ── Report False Positive ──
  const handleReport = async () => {
    setSendingReport(true);
    setReportError(false);
    const payload: OverridePayload = {
      action:      'false_positive',
      message_id:  messageId,
      trust_score: score,
      timestamp:   new Date().toISOString(),
    };
    try {
      await postFeedback(payload);
      setReportSent(true);
    } catch (err) {
      console.warn('[ShadowSense] Feedback POST failed (offline?):', err);
      setReportError(true);
    } finally {
      setSendingReport(false);
    }
  };

  const isHighRisk    = level === 'high-risk';
  const overrideLabel = isHighRisk ? 'Override + Continue' : 'Dismiss Warning';
  const reportLabel   = isHighRisk ? 'Report Client'       : 'Report False Positive';
  const reportClass   = isHighRisk ? 'action-btn-danger'   : 'action-btn-warn';

  return (
    <div className="popup-actions">
      {/* Override / Dismiss */}
      <button
        id="btn-action-override"
        className="action-btn-primary"
        onClick={overrideError ? handleOverride : handleOverride}
        disabled={sendingOver || overrideSent}
        aria-busy={sendingOver}
        title={overrideLabel}
        style={{ cursor: overrideSent ? 'default' : 'pointer' }}
      >
        {sendingOver ? (
          <span className="ao-spinner" aria-hidden="true">⟳</span>
        ) : overrideSent ? (
          '✓ Done'
        ) : overrideError ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
            ⚠ Retry
          </span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
            <IconSend size={11} strokeWidth={2} aria-hidden="true" />
            {overrideLabel}
          </span>
        )}
      </button>

      {/* Report */}
      <button
        id="btn-action-report"
        className={reportClass}
        onClick={handleReport}
        disabled={sendingReport || reportSent}
        aria-busy={sendingReport}
        title={reportLabel}
        style={{ cursor: reportSent ? 'default' : 'pointer' }}
      >
        {sendingReport ? (
          <span className="ao-spinner" aria-hidden="true">⟳</span>
        ) : reportSent ? (
          '✓ Reported'
        ) : reportError ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
            ⚠ Retry
          </span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
            <IconFlag size={11} strokeWidth={2} aria-hidden="true" />
            {reportLabel}
          </span>
        )}
      </button>
    </div>
  );
};
