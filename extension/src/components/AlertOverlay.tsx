/**
 * AlertOverlay.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Tiered intervention overlay positioned inside the popup panel.
 *
 * Score ranges (synced with backend ShieldAgent._classify()):
 *   Clear     70–100 → No overlay (silent mode)
 *   Advisory  30–69  → Amber slide-in banner
 *   High-risk  0–29  → Red rising modal blocking chat input
 *
 * Override flow:
 *   POST /api/feedback/override  →  triggers ChromaDB benign-pattern learning
 *   { analysis_id, pattern_text, trust_score }
 *
 * False-positive flow:
 *   POST /api/feedback/  →  general accuracy log (no ML effect)
 *   { analysis_id, user_feedback: "false_positive", was_accurate: false }
 *
 * Popup pages have host_permissions for http://localhost:8000/* so direct
 * fetch() calls are permitted here.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  IconShieldOff,
  IconAlertTriangle,
  IconX,
  IconSend,
  IconFlag,
  IconRefresh,
} from '@tabler/icons-react';
import type { ThreatLevel } from '../types';

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface OverridePayload {
  action:      'override' | 'false_positive';
  message_id:  string;
  trust_score: number;
  timestamp:   string;
}

export interface AlertOverlayProps {
  score:           number;
  level:           ThreatLevel;
  messageId?:      string;
  onDismiss?:      () => void;
  onFeedbackSent?: (payload: OverridePayload) => void;
}

// ─── Backend constants ────────────────────────────────────────────────────────

const BACKEND_BASE      = 'http://127.0.0.1:8000';
const FEEDBACK_TIMEOUT  = 8_000; // ms

// ─── API helpers ─────────────────────────────────────────────────────────────

/** POST to /api/feedback/override — triggers ChromaDB benign-pattern learning. */
async function postOverride(
  analysisId:  string,
  patternText: string,
  trustScore:  number
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FEEDBACK_TIMEOUT);
  try {
    const res = await fetch(`${BACKEND_BASE}/api/feedback/override`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        analysis_id:  analysisId,
        pattern_text: patternText,
        trust_score:  trustScore,
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Override API returned HTTP ${res.status}`);
    console.info('[ShadowSense] ✓ Override sent — status', res.status);
  } finally {
    clearTimeout(timer);
  }
}

/** POST to /api/feedback/ — general accuracy log (no ML side-effect). */
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
    if (!res.ok) throw new Error(`Feedback API returned HTTP ${res.status}`);
    console.info('[ShadowSense] ✓ Feedback received — status', res.status);
  } finally {
    clearTimeout(timer);
  }
}

// ─── Advisory Banner (score 30–69) ───────────────────────────────────────────

const AdvisoryBanner: React.FC<{
  score:           number;
  messageId:       string;
  onDismiss:       () => void;
  onFeedbackSent:  (p: OverridePayload) => void;
}> = ({ score, messageId, onDismiss, onFeedbackSent }) => {
  const [sending,   setSending]  = useState(false);
  const [done,      setDone]     = useState(false);
  const [hasFailed, setFailed]   = useState(false);

  const handleFalsePositive = useCallback(async () => {
    setSending(true);
    setFailed(false);
    const payload: OverridePayload = {
      action:      'false_positive',
      message_id:  messageId,
      trust_score: score,
      timestamp:   new Date().toISOString(),
    };
    try {
      await postFeedback(payload);
      onFeedbackSent(payload);
      setDone(true);
      setTimeout(onDismiss, 600);
    } catch (err) {
      console.warn('[ShadowSense] Advisory feedback failed:', err);
      setFailed(true);
    } finally {
      setSending(false);
    }
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
        {hasFailed && (
          <p className="ao-feedback-error" role="alert">
            ⚠ Feedback failed — is the backend running on port 8000?
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="advisory-actions">
        {hasFailed ? (
          <button
            id="btn-advisory-retry"
            className="ao-btn ao-btn-retry"
            onClick={handleFalsePositive}
            aria-label="Retry sending feedback"
          >
            <IconRefresh size={11} strokeWidth={2} />
            <span>Retry</span>
          </button>
        ) : (
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
        )}

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

// ─── High-Risk Modal (score 0–29) ─────────────────────────────────────────────

const HighRiskModal: React.FC<{
  score:           number;
  messageId:       string;
  onDismiss:       () => void;
  onFeedbackSent:  (p: OverridePayload) => void;
}> = ({ score, messageId, onDismiss, onFeedbackSent }) => {
  const [sending,    setSending]    = useState(false);
  const [overridden, setOverridden] = useState(false);
  const [hasFailed,  setFailed]     = useState(false);

  // Escape key closes the modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  const handleOverride = useCallback(async () => {
    setSending(true);
    setFailed(false);
    const payload: OverridePayload = {
      action:      'override',
      message_id:  messageId,
      trust_score: score,
      timestamp:   new Date().toISOString(),
    };
    try {
      // Sends override event to ChromaDB learning pipeline
      await postOverride(messageId, `override:${messageId}`, score);
      onFeedbackSent(payload);
      setOverridden(true);
      setTimeout(onDismiss, 500);
    } catch (err) {
      console.warn('[ShadowSense] Override POST failed:', err);
      setFailed(true);
    } finally {
      setSending(false);
    }
  }, [score, messageId, onDismiss, onFeedbackSent]);

  if (overridden) return null;

  return (
    <>
      {/* Blurred backdrop */}
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
          ShadowSense has flagged this conversation. It exhibits patterns
          associated with fraud or social engineering.
        </p>

        {/* Score badge */}
        <div
          className="ao-modal-score"
          aria-label={`Trust score: ${score} out of 100`}
        >
          <span className="ao-modal-score-num">{score}</span>
          <span className="ao-modal-score-slash">/ 100</span>
          <span className="ao-modal-score-label">Trust Score</span>
        </div>

        {/* Error + retry */}
        {hasFailed && (
          <p className="ao-feedback-error" role="alert">
            ⚠ Server unreachable — feedback not sent.{' '}
            <button
              className="ao-inline-retry"
              onClick={handleOverride}
              aria-label="Retry feedback submission"
            >
              Retry
            </button>
          </p>
        )}

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
          Clicking Override logs this decision to the ShadowSense feedback
          system to help improve detection accuracy.
        </p>
      </div>
    </>
  );
};

// ─── Main export ──────────────────────────────────────────────────────────────

export const AlertOverlay: React.FC<AlertOverlayProps> = ({
  score,
  level,
  messageId       = 'unknown',
  onDismiss       = () => {},
  onFeedbackSent  = () => {},
}) => {
  // Clear (70–100): silent mode
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

  // High-risk (0–29)
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
