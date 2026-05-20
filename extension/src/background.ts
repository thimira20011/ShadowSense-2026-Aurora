/**
 * Service Worker for ShadowSense Aurora extension
 * Handles extension lifecycle and messaging
 */

declare const chrome: any;

// Initialize extension on install
chrome.runtime.onInstalled.addListener(() => {
  console.log("ShadowSense Aurora installed");
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener(
  (request: unknown, sender: unknown, sendResponse: (arg0: unknown) => void) => {
    if (request.type === "ANALYZE_GIG") {
      // TODO: Forward analysis requests to backend
      sendResponse({ success: true });
    }
  }
);

// Background tasks
setInterval(() => {
  // TODO: Periodic checks for updates
}, 3600000); // Every hour
