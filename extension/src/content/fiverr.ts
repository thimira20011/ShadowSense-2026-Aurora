/**
 * ShadowSense Aurora – Fiverr Chat Content Script
 * ─────────────────────────────────────────────────
 * Monitors the Fiverr inbox/chat page for new messages using a
 * MutationObserver.  For each new message it:
 *   1. Extracts text, sender name, and timestamp from the DOM.
 *   2. Deduplicates against already-captured messages.
 *   3. Persists the captured messages to chrome.storage.local.
 *   4. Notifies the background service worker so it can trigger
 *      real-time analysis.
 *
 * Selector strategy
 * ─────────────────
 * Fiverr uses obfuscated / auto-generated CSS class names that
 * change frequently.  We therefore prefer, in priority order:
 *   1. Stable ARIA roles   (role="log", role="list", role="listitem")
 *   2. data-* attributes   (data-testid, data-message-id, data-user-id)
 *   3. Semantic HTML       (<time>, <article>, <section>)
 *   4. Structural / heuristic patterns as a last resort
 *
 * URL patterns handled
 * ────────────────────
 *   https://www.fiverr.com/inbox
 *   https://www.fiverr.com/inbox/<conversation-id>
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ChatMessage {
  /** Stable fingerprint used for deduplication (sender + text + ts) */
  id: string;
  /** Fiverr conversation ID derived from the current URL */
  conversationId: string;
  /** Display name of the sender as shown in the DOM */
  sender: string;
  /** "self" | "other" – which side of the conversation */
  senderRole: "self" | "other";
  /** Full text content of the message bubble */
  text: string;
  /** ISO-8601 timestamp – from <time datetime="…"> when available */
  timestamp: string;
  /** Unix epoch (ms) of when the extension first saw this message */
  capturedAt: number;
  /** Raw page URL at the time of capture */
  pageUrl: string;
}

interface StoragePayload {
  /** Messages keyed by conversationId */
  [conversationId: string]: ChatMessage[];
}

// ─── Constants ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "shadowsense_fiverr_messages";
/** Maximum messages stored per conversation before the oldest are evicted */
const MAX_MESSAGES_PER_CONVO = 500;
/** Debounce window (ms) – prevents thrashing on rapid DOM mutations */
const DEBOUNCE_MS = 300;

// ─── Selector catalogue ────────────────────────────────────────────────────
/**
 * Ordered lists of CSS selectors tried in sequence.
 * The first selector that returns ≥1 element wins.
 */

/** Root container that wraps the whole message list / log */
const CHAT_CONTAINER_SELECTORS = [
  '[role="log"]',
  '[role="list"][aria-label*="message" i]',
  '[data-testid*="message-list"]',
  '[data-testid*="chat-log"]',
  '[data-testid*="conversation"]',
  "main [class*='conversation']",
  "main [class*='messages']",
  "main [class*='chat']",
  // Fallback: the <main> landmark itself so MutationObserver still fires
  "main",
] as const;

/** Individual message bubble / row */
const MESSAGE_ROW_SELECTORS = [
  '[role="listitem"]',
  '[data-testid*="message-row"]',
  '[data-testid*="message-item"]',
  '[data-message-id]',
  'article[class*="message"]',
  'div[class*="message-row"]',
  'div[class*="messageRow"]',
  'div[class*="message_row"]',
  'li[class*="message"]',
] as const;

/** Sender name element inside a message row */
const SENDER_SELECTORS = [
  '[data-testid*="sender"]',
  '[data-testid*="username"]',
  '[aria-label*="sender" i]',
  '[class*="sender"]',
  '[class*="username"]',
  '[class*="userName"]',
  '[class*="user-name"]',
  // Fiverr often puts the name in a <strong> or <b> tag inside the bubble
  "strong",
  "b",
] as const;

/** Timestamp element */
const TIMESTAMP_SELECTORS = [
  "time",
  '[data-testid*="timestamp"]',
  '[data-testid*="time"]',
  '[aria-label*="sent at" i]',
  '[class*="timestamp"]',
  '[class*="timeStamp"]',
  '[class*="time-stamp"]',
  '[class*="message-time"]',
  '[class*="messageTime"]',
] as const;

