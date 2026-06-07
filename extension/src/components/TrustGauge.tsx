import React from 'react';
import type { ThreatLevel } from '../types';

interface TrustGaugeProps {
  score: number;
  level: ThreatLevel;
  isStreaming?: boolean;
}

const RADIUS = 24;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function getStrokeColor(level: ThreatLevel): string {
  switch (level) {
    case 'high-risk': return 'var(--color-risk-primary)';
    case 'advisory': return 'var(--color-warn-primary)';
    case 'clear': return 'var(--color-clear-primary)';
  }
}

function getTextColor(level: ThreatLevel): string {
  switch (level) {
    case 'high-risk': return 'var(--color-risk-text)';
    case 'advisory': return 'var(--color-warn-text)';
    case 'clear': return 'var(--color-clear-text)';
  }
}

export const TrustGauge: React.FC<TrustGaugeProps> = ({ score, level, isStreaming }) => {
  const offset = isStreaming
    ? CIRCUMFERENCE
    : CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;

  const strokeColor = isStreaming ? 'var(--color-accent-light)' : getStrokeColor(level);
  const textColor = isStreaming ? 'var(--color-accent-text)' : getTextColor(level);

  return (
    <div
      className={`gauge-svg-container${isStreaming ? ' pulse-glow-loading' : ''}`}
    >
      <svg viewBox="0 0 60 60">
        <circle
          className="gauge-track"
          cx="30"
          cy="30"
          r={RADIUS}
          fill="none"
          stroke="#e4e4e7"
          strokeWidth="5.5"
        />
        <circle
          className="gauge-fill"
          cx="30"
          cy="30"
          r={RADIUS}
          fill="none"
          stroke={strokeColor}
          strokeWidth="5.5"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.4s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease',
          }}
        />
      </svg>
      <div className="gauge-text" style={{ color: textColor }}>
        {isStreaming ? '...' : score}
      </div>
    </div>
  );
};
