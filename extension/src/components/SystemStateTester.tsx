import React from 'react';
import { IconAdjustmentsHorizontal, IconBolt, IconLoader } from '@tabler/icons-react';

interface SystemStateTesterProps {
  score: number;
  isStreaming: boolean;
  onScoreChange: (score: number) => void;
  onPreset: (score: number) => void;
  onRunStream: () => void;
}

export const SystemStateTester: React.FC<SystemStateTesterProps> = ({
  score,
  isStreaming,
  onScoreChange,
  onPreset,
  onRunStream,
}) => {
  return (
    <div className="sandbox-console">
      <div className="console-header">
        <div className="console-title">
          <IconAdjustmentsHorizontal size={16} /> Real-time System State Tester
        </div>
        <div className="preset-btns">
          <button className="preset-btn" onClick={() => onPreset(15)} disabled={isStreaming}>
            🔴 High-Risk
          </button>
          <button className="preset-btn" onClick={() => onPreset(52)} disabled={isStreaming}>
            🟡 Advisory
          </button>
          <button className="preset-btn" onClick={() => onPreset(86)} disabled={isStreaming}>
            🟢 Clear
          </button>
          <button
            className="preset-btn stream-btn"
            onClick={onRunStream}
            disabled={isStreaming}
          >
            {isStreaming ? (
              <>
                <IconLoader size={14} className="spin-icon" /> Orchestrating Agents...
              </>
            ) : (
              <>
                <IconBolt size={14} /> ⚡ Run Multi-Agent Live Stream
              </>
            )}
          </button>
        </div>
      </div>
      <div className="slider-container">
        <input
          type="range"
          min="0"
          max="100"
          value={score}
          className="score-slider"
          onChange={(e) => onScoreChange(parseInt(e.target.value))}
          disabled={isStreaming}
        />
        <span className="slider-val-badge">{score}</span>
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          Drag the slider or trigger the <b>Live Stream Simulation</b> to preview real-time
          multi-agent processing pipelines on the popup UI.
        </span>
      </div>
    </div>
  );
};
