/**
 * popup.tsx — ShadowSense Aurora Extension Popup
 *
 * Reads the latest trust score from chrome.storage.local (written by
 * background.ts after each /api/analyze call) and renders the PopupPanel.
 *
 * Falls back to a "no scan yet" advisory state if the extension has not yet
 * analysed any messages in the current browsing session.
 */
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { PopupPanel } from "./components/PopupPanel";
import { useSimulation } from "./hooks/useSimulation";
import { StoredResult } from "./types";
import "./styles/variables.css";
import "./styles/popup.css";

const CACHED_SCORE_KEY = "shadowsense_cached_score";
const CACHED_RESULT_KEY = "shadowsense_cached_result";

/** Initial/default advisory score rendered while storage is loading. */
const DEFAULT_SCORE = 55;

export const Popup: React.FC = () => {
  const [platform, setPlatform] = useState<"fiverr" | "upwork">("fiverr");
  const [messageId, setMessageId] = useState<string>("no-scan-yet");
  const [loading, setLoading]   = useState<boolean>(true);
  const { state, updateScore } = useSimulation(DEFAULT_SCORE, platform);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url || "";
      if (url.includes("upwork.com")) {
        setPlatform("upwork");
      } else {
        setPlatform("fiverr");
      }
    });
  }, []);

  // ── 1. Load stored result on mount ─────────────────────────────────────────
  useEffect(() => {
    chrome.storage.local.get(
      [CACHED_SCORE_KEY, CACHED_RESULT_KEY],
      (stored) => {
        const cached = stored[CACHED_RESULT_KEY] as StoredResult | undefined;
        const cachedScore = stored[CACHED_SCORE_KEY] as number | undefined;

        if (cached) {
          setMessageId(cached.message_id);
          updateScore(cached.trust_score, cached);
        } else if (cachedScore !== undefined) {
          updateScore(cachedScore);
        }
        // If nothing stored, keep the advisory default (55)
        setLoading(false);
      }
    );
  }, [updateScore]);

  // ── 2. Live-update whenever background writes a new result ─────────────────
  useEffect(() => {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area !== "local") return;

      if (changes[CACHED_RESULT_KEY]?.newValue) {
        const result = changes[CACHED_RESULT_KEY].newValue as StoredResult;
        setMessageId(result.message_id);
        updateScore(result.trust_score, result);
      } else if (changes[CACHED_SCORE_KEY]?.newValue !== undefined) {
        const newScore = changes[CACHED_SCORE_KEY].newValue as number;
        updateScore(newScore);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [updateScore]);

  if (loading) {
    return (
      <div className="popup-root">
        <div style={{ padding: "24px", textAlign: "center", color: "var(--color-text-muted)" }}>
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="popup-root">
      <PopupPanel state={state} messageId={messageId} platform={platform} />
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
