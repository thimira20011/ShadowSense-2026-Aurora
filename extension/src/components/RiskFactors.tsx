import React from 'react';
import {
  IconMessage2,
  IconUserX,
  IconFileAlert,
  IconCircleCheck,
} from '@tabler/icons-react';
import type { DefenseReason, ThreatLevel } from '../types';

interface RiskFactorsProps {
  reasons: DefenseReason[];
  level: ThreatLevel;
  isStreaming?: boolean;
}

function getFactorIcon(type: DefenseReason['type'], level: ThreatLevel) {
  const colorMap = {
    'high-risk': { bg: '#fcebeb', color: '#a32d2d' },
    advisory: { bg: '#faeeda', color: '#854f0b' },
    clear: { bg: '#e1f5ee', color: '#0f6e56' },
  };

  const colors = colorMap[level];

  const icons: Record<string, React.ReactNode> = {
    linguistic:
      level === 'clear' ? (
        <IconCircleCheck size={11} color={colors.color} />
      ) : (
        <IconMessage2 size={11} color={colors.color} />
      ),
    identity: <IconUserX size={11} color={colors.color} />,
    payload: <IconFileAlert size={11} color={colors.color} />,
  };

  return (
    <div className="factor-icon-wrap" style={{ background: colors.bg, color: colors.color }}>
      {icons[type]}
    </div>
  );
}

export const RiskFactors: React.FC<RiskFactorsProps> = ({ reasons, level, isStreaming }) => {
  return (
    <div className="factors-box">
      <div className="factors-heading">Explainable Defense Reasons</div>
      <div>
        {isStreaming ? (
          <>
            <div className="skeleton-line" />
            <div className="skeleton-line" />
            <div className="skeleton-line short" />
          </>
        ) : (
          reasons.map((reason, idx) => (
            <div className="factor-item" key={idx}>
              {getFactorIcon(reason.type, level)}
              <div className="factor-text-wrap">
                <b>{reason.label}</b> {reason.description}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
