/**
 * AlertOverlay.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Tiered intervention overlay positioned absolutely over the Fiverr chat window.
 *
 * Score ranges:
 *   Clear     70–100 → No overlay (silent mode)
 *   Advisory  40–69  → Yellow slide-in banner — "This conversation shows moderate risk signals"
 *   High-risk  0–39  → Red rising modal blocking chat input — "High-risk conversation detected"
 *
 * Override + Report feedback is POSTed to /api/feedback with:
 *   { action: "override" | "false_positive", message_id, trust_score, timestamp }
 */

import React, { useState, useCallback } from 'react';
import {
  IconShieldOff,
  IconAlertTriangle,
  IconX,
  IconSend,
  IconFlag,
} from '@tabler/icons-react';
import type { ThreatLevel } from '../types';

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface OverridePayload {
  action: 'override' | 'false_positive';
  message_id: string;
  trust_score: number;
  timestamp: string;
}

export interface AlertOverlayProps {
  score: number;
  level: ThreatLevel;
  messageId?: string;
  onDismiss?: () => void;
  onFeedbackSent?: (payload: OverridePayload) => void;
}

// ─── Feedback API ─────────────────────────────────────────────────────────────

const BACKEND_BASE = 'http://127.0.0.1:8000';

async function postFeedback(payload: OverridePayload): Promise<void> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        analysis_id: payload.message_id,
        user_feedback: payload.action,
        was_accurate: false,
        additional_context: {
          action: payload.action,
          message_id: payload.message_id,
          trust_score: payload.trust_score,
          timestamp: payload.timestamp,
        },
      }),
    });
    console.info('[ShadowSense] ✓ Feedback received by backend — status', res.status, payload);
  } catch (err) {
    // Graceful offline handling — log only, never crash
    console.warn('[ShadowSense] Feedback POST failed (offline?):', err);
  }
}

// ─── Advisory Banner (score 40–69) ────────────────────────────────────────────

