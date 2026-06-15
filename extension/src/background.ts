/**
 * ShadowSense Aurora — Background Service Worker (MV3)
 *
 * Responsibilities:
 *  1. Receive captured messages from content scripts (fiverr.ts, upwork_gig.ts, etc.)
 *  2. Forward each "other"-sender message to the backend /api/analyze endpoint
 *  3. Store the latest trust score in chrome.storage.local so the popup can read it
 *  4. Send the verdict back to the content script (for response template injection)
 *  5. Manage periodic health-checks via chrome.alarms (MV3-safe, no setInterval)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface CapturedMessage {
  id: string;
  conversationId: string;
  sender: string;
  senderRole: "self" | "other";
  text: string;
  timestamp: string;
  capturedAt: number;
  pageUrl: string;
}

interface BackendAnalysisResponse {
  analysis_id: string;
  trust_score: number;
  verdict: {
    trust_score: { score: number; level: string; explanation: string };
    reasons: string[];
    suggested_responses: string[];
  };
  agent_details: Record<string, unknown> | null;
}

interface StoredResult {
  analysis_id: string;
  trust_score: number;
  level: string;
  reasons: string[];
  suggested_responses: string[];
  timestamp: number;
  message_id: string;
  message_text: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = "http://localhost:8000";
const CACHED_SCORE_KEY = "shadowsense_cached_score";
const CACHED_RESULT_KEY = "shadowsense_cached_result";
const ANALYSIS_TIMEOUT_MS = 10_000;

// ─── Installation ─────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  console.log("[ShadowSense BG] Extension installed — ShadowSense Aurora v1.0.0");
  // Set up periodic health-check alarm (MV3-safe alternative to setInterval)
  chrome.alarms.create("shadowsense-health-check", {
    periodInMinutes: 60,
  });
});

// ─── Health-check alarm ───────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "shadowsense-health-check") {
    fetch(`${API_BASE}/health`, { method: "GET" })
      .then((r) => r.json())
      .then((data) => {
        console.log("[ShadowSense BG] Health check OK:", data.status);
      })
      .catch((err) => {
        console.warn("[ShadowSense BG] Health check failed — backend may be offline:", err.message);
      });
  }
});

// ─── Backend analysis helper ──────────────────────────────────────────────────

async function analyzeWithBackend(
  message: CapturedMessage
): Promise<BackendAnalysisResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}/api/analyze/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: message.text,
        sender: message.sender,
        timestamp: message.timestamp,
        context: { conversationId: message.conversationId, pageUrl: message.pageUrl },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}: ${response.statusText}`);
    }

    return response.json() as Promise<BackendAnalysisResponse>;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Store result + update badge ─────────────────────────────────────────────

function backendLevelToFrontend(backendLevel: string): string {
  switch (backendLevel) {
    case "HIGH_RISK":  return "high-risk";
    case "ADVISORY":   return "advisory";
    case "CLEAR":      return "clear";
    default:           return "advisory";
  }
}

async function storeResult(
  result: BackendAnalysisResponse,
  message: CapturedMessage
): Promise<void> {
  const level = backendLevelToFrontend(result.verdict.trust_score.level);
  const stored: StoredResult = {
    analysis_id:        result.analysis_id,
    trust_score:        result.trust_score,
    level,
    reasons:            result.verdict.reasons,
    suggested_responses: result.verdict.suggested_responses,
    timestamp:          Date.now(),
    message_id:         message.id,
    message_text:       message.text.slice(0, 200),
  };

  await chrome.storage.local.set({
    [CACHED_SCORE_KEY]:  result.trust_score,
    [CACHED_RESULT_KEY]: stored,
  });

  console.log(
    `[ShadowSense BG] Score stored: ${result.trust_score} (${level}) — analysis_id: ${result.analysis_id}`
  );
}

// ─── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    request: { type: string; payload?: unknown },
    _sender,
    sendResponse: (response: unknown) => void
  ) => {
    // ── Pre-engagement gig/job analysis ──────────────────────────────────────
    if (request.type === "ANALYZE_GIG") {
      const gig = request.payload as Record<string, unknown> | undefined;
      if (!gig) {
        sendResponse({ success: false, error: "No gig payload provided" });
        return true;
      }

      fetch(`${API_BASE}/api/pre-engage/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gig),
      })
        .then((r) => {
          if (!r.ok) throw new Error(`Pre-engage API error: ${r.status}`);
          return r.json();
        })
        .then((data) => {
          console.log("[ShadowSense BG] Pre-engage result:", data.verdict, "score:", data.pre_engage_score);
          sendResponse({ success: true, result: data });
        })
        .catch((err) => {
          console.error("[ShadowSense BG] Pre-engage analysis failed:", err.message);
          sendResponse({ success: false, error: err.message });
        });

      return true; // keep message channel open for async response
    }

    // ── Fiverr or Upwork chat messages captured ───────────────────────────────
    if (request.type === "FIVERR_MESSAGES_CAPTURED" || request.type === "UPWORK_MESSAGES_CAPTURED") {
      const messages = (request.payload as CapturedMessage[]) ?? [];
      const platformName = request.type === "FIVERR_MESSAGES_CAPTURED" ? "Fiverr" : "Upwork";

      if (messages.length === 0) {
        sendResponse({ success: true, count: 0 });
        return true;
      }

      console.log(
        `[ShadowSense BG] Received ${messages.length} captured message(s) from ${platformName} content script.`
      );

      // Analyse the last message from the other party (most recent threat signal)
      const incomingMessages = messages.filter((m) => m.senderRole === "other");
      if (incomingMessages.length === 0) {
        // Only own messages — no threat analysis needed
        sendResponse({ success: true, count: 0, skipped: "own-messages-only" });
        return true;
      }

      const latest = incomingMessages[incomingMessages.length - 1];

      analyzeWithBackend(latest)
        .then((result) => storeResult(result, latest).then(() => result))
        .then((result) => {
          const level = backendLevelToFrontend(result.verdict.trust_score.level);
          console.log(
            `[ShadowSense BG] Analysis complete — score: ${result.trust_score} level: ${level}`
          );
          // Send verdict back to content script so it can inject response templates
          sendResponse({
            success: true,
            count: messages.length,
            trust_score: result.trust_score,
            level,
            analysis_id: result.analysis_id,
            reasons: result.verdict.reasons,
          });
        })
        .catch((err) => {
          console.error("[ShadowSense BG] Analysis failed:", err.message);
          // Return cached score so content script can show offline badge
          chrome.storage.local.get([CACHED_SCORE_KEY], (stored) => {
            sendResponse({
              success: false,
              error: err.message,
              cached_score: stored[CACHED_SCORE_KEY] ?? null,
            });
          });
        });

      return true; // keep message channel open for async response
    }

    // ── Popup requesting latest result ───────────────────────────────────────
    if (request.type === "GET_LATEST_RESULT") {
      chrome.storage.local.get([CACHED_RESULT_KEY, CACHED_SCORE_KEY], (stored) => {
        sendResponse({
          result: stored[CACHED_RESULT_KEY] ?? null,
          score:  stored[CACHED_SCORE_KEY] ?? null,
        });
      });
      return true;
    }

    return false;
  }
);
