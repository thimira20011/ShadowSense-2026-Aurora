import React, { useState } from "react";

interface TrustGaugeProps {
  threatLevel: "low" | "medium" | "high" | "critical";
  confidence: number;
}

export const TrustGauge: React.FC<TrustGaugeProps> = ({
  threatLevel,
  confidence,
}) => {
  const colorMap = {
    low: "#4CAF50",
    medium: "#FFC107",
    high: "#FF9800",
    critical: "#F44336",
  };

  const arcPercentage = confidence * 100;

  return (
    <div className="trust-gauge">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="#e0e0e0"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke={colorMap[threatLevel]}
          strokeWidth="8"
          strokeDasharray={`${(arcPercentage / 100) * 251.2} 251.2`}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="gauge-text">
        <p className="threat-level">{threatLevel.toUpperCase()}</p>
        <p className="confidence">{(confidence * 100).toFixed(0)}%</p>
      </div>
    </div>
  );
};
