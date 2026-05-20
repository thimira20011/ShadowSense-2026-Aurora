import React from "react";

interface DefenseNarrativeProps {
  narrative: string;
  indicators: Array<{
    type: string;
    description: string;
    confidence: number;
  }>;
}

export const DefenseNarrative: React.FC<DefenseNarrativeProps> = ({
  narrative,
  indicators,
}) => {
  return (
    <div className="defense-narrative">
      <div className="narrative-section">
        <h4>Analysis Summary</h4>
        <p>{narrative}</p>
      </div>

      <div className="indicators-section">
        <h4>Detected Indicators ({indicators.length})</h4>
        <ul className="indicators-list">
          {indicators.map((indicator, idx) => (
            <li key={idx} className={`indicator-${indicator.type}`}>
              <span className="indicator-type">[{indicator.type}]</span>
              <span className="indicator-description">
                {indicator.description}
              </span>
              <span className="indicator-confidence">
                {(indicator.confidence * 100).toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
