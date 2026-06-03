import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { analyzeContent } from "./api";
import { TrustGauge } from "./components/TrustGauge";
import "./styles/popup.css";

export const Popup: React.FC = () => {
  const [content, setContent] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!content.trim()) return;

    setLoading(true);
    try {
      const response = await analyzeContent({
        content,
        context: {},
      });
      setResult(response);
    } catch (error) {
      console.error("Analysis error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="popup-container">
      <header className="popup-header">
        <h1>ShadowSense Aurora</h1>
        <p>AI Scam Detection</p>
      </header>

      <div className="popup-content">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste suspicious message or gig description here..."
          className="popup-textarea"
        />

        <button
          onClick={handleAnalyze}
          disabled={loading || !content.trim()}
          className="analyze-btn"
        >
          {loading ? "Analyzing..." : "Analyze"}
        </button>

        {result && (
          <div className="result-container">
            <TrustGauge
              threatLevel={result.threat_level}
              confidence={result.confidence}
            />
            <div className="result-text">
              <p>{result.narrative}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Popup;

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <Popup />
    </React.StrictMode>
  );
}
