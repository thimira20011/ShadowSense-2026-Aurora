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
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    .ss-badge-wrapper {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: 'Inter', system-ui, sans-serif;
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
      background: linear-gradient(135deg, #05c46b 0%, #0be881 100%);
      color: #fff;
      box-shadow: 0 2px 8px rgba(5,196,107,.35);
    }
    .ss-badge--safe:hover { box-shadow: 0 4px 14px rgba(5,196,107,.5); }

    .ss-badge--moderate {
      background: linear-gradient(135deg, #f7b731 0%, #ffd32a 100%);
      color: #3d2600;
      box-shadow: 0 2px 8px rgba(247,183,49,.4);
    }
    .ss-badge--moderate:hover { box-shadow: 0 4px 14px rgba(247,183,49,.55); }

    .ss-badge--risk {
      background: linear-gradient(135deg, #ff3f34 0%, #ff5e57 100%);
      color: #fff;
      box-shadow: 0 2px 8px rgba(255,63,52,.4);
      animation: ss-pulse 2.2s infinite;
    }
    .ss-badge--risk:hover { box-shadow: 0 4px 14px rgba(255,63,52,.6); }

    .ss-badge--loading {
      background: linear-gradient(135deg, #576574 0%, #808e9b 100%);
      color: #fff;
      opacity: 0.85;
    }

    .ss-badge--error {
      background: linear-gradient(135deg, #808e9b 0%, #576574 100%);
      color: #fff;
      opacity: 0.8;
    }

    @keyframes ss-pulse {
      0%,100% { box-shadow: 0 2px 8px rgba(255,63,52,.4); }
      50%      { box-shadow: 0 0 0 5px rgba(255,63,52,.18), 0 2px 8px rgba(255,63,52,.4); }
    }

    .ss-score-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,.25);
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
      background: #1a1e2e;
      color: #e8ecf5;
      border-radius: 10px;
      padding: 12px 14px;
      min-width: 240px;
      max-width: 320px;
      box-shadow: 0 8px 30px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.07);
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 12px;
      line-height: 1.55;
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
    .ss-tooltip-score--safe     { color: #0be881; }
    .ss-tooltip-score--moderate { color: #ffd32a; }
    .ss-tooltip-score--risk     { color: #ff5e57; }

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
      color: #c5cde6;
    }
    .ss-tooltip-flags li::before {
      content: '⚠';
      font-size: 10px;
      color: #f7b731;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .ss-tooltip-footer {
      margin-top: 9px;
      padding-top: 7px;
      border-top: 1px solid rgba(255,255,255,.09);
      font-size: 10px;
      color: #6b7899;
    }

    .ss-spinner {
      display: inline-block;
      width: 10px;
      height: 10px;
      border: 2px solid rgba(255,255,255,.3);
      border-top-color: #fff;
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
    ok.style.cssText = "margin:6px 0 0;color:#0be881;font-size:11px";
    ok.textContent = "✓ No scam indicators detected.";
    tooltip.appendChild(ok);
  }

  if (options.topPatternType) {
    const pat = document.createElement("p");
    pat.style.cssText = "margin:5px 0 0;font-size:10.5px;color:#9ba6c8";
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
