import React from 'react';
import { TrustGauge } from './TrustGauge';
import { AgentChips } from './AgentChips';
import { RiskFactors } from './RiskFactors';
import { SafeResponse } from './SafeResponse';
import { ActionButtons } from './ActionButtons';
import type { SimulationState } from '../types';
import { getStatusLabel } from '../types';

interface PopupPanelProps {
  state: SimulationState;
}

function getGaugeCardBg(level: string): string {
  switch (level) {
    case 'high-risk': return '#fff5f5';
    case 'advisory': return '#fffbf0';
    case 'clear': return '#f0fdf8';
    default: return 'transparent';
  }
}

function getPillClass(level: string): string {
  switch (level) {
    case 'high-risk': return 'pill pill-red';
    case 'advisory': return 'pill pill-amber';
    case 'clear': return 'pill pill-green';
    default: return 'pill pill-purple';
  }
}

function getBorderColor(level: string): string {
  switch (level) {
    case 'high-risk': return 'var(--color-risk-primary)';
    case 'advisory': return 'var(--color-warn-primary)';
    case 'clear': return 'var(--color-clear-primary)';
    default: return 'var(--color-border-primary)';
  }
}

export const PopupPanel: React.FC<PopupPanelProps> = ({ state }) => {
  const { score, level, agents, reasons, suggestedResponse, isStreaming } = state;

  return (
    <div
      className="ext-popup"
      style={{
        borderColor: isStreaming ? 'var(--color-accent-light)' : getBorderColor(level),
        transition: 'border-color 0.3s ease',
      }}
    >
      {/* Header */}
      <div className="ext-header">
        <div className="ext-brand">
          <div className="brand-logo-wrap">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7b61ff" />
                  <stop offset="100%" stopColor="#4ecdc4" />
                </linearGradient>
              </defs>
              <path
                d="M16 6L8 9V15C8 20.3 11.4 25.2 16 26.5C20.6 25.2 24 20.3 24 15V9L16 6Z"
                stroke="url(#shieldGrad)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M13.5 11.5C14.5 10.5 17.5 10.5 18.5 12.5C18.5 14.5 13.5 14.5 13.5 16.5C13.5 18.5 16.5 19.5 18.5 18.5"
                stroke="#ffffff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <div className="ext-brand-title">ShadowSense AI</div>
            <div className="ext-brand-status">
              <span className={`status-dot${isStreaming ? ' pulsing' : ''}`} />
              <span>{isStreaming ? 'Scanning message stream...' : 'Active on Fiverr'}</span>
            </div>
          </div>
        </div>
        <div className="switch-toggle" />
      </div>

      {/* Gauge Card */}
      <div
        className="gauge-card"
        style={{
          backgroundColor: isStreaming ? 'transparent' : getGaugeCardBg(level),
          transition: 'background-color 0.3s ease',
        }}
      >
        <div className="gauge-row">
          <TrustGauge score={score} level={level} isStreaming={isStreaming} />
          <div className="gauge-info">
            <div className="gauge-title">Client Trust Score</div>
            <div className="gauge-badge-row">
              <span className="gauge-score-large">
                {isStreaming ? '--' : score}
              </span>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>/ 100</span>
            </div>
            <span className={isStreaming ? 'pill pill-purple' : getPillClass(level)}>
              {isStreaming ? 'Orchestrating...' : getStatusLabel(level)}
            </span>
          </div>
        </div>
      </div>

      {/* Risk Factors */}
      <RiskFactors reasons={reasons} level={level} isStreaming={isStreaming} />

      {/* Agent Chips */}
      <AgentChips agents={agents} />

      {/* Suggested Response */}
      <SafeResponse text={suggestedResponse} />

      {/* Action Buttons */}
      <ActionButtons level={level} />
    </div>
  );
};
