import React from "react";

interface AlertOverlayProps {
  threatLevel: "low" | "medium" | "high" | "critical";
  message: string;
  details: string[];
  onDismiss: () => void;
}

export const AlertOverlay: React.FC<AlertOverlayProps> = ({
  threatLevel,
  message,
  details,
  onDismiss,
}) => {
  const iconMap = {
    low: "✓",
    medium: "⚠",
    high: "⚠",
    critical: "🛑",
  };

  return (
    <div className={`alert-overlay alert-${threatLevel}`}>
      <div className="alert-header">
        <span className="alert-icon">{iconMap[threatLevel]}</span>
        <h3>{message}</h3>
        <button onClick={onDismiss} className="close-btn">
          ✕
        </button>
      </div>
      <div className="alert-details">
        {details.map((detail, idx) => (
          <p key={idx}>• {detail}</p>
        ))}
      </div>
    </div>
  );
};
