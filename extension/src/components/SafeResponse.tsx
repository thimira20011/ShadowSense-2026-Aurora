import React, { useCallback } from 'react';
import { IconCopy } from '@tabler/icons-react';

interface SafeResponseProps {
  text: string;
}

export const SafeResponse: React.FC<SafeResponseProps> = ({ text }) => {
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      // Could add toast notification here
    }).catch(() => {
      // Fallback copy
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    });
  }, [text]);

  return (
    <div className="template-box">
      <div className="template-header">
        <span className="factors-heading" style={{ marginBottom: 0 }}>
          Smart Defense Response
        </span>
        <button className="copy-btn" onClick={handleCopy}>
          <IconCopy size={12} /> Copy
        </button>
      </div>
      <div className="template-card">{text}</div>
    </div>
  );
};
