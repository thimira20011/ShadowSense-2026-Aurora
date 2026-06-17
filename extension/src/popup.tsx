/**
 * popup.tsx — ShadowSense Aurora Extension Popup
 *
 * Flow:
 *  1. Detect platform (Fiverr / Upwork) from the active tab URL.
 *  2. Ping backend /health to detect offline state.
 *  3. Read the latest analysis from chrome.storage.local.
 *     - If a cached result exists → render real analysis data.
 *     - If nothing is cached yet → render "No scan yet" state.
 *  4. Listen for storage changes so the popup updates live when background
 *     writes a new analysis result.
 */
import React, { useEffect, useState, useCallback } from "react";
import ReactDOM from "react-dom/client";
import { PopupPanel } from "./components/PopupPanel";
import { useSimulation } from "./hooks/useSimulation";
import type { StoredResult } from "./types";
import "./styles/variables.css";
import "./styles/popup.css";

const CACHED_SCORE_KEY  = "shadowsense_cached_score";
const CACHED_RESULT_KEY = "shadowsense_cached_result";

export const Popup: React.FC = () => {
  const [platform, setPlatform]           = useState<"fiverr" | "upwork">("fiverr");
  const [messageId, setMessageId]         = useState<string>("no-scan-yet");
  const [loading, setLoading]             = useState<boolean>(true);
  // noScanYet: true until we confirm at least one stored analysis exists
  const [noScanYet, setNoScanYet]         = useState<boolean>(true);
  // backendOffline: null = unknown, true = offline, false = online
  const [backendOffline, setBackendOffline] = useState<boolean>(false);

  const { state, updateScore } = useSimulation(55, platform);

  // ── 1. Detect active-tab platform ──────────────────────────────────────────
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url ?? "";
      if (url.includes("upwork.com")) setPlatform("upwork");
      else setPlatform("fiverr");
    });
  }, []);

  // ── 2. Backend health check ─────────────────────────────────────────────────
  // Popup has host_permissions for http://localhost:8000/* so direct fetch is allowed.
  useEffect(() => {
    const controller = new AbortController();
    fetch("http://127.0.0.1:8000/health", {
      method: "GET",
      signal: controller.signal,
    })
      .then((r) => setBackendOffline(!r.ok))
      .catch(() => setBackendOffline(true));
    return () => controller.abort();
  }, []);

  // ── 3. Load stored result on mount ──────────────────────────────────────────
  const loadFromStorage = useCallback(() => {
    chrome.storage.local.get(
      [CACHED_SCORE_KEY, CACHED_RESULT_KEY],
      (stored) => {
        const cached     = stored[CACHED_RESULT_KEY] as StoredResult | undefined;
        const cachedScore = stored[CACHED_SCORE_KEY]  as number      | undefined;

        if (cached) {
          setMessageId(cached.message_id);
          updateScore(cached.trust_score, cached);
          setNoScanYet(false);
        } else if (cachedScore !== undefined) {
          updateScore(cachedScore);
          setNoScanYet(false);
        }
        // else: no data → keep noScanYet=true (show empty state)
        setLoading(false);
      }
    );
  }, [updateScore]);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // ── 4. Live-update when background writes a new analysis ────────────────────
  useEffect(() => {
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area !== "local") return;

      if (changes[CACHED_RESULT_KEY]?.newValue) {
        const result = changes[CACHED_RESULT_KEY].newValue as StoredResult;
        setMessageId(result.message_id);
        updateScore(result.trust_score, result);
        setNoScanYet(false);
        setBackendOffline(false); // successfully received new backend data
      } else if (changes[CACHED_SCORE_KEY]?.newValue !== undefined) {
        updateScore(changes[CACHED_SCORE_KEY].newValue as number);
        setNoScanYet(false);
        setBackendOffline(false);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [updateScore]);

  // ── Loading spinner ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="popup-root">
        <div className="popup-loading">
          <div className="popup-loading-spinner" />
          <span>Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="popup-root">
      <PopupPanel
        state={state}
        messageId={messageId}
        platform={platform}
        noScanYet={noScanYet}
        backendOffline={backendOffline}
      />
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
