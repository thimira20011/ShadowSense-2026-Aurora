(function(){"use strict";async function L(e){return new Promise((r,t)=>{chrome.runtime.sendMessage({type:"ANALYZE_GIG",payload:e},s=>{if(chrome.runtime.lastError){t(new Error(chrome.runtime.lastError.message));return}s&&s.success?r(s.result):t(new Error((s==null?void 0:s.error)||"Unknown pre-engage analysis error"))})})}const w="data-ss-badge";let _=!1;function P(){if(_)return;_=!0;const e=`
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
  `;try{const r=new CSSStyleSheet;r.replaceSync(e),document.adoptedStyleSheets=[...document.adoptedStyleSheets,r]}catch{const r=document.createElement("style");r.textContent=e,(document.head??document.documentElement).appendChild(r)}}function G(e){return e==="VERIFIED_SAFE"?"ss-badge--safe":e==="MODERATE_RISK"?"ss-badge--moderate":e==="HIGH_RISK"?"ss-badge--risk":e==="LOADING"?"ss-badge--loading":"ss-badge--error"}function R(e){return e==="VERIFIED_SAFE"?"🟢":e==="MODERATE_RISK"?"🟡":e==="HIGH_RISK"?"🔴":e==="LOADING"?"⏳":"⚪"}function I(e){return e==="VERIFIED_SAFE"?"Verified Safe":e==="MODERATE_RISK"?"Moderate Risk":e==="HIGH_RISK"?"High Risk":e==="LOADING"?"Scanning…":"Scan Error"}function $(e){return e==="VERIFIED_SAFE"?"ss-tooltip-score--safe":e==="MODERATE_RISK"?"ss-tooltip-score--moderate":e==="HIGH_RISK"?"ss-tooltip-score--risk":""}function u(e,r,t="before"){P(),A(r.badgeId);const s=document.createElement("div");s.className="ss-badge-wrapper",s.setAttribute(w,r.badgeId);const o=document.createElement("button");o.className=`ss-badge ${G(r.verdict)}`,o.setAttribute("aria-label",`ShadowSense: ${I(r.verdict)}`),o.setAttribute("type","button");const c=document.createElement("span");c.textContent=R(r.verdict),c.setAttribute("aria-hidden","true");const i=document.createElement("span");if(i.textContent=I(r.verdict),o.appendChild(c),o.appendChild(i),r.verdict!=="LOADING"&&r.verdict!=="ERROR"){const a=document.createElement("span");a.className="ss-score-chip",a.textContent=String(r.score),o.appendChild(a)}else if(r.verdict==="LOADING"){const a=document.createElement("span");a.className="ss-spinner",o.appendChild(a)}const n=document.createElement("div");n.className="ss-tooltip",n.setAttribute("role","tooltip");const l=document.createElement("div");if(l.className="ss-tooltip-title",l.textContent=`${R(r.verdict)} ShadowSense Pre-Engage Score`,n.appendChild(l),r.verdict!=="LOADING"&&r.verdict!=="ERROR"){const a=document.createElement("div");a.className=`ss-tooltip-score ${$(r.verdict)}`,a.textContent=`${r.score} / 100`,n.appendChild(a)}if(r.redFlags.length>0){const a=document.createElement("ul");a.className="ss-tooltip-flags",r.redFlags.slice(0,5).forEach(y=>{const b=document.createElement("li");b.textContent=y,a.appendChild(b)}),n.appendChild(a)}else if(r.verdict==="VERIFIED_SAFE"){const a=document.createElement("p");a.style.cssText="margin:6px 0 0;color:var(--ss-color-clear-primary);font-size:11px",a.textContent="✓ No scam indicators detected.",n.appendChild(a)}if(r.topPatternType){const a=document.createElement("p");a.style.cssText="margin:5px 0 0;font-size:10.5px;color:var(--ss-color-text-tertiary)",a.textContent=`Similar pattern: ${r.topPatternType}`,n.appendChild(a)}const d=document.createElement("div");d.className="ss-tooltip-footer",d.textContent=`🛡 ShadowSense Aurora · ${r.platform.charAt(0).toUpperCase()+r.platform.slice(1)} pre-engagement scan`,n.appendChild(d),s.appendChild(o),s.appendChild(n);const p=e.parentElement;return p?t==="before"?p.insertBefore(s,e):p.insertBefore(s,e.nextSibling):e.appendChild(s),s}function A(e){document.querySelectorAll(`[${w}="${e}"]`).forEach(r=>r.remove())}const g="fiverr",v=15*60*1e3,f="ss_pre_engage_fiverr_jobs_cache",M=800,T=3,z=["[data-testid*='request-card']","[class*='request-card']","[class*='requestCard']","[data-testid*='brief-card']","[class*='brief-card']","[class*='briefCard']","[data-testid*='lead-card']","[class*='lead-card']","[class*='leadCard']","[data-testid*='job-card']","[class*='job-card']","[class*='jobCard']","article[class*='request']","li[class*='request']","article[class*='brief']","li[class*='brief']","article[class*='lead']","li[class*='lead']","tr[class*='request']","tr[class*='brief']",".request-row",".brief-row","div.brief-card","table.table-buyer-requests tbody tr"],B=["h3","h4","[class*='title']","[data-testid*='title']","a[class*='title']","a[href*='/requests/']","a[href*='/briefs/']","td.request-title","td strong"],U=["[class*='description']","[class*='desc']","p","div[class*='text']","div[class*='content']","td.request-description"],H=["[class*='price']","[class*='Price']","[class*='budget']","[class*='Budget']","[data-testid*='price']","span[class*='amount']","td.request-budget"],K=["[class*='buyer-name']","[class*='username']","[class*='userName']","a[href*='/users/']","td.request-buyer"];function m(e,r){for(const t of r)try{const s=e.querySelector(t);if(s)return s}catch{}return null}function j(e,r){for(const t of r)try{const s=Array.from(e.querySelectorAll(t));if(s.length>0)return s}catch{}return[]}function D(){return window.location.pathname.includes("/requests")}function q(e){try{return new URL(e).pathname}catch{return e}}const E=new Map;async function V(e){const r=E.get(e);return r&&Date.now()-r.cachedAt<v?r:new Promise(t=>{chrome.storage.local.get([f],s=>{const c=(s[f]??{})[e];c&&Date.now()-c.cachedAt<v?(E.set(e,c),t(c)):t(null)})})}async function J(e,r){return E.set(e,r),new Promise(t=>{chrome.storage.local.get([f],s=>{const o=s[f]??{},c=Date.now();for(const[i,n]of Object.entries(o))c-n.cachedAt>=v&&delete o[i];o[e]=r,chrome.storage.local.set({[f]:o},()=>t())})})}function Y(e,r){var y,b,O,F;const t=m(e,B);if(!t)return null;const s=((y=t.textContent)==null?void 0:y.trim())??"";if(!s||s.length<3)return null;const o=m(e,U),c=((b=o==null?void 0:o.textContent)==null?void 0:b.trim())??s,i=m(e,H),n=((O=i==null?void 0:i.textContent)==null?void 0:O.trim())||void 0,l=m(e,K),d=((F=l==null?void 0:l.textContent)==null?void 0:F.trim())||void 0,p=e.querySelector("a[href*='/requests/'], a[href*='/briefs/']"),a=(p==null?void 0:p.href)??window.location.href+`#request-${r}-${encodeURIComponent(s.slice(0,15))}`;return{jobTitle:s,jobDescription:c,budget:n,buyerName:d,pageUrl:a,anchorElement:t,badgeId:`ss-job-${r}-${q(a)}`}}let S=0;async function W(e){var s,o;if(document.querySelector(`[${w}="${e.badgeId}"]`))return;u(e.anchorElement,{badgeId:e.badgeId,score:0,verdict:"LOADING",redFlags:[],platform:g},"after");const r=q(e.pageUrl),t=await V(r);if(t){u(e.anchorElement,{badgeId:e.badgeId,score:t.score,verdict:t.verdict,redFlags:t.redFlags,topPatternType:t.topPatternType,platform:g},"after");return}if(S>=T){A(e.badgeId);return}S++;try{const c={platform:g,job_url:e.pageUrl,job_title:e.jobTitle,job_description:e.jobDescription,budget:e.budget,client_profile:{reviews:void 0,member_since_days:void 0,level:void 0,verified:!1}},i=await L(c),n=i.verdict,l={score:i.pre_engage_score,verdict:n,redFlags:i.red_flags??[],topPatternType:(o=(s=i.similar_patterns)==null?void 0:s[0])==null?void 0:o.type,cachedAt:Date.now()};await J(r,l);const d=(e.anchorElement.isConnected,e.anchorElement);u(d,{badgeId:e.badgeId,score:l.score,verdict:l.verdict,redFlags:l.redFlags,topPatternType:l.topPatternType,platform:g},"after"),console.log(`[ShadowSense] Fiverr job request: "${e.jobTitle}" → ${l.score} ${l.verdict}`)}catch(c){console.warn("[ShadowSense] Fiverr pre-engage job request failed:",c),u(e.anchorElement,{badgeId:e.badgeId,score:50,verdict:"ERROR",redFlags:["Backend unreachable — start ShadowSense backend"],platform:g},"after")}finally{S--}}async function C(){if(D()||window.location.pathname.startsWith("/categories/")){const e=j(document,z).slice(0,T*4);console.log(`[ShadowSense] Found ${e.length} job cards/listings on requests/categories page.`);for(let r=0;r<e.length;r++){const t=Y(e[r],r);t&&W(t)}}}let N=window.location.href,h=null;function k(){window.location.href!==N&&(N=window.location.href,h!==null&&clearTimeout(h),h=setTimeout(()=>{h=null,C().catch(()=>{})},M))}(function(){const r=history.pushState.bind(history),t=history.replaceState.bind(history);history.pushState=(...s)=>{r(...s),k()},history.replaceState=(...s)=>{t(...s),k()}})(),window.addEventListener("popstate",k);let x=null;new MutationObserver(()=>{x!==null&&clearTimeout(x),x=setTimeout(()=>{x=null,(D()||window.location.pathname.startsWith("/categories/"))&&C().catch(()=>{})},600)}).observe(document.body,{childList:!0,subtree:!0}),function(){console.log("[ShadowSense] Fiverr requests/jobs pre-engage script loaded."),C().catch(r=>console.error("[ShadowSense] Fiverr requests scan error:",r))}()})();
