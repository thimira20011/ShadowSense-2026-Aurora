import React, { useState } from 'react';
import { IconSend, IconFlag } from '@tabler/icons-react';
import type { ThreatLevel } from '../types';
import type { OverridePayload } from './AlertOverlay';

interface ActionButtonsProps {
  level: ThreatLevel;
  score?: number;
  messageId?: string;
  /** Called after the user successfully overrides */
  onOverride?: () => void;
}

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
    console.info('[ShadowSense] ActionButtons feedback sent — HTTP', res.status, payload);
  } catch (err) {
    console.warn('[ShadowSense] Feedback POST failed (offline?):', err);
  }
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  level,
  score = 22,
  messageId = 'unknown',
  onOverride,
}) => {
  const [overrideSent, setOverrideSent]     = useState(false);
  const [reportSent, setReportSent]         = useState(false);
  const [sendingOver, setSendingOver]       = useState(false);
  const [sendingReport, setSendingReport]   = useState(false);

  if (level === 'clear') return null;

  /* ── Override / Dismiss ── */
  const handleOverride = async () => {
    setSendingOver(true);
    const payload: OverridePayload = {
      action: 'override',
      message_id: messageId,
      trust_score: score,
      timestamp: new Date().toISOString(),
    };
    // Log per spec: {action: "override", message_id: "...", trust_score: 22}
    console.log('[ShadowSense] Override action:', {
      action: payload.action,
      message_id: payload.message_id,
      trust_score: payload.trust_score,
    });
    await postFeedback(payload);
    setSendingOver(false);
    setOverrideSent(true);
    onOverride?.();
  };

  /* ── Report False Positive ── */
  const handleReport = async () => {
    setSendingReport(true);
    const payload: OverridePayload = {
      action: 'false_positive',
      message_id: messageId,
      trust_score: score,
      timestamp: new Date().toISOString(),
    };
    console.log('[ShadowSense] False positive reported:', {
      action: payload.action,
      message_id: payload.message_id,
      trust_score: payload.trust_score,
    });
    await postFeedback(payload);
    setSendingReport(false);
    setReportSent(true);
  };

  const isHighRisk    = level === 'high-risk';
  const overrideLabel = isHighRisk ? 'Override + Continue' : 'Dismiss Warning';
  const reportLabel   = isHighRisk ? 'Report Client' : 'Report False Positive';
  const reportClass   = isHighRisk ? 'action-btn-danger' : 'action-btn-warn';

  return (
    <div className="popup-actions">
      {/* Override / Dismiss */}
      <button
        id="btn-action-override"
        className="action-btn-primary"
        onClick={handleOverride}
        disabled={sendingOver || overrideSent}
        aria-busy={sendingOver}
        title={overrideLabel}
        style={{ cursor: overrideSent ? 'default' : 'pointer' }}
      >
        {sendingOver ? (
          <span className="ao-spinner" aria-hidden="true">⟳</span>
        ) : overrideSent ? (
          '✓ Done'
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