/** Text / body of the message */
const MESSAGE_TEXT_SELECTORS = [
  '[data-testid*="message-text"]',
  '[data-testid*="message-content"]',
  '[class*="message-text"]',
  '[class*="messageText"]',
  '[class*="message-content"]',
  '[class*="messageContent"]',
  '[class*="bubble"]',
  "p",
] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function queryFirst<T extends Element = Element>(
  root: Element | Document,
  selectors: readonly string[]
): T | null {
  for (const sel of selectors) {
    try {
      const el = root.querySelector<T>(sel);
      if (el) return el;
    } catch {
      // ignore invalid selectors in edge-cases
    }
  }
  return null;
}

function queryAll<T extends Element = Element>(
  root: Element | Document,
  selectors: readonly string[]
): T[] {
  for (const sel of selectors) {
    try {
      const els = Array.from(root.querySelectorAll<T>(sel));
      if (els.length > 0) return els;
    } catch {
      // ignore
    }
  }
  return [];
}

/** Simple hash for deduplication – not cryptographic */
function fingerprint(sender: string, text: string, timestamp: string): string {
  const raw = `${sender}|${text}|${timestamp}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16);
}

/** Extract a human-readable timestamp string from a DOM element */
function extractTimestamp(row: Element): string {
  const timeEl = queryFirst(row, TIMESTAMP_SELECTORS);
  if (!timeEl) return "";

  // Prefer the machine-readable datetime attribute
  const dt =
    timeEl.getAttribute("datetime") ||
    timeEl.getAttribute("title") ||
    timeEl.getAttribute("aria-label");

  if (dt) {
    const parsed = Date.parse(dt);
    if (!isNaN(parsed)) return new Date(parsed).toISOString();
  }

  // Fall back to visible text and try to parse it
  const visible = timeEl.textContent?.trim() ?? "";
  const parsed = Date.parse(visible);
  if (!isNaN(parsed)) return new Date(parsed).toISOString();

  // Return the raw visible text or empty string rather than "now"
  return visible || "";
}

/**
 * Determine whether a message row was sent by the current user.
 * Fiverr marks "own" messages with alignment classes, data attributes,
 * or aria attributes.  We check several signals.
 */
function detectSenderRole(row: Element): "self" | "other" {
  const styleAttr = row.getAttribute("style") ?? "";

  const selfSignals = [
    row.getAttribute("data-self"),
    row.getAttribute("data-is-self"),
    row.getAttribute("data-sender-is-me"),
    row.getAttribute("aria-label"),
    row.className,
  ];

  for (const signal of selfSignals) {
    if (!signal) continue;
    const lower = signal.toLowerCase();
    if (
      lower.includes("self") ||
      lower.includes("own") ||
      lower.includes("outgoing") ||
      lower.includes("sent") ||
      lower.includes("me")
    ) {
      return "self";
    }
  }

  // Heuristic: flex-end / right-aligned containers typically carry own messages
  const style = window.getComputedStyle(row);
  if (
    style.justifyContent === "flex-end" ||
    style.alignSelf === "flex-end" ||
    row.className.includes("flex-end") ||
    styleAttr.includes("flex-end")
  ) {
    return "self";
  }

  return "other";
}

/** Derive a conversation ID from the current URL */
function getConversationId(): string {
  const match = window.location.pathname.match(
    /\/inbox\/([^/?#]+)/
  );
  return match?.[1] ?? "unknown";
}

// ─── Storage helpers ────────────────────────────────────────────────────────

async function loadStoredMessages(
  conversationId: string
): Promise<ChatMessage[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result: any) => {
      const payload: StoragePayload = result[STORAGE_KEY] ?? {};
      resolve(payload[conversationId] ?? []);
    });
  });
}

async function saveMessages(
  conversationId: string,
  messages: ChatMessage[]
): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result: any) => {
      const payload: StoragePayload = result[STORAGE_KEY] ?? {};

      // Append new messages, deduplicate by id, and enforce cap
      const merged = [...(payload[conversationId] ?? []), ...messages];
      const deduped = Array.from(
        new Map(merged.map((m) => [m.id, m])).values()
      );
      const capped =
        deduped.length > MAX_MESSAGES_PER_CONVO
          ? deduped.slice(deduped.length - MAX_MESSAGES_PER_CONVO)
          : deduped;

      payload[conversationId] = capped;

      chrome.storage.local.set({ [STORAGE_KEY]: payload }, () => {
        if (chrome.runtime.lastError) {
          console.error(
            "[ShadowSense] Storage error:",
            chrome.runtime.lastError
          );
        }
        resolve();
      });
    });
  });
}

// ─── Core observer class ────────────────────────────────────────────────────

class FiverrChatObserver {
  /** fingerprints of messages already captured in this session */
  private readonly seen = new Set<string>();
  /** Pre-loaded fingerprints from chrome.storage to survive page reloads */
  private preloadedIds = new Set<string>();

  private observer: MutationObserver | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private chatContainer: Element | null = null;
  private stopped = false;
  private isScanning = false;
  private scanQueued = false;

  // ── Lifecycle ────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    this.stopped = false;
    const conversationId = getConversationId();

    // Pre-load fingerprints of already-stored messages for this conversation
    const existing = await loadStoredMessages(conversationId);
    for (const msg of existing) {
      this.preloadedIds.add(msg.id);
      this.seen.add(msg.id);
    }

    console.log(
      `[ShadowSense] Loaded ${this.preloadedIds.size} existing messages ` +
        `for conversation "${conversationId}"`
    );

    this.attach();
    // Do an initial scan for messages already present in the DOM
    await this.scanAll();
  }

  /**
   * Find the best chat container and attach the MutationObserver.
   * Retries every second for up to 30 s to handle SPA lazy-loading.
   */
  private attach(attempts = 0): void {
    if (this.stopped) return;

    const container = queryFirst(document, CHAT_CONTAINER_SELECTORS);

    if (container) {
      this.chatContainer = container;
      this.observer = new MutationObserver(() => this.scheduleExtraction());
      this.observer.observe(container, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: false, // avoids noise from style/class churn
      });
      console.log(
        "[ShadowSense] MutationObserver attached to chat container:",
        container.tagName,
        container.className.slice(0, 60)
      );
    } else if (attempts < 30) {
      // Retry – the SPA may not have rendered the inbox yet
      if (this.retryTimer !== null) clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => this.attach(attempts + 1), 1000);
    } else {
      console.warn(
        "[ShadowSense] Could not find a chat container after 30 s. " +
          "Fiverr's DOM structure may have changed."
      );
    }
  }

  stop(): void {
    this.stopped = true;
    this.observer?.disconnect();
    this.observer = null;
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
  }

  // ── Extraction ───────────────────────────────────────────────────────────

  private scheduleExtraction(): void {
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      void this.scanAll().catch((err) =>
        console.error("[ShadowSense] Scan error:", err)
      );
    }, DEBOUNCE_MS);
  }

  private async scanAll(): Promise<void> {
    if (this.isScanning) {
      this.scanQueued = true;
      return;
    }
    this.isScanning = true;

    try {
      const root = this.chatContainer ?? document;
      const rows = queryAll<Element>(root, MESSAGE_ROW_SELECTORS);

      if (rows.length === 0) {
        // Nothing recognisable yet – could be a non-chat page
        return;
      }

      const conversationId = getConversationId();
      const newMessages: ChatMessage[] = [];

      for (const row of rows) {
        const msg = this.extractMessage(row, conversationId);
        if (!msg) continue;

        if (this.seen.has(msg.id)) continue; // already captured
        this.seen.add(msg.id);
        newMessages.push(msg);
      }

      if (newMessages.length === 0) return;

      console.log(
        `[ShadowSense] Captured ${newMessages.length} new message(s) ` +
          `in conversation "${conversationId}"`
      );

      await saveMessages(conversationId, newMessages);
      this.notifyBackground(newMessages);
    } finally {
      this.isScanning = false;
      if (this.scanQueued) {
        this.scanQueued = false;
        this.scheduleExtraction();
      }
    }
  }

  /**
   * Extract a single ChatMessage from a DOM row element.
   * Returns null when the element doesn't look like a message.
   */
  private extractMessage(
    row: Element,
    conversationId: string
  ): ChatMessage | null {
    // ── Text ──────────────────────────────────────────────────────────────
    const textEl = queryFirst(row, MESSAGE_TEXT_SELECTORS);
    const text = (textEl ?? row).textContent?.trim() ?? "";

    if (text.length === 0) return null;
    // Skip very long "messages" that are likely entire page sections
    if (text.length > 10_000) return null;

    // ── Sender ────────────────────────────────────────────────────────────
    let sender = "Unknown";

    // 1. Stable data attributes on the row itself
    const dataUser =
      row.getAttribute("data-username") ||
      row.getAttribute("data-sender") ||
      row.getAttribute("data-user");

    if (dataUser) {
      sender = dataUser;
    } else {
      // 2. Look for a sender element inside the row
      const senderEl = queryFirst(row, SENDER_SELECTORS);
      if (senderEl) {
        const rawSender = senderEl.textContent?.trim() ?? "";
        // Exclude very long strings (those are body text, not names)
        if (rawSender.length > 0 && rawSender.length < 80) {
          sender = rawSender;
        }
      }
    }

    // ── Timestamp ─────────────────────────────────────────────────────────
    const timestamp = extractTimestamp(row);

    // ── Sender role ───────────────────────────────────────────────────────
    const senderRole = detectSenderRole(row);

    // ── Build message object ──────────────────────────────────────────────
    // Prefer stable DOM message id attributes, otherwise fall back to stable fingerprint
    const domMessageId =
      row.getAttribute("data-message-id") ||
      row.getAttribute("id");
    const id = domMessageId || fingerprint(sender, text, timestamp);

    const msg: ChatMessage = {
      id,
      conversationId,
      sender,
      senderRole,
      text,
      timestamp,
      capturedAt: Date.now(),
      pageUrl: window.location.href,
    };

    return msg;
  }

  // ── Messaging ────────────────────────────────────────────────────────────

  private notifyBackground(messages: ChatMessage[]): void {
    try {
      chrome.runtime.sendMessage({
        type: "FIVERR_MESSAGES_CAPTURED",
        payload: messages,
      });
    } catch (err) {
      // Background SW may not be running; that's fine for passive capture
      console.debug("[ShadowSense] Could not notify background:", err);
    }
  }
}

// ─── URL-change handling for SPA navigation ──────────────────────────────────
/**
 * Fiverr is a SPA – navigating between conversations doesn't reload the page.
 * We watch for pushState / replaceState and history.popstate to re-initialize
 * the observer each time the inbox URL changes.
 */

let currentObserver: FiverrChatObserver | null = null;
let lastPathname = window.location.pathname;

function isInboxPage(): boolean {
  return window.location.pathname.startsWith("/inbox");
}

async function handleNavigation(): Promise<void> {
  const pathname = window.location.pathname;
  if (pathname === lastPathname) return;
  lastPathname = pathname;

  console.log("[ShadowSense] Navigation detected →", pathname);

  // Tear down the previous observer before creating a new one
  currentObserver?.stop();
  currentObserver = null;

  if (isInboxPage()) {
    currentObserver = new FiverrChatObserver();
    await currentObserver.init();
  }
}

// Intercept pushState and replaceState (used by React Router / Next.js SPAs)
(function patchHistory(): void {
  const originalPush = history.pushState.bind(history);
  const originalReplace = history.replaceState.bind(history);

  history.pushState = (...args) => {
    originalPush(...args);
    void handleNavigation().catch((err) =>
      console.error("[ShadowSense] PushState navigation error:", err)
    );
  };

  history.replaceState = (...args) => {
    originalReplace(...args);
    void handleNavigation().catch((err) =>
      console.error("[ShadowSense] ReplaceState navigation error:", err)
    );
  };
})();

window.addEventListener("popstate", () => {
  void handleNavigation().catch((err) =>
    console.error("[ShadowSense] Popstate navigation error:", err)
  );
});

// ─── Entry point ─────────────────────────────────────────────────────────────

(function main(): void {
  console.log("[ShadowSense] Fiverr content script loaded.");

  if (isInboxPage()) {
    currentObserver = new FiverrChatObserver();
    void currentObserver.init().catch((err) =>
      console.error("[ShadowSense] Initialization error:", err)
    );
  } else {
    console.log(
      "[ShadowSense] Not on an inbox page – observer will activate on navigation."
    );
  }
})();
