/**
 * ShadowSense Aurora – Upwork Chat Content Script
 * ─────────────────────────────────────────────────
 * Monitors the Upwork messages/chat page for new messages using a
 * MutationObserver. For each new message it:
 *   1. Extracts text, sender name, and timestamp from the DOM.
 *   2. Deduplicates against already-captured messages.
 *   3. Persists the captured messages to chrome.storage.local.
 *   4. Notifies the background service worker so it can trigger
 *      real-time analysis.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  conversationId: string;
  sender: string;
  senderRole: "self" | "other";
  text: string;
  timestamp: string;
  capturedAt: number;
  pageUrl: string;
}

interface StoragePayload {
  [conversationId: string]: ChatMessage[];
}

// ─── Constants ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "shadowsense_upwork_messages";
const CACHED_SCORE_KEY = "shadowsense_cached_score";
const MAX_MESSAGES_PER_CONVO = 500;
const DEBOUNCE_MS = 300;
const NOTIFY_TIMEOUT_MS = 3000;

// ─── Selector catalogue ────────────────────────────────────────────────────

const CHAT_CONTAINER_SELECTORS = [
  '.fe-chat-thread',
  '[data-qa="chat-thread"]',
  '.message-list',
  '.chat-thread',
  '[role="log"]',
  'main [class*="chat"]',
  'main [class*="message"]',
  'main',
] as const;

const MESSAGE_ROW_SELECTORS = [
  '[data-qa="message"]',
  '[data-testid="message"]',
  '.fe-message',
  '.message-row',
  '[role="listitem"]',
  '.message',
  'article',
  '[class*="message-item"]',
  '[class*="message-row"]',
] as const;

const SENDER_SELECTORS = [
  '.sender-name',
  '[data-qa="sender-name"]',
  '[data-testid="sender-name"]',
  '.author',
  'strong',
  'b',
  '[class*="sender"]',
  '[class*="username"]',
  '[class*="author"]',
] as const;

const TIMESTAMP_SELECTORS = [
  'time',
  '.time',
  '[data-qa="timestamp"]',
  '[data-testid="timestamp"]',
  '.timestamp',
  '[class*="time"]',
  '[class*="date"]',
] as const;

const MESSAGE_TEXT_SELECTORS = [
  '.message-text',
  '.fe-message-text',
  '[data-qa="message-text"]',
  '[data-testid="message-text"]',
  '.story-bubble',
  '[class*="message-body"]',
  '[class*="message-content"]',
  '[class*="text"]',
  'p',
  'span',
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
      // ignore
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

function fingerprint(sender: string, text: string, timestamp: string): string {
  const raw = `${sender}|${text}|${timestamp}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16);
}

function extractTimestamp(row: Element): string {
  const timeEl = queryFirst(row, TIMESTAMP_SELECTORS);
  if (!timeEl) return "";

  const dt =
    timeEl.getAttribute("datetime") ||
    timeEl.getAttribute("title") ||
    timeEl.getAttribute("aria-label");

  if (dt) {
    const parsed = Date.parse(dt);
    if (!isNaN(parsed)) return new Date(parsed).toISOString();
  }

  const visible = timeEl.textContent?.trim() ?? "";
  const parsed = Date.parse(visible);
  if (!isNaN(parsed)) return new Date(parsed).toISOString();

  return visible || "";
}

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

function getConversationId(): string {
  const match = window.location.pathname.match(
    /\/rooms\/(?:room_)?([^/?#]+)/
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
          console.error("[ShadowSense] Storage error:", chrome.runtime.lastError);
        }
        resolve();
      });
    });
  });
}

// ─── Core observer class ────────────────────────────────────────────────────

class UpworkChatObserver {
  private readonly seen = new Set<string>();
  private preloadedIds = new Set<string>();

  private observer: MutationObserver | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private attachRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private chatContainer: Element | null = null;
  private stopped = false;
  private isScanning = false;
  private scanQueued = false;

  async init(): Promise<void> {
    this.stopped = false;
    const conversationId = getConversationId();

    const existing = await loadStoredMessages(conversationId);
    for (const msg of existing) {
      this.preloadedIds.add(msg.id);
      this.seen.add(msg.id);
    }

    console.log(
      `[ShadowSense] Loaded ${this.preloadedIds.size} existing messages ` +
      `for Upwork conversation "${conversationId}"`
    );

    this.attach();
    await this.scanAll();
  }

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
        attributes: false,
      });
      console.log(
        "[ShadowSense] MutationObserver attached to Upwork chat container:",
        container.tagName,
        container.className.slice(0, 60)
      );
    } else if (attempts < 30) {
      if (this.attachRetryTimer !== null) clearTimeout(this.attachRetryTimer);
      this.attachRetryTimer = setTimeout(() => this.attach(attempts + 1), 1000);
    } else {
      console.warn(
        "[ShadowSense] Could not find an Upwork chat container after 30 s."
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
  }

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
        return;
      }

      const conversationId = getConversationId();
      const newMessages: ChatMessage[] = [];

      for (const row of rows) {
        const msg = this.extractMessage(row, conversationId);
        if (!msg) continue;

        if (this.seen.has(msg.id)) continue;
        this.seen.add(msg.id);
        newMessages.push(msg);
      }

      if (newMessages.length === 0) return;

      console.log(
        `[ShadowSense] Captured ${newMessages.length} new message(s) ` +
        `in Upwork conversation "${conversationId}"`
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

  private extractMessage(
    row: Element,
    conversationId: string
  ): ChatMessage | null {
    const textEl = queryFirst(row, MESSAGE_TEXT_SELECTORS);
    const text = (textEl ?? row).textContent?.trim() ?? "";

    if (text.length === 0) return null;
    if (text.length > 10_000) return null;

    let sender = "Unknown";

    const dataUser =
      row.getAttribute("data-username") ||
      row.getAttribute("data-sender") ||
      row.getAttribute("data-user");

    if (dataUser) {
      sender = dataUser;
    } else {
      const senderEl = queryFirst(row, SENDER_SELECTORS);
      if (senderEl) {
        const rawSender = senderEl.textContent?.trim() ?? "";
        if (rawSender.length > 0 && rawSender.length < 80) {
          sender = rawSender;
        }
      }
    }

    const timeEl = queryFirst(row, TIMESTAMP_SELECTORS);
    const timestamp = extractTimestamp(row);
    const timestampKey =
      timeEl?.getAttribute("datetime") ||
      timeEl?.getAttribute("title") ||
      timeEl?.getAttribute("aria-label") ||
      timeEl?.textContent?.trim() ||
      "";

    const senderRole = detectSenderRole(row);

    const domMessageId =
      row.getAttribute("data-message-id") ||
      row.getAttribute("data-messageid") ||
      row.getAttribute("data-testid") ||
      row.getAttribute("id");

    const id = domMessageId
      ? `upwork:${conversationId}:${domMessageId}`
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

  private notifyBackground(messages: ChatMessage[]): void {
    this.saveLastKnownScore();

    const timeoutId = setTimeout(() => {
      this.showOfflineBadge();
    }, NOTIFY_TIMEOUT_MS);

    try {
      chrome.runtime.sendMessage(
        { type: "UPWORK_MESSAGES_CAPTURED", payload: messages },
        (response) => {
          clearTimeout(timeoutId);
          if (chrome.runtime.lastError) {
            console.debug("[ShadowSense] Background response error:", chrome.runtime.lastError);
            this.showOfflineBadge();
            return;
          }
          if (response?.level === 'high-risk') {
            this.injectResponseTemplates([
              "Thanks, but I need to verify this request with Upwork support first.",
              "I'm only able to accept files through the official Upwork platform. Please use the attachment feature here.",
              "I prefer to keep all communication within Upwork to protect both of us. Let's continue here.",
            ]);
          }
        }
      );
    } catch (err) {
      clearTimeout(timeoutId);
      console.debug("[ShadowSense] Could not notify background:", err);
      this.showOfflineBadge();
    }
  }

  private saveLastKnownScore(): void {
    chrome.storage.local.get([CACHED_SCORE_KEY], (result: any) => {
      console.debug("[ShadowSense] Cached score available:", result[CACHED_SCORE_KEY]);
    });
  }

  private showOfflineBadge(): void {
    const BADGE_ID = 'ss-offline-badge';
    if (document.getElementById(BADGE_ID)) return;

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

  private injectResponseTemplates(templates: string[]): void {
    const CONTAINER_ID = 'ss-response-templates';

    document.getElementById(CONTAINER_ID)?.remove();

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

    if (!document.getElementById('ss-tmpl-style')) {
      const style = document.createElement('style');
      style.id = 'ss-tmpl-style';
      style.textContent = `
        @keyframes ss-tmpl-in {
          from { opacity:0; transform:translateY(-6px); }
          to   { opacity:1; transform:translateY(0); }
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

    inputEl.parentElement?.insertBefore(container, inputEl.nextSibling) ||
      inputEl.parentElement?.appendChild(container);

    const onInput = () => { container.remove(); inputEl!.removeEventListener('input', onInput); };
    inputEl.addEventListener('input', onInput);

    setTimeout(() => container.remove(), 30_000);

    console.log('[ShadowSense] Response templates injected below chat input.');
  }
}

// ─── URL-change handling for SPA navigation ──────────────────────────────────

let currentObserver: UpworkChatObserver | null = null;
let lastPathname = window.location.pathname;

function isInboxPage(): boolean {
  const p = window.location.pathname;
  return p.includes("/messages") || p.includes("/rooms");
}

async function handleNavigation(): Promise<void> {
  const pathname = window.location.pathname;
  if (pathname === lastPathname) return;
  lastPathname = pathname;

  console.log("[ShadowSense] Upwork navigation detected →", pathname);

  currentObserver?.stop();
  currentObserver = null;

  if (isInboxPage()) {
    currentObserver = new UpworkChatObserver();
    await currentObserver.init();
  }
}

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
  console.log("[ShadowSense] Upwork Inbox content script loaded.");

  if (isInboxPage()) {
    currentObserver = new UpworkChatObserver();
    void currentObserver.init().catch((err) =>
      console.error("[ShadowSense] Initialization error:", err)
    );
  } else {
    console.log(
      "[ShadowSense] Not on an Upwork messages page – observer will activate on navigation."
    );
  }
})();
