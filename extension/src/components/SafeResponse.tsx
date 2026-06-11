/**
 * SafeResponse.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Single suggested-response card used in the popup panel.
 * Long texts (> 300 chars) are truncated with a "show more" toggle.
 */

import React, { useState, useCallback } from 'react';
import { IconCopy } from '@tabler/icons-react';

interface SafeResponseProps {
  text: string;
}

const MAX_VISIBLE = 300;

export const SafeResponse: React.FC<SafeResponseProps> = ({ text }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied]     = useState(false);

  const isTruncatable = text.length > MAX_VISIBLE;
  const displayText   = isTruncatable && !expanded
    ? text.slice(0, MAX_VISIBLE) + '…'
    : text;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <div className="template-box">
      <div className="template-header">
        <span className="factors-heading" style={{ marginBottom: 0 }}>
          Smart Defense Response
        </span>
        <button
          className="copy-btn"
          onClick={handleCopy}
          aria-label="Copy response to clipboard"
          title="Copy to clipboard"
        >
          <IconCopy size={12} />
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <div className="template-card">
        {displayText}
        {isTruncatable && (
          <button
            className="template-expand-btn"
            onClick={() => setExpanded(e => !e)}
            aria-expanded={expanded}
          >
            {expanded ? ' show less' : ' show more'}
          </button>
        )}
      </div>
    </div>
  );
};
