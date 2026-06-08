/**
 * popup.tsx
 * ─────────────────────────────────────────────────────
 * Extension popup entry point.
 *
 * TEST: score=25 is hardcoded → verify red high-risk modal appears.
 * To test advisory, change TEST_SCORE to 55.
 * To test clear,    change TEST_SCORE to 85.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { PopupPanel } from "./components/PopupPanel";
import { useSimulation } from "./hooks/useSimulation";
import "./styles/variables.css";
import "./styles/popup.css";

// ── Test: hardcode score=25 → should render red high-risk modal ──────────────
const TEST_SCORE = 25;
const TEST_MESSAGE_ID = "fiverr-msg-001";

export const Popup: React.FC = () => {
  const { state } = useSimulation(TEST_SCORE);

  return (
    <div className="popup-root">
      <PopupPanel state={state} messageId={TEST_MESSAGE_ID} />
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
