/**
 * DefenseNarrative.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Expandable "Why this score?" section placed below the Trust Gauge in PopupPanel.
 *
 * Features:
 *  • Click to expand / collapse (smooth max-height animation)
 *  • Bullet points from backend DefenseReason[] array
 *  • Color-coded by threat level (red / amber / green)
 *  • Auto-expands for high-risk scores
 *  • Skeleton shimmer while streaming
 */

import React, { useState } from 'react';
import {
  IconChevronDown,
  IconChevronUp,
  IconMessage2,
  IconUserX,
  IconFileAlert,
  IconCircleCheck,
  IconInfoCircle,
} from '@tabler/icons-react';
import type { DefenseReason, ThreatLevel } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DefenseNarrativeProps {
  reasons: DefenseReason[];
  level: ThreatLevel;
  score: number;
  isStreaming?: boolean;
  /** Auto-expand on mount; defaults to true for high-risk */
  defaultExpanded?: boolean;
}

// ─── Level config ─────────────────────────────────────────────────────────────

interface LevelCfg {
  accentBar: string;
  iconBg: string;
  iconColor: string;
  labelColor: string;
  headingColor: string;
  countBg: string;
  countColor: string;
}

const LEVEL_CFG: Record<ThreatLevel, LevelCfg> = {
  'high-risk': {
    accentBar:   '#e24b4a',
    iconBg:      '#fcebeb',
    iconColor:   '#a32d2d',
    labelColor:  '#a32d2d',
    headingColor:'#7f1d1d',
    countBg:     '#fcebeb',
    countColor:  '#a32d2d',
  },
  advisory: {
    accentBar:   '#ef9f27',
    iconBg:      '#faeeda',
    iconColor:   '#854f0b',
    labelColor:  '#854f0b',
    headingColor:'#78350f',
    countBg:     '#faeeda',
    countColor:  '#854f0b',
  },
  clear: {
    accentBar:   '#1d9e75',
    iconBg:      '#e1f5ee',
    iconColor:   '#0f6e56',
    labelColor:  '#0f6e56',
    headingColor:'#064e3b',
    countBg:     '#e1f5ee',
    countColor:  '#0f6e56',
  },
};

// ─── Summary sentence per level ───────────────────────────────────────────────

function getSummary(level: ThreatLevel, score: number): string {
  if (level === 'high-risk') {
    return `Score ${score}/100 — Multiple high-confidence threat signals were detected across linguistic, identity, and payload dimensions.`;
  }
  if (level === 'advisory') {
    return `Score ${score}/100 — Moderate risk signals detected. Proceed with caution and verify buyer intent.`;
  }
  return `Score ${score}/100 — No significant risk signals detected. This conversation appears legitimate.`;
}

// ─── Reason icon ─────────────────────────────────────────────────────────────

function ReasonIcon({
  type,
  level,
  cfg,
}: {
  type: DefenseReason['type'];
  level: ThreatLevel;
  cfg: LevelCfg;
}) {
  const iconProps = { size: 11, color: cfg.iconColor, strokeWidth: 2 };

  const icon =
    type === 'linguistic' && level === 'clear' ? (
      <IconCircleCheck {...iconProps} />
    ) : type === 'linguistic' ? (
      <IconMessage2 {...iconProps} />
    ) : type === 'identity' ? (
      <IconUserX {...iconProps} />
    ) : (
      <IconFileAlert {...iconProps} />
    );

  return (
    <div
      className="dn-reason-icon"
      style={{ background: cfg.iconBg }}
      aria-hidden="true"
    >
      {icon}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const DefenseNarrative: React.FC<DefenseNarrativeProps> = ({
  reasons,
  level,
  score,
  isStreaming = false,
  defaultExpanded,
}) => {
  const autoExpand = defaultExpanded ?? level === 'high-risk';
  const [expanded, setExpanded] = useState(autoExpand);
  const cfg = LEVEL_CFG[level];

  return (
    <div className="dn-box" aria-label="Defense narrative">
      {/* ── Toggle header ── */}
      <button
        id="btn-defense-narrative-toggle"
        className="dn-toggle"
        style={{ borderLeftColor: cfg.accentBar }}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="dn-body"
        type="button"
      >
        <span className="dn-toggle-left">
          <IconInfoCircle size={13} color={cfg.iconColor} strokeWidth={2} aria-hidden="true" />
          <span className="dn-toggle-label" style={{ color: cfg.headingColor }}>
            Why this score?
          </span>
          {!isStreaming && (
            <span
              className="dn-count"
              style={{ background: cfg.countBg, color: cfg.countColor }}
              aria-label={`${reasons.length} signals`}
            >
              {reasons.length} signal{reasons.length !== 1 ? 's' : ''}
            </span>
          )}
        </span>

        <span className="dn-chevron" style={{ color: cfg.iconColor }} aria-hidden="true">
          {expanded ? (
            <IconChevronUp size={13} strokeWidth={2.5} />
          ) : (
            <IconChevronDown size={13} strokeWidth={2.5} />
          )}
        </span>
      </button>

      {/* ── Collapsible body ── */}
      <div
        id="dn-body"
        className={`dn-body${expanded ? ' expanded' : ''}`}
        aria-hidden={!expanded}
      >
        <div className="dn-content">
          {isStreaming ? (
            /* Skeleton shimmer while agents process */
            <>
              <div className="skeleton-line" style={{ marginTop: 8 }} />
              <div className="skeleton-line short" />
              <div className="skeleton-line" style={{ width: '75%' }} />
            </>
          ) : (
            <>
              {/* Summary sentence */}
              <p className="dn-summary">{getSummary(level, score)}</p>

              {/* Bullet list */}
              <ul className="dn-list" aria-label="Risk signal details">
                {reasons.map((reason, idx) => (
                  <li key={idx} className="dn-item">
                    <ReasonIcon type={reason.type} level={level} cfg={cfg} />
                    <span className="dn-item-text">
                      {/* "• Urgent language detected: 'Need this done TODAY'" */}
                      <span className="dn-item-label" style={{ color: cfg.labelColor }}>
                        {reason.label}
                      </span>{' '}
                      <span className="dn-item-desc">{reason.description}</span>
                    </span>
                  </li>
                ))}
              </ul>

              {/* Footer attribution */}
              <p className="dn-footer">
                Analysis powered by ShadowSense Aurora multi-agent pipeline
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DefenseNarrative;
