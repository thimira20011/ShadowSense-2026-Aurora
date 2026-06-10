/**
 * SafeResponseTemplates.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders up to 3 click-to-copy safe response cards when a high-risk
 * conversation is detected. Each card shows the template text and a
 * copy button that flashes "✓ Copied!" for 1.5 s after activation.
 *
 * Only renders content when `templates.length > 0` (clear level = hidden).
 */

import React, { useState, useCallback } from 'react';
import { IconShield, IconCopy, IconCheck } from '@tabler/icons-react';
import type { ThreatLevel } from '../types';

interface SafeResponseTemplatesProps {
  templates: string[];
  level: ThreatLevel;
}

// ─── Single template card ─────────────────────────────────────────────────────

const TemplateCard: React.FC<{ text: string; index: number }> = ({ text, index }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for content-script context
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <div
      className="ss-template-card"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <p className="ss-template-text">{text}</p>
      <button
        className={`ss-copy-btn${copied ? ' ss-copy-btn--copied' : ''}`}
        onClick={handleCopy}
        aria-label="Copy response to clipboard"
        title="Click to copy"
      >
        {copied ? (
          <>
            <IconCheck size={11} strokeWidth={2.5} />
            <span>Copied!</span>
          </>
        ) : (
          <>
            <IconCopy size={11} strokeWidth={2} />
            <span>Copy</span>
          </>
        )}
      </button>
    </div>
  );
};

// ─── Main export ─────────────────────────────────────────────────────────────

export const SafeResponseTemplates: React.FC<SafeResponseTemplatesProps> = ({
  templates,
  level,
}) => {
  if (templates.length === 0) return null;

  const isHighRisk = level === 'high-risk';

  return (
    <div
      className={`ss-templates-box${isHighRisk ? ' ss-templates-box--risk' : ' ss-templates-box--advisory'}`}
      role="region"
      aria-label="Suggested safe responses"
    >
      {/* Header */}
      <div className="ss-templates-header">
        <IconShield
          size={13}
          strokeWidth={2}
          color={isHighRisk ? 'var(--color-risk-text)' : 'var(--color-warn-text)'}
          aria-hidden="true"
        />
        <span className="ss-templates-label">
          {isHighRisk ? 'Shield Responses' : 'Safe Response'}
        </span>
        <span className="ss-templates-hint">Click to copy</span>
      </div>

      {/* Cards */}
      <div className="ss-templates-list">
        {templates.map((text, i) => (
          <TemplateCard key={i} text={text} index={i} />
        ))}
      </div>
    </div>
  );
};
