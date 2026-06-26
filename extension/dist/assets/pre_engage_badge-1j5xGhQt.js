async function v(e){return new Promise((r,l)=>{chrome.runtime.sendMessage({type:"ANALYZE_GIG",payload:e},a=>{if(chrome.runtime.lastError){l(new Error(chrome.runtime.lastError.message));return}a&&a.success?r(a.result):l(new Error((a==null?void 0:a.error)||"Unknown pre-engage analysis error"))})})}const m="data-ss-badge";let b=!1;function h(){if(b)return;b=!0;const e=`
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
  `;try{const r=new CSSStyleSheet;r.replaceSync(e),document.adoptedStyleSheets=[...document.adoptedStyleSheets,r]}catch{const r=document.createElement("style");r.textContent=e,(document.head??document.documentElement).appendChild(r)}}function y(e){return e==="VERIFIED_SAFE"?"ss-badge--safe":e==="MODERATE_RISK"?"ss-badge--moderate":e==="HIGH_RISK"?"ss-badge--risk":e==="LOADING"?"ss-badge--loading":"ss-badge--error"}function f(e){return e==="VERIFIED_SAFE"?"🟢":e==="MODERATE_RISK"?"🟡":e==="HIGH_RISK"?"🔴":e==="LOADING"?"⏳":"⚪"}function x(e){return e==="VERIFIED_SAFE"?"Verified Safe":e==="MODERATE_RISK"?"Moderate Risk":e==="HIGH_RISK"?"High Risk":e==="LOADING"?"Scanning…":"Scan Error"}function w(e){return e==="VERIFIED_SAFE"?"ss-tooltip-score--safe":e==="MODERATE_RISK"?"ss-tooltip-score--moderate":e==="HIGH_RISK"?"ss-tooltip-score--risk":""}function E(e,r,l="before"){h(),k(r.badgeId);const a=document.createElement("div");a.className="ss-badge-wrapper",a.setAttribute(m,r.badgeId);const t=document.createElement("button");t.className=`ss-badge ${y(r.verdict)}`,t.setAttribute("aria-label",`ShadowSense: ${x(r.verdict)}`),t.setAttribute("type","button");const c=document.createElement("span");c.textContent=f(r.verdict),c.setAttribute("aria-hidden","true");const p=document.createElement("span");if(p.textContent=x(r.verdict),t.appendChild(c),t.appendChild(p),r.verdict!=="LOADING"&&r.verdict!=="ERROR"){const s=document.createElement("span");s.className="ss-score-chip",s.textContent=String(r.score),t.appendChild(s)}else if(r.verdict==="LOADING"){const s=document.createElement("span");s.className="ss-spinner",t.appendChild(s)}const o=document.createElement("div");o.className="ss-tooltip",o.setAttribute("role","tooltip");const n=document.createElement("div");if(n.className="ss-tooltip-title",n.textContent=`${f(r.verdict)} ShadowSense Pre-Engage Score`,o.appendChild(n),r.verdict!=="LOADING"&&r.verdict!=="ERROR"){const s=document.createElement("div");s.className=`ss-tooltip-score ${w(r.verdict)}`,s.textContent=`${r.score} / 100`,o.appendChild(s)}if(r.redFlags.length>0){const s=document.createElement("ul");s.className="ss-tooltip-flags",r.redFlags.slice(0,5).forEach(u=>{const g=document.createElement("li");g.textContent=u,s.appendChild(g)}),o.appendChild(s)}else if(r.verdict==="VERIFIED_SAFE"){const s=document.createElement("p");s.style.cssText="margin:6px 0 0;color:var(--ss-color-clear-primary);font-size:11px",s.textContent="✓ No scam indicators detected.",o.appendChild(s)}if(r.topPatternType){const s=document.createElement("p");s.style.cssText="margin:5px 0 0;font-size:10.5px;color:var(--ss-color-text-tertiary)",s.textContent=`Similar pattern: ${r.topPatternType}`,o.appendChild(s)}const i=document.createElement("div");i.className="ss-tooltip-footer",i.textContent=`🛡 ShadowSense Aurora · ${r.platform.charAt(0).toUpperCase()+r.platform.slice(1)} pre-engagement scan`,o.appendChild(i),a.appendChild(t),a.appendChild(o);const d=e.parentElement;return d?l==="before"?d.insertBefore(a,e):d.insertBefore(a,e.nextSibling):e.appendChild(a),a}function k(e){document.querySelectorAll(`[${m}="${e}"]`).forEach(r=>r.remove())}export{m as B,v as a,E as i,k as r};
