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
const CACHED_SCORE_KEY = "shadowsense_cached_score";
/** Maximum messages stored per conversation before the oldest are evicted */
const MAX_MESSAGES_PER_CONVO = 500;
/** Debounce window (ms) – prevents thrashing on rapid DOM mutations */
const DEBOUNCE_MS = 300;
/** Timeout before we fall back to cached score (ms).
 *  Must be >= ANALYSIS_TIMEOUT_MS in background.ts (90 s) + buffer. */
const NOTIFY_TIMEOUT_MS = 120_000;

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

  // Check data attributes and labels
  const selfSignals = [
    row.getAttribute("data-self"),
    row.getAttribute("data-is-self"),
    row.getAttribute("data-sender-is-me"),
    row.getAttribute("aria-label"),
  ];

  for (const signal of selfSignals) {
    if (!signal) continue;
    const lower = signal.toLowerCase();
    if (
      lower.includes("self") ||
      lower.includes("own") ||
      lower.includes("outgoing") ||
      lower.includes("sent by me") ||
      lower.includes("sent by myself") ||
      /\bme\b/i.test(signal)
    ) {
      return "self";
    }
  }

  // Check className separately to prevent matching "message" containing "me"
  const className = row.className ?? "";
  const lowerClass = className.toLowerCase();
  if (
    lowerClass.includes("self") ||
    lowerClass.includes("own") ||
    lowerClass.includes("outgoing") ||
    lowerClass.includes("sent by me") ||
    lowerClass.includes("sent by myself") ||
    /\bme\b/i.test(className) ||
    lowerClass.includes("is-me") ||
    lowerClass.includes("sender-me")
  ) {
    return "self";
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
  private attachRetryTimer: ReturnType<typeof setTimeout> | null = null;
  /** Periodic fallback scanner — catches mutations the Observer might miss */
  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private chatContainer: Element | null = null;
  private stopped = false;
  private isScanning = false;
  private scanQueued = false;

  // ── Lifecycle ────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    this.stopped = false;

    // Fix A: Always disconnect the stale observer before re-attaching.
    // Fiverr replaces the chat container element on SPA thread switches.
    // Without this, the old observer keeps watching a detached node.
    this.observer?.disconnect();
    this.observer = null;
    this.chatContainer = null;
    this.preloadedIds.clear();
    this.seen.clear();

    const conversationId = getConversationId();

    // Fix B: Only populate preloadedIds (for storage dedup), NOT this.seen.
    // this.seen starts empty so scanAll() will re-capture all visible messages
    // and send them as a fresh context window for analysis.
    const existing = await loadStoredMessages(conversationId);
    for (const msg of existing) {
      this.preloadedIds.add(msg.id);
    }

    console.log(
      `[ShadowSense] Loaded ${this.preloadedIds.size} existing messages ` +
      `for conversation "${conversationId}"`
    );

    this.attach();
    // Do an initial scan for messages already present in the DOM
    await this.scanAll();

    // Fix E: Periodic fallback scanner (10 s) in case MutationObserver misses
    // messages (e.g. virtual-scroll, lazy-loaded bubbles).
    if (this.intervalTimer !== null) clearInterval(this.intervalTimer);
    this.intervalTimer = setInterval(() => {
      if (!this.stopped) {
        void this.scanAll().catch((err) =>
          console.error('[ShadowSense] Interval scan error:', err)
        );
      }
    }, 10_000);
  }

  /**
   * Find the best chat container and attach the MutationObserver.
   * Retries every second for up to 30 s to handle SPA lazy-loading.
   */
  private attach(attempts = 0): void {
    if (this.stopped) return;

    const container = queryFirst(document, CHAT_CONTAINER_SELECTORS);

    if (container) {
      if (this.attachRetryTimer !== null) {
        clearTimeout(this.attachRetryTimer);
        this.attachRetryTimer = null;
      }
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
      if (this.attachRetryTimer !== null) clearTimeout(this.attachRetryTimer);
      this.attachRetryTimer = setTimeout(() => this.attach(attempts + 1), 1000);
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
    this.debounceTimer = null;
    if (this.attachRetryTimer !== null) clearTimeout(this.attachRetryTimer);
    this.attachRetryTimer = null;
    if (this.intervalTimer !== null) clearInterval(this.intervalTimer);
    this.intervalTimer = null;
  }

  // ── Extraction ───────────────────────────────────────────────────────────

  private scheduleExtraction(): void {
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
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

        // Fix B: skip if in seen (this session) OR preloadedIds (prior storage)
        if (this.seen.has(msg.id) || this.preloadedIds.has(msg.id)) continue;
        this.seen.add(msg.id);
        newMessages.push(msg);
      }

      if (newMessages.length === 0) return;

      console.log(
        `[ShadowSense] Captured ${newMessages.length} new message(s) ` +
        `in conversation "${conversationId}"`
      );

      await saveMessages(conversationId, newMessages);
      // Fix C: send the last 10 stored messages as context (not just the new ones)
      const allStored = await loadStoredMessages(conversationId);
      const contextWindow = allStored.slice(-10);
      this.notifyBackground(contextWindow);
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
    const timeEl = queryFirst(row, TIMESTAMP_SELECTORS);
    const timestamp = extractTimestamp(row);
    const timestampKey =
      timeEl?.getAttribute("datetime") ||
      timeEl?.getAttribute("title") ||
      timeEl?.getAttribute("aria-label") ||
      timeEl?.textContent?.trim() ||
      "";

    // ── Sender role ───────────────────────────────────────────────────────
    const senderRole = detectSenderRole(row);

    // ── Build message object ──────────────────────────────────────────────
    const domMessageId =
      row.getAttribute("data-message-id") ||
      row.getAttribute("data-messageid") ||
      row.getAttribute("data-testid") ||
      row.getAttribute("id");

    const id = domMessageId
      ? `fiverr:${conversationId}:${domMessageId}`
      : fingerprint(sender, text, timestampKey);

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

  // ── Fix D: Analyzing spinner badge ──────────────────────────────────────

  private showAnalyzingBadge(): void {
    const BADGE_ID = 'ss-analyzing-badge';
    if (document.getElementById(BADGE_ID)) return;
    const badge = document.createElement('div');
    badge.id = BADGE_ID;
    badge.setAttribute('role', 'status');
    badge.setAttribute('aria-live', 'polite');
    badge.style.cssText = [
      'position:fixed', 'bottom:80px', 'right:16px', 'z-index:2147483647',
      'background:#312e81', 'color:#fff', 'font-size:11px',
      'font-family:system-ui,sans-serif', 'font-weight:500',
      'padding:7px 14px', 'border-radius:8px',
      'box-shadow:0 4px 16px rgba(0,0,0,0.3)',
      'display:flex', 'align-items:center', 'gap:8px',
      'opacity:0', 'transition:opacity 0.2s ease',
    ].join(';');
    badge.innerHTML = `<span>🛡</span><span>ShadowSense — Analyzing…</span>`;
    document.body.appendChild(badge);
    requestAnimationFrame(() => { badge.style.opacity = '1'; });
  }

  private hideAnalyzingBadge(): void {
    const badge = document.getElementById('ss-analyzing-badge');
    if (!badge) return;
    badge.style.opacity = '0';
    setTimeout(() => badge.remove(), 200);
  }

  private notifyBackground(messages: ChatMessage[]): void {
    // Save a cached score so we can show it offline
    this.saveLastKnownScore();

    // Fix D: show spinner while waiting for 20-90s backend response
    this.showAnalyzingBadge();

    const timeoutId = setTimeout(() => {
      // Background didn't respond in time — show offline badge
      this.hideAnalyzingBadge();
      this.showOfflineBadge();
    }, NOTIFY_TIMEOUT_MS);

    // Get latest message text from the other party for override feedback mapping
    const incomingMessages = messages.filter((m) => m.senderRole === "other");
    const latestText = incomingMessages.length > 0 ? incomingMessages[incomingMessages.length - 1].text : "";

    try {
      chrome.runtime.sendMessage(
        { type: "FIVERR_MESSAGES_CAPTURED", payload: messages },
        (response) => {
          clearTimeout(timeoutId);
          this.hideAnalyzingBadge(); // Fix D: hide spinner on any response
          if (chrome.runtime.lastError) {
            console.debug("[ShadowSense] Background response error:", chrome.runtime.lastError);
            this.showOfflineBadge();
            return;
          }
          if (response && response.success) {
            const level         = response.level ?? 'clear';
            const score         = response.trust_score ?? 100;
            const reasons       = response.reasons ?? [];
            const analysisId    = response.analysis_id ?? '';
            const aiTemplates   = (response.suggested_responses ?? []) as string[];

            // Inject response chips for high-risk AND advisory
            if (level === 'high-risk' || level === 'advisory') {
              const highRiskFallback = [
                "Thanks, but I need to verify this request with Fiverr support first.",
                "I'm only able to accept files through the official Fiverr platform. Please use the attachment feature here.",
                "I prefer to keep all communication within Fiverr to protect both of us. Let's continue here.",
              ];
              const advisoryFallback = [
                "Thank you for your message. Please share all project details directly on the platform.",
                "I'd love to help — could we keep all communication and files within the platform?",
                "Let's discuss the full scope of work here before I commit to anything.",
              ];
              const fallback = level === 'high-risk' ? highRiskFallback : advisoryFallback;
              // AI-generated templates take priority; fall back to static if backend returned none
              this.injectResponseTemplates(aiTemplates.length > 0 ? aiTemplates : fallback);
            }

            // Inject in-chat intervention overlay
            this.injectInterventionOverlay(score, level, reasons, analysisId, latestText);
          } else if (response && !response.success) {
            this.showOfflineBadge();
          }
        }
      );
    } catch (err) {
      clearTimeout(timeoutId);
      console.debug("[ShadowSense] Could not notify background:", err);
      this.showOfflineBadge();
    }
  }

  /**
   * Persist the last known analysis result to chrome.storage.local
   * so it can be shown when the backend is unreachable.
   */
  private saveLastKnownScore(): void {
    chrome.storage.local.get([CACHED_SCORE_KEY], (result: any) => {
      // keep whatever was already stored; only update after a real analysis result comes back
      console.debug("[ShadowSense] Cached score available:", result[CACHED_SCORE_KEY]);
    });
  }

  /**
   * Show a non-blocking "offline — cached score" badge in the chat area.
   * Attaches to the first suitable anchor; removes itself after 6 s.
   */
  private showOfflineBadge(): void {
    const BADGE_ID = 'ss-offline-badge';
    if (document.getElementById(BADGE_ID)) return; // already shown

    chrome.storage.local.get([CACHED_SCORE_KEY], (result: any) => {
      const cached = result[CACHED_SCORE_KEY];
      const scoreText = cached != null ? `cached score: ${cached}` : 'no cached data';

      const badge = document.createElement('div');
      badge.id = BADGE_ID;
      badge.setAttribute('role', 'status');
      badge.setAttribute('aria-live', 'polite');
      badge.style.cssText = [
        'position:fixed', 'bottom:80px', 'right:16px', 'z-index:2147483647',
        'background:#27272a', 'color:#fafafa', 'font-size:11px',
        'font-family:system-ui,sans-serif', 'font-weight:500',
        'padding:7px 12px', 'border-radius:8px',
        'box-shadow:0 4px 16px rgba(0,0,0,0.3)',
        'display:flex', 'align-items:center', 'gap:6px',
        'opacity:0', 'transition:opacity 0.2s ease',
        'pointer-events:none',
      ].join(';');
      badge.innerHTML = `⚠️ <span>Offline — showing ${scoreText}</span>`;

      document.body.appendChild(badge);
      requestAnimationFrame(() => { badge.style.opacity = '1'; });
      setTimeout(() => {
        badge.style.opacity = '0';
        setTimeout(() => badge.remove(), 250);
      }, 6000);
    });
  }

  /**
   * Inject 3 click-to-copy response template chips below the Fiverr chat input.
   * Idempotent — removes any existing injection before re-injecting.
   * Auto-removes when the user starts typing or after 30 s.
   */
  private injectResponseTemplates(templates: string[]): void {
    const CONTAINER_ID = 'ss-response-templates';

    // Remove any existing injection first
    document.getElementById(CONTAINER_ID)?.remove();

    // Find the chat input using stable ARIA selectors
    const INPUT_SELECTORS = [
      '[data-testid*="message-input"]',
      '[data-testid*="chat-input"]',
      '[aria-label*="message" i][contenteditable]',
      '[role="textbox"]',
      'textarea[placeholder*="message" i]',
      'textarea[placeholder*="reply" i]',
      'textarea[placeholder*="write" i]',
      'div[contenteditable="true"]',
    ] as const;

    let inputEl: Element | null = null;
    for (const sel of INPUT_SELECTORS) {
      try {
        inputEl = document.querySelector(sel);
        if (inputEl) break;
      } catch { /* ignore */ }
    }

    if (!inputEl) {
      console.debug('[ShadowSense] Chat input not found — skipping template injection');
      return;
    }

    // Build container
    const container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'ShadowSense — Suggested safe responses');
    container.style.cssText = [
      'display:flex', 'flex-direction:column', 'gap:6px',
      'padding:8px 12px', 'margin-top:4px',
      'background:linear-gradient(135deg,#fcebeb,#fafafa)',
      'border-top:2px solid #e24b4a',
      'animation:ss-tmpl-in 0.25s ease both',
      'font-family:system-ui,sans-serif',
    ].join(';');

    // Inject animation keyframe if not present
    if (!document.getElementById('ss-tmpl-style')) {
      const style = document.createElement('style');
      style.id = 'ss-tmpl-style';
      style.textContent = `
        @keyframes ss-tmpl-in {
          from { opacity:0; transform:translateY(-6px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes ss-copied {
          0%   { background:#e1f5ee; }
          100% { background:transparent; }
        }
        #ss-response-templates .ss-chip {
          display:flex; align-items:flex-start; justify-content:space-between;
          gap:8px; background:#fff; border:1px solid #e4e4e7;
          border-radius:8px; padding:8px 10px;
          transition:border-color 0.15s;
        }
        #ss-response-templates .ss-chip:hover { border-color:#7b61ff; }
        #ss-response-templates .ss-chip-text {
          font-size:11px; color:#52525b; line-height:1.5; flex:1; min-width:0;
        }
        #ss-response-templates .ss-chip-copy {
          font-size:10px; font-weight:600; color:#7f56d9;
          background:transparent; border:1px solid transparent;
          border-radius:5px; padding:3px 7px; cursor:pointer;
          white-space:nowrap; flex-shrink:0;
          transition:background 0.12s,color 0.12s;
        }
        #ss-response-templates .ss-chip-copy:hover {
          background:#eeedfe; border-color:#7b61ff;
        }
        #ss-response-templates .ss-chip-copy.copied {
          color:#0f6e56; background:#e1f5ee; border-color:#1d9e7555;
        }
        #ss-header-row {
          display:flex; justify-content:space-between; align-items:center;
          font-size:9px; font-weight:700; text-transform:uppercase;
          letter-spacing:0.06em; color:#a32d2d;
        }
        #ss-dismiss-btn {
          background:none; border:none; cursor:pointer;
          font-size:11px; color:#a1a1aa; padding:0;
          font-family:system-ui,sans-serif;
        }
      `;
      document.head.appendChild(style);
    }

    // Header row
    const headerRow = document.createElement('div');
    headerRow.id = 'ss-header-row';
    const headerLabel = document.createElement('span');
    headerLabel.textContent = '🛡 ShadowSense — Shield Responses';
    const dismissBtn = document.createElement('button');
    dismissBtn.id = 'ss-dismiss-btn';
    dismissBtn.textContent = '✕ Dismiss';
    dismissBtn.onclick = () => container.remove();
    headerRow.appendChild(headerLabel);
    headerRow.appendChild(dismissBtn);
    container.appendChild(headerRow);

    // Template chips
    templates.forEach((text) => {
      const chip = document.createElement('div');
      chip.className = 'ss-chip';

      const label = document.createElement('span');
      label.className = 'ss-chip-text';
      label.textContent = text;

      const copyBtn = document.createElement('button');
      copyBtn.className = 'ss-chip-copy';
      copyBtn.textContent = 'Copy';
      copyBtn.setAttribute('aria-label', 'Copy response to clipboard');
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(text).catch(() => {
          const el = document.createElement('textarea');
          el.value = text;
          document.body.appendChild(el);
          el.select();
          document.execCommand('copy');
          document.body.removeChild(el);
        });
        copyBtn.textContent = '✓ Copied!';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.textContent = 'Copy';
          copyBtn.classList.remove('copied');
        }, 1500);
      };

      chip.appendChild(label);
      chip.appendChild(copyBtn);
      container.appendChild(chip);
    });

    // Insert after the input element
    inputEl.parentElement?.insertBefore(container, inputEl.nextSibling) ||
      inputEl.parentElement?.appendChild(container);

    // Auto-remove when user starts typing
    const onInput = () => { container.remove(); inputEl!.removeEventListener('input', onInput); };
    inputEl.addEventListener('input', onInput);

    // Auto-remove after 30 s
    setTimeout(() => container.remove(), 30_000);

    console.log('[ShadowSense] Response templates injected below chat input.');
  }

  private ensureStyles(): void {
    if (document.getElementById('ss-intervention-styles')) return;
    const style = document.createElement('style');
    style.id = 'ss-intervention-styles';
    style.textContent = `
      :root {
        /* Neutral Palette (Light) */
        --ss-color-bg-base: #fafafa;
        --ss-color-bg-surface: #ffffff;
        --ss-color-border-primary: #e4e4e7;
        --ss-color-border-secondary: #f4f4f5;
        --ss-color-text-primary: #09090b;
        --ss-color-text-secondary: #52525b;
        --ss-color-text-tertiary: #a1a1aa;

        /* Risk State (Red) */
        --ss-color-risk-bg: #fcebeb;
        --ss-color-risk-border: #e24b4a55;
        --ss-color-risk-text: #a32d2d;
        --ss-color-risk-primary: #e24b4a;

        /* Advisory State (Amber) */
        --ss-color-warn-bg: #faeeda;
        --ss-color-warn-border: #ef9f2755;
        --ss-color-warn-text: #854f0b;
        --ss-color-warn-primary: #ba7517;

        /* Clear State (Green) */
        --ss-color-clear-bg: #e1f5ee;
        --ss-color-clear-border: #1d9e7555;
        --ss-color-clear-text: #0f6e56;
        --ss-color-clear-primary: #1d9e75;

        /* Accent (Purple) */
        --ss-color-accent: #7f56d9;
        --ss-color-accent-light: #7b61ff;
        --ss-color-accent-bg: #eeedfe;
        --ss-color-accent-text: #3c3489;

        --ss-border-radius-sm: 6px;
        --ss-border-radius-md: 10px;
        --ss-border-radius-lg: 16px;

        /* Gradients */
        --ss-grad-risk: linear-gradient(135deg, #fff5f5 0%, #fee2e2 100%);
        --ss-grad-warn: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
        --ss-grad-clear: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
        --ss-grad-accent: linear-gradient(135deg, #eeedfe 0%, #e0e0ff 100%);

        /* Glowing shadows */
        --ss-glow-risk: 0 8px 32px rgba(226, 75, 74, 0.15), 0 2px 8px rgba(226, 75, 74, 0.08);
        --ss-glow-warn: 0 8px 32px rgba(239, 159, 39, 0.15), 0 2px 8px rgba(239, 159, 39, 0.08);
        --ss-glow-clear: 0 8px 32px rgba(29, 158, 117, 0.15), 0 2px 8px rgba(29, 158, 117, 0.08);
        --ss-glow-accent: 0 8px 32px rgba(123, 97, 255, 0.15), 0 2px 8px rgba(123, 97, 255, 0.08);
      }

      /* Dark Mode support */
      @media (prefers-color-scheme: dark) {
        :root {
          --ss-color-bg-base: #18181b;
          --ss-color-bg-surface: #27272a;
          --ss-color-border-primary: #3f3f46;
          --ss-color-border-secondary: #2c2c30;
          --ss-color-text-primary: #fafafa;
          --ss-color-text-secondary: #a1a1aa;
          --ss-color-text-tertiary: #71717a;

          --ss-color-risk-bg: #2d1515;
          --ss-color-risk-border: #e24b4a40;
          --ss-color-risk-text: #fca5a5;
          --ss-color-risk-primary: #ef4444;

          --ss-color-warn-bg: #2d1f08;
          --ss-color-warn-border: #ef9f2740;
          --ss-color-warn-text: #fcd34d;
          --ss-color-warn-primary: #f59e0b;

          --ss-color-clear-bg: #0d2e22;
          --ss-color-clear-border: #1d9e7540;
          --ss-color-clear-text: #6ee7b7;
          --ss-color-clear-primary: #10b981;

          --ss-color-accent: #a78bfa;
          --ss-color-accent-light: #a78bfa;
          --ss-color-accent-bg: #1e1a3a;
          --ss-color-accent-text: #c4b5fd;

          --ss-grad-risk: linear-gradient(135deg, #2d1515 0%, #1c0b0b 100%);
          --ss-grad-warn: linear-gradient(135deg, #2d1f08 0%, #1e1302 100%);
          --ss-grad-clear: linear-gradient(135deg, #0d2e22 0%, #081e16 100%);
          --ss-grad-accent: linear-gradient(135deg, #1e1a3a 0%, #121024 100%);
        }
      }

      /* Explicit dark theme targets for platforms with custom dark theme toggles */
      html[data-theme="dark"],
      body.dark-mode,
      body[class*="dark"],
      .dark,
      .dark-theme {
        --ss-color-bg-base: #18181b;
        --ss-color-bg-surface: #27272a;
        --ss-color-border-primary: #3f3f46;
        --ss-color-border-secondary: #2c2c30;
        --ss-color-text-primary: #fafafa;
        --ss-color-text-secondary: #a1a1aa;
        --ss-color-text-tertiary: #71717a;

        --ss-color-risk-bg: #2d1515;
        --ss-color-risk-border: #e24b4a40;
        --ss-color-risk-text: #fca5a5;
        --ss-color-risk-primary: #ef4444;

        --ss-color-warn-bg: #2d1f08;
        --ss-color-warn-border: #ef9f2740;
        --ss-color-warn-text: #fcd34d;
        --ss-color-warn-primary: #f59e0b;

        --ss-color-clear-bg: #0d2e22;
        --ss-color-clear-border: #1d9e7540;
        --ss-color-clear-text: #6ee7b7;
        --ss-color-clear-primary: #10b981;

        --ss-color-accent: #a78bfa;
        --ss-color-accent-light: #a78bfa;
        --ss-color-accent-bg: #1e1a3a;
        --ss-color-accent-text: #c4b5fd;

        --ss-grad-risk: linear-gradient(135deg, #2d1515 0%, #1c0b0b 100%);
        --ss-grad-warn: linear-gradient(135deg, #2d1f08 0%, #1e1302 100%);
        --ss-grad-clear: linear-gradient(135deg, #0d2e22 0%, #081e16 100%);
        --ss-grad-accent: linear-gradient(135deg, #1e1a3a 0%, #121024 100%);
      }

      .ss-intervention-wrapper {
        border: 1.5px solid var(--ss-color-risk-border) !important;
        border-radius: var(--ss-border-radius-lg) !important;
        background: var(--ss-grad-risk) !important;
        overflow: hidden !important;
        margin-bottom: 16px !important;
        margin-top: 16px !important;
        font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif !important;
        box-shadow: var(--ss-glow-risk) !important;
        transition: all 0.3s ease !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }
      .ss-intervention-wrapper.ss-advisory {
        border-color: var(--ss-color-warn-border) !important;
        background: var(--ss-grad-warn) !important;
        box-shadow: var(--ss-glow-warn) !important;
      }
      .ss-intervention-banner {
        background: var(--ss-color-risk-primary) !important;
        color: var(--ss-color-bg-surface) !important;
        padding: 8px 14px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        font-size: 11px !important;
        font-weight: 600 !important;
      }
      .ss-intervention-wrapper.ss-advisory .ss-intervention-banner {
        background: var(--ss-color-warn-primary) !important;
        color: var(--ss-color-bg-surface) !important;
      }
      .ss-intervention-banner-left {
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
      }
      .ss-intervention-body {
        padding: 12px 14px !important;
        background: transparent !important;
      }
      .ss-intervention-wrapper.ss-advisory .ss-intervention-body {
        background: transparent !important;
      }
      .ss-intervention-title {
        font-size: 13px !important;
        font-weight: 700 !important;
        color: var(--ss-color-risk-text) !important;
        margin-bottom: 4px !important;
      }
      .ss-intervention-wrapper.ss-advisory .ss-intervention-title {
        color: var(--ss-color-warn-text) !important;
      }
      .ss-intervention-desc {
        font-size: 12px !important;
        color: var(--ss-color-text-secondary) !important;
        line-height: 1.4 !important;
        margin-bottom: 10px !important;
      }
      .ss-intervention-wrapper.ss-advisory .ss-intervention-desc {
        color: var(--ss-color-text-secondary) !important;
        margin-bottom: 0px !important;
      }
      .ss-intervention-actions {
        display: flex !important;
        gap: 8px !important;
      }
      .ss-inter-btn-white {
        background: var(--ss-color-bg-surface) !important;
        border: 1px solid var(--ss-color-border-primary) !important;
        color: var(--ss-color-text-secondary) !important;
        font-size: 11px !important;
        padding: 6px 12px !important;
        border-radius: var(--ss-border-radius-sm) !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        transition: background 0.2s, border-color 0.2s !important;
      }
      .ss-inter-btn-white:hover {
        background: var(--ss-color-border-secondary) !important;
        border-color: var(--ss-color-border-primary) !important;
      }
      .ss-inter-btn-accent {
        background: var(--ss-color-risk-primary) !important;
        color: white !important;
        border: none !important;
        font-size: 11px !important;
        padding: 6px 12px !important;
        border-radius: var(--ss-border-radius-sm) !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        transition: background 0.2s !important;
      }
      .ss-inter-btn-accent:hover {
        background: var(--ss-color-risk-primary) !important;
        opacity: 0.9 !important;
      }
      .ss-floating-mini-badge {
        align-self: center !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 8px !important;
        background: var(--ss-color-clear-bg) !important;
        border: 1px solid var(--ss-color-clear-border) !important;
        border-radius: 100px !important;
        padding: 4px 16px !important;
        font-size: 12px !important;
        font-weight: 600 !important;
        color: var(--ss-color-clear-text) !important;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05) !important;
        margin-bottom: 16px !important;
        margin-top: 16px !important;
        font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif !important;
      }
      .ss-high-risk-input-border {
        border: 2px dashed var(--ss-color-risk-primary) !important;
        border-radius: var(--ss-border-radius-md) !important;
        position: relative !important;
      }
      .ss-input-blocking-overlay {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        background: var(--ss-color-risk-bg) !important;
        opacity: 0.94 !important;
        backdrop-filter: blur(4px) !important;
        -webkit-backdrop-filter: blur(4px) !important;
        z-index: 10000 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: not-allowed !important;
        pointer-events: all !important;
        border-radius: inherit !important;
        font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif !important;
        padding: 8px !important;
        box-sizing: border-box !important;
      }
      .ss-blocking-text {
        color: var(--ss-color-risk-text) !important;
        font-size: 12px !important;
        font-weight: 700 !important;
        text-align: center !important;
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
      }
      .ss-dismiss-btn {
        background: none !important;
        border: none !important;
        cursor: pointer !important;
        font-size: 12px !important;
        color: white !important;
        padding: 0 !important;
        font-weight: bold !important;
      }
    `;
    document.head.appendChild(style);
  }

  private cleanInterventions(): void {
    // Remove wrapper cards and badges
    document.querySelectorAll('.ss-intervention-wrapper, .ss-floating-mini-badge').forEach((el) => el.remove());
    // Remove blocking overlays
    document.querySelectorAll('.ss-input-blocking-overlay').forEach((el) => el.remove());
    // Remove border highlights
    document.querySelectorAll('.ss-high-risk-input-border').forEach((el) => {
      el.classList.remove('ss-high-risk-input-border');
    });
  }

  private injectInterventionOverlay(
    score: number,
    level: string,
    reasons: string[],
    analysisId: string,
    messageText: string
  ): void {
    this.ensureStyles();
    this.cleanInterventions();

    const root = this.chatContainer ?? document;
    const rows = queryAll<Element>(root, MESSAGE_ROW_SELECTORS);
    if (rows.length === 0) return;

    // Find the last incoming message row
    let targetRow: Element | null = null;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (detectSenderRole(rows[i]) === "other") {
        targetRow = rows[i];
        break;
      }
    }
    if (!targetRow) {
      targetRow = rows[rows.length - 1];
    }

    if (!targetRow || !targetRow.parentElement) return;

    const reasonsText = reasons && reasons.length > 0
      ? `<ul style="margin:4px 0 0 0;padding-left:18px;">` +
          reasons.slice(0, 5).map(r =>
            `<li style="font-size:11px;line-height:1.55;margin-bottom:3px;">${r}</li>`
          ).join('') +
        `</ul>`
      : `<p style="font-size:11px;margin:0;">Suspicious metadata or behavioral characteristics detected.</p>`;

    if (level === 'high-risk') {
      // Create High-Risk Card
      const overlay = document.createElement('div');
      overlay.className = 'ss-intervention-wrapper';
      overlay.innerHTML = `
        <div class="ss-intervention-banner">
          <div class="ss-intervention-banner-left">
            <span>⚠️ ShadowSense Agentic Shield Active</span>
          </div>
          <span style="font-size:9px" class="text-mono">Blocked</span>
        </div>
        <div class="ss-intervention-body">
          <div class="ss-intervention-title">Shield Block Applied (Trust Score: ${score})</div>
          <div class="ss-intervention-desc">
            ${reasonsText}
          </div>
          <div class="ss-intervention-actions">
            <button class="ss-inter-btn-white" id="ss-report-btn">Report Scam</button>
            <button class="ss-inter-btn-accent" id="ss-bypass-btn">Bypass Warning</button>
          </div>
        </div>
      `;

      // Insert overlay above the last incoming message row
      targetRow.parentElement.insertBefore(overlay, targetRow);

      // Add Event Listeners
      overlay.querySelector('#ss-bypass-btn')?.addEventListener('click', () => {
        chrome.runtime.sendMessage({
          type: "SUBMIT_OVERRIDE_FEEDBACK",
          payload: {
            analysis_id: analysisId,
            pattern_text: messageText || "Override flagged conversation",
            user_id: "anonymous",
            trust_score: score
          }
        }, (res) => {
          console.log("[ShadowSense] Override submitted:", res);
          const body = overlay.querySelector('.ss-intervention-body');
          if (body) {
            overlay.style.borderColor = 'var(--ss-color-clear-primary)';
            overlay.style.background = 'linear-gradient(135deg, var(--ss-color-clear-bg) 0%, #ffffff 100%)';
            const banner = overlay.querySelector('.ss-intervention-banner');
            if (banner) {
              (banner as HTMLElement).style.background = 'var(--ss-color-clear-primary)';
              const bannerText = banner.querySelector('span');
              if (bannerText) bannerText.textContent = '✓ Warning Overridden';
            }
            body.innerHTML = `
              <div style="display:flex;align-items:flex-start;gap:10px;">
                <div style="width:24px;height:24px;border-radius:50%;background:var(--ss-color-clear-bg);border:1px solid var(--ss-color-clear-border);display:flex;align-items:center;justify-content:center;color:var(--ss-color-clear-primary);font-weight:bold;flex-shrink:0;">✓</div>
                <div>
                  <div class="ss-intervention-title" style="color: var(--ss-color-clear-text);margin-bottom:2px;">Override Processed</div>
                  <div class="ss-intervention-desc" style="color: var(--ss-color-clear-text);margin:0;">Safety warning bypassed successfully.</div>
                </div>
              </div>
            `;
            const inputOverlay = document.querySelector('.ss-input-blocking-overlay');
            if (inputOverlay) inputOverlay.remove();
            const inputParent = document.querySelector('.ss-high-risk-input-border');
            if (inputParent) inputParent.classList.remove('ss-high-risk-input-border');
          }
          setTimeout(() => this.cleanInterventions(), 1000);
        });
      });

      overlay.querySelector('#ss-report-btn')?.addEventListener('click', () => {
        chrome.runtime.sendMessage({
          type: "SUBMIT_GENERAL_FEEDBACK",
          payload: {
            analysis_id: analysisId,
            user_feedback: "report",
            was_accurate: true,
            additional_context: { platform: "fiverr", score }
          }
        }, (res) => {
          console.log("[ShadowSense] Report submitted:", res);
          const body = overlay.querySelector('.ss-intervention-body');
          if (body) {
            overlay.style.borderColor = 'var(--ss-color-clear-primary)';
            overlay.style.background = 'linear-gradient(135deg, var(--ss-color-clear-bg) 0%, #ffffff 100%)';
            overlay.style.boxShadow = '0 8px 32px rgba(16, 185, 129, 0.08)';
            const banner = overlay.querySelector('.ss-intervention-banner');
            if (banner) {
              (banner as HTMLElement).style.background = 'var(--ss-color-clear-primary)';
              const bannerText = banner.querySelector('span');
              if (bannerText) bannerText.textContent = '✓ ShadowSense Threat Flagged';
            }
            body.innerHTML = `
              <div style="display:flex;align-items:flex-start;gap:10px;">
                <div style="width:24px;height:24px;border-radius:50%;background:var(--ss-color-clear-bg);border:1px solid var(--ss-color-clear-border);display:flex;align-items:center;justify-content:center;color:var(--ss-color-clear-primary);font-weight:bold;flex-shrink:0;">✓</div>
                <div>
                  <div class="ss-intervention-title" style="color: var(--ss-color-clear-text);margin-bottom:2px;">Thank you for reporting!</div>
                  <div class="ss-intervention-desc" style="color: var(--ss-color-clear-text);margin:0;">The threat signature has been flagged for analysis. You can now close this conversation safely.</div>
                </div>
              </div>
            `;
          }
        });
      });

      // Block Input Box
      const INPUT_SELECTORS = [
        '[data-testid*="message-input"]',
        '[data-testid*="chat-input"]',
        '[aria-label*="message" i][contenteditable]',
        '[role="textbox"]',
        'textarea[placeholder*="message" i]',
        'textarea[placeholder*="reply" i]',
        'textarea[placeholder*="write" i]',
        'div[contenteditable="true"]',
      ] as const;

      let inputEl: Element | null = null;
      for (const sel of INPUT_SELECTORS) {
        try {
          inputEl = document.querySelector(sel);
          if (inputEl) break;
        } catch {}
      }

      if (inputEl) {
        const inputParent = inputEl.parentElement;
        if (inputParent) {
          inputParent.classList.add('ss-high-risk-input-border');
          const originalPosition = window.getComputedStyle(inputParent).position;
          if (originalPosition !== 'relative' && originalPosition !== 'absolute' && originalPosition !== 'fixed') {
            (inputParent as HTMLElement).style.position = 'relative';
          }

          const inputOverlay = document.createElement('div');
          inputOverlay.className = 'ss-input-blocking-overlay';
          inputOverlay.innerHTML = `
            <div class="ss-blocking-text">
              ⚠️ Typing disabled. Please review safety warning above.
            </div>
          `;
          inputParent.appendChild(inputOverlay);
        }
      }

    } else if (level === 'advisory') {
      // Create Advisory Card
      const overlay = document.createElement('div');
      overlay.className = 'ss-intervention-wrapper ss-advisory';
      overlay.innerHTML = `
        <div class="ss-intervention-banner">
          <div class="ss-intervention-banner-left">
            <span>⚠️ ShadowSense Advisory Active</span>
          </div>
          <button class="ss-dismiss-btn" id="ss-advisory-dismiss">Dismiss ×</button>
        </div>
        <div class="ss-intervention-body">
          <div class="ss-intervention-title">Caution (Trust Score: ${score})</div>
          <div class="ss-intervention-desc">
            ${reasonsText}
          </div>
          <div class="ss-intervention-actions" style="margin-top: 8px;">
            <button class="ss-inter-btn-white" id="ss-advisory-report" style="border-color: var(--ss-color-warn-border); color: var(--ss-color-warn-text); background: white;">Report Client</button>
          </div>
        </div>
      `;

      targetRow.parentElement.insertBefore(overlay, targetRow);

      overlay.querySelector('#ss-advisory-dismiss')?.addEventListener('click', () => {
        this.cleanInterventions();
      });

      overlay.querySelector('#ss-advisory-report')?.addEventListener('click', () => {
        chrome.runtime.sendMessage({
          type: "SUBMIT_GENERAL_FEEDBACK",
          payload: {
            analysis_id: analysisId,
            user_feedback: "report",
            was_accurate: true,
            additional_context: { platform: "fiverr", score }
          }
        }, (res) => {
          console.log("[ShadowSense] Report submitted:", res);
          const body = overlay.querySelector('.ss-intervention-body');
          if (body) {
            overlay.style.borderColor = 'var(--ss-color-clear-primary)';
            overlay.style.background = 'linear-gradient(135deg, var(--ss-color-clear-bg) 0%, #ffffff 100%)';
            overlay.style.boxShadow = '0 8px 32px rgba(16, 185, 129, 0.08)';
            const banner = overlay.querySelector('.ss-intervention-banner');
            if (banner) {
              (banner as HTMLElement).style.background = 'var(--ss-color-clear-primary)';
              const bannerText = banner.querySelector('span');
              if (bannerText) bannerText.textContent = '✓ ShadowSense Threat Flagged';
            }
            body.innerHTML = `
              <div style="display:flex;align-items:flex-start;gap:10px;">
                <div style="width:24px;height:24px;border-radius:50%;background:var(--ss-color-clear-bg);border:1px solid var(--ss-color-clear-border);display:flex;align-items:center;justify-content:center;color:var(--ss-color-clear-primary);font-weight:bold;flex-shrink:0;">✓</div>
                <div>
                  <div class="ss-intervention-title" style="color: var(--ss-color-clear-text);margin-bottom:2px;">Thank you for reporting!</div>
                  <div class="ss-intervention-desc" style="color: var(--ss-color-clear-text);margin:0;">The warning has been reported to the community moderation system.</div>
                </div>
              </div>
            `;
            setTimeout(() => this.cleanInterventions(), 2000);
          }
        });
      });

    } else if (level === 'clear') {
      // Create Minimal Badge
      const badge = document.createElement('div');
      badge.className = 'ss-floating-mini-badge';
      badge.innerHTML = `
        <span>🛡 Checked by ShadowSense: Safe Client (${score}/100)</span>
      `;
      targetRow.parentElement.insertBefore(badge, targetRow);
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
