import React, { useEffect, useState } from 'react';
import type { ThreatLevel } from '../types';

interface TrustGaugeProps {
  score: number;
  level: ThreatLevel;
  isStreaming?: boolean;
}

const RADIUS = 24;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ≈ 150.796

// ─── Per-level gradient stop pairs ───────────────────────────────────────────

function getGradientStops(level: ThreatLevel): [string, string] {
  switch (level) {
    case 'high-risk': return ['#e24b4a', '#f97316']; // red → orange
    case 'advisory':  return ['#ef9f27', '#fbbf24']; // amber → gold
    case 'clear':     return ['#1d9e75', '#34d399']; // emerald → mint
  }
}

function getGradientId(level: ThreatLevel): string {
  return `gauge-grad-${level}`;
}

function getFilterId(level: ThreatLevel): string {
  return `gauge-shadow-${level}`;
}

function getShadowColor(level: ThreatLevel): string {
  switch (level) {
    case 'high-risk': return 'rgba(226, 75, 74, 0.45)';
    case 'advisory':  return 'rgba(239, 159, 39, 0.45)';
    case 'clear':     return 'rgba(29, 158, 117, 0.45)';
  }
}

function getTextColor(level: ThreatLevel): string {
  switch (level) {
    case 'high-risk': return 'var(--color-risk-text)';
    case 'advisory':  return 'var(--color-warn-text)';
    case 'clear':     return 'var(--color-clear-text)';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export const TrustGauge: React.FC<TrustGaugeProps> = ({ score, level, isStreaming }) => {
  // Mount animation: start from CIRCUMFERENCE (empty), ease to target offset
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Small RAF delay ensures the transition triggers after first paint
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [score, level]);

  // Reset animation on score/level change
  useEffect(() => {
    setMounted(false);
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [score, level]);

  const targetOffset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;
  const offset = isStreaming ? CIRCUMFERENCE : (mounted ? targetOffset : CIRCUMFERENCE);

  const strokeColor = isStreaming
    ? `url(#gauge-grad-streaming)`
    : `url(#${getGradientId(level)})`;

  const textColor = isStreaming ? 'var(--color-accent-text)' : getTextColor(level);
  const filterId = isStreaming ? 'gauge-shadow-streaming' : getFilterId(level);
  const [stopA, stopB] = isStreaming ? ['#7b61ff', '#4ecdc4'] : getGradientStops(level);
  const shadowColor = isStreaming ? 'rgba(123, 97, 255, 0.45)' : getShadowColor(level);

  return (
    <div className={`gauge-svg-container${isStreaming ? ' pulse-glow-loading' : ''}`}>
      <svg viewBox="0 0 60 60" overflow="visible" aria-hidden="true">
        <defs>
          {/* Gradient for current level */}
          <linearGradient
            id={isStreaming ? 'gauge-grad-streaming' : getGradientId(level)}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%"   stopColor={stopA} />
            <stop offset="100%" stopColor={stopB} />
          </linearGradient>

          {/* Drop shadow filter */}
          <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow
              dx="0"
              dy="2"
              stdDeviation="3"
              floodColor={shadowColor}
              floodOpacity="1"
            />
          </filter>
        </defs>

        {/* Track ring */}
        <circle
          className="gauge-track"
          cx="30"
          cy="30"
          r={RADIUS}
          fill="none"
          style={{ stroke: 'var(--gauge-track-color)' }}
          strokeWidth="5.5"
        />

        {/* Animated fill arc */}
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
          filter={`url(#${filterId})`}
          style={{
            transition: isStreaming
              ? 'none'
              : 'stroke-dashoffset 0.55s cubic-bezier(0.34, 1.4, 0.64, 1), stroke 0.3s ease',
            transformOrigin: 'center',
          }}
        />
      </svg>

      {/* Score label */}
      <div
        className="gauge-text"
        style={{
          color: textColor,
          fontSize: '19px',
          fontWeight: 700,
          letterSpacing: '-0.03em',
          textShadow: `0 1px 6px ${shadowColor}`,
          transition: 'color 0.3s ease',
        }}
      >
        {isStreaming ? '…' : score}
      </div>
    </div>
  );
};