const AdvisoryBanner: React.FC<{
  score: number;
  messageId: string;
  onDismiss: () => void;
  onFeedbackSent: (p: OverridePayload) => void;
}> = ({ score, messageId, onDismiss, onFeedbackSent }) => {
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const handleFalsePositive = useCallback(async () => {
    setSending(true);
    const payload: OverridePayload = {
      action: 'false_positive',
      message_id: messageId,
      trust_score: score,
      timestamp: new Date().toISOString(),
    };
    await postFeedback(payload);
    onFeedbackSent(payload);
    setSending(false);
    setDone(true);
    setTimeout(onDismiss, 600);
  }, [score, messageId, onDismiss, onFeedbackSent]);

  if (done) return null;

  return (
    <div
      className="alert-overlay-advisory"
      role="alert"
      aria-live="polite"
      aria-label="Advisory warning"
    >
      {/* Left accent bar */}
      <div className="advisory-accent-bar" />

      {/* Icon */}
      <div className="advisory-icon-wrap" aria-hidden="true">
        <IconAlertTriangle size={15} strokeWidth={2.2} color="#854f0b" />
      </div>

      {/* Text */}
      <div className="advisory-text">
        <span className="advisory-eyebrow">Advisory Warning</span>
        <p className="advisory-message">
          This conversation shows moderate risk signals
        </p>
      </div>

      {/* Actions */}
      <div className="advisory-actions">
        <button
          id="btn-report-false-positive"
          className="ao-btn ao-btn-ghost"
          onClick={handleFalsePositive}
          disabled={sending}
          aria-label="Report as false positive"
          title="Report False Positive"
        >
          {sending ? (
            <span className="ao-spinner" aria-hidden="true">⟳</span>
          ) : (
            <>
              <IconFlag size={11} strokeWidth={2} />
              <span>Report False Positive</span>
            </>
          )}
        </button>

        <button
          id="btn-advisory-dismiss"
          className="ao-btn ao-btn-icon"
          onClick={onDismiss}
          aria-label="Dismiss advisory banner"
        >
          <IconX size={12} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};

// ─── High-Risk Modal (score 0–39) ─────────────────────────────────────────────

const HighRiskModal: React.FC<{
  score: number;
  messageId: string;
  onDismiss: () => void;
  onFeedbackSent: (p: OverridePayload) => void;
}> = ({ score, messageId, onDismiss, onFeedbackSent }) => {
  const [sending, setSending] = useState(false);
  const [overridden, setOverridden] = useState(false);

  const handleOverride = useCallback(async () => {
    setSending(true);
    const payload: OverridePayload = {
      action: 'override',
      message_id: messageId,
      trust_score: score,
      timestamp: new Date().toISOString(),
    };
    // Log action to console per spec
    console.log('[ShadowSense] Override action logged:', {
      action: 'override',
      message_id: messageId,
      trust_score: score,
    });
    await postFeedback(payload);
    onFeedbackSent(payload);
    setSending(false);
    setOverridden(true);
    // Dismiss after short confirmation flash
    setTimeout(onDismiss, 500);
  }, [score, messageId, onDismiss, onFeedbackSent]);

  if (overridden) return null;

  return (
    <>
      {/* Blurred backdrop — blocks interaction with chat input below */}
      <div
        className="ao-backdrop"
        role="presentation"
        aria-hidden="true"
      />

      {/* Modal card */}
      <div
        className="ao-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ao-modal-title"
        aria-describedby="ao-modal-desc"
      >
        {/* Pulsing shield icon */}
        <div className="ao-modal-icon-ring" aria-hidden="true">
          <div className="ao-modal-icon-pulse" />
          <div className="ao-modal-icon-inner">
            <IconShieldOff size={26} strokeWidth={1.8} color="#e24b4a" />
          </div>
        </div>

        <h2 id="ao-modal-title" className="ao-modal-title">
          High-risk Conversation Detected
        </h2>

        <p id="ao-modal-desc" className="ao-modal-body">
          ShadowSense has blocked your reply. This conversation exhibits
          patterns associated with fraud or social engineering.
        </p>

        {/* Score badge */}
        <div className="ao-modal-score" aria-label={`Trust score: ${score} out of 100`}>
          <span className="ao-modal-score-num">{score}</span>
          <span className="ao-modal-score-slash">/ 100</span>
          <span className="ao-modal-score-label">Trust Score</span>
        </div>

        {/* Primary CTA */}
        <button
          id="btn-override-continue"
          className="ao-btn ao-btn-override"
          onClick={handleOverride}
          disabled={sending}
          aria-busy={sending}
        >
          {sending ? (
            <>
              <span className="ao-spinner" aria-hidden="true">⟳</span>
              <span>Sending feedback…</span>
            </>
          ) : (
            <>
              <IconSend size={13} strokeWidth={2} />
              <span>Override + Continue</span>
            </>
          )}
        </button>

        <p className="ao-modal-disclaimer" role="note">
          Clicking Override logs this decision to the ShadowSense feedback system
          to help improve detection accuracy.
        </p>
      </div>
    </>
  );
};

// ─── Main export ──────────────────────────────────────────────────────────────

export const AlertOverlay: React.FC<AlertOverlayProps> = ({
  score,
  level,
  messageId = 'unknown',
  onDismiss = () => {},
  onFeedbackSent = () => {},
}) => {
  // Clear (70–100): silent mode, no overlay rendered
  if (level === 'clear') return null;

  if (level === 'advisory') {
    return (
      <AdvisoryBanner
        score={score}
        messageId={messageId}
        onDismiss={onDismiss}
        onFeedbackSent={onFeedbackSent}
      />
    );
  }

  // High-risk (0–39)
  return (
    <HighRiskModal
      score={score}
      messageId={messageId}
      onDismiss={onDismiss}
      onFeedbackSent={onFeedbackSent}
    />
  );
};

export default AlertOverlay;
