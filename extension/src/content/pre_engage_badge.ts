/**
 * pre_engage_badge.ts
 * ═══════════════════
 * Self-contained badge injection module for Pre-Engagement Trust Score display.
 * Injects 🟢/🟡/🔴 pill badges with hover tooltip into Fiverr/Upwork DOM.
 *
 * All CSS is injected via adoptedStyleSheets (Chrome MV3 compatible).
 * No external files or dependencies required.
 *
 * Public API
 * ──────────
 *   injectBadge(anchor, options, position?)  → HTMLElement
 *   removeBadge(badgeId)
 *   updateBadge(anchor, options, position?)  → HTMLElement
 *   BADGE_INJECTED_ATTR  — data attribute stamped on injected wrappers
 */

export type Verdict = "VERIFIED_SAFE" | "MODERATE_RISK" | "HIGH_RISK" | "LOADING" | "ERROR";

export interface BadgeOptions {
  badgeId:          string;
  score:            number;
  verdict:          Verdict;
  redFlags:         string[];
  topPatternType?:  string;
  platform:         "fiverr" | "upwork";
}

export const BADGE_INJECTED_ATTR = "data-ss-badge";

// ─── Styles ────────────────────────────────────────────────────────────────

let _stylesInjected = false;

function ensureStyles(): void {
  if (_stylesInjected) return;
  _stylesInjected = true;

  const css = `
    :root {
      /* Neutral Palette (Light) */
      --ss-font-sans: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      --ss-font-mono: 'JetBrains Mono', monospace;

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

      /* Glassmorphism */
      --ss-glass-bg: rgba(255, 255, 255, 0.75);
      --ss-glass-border: rgba(228, 228, 231, 0.6);
      --ss-glass-blur: blur(12px);

      --ss-shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      --ss-shadow-md: 0 4px 12px -2px rgba(9, 9, 11, 0.04), 0 2px 6px -1px rgba(9, 9, 11, 0.02);
      --ss-shadow-lg: 0 10px 25px -5px rgba(9, 9, 11, 0.08), 0 8px 10px -6px rgba(9, 9, 11, 0.08);
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

        --ss-glass-bg: rgba(39, 39, 42, 0.8);
        --ss-glass-border: rgba(63, 63, 70, 0.55);
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

      --ss-glass-bg: rgba(39, 39, 42, 0.8);
      --ss-glass-border: rgba(63, 63, 70, 0.55);
    }

    .ss-badge-wrapper {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: var(--ss-font-sans);
      margin: 6px 0 8px 0;
      position: relative;
    }

    .ss-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px 4px 8px;
      border-radius: 20px;
      font-size: 11.5px;
      font-weight: 600;
      letter-spacing: 0.02em;
      cursor: pointer;
      border: none;
      outline: none;
      transition: box-shadow 0.18s ease, transform 0.12s ease;
      white-space: nowrap;
      user-select: none;
      line-height: 1.4;
    }
    .ss-badge:hover { transform: translateY(-1px); }

    .ss-badge--safe {
      background: var(--ss-grad-clear);
      color: var(--ss-color-clear-text);
      border: 1px solid var(--ss-color-clear-border);
      box-shadow: var(--ss-glow-clear);
    }
    .ss-badge--safe:hover { box-shadow: var(--ss-glow-clear); }

    .ss-badge--moderate {
      background: var(--ss-grad-warn);
      color: var(--ss-color-warn-text);
      border: 1px solid var(--ss-color-warn-border);
      box-shadow: var(--ss-glow-warn);
    }
    .ss-badge--moderate:hover { box-shadow: var(--ss-glow-warn); }

    .ss-badge--risk {
      background: var(--ss-grad-risk);
      color: var(--ss-color-risk-text);
      border: 1px solid var(--ss-color-risk-border);
      box-shadow: var(--ss-glow-risk);
      animation: ss-pulse 2.2s infinite;
    }
    .ss-badge--risk:hover { box-shadow: var(--ss-glow-risk); }

    .ss-badge--loading {
      background: var(--ss-color-border-secondary);
      border: 1px solid var(--ss-color-border-primary);
      color: var(--ss-color-text-secondary);
      opacity: 0.85;
    }

    .ss-badge--error {
      background: var(--ss-color-risk-bg);
      border: 1px solid var(--ss-color-risk-border);
      color: var(--ss-color-risk-text);
      opacity: 0.8;
    }

    @keyframes ss-pulse {
      0%,100% { box-shadow: var(--ss-glow-risk); }
      50%      { box-shadow: 0 0 0 5px var(--ss-color-risk-border), var(--ss-glow-risk); }
    }

    .ss-score-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.06);
      color: inherit;
      border-radius: 10px;
      min-width: 22px;
      height: 18px;
      padding: 0 4px;
      font-size: 10.5px;
      font-weight: 700;
      line-height: 1;
    }

    .ss-tooltip {
      display: none;
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      z-index: 2147483647;
      background: var(--ss-glass-bg);
      color: var(--ss-color-text-primary);
      border-radius: var(--ss-border-radius-md);
      padding: 12px 14px;
      min-width: 240px;
      max-width: 320px;
      box-shadow: var(--ss-shadow-lg);
      font-family: var(--ss-font-sans);
      font-size: 12px;
      line-height: 1.55;
      border: 1px solid var(--ss-glass-border);
      backdrop-filter: var(--ss-glass-blur);
      -webkit-backdrop-filter: var(--ss-glass-blur);
    }
    .ss-badge-wrapper:hover .ss-tooltip { display: block; }

    .ss-tooltip-title {
      font-weight: 700;
      font-size: 12.5px;
      margin-bottom: 7px;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .ss-tooltip-score {
      font-size: 22px;
      font-weight: 800;
      line-height: 1;
      margin-bottom: 8px;
    }
    .ss-tooltip-score--safe     { color: var(--ss-color-clear-primary); }
    .ss-tooltip-score--moderate { color: var(--ss-color-warn-primary); }
    .ss-tooltip-score--risk     { color: var(--ss-color-risk-primary); }

    .ss-tooltip-flags {
      margin-top: 6px;
      list-style: none;
      padding: 0;
    }
    .ss-tooltip-flags li {
      display: flex;
      gap: 5px;
      align-items: flex-start;
      margin-bottom: 4px;
      font-size: 11px;
      color: var(--ss-color-text-secondary);
    }
    .ss-tooltip-flags li::before {
      content: '⚠';
      font-size: 10px;
      color: var(--ss-color-warn-primary);
      flex-shrink: 0;
      margin-top: 1px;
    }

    .ss-tooltip-footer {
      margin-top: 9px;
      padding-top: 7px;
      border-top: 1px solid var(--ss-color-border-primary);
      font-size: 10px;
      color: var(--ss-color-text-tertiary);
    }

    .ss-spinner {
      display: inline-block;
      width: 10px;
      height: 10px;
      border: 2px solid var(--ss-color-border-primary);
      border-top-color: var(--ss-color-text-primary);
      border-radius: 50%;
      animation: ss-spin .7s linear infinite;
    }
    @keyframes ss-spin { to { transform: rotate(360deg); } }
  `;

  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  } catch {
    // Fallback for older Chromium builds
    const style = document.createElement("style");
    style.textContent = css;
    (document.head ?? document.documentElement).appendChild(style);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function verdictClass(v: Verdict): string {
  if (v === "VERIFIED_SAFE")  return "ss-badge--safe";
  if (v === "MODERATE_RISK")  return "ss-badge--moderate";
  if (v === "HIGH_RISK")      return "ss-badge--risk";
  if (v === "LOADING")        return "ss-badge--loading";
  return "ss-badge--error";
}

function verdictEmoji(v: Verdict): string {
  if (v === "VERIFIED_SAFE")  return "🟢";
  if (v === "MODERATE_RISK")  return "🟡";
  if (v === "HIGH_RISK")      return "🔴";
  if (v === "LOADING")        return "⏳";
  return "⚪";
}

function verdictLabel(v: Verdict): string {
  if (v === "VERIFIED_SAFE")  return "Verified Safe";
  if (v === "MODERATE_RISK")  return "Moderate Risk";
  if (v === "HIGH_RISK")      return "High Risk";
  if (v === "LOADING")        return "Scanning…";
  return "Scan Error";
}

function scoreColorClass(v: Verdict): string {
  if (v === "VERIFIED_SAFE")  return "ss-tooltip-score--safe";
  if (v === "MODERATE_RISK")  return "ss-tooltip-score--moderate";
  if (v === "HIGH_RISK")      return "ss-tooltip-score--risk";
  return "";
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function injectBadge(
  anchor: Element,
  options: BadgeOptions,
  position: "before" | "after" = "before"
): HTMLElement {
  ensureStyles();
  removeBadge(options.badgeId);

  const wrapper = document.createElement("div");
  wrapper.className = "ss-badge-wrapper";
  wrapper.setAttribute(BADGE_INJECTED_ATTR, options.badgeId);

  // ── Pill button ──────────────────────────────────────────────────────────
  const badge = document.createElement("button");
  badge.className = `ss-badge ${verdictClass(options.verdict)}`;
  badge.setAttribute("aria-label", `ShadowSense: ${verdictLabel(options.verdict)}`);
  badge.setAttribute("type", "button");

  const emoji = document.createElement("span");
  emoji.textContent = verdictEmoji(options.verdict);
  emoji.setAttribute("aria-hidden", "true");

  const label = document.createElement("span");
  label.textContent = verdictLabel(options.verdict);

  badge.appendChild(emoji);
  badge.appendChild(label);

  if (options.verdict !== "LOADING" && options.verdict !== "ERROR") {
    const chip = document.createElement("span");
    chip.className = "ss-score-chip";
    chip.textContent = String(options.score);
    badge.appendChild(chip);
  } else if (options.verdict === "LOADING") {
    const spinner = document.createElement("span");
    spinner.className = "ss-spinner";
    badge.appendChild(spinner);
  }

  // ── Tooltip ──────────────────────────────────────────────────────────────
  const tooltip = document.createElement("div");
  tooltip.className = "ss-tooltip";
  tooltip.setAttribute("role", "tooltip");

  const title = document.createElement("div");
  title.className = "ss-tooltip-title";
  title.textContent = `${verdictEmoji(options.verdict)} ShadowSense Pre-Engage Score`;
  tooltip.appendChild(title);

  if (options.verdict !== "LOADING" && options.verdict !== "ERROR") {
    const scoreEl = document.createElement("div");
    scoreEl.className = `ss-tooltip-score ${scoreColorClass(options.verdict)}`;
    scoreEl.textContent = `${options.score} / 100`;
    tooltip.appendChild(scoreEl);
  }

  if (options.redFlags.length > 0) {
    const list = document.createElement("ul");
    list.className = "ss-tooltip-flags";
    options.redFlags.slice(0, 5).forEach((flag) => {
      const li = document.createElement("li");
      li.textContent = flag;
      list.appendChild(li);
    });
    tooltip.appendChild(list);
  } else if (options.verdict === "VERIFIED_SAFE") {
    const ok = document.createElement("p");
    ok.style.cssText = "margin:6px 0 0;color:var(--ss-color-clear-primary);font-size:11px";
    ok.textContent = "✓ No scam indicators detected.";
    tooltip.appendChild(ok);
  }
 
  if (options.topPatternType) {
    const pat = document.createElement("p");
    pat.style.cssText = "margin:5px 0 0;font-size:10.5px;color:var(--ss-color-text-tertiary)";
    pat.textContent = `Similar pattern: ${options.topPatternType}`;
    tooltip.appendChild(pat);
  }

  const footer = document.createElement("div");
  footer.className = "ss-tooltip-footer";
  footer.textContent = `🛡 ShadowSense Aurora · ${options.platform.charAt(0).toUpperCase() + options.platform.slice(1)} pre-engagement scan`;
  tooltip.appendChild(footer);

  wrapper.appendChild(badge);
  wrapper.appendChild(tooltip);

  // ── Insert into DOM ───────────────────────────────────────────────────────
  const parent = anchor.parentElement;
  if (parent) {
    if (position === "before") {
      parent.insertBefore(wrapper, anchor);
    } else {
      parent.insertBefore(wrapper, anchor.nextSibling);
    }
  } else {
    anchor.appendChild(wrapper);
  }

  return wrapper;
}

export function removeBadge(badgeId: string): void {
  document
    .querySelectorAll(`[${BADGE_INJECTED_ATTR}="${badgeId}"]`)
    .forEach((el) => el.remove());
}

export function updateBadge(
  anchor: Element,
  options: BadgeOptions,
  position: "before" | "after" = "before"
): HTMLElement {
  return injectBadge(anchor, options, position);
}
