/**
 * Service Worker for ShadowSense Aurora extension
 * Handles extension lifecycle and messaging
 */

// chrome is declared globally by @types/chrome

// Initialize extension on install
chrome.runtime.onInstalled.addListener(() => {
  console.log("ShadowSense Aurora installed");
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener(
  (request: any, _sender: unknown, sendResponse: (arg0: unknown) => void) => {
    if (request.type === "ANALYZE_GIG") {
      // TODO: Forward analysis requests to backend
      sendResponse({ success: true });
    }

    if (request.type === "FIVERR_MESSAGES_CAPTURED") {
      // New chat messages captured by the Fiverr content script.
      // Forward each message to the backend analysis endpoint.
      const messages: unknown[] = request.payload ?? [];
      console.log(
        `[ShadowSense BG] Received ${messages.length} captured message(s) from Fiverr content script.`
      );
      // TODO: queue messages for analysis (call analyzeContent from api/index.ts)
      sendResponse({ success: true, count: messages.length });
    }
  }
);

// Background tasks
setInterval(() => {
  // TODO: Periodic checks for updates
}, 3600000); // Every hour
