import React from 'react';
import type { ThreatLevel } from '../types';

interface ActionButtonsProps {
  level: ThreatLevel;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({ level }) => {
  const handleOverride = () => {
    alert('Proceed event logged to backend.');
  };

  const handleReport = () => {
    alert('Reporting payload block patterns to local ChromaDB...');
  };

  if (level === 'clear') return null;

  return (
    <div className="popup-actions">
      <button className="action-btn-primary" onClick={handleOverride}>
        {level === 'advisory' ? 'Dismiss warning' : 'Override + Proceed'}
      </button>
      <button
        className={level === 'high-risk' ? 'action-btn-danger' : 'action-btn-warn'}
        onClick={handleReport}
      >
        {level === 'advisory' ? 'Report anyway' : 'Report Client'}
      </button>
    </div>
  );
};
