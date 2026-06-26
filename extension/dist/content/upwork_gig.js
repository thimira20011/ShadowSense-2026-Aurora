(function(){"use strict";async function q(e){return new Promise((r,s)=>{chrome.runtime.sendMessage({type:"ANALYZE_GIG",payload:e},t=>{if(chrome.runtime.lastError){s(new Error(chrome.runtime.lastError.message));return}t&&t.success?r(t.result):s(new Error((t==null?void 0:t.error)||"Unknown pre-engage analysis error"))})})}const y="data-ss-badge";let I=!1;function G(){if(I)return;I=!0;const e=`
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
  `;try{const r=new CSSStyleSheet;r.replaceSync(e),document.adoptedStyleSheets=[...document.adoptedStyleSheets,r]}catch{const r=document.createElement("style");r.textContent=e,(document.head??document.documentElement).appendChild(r)}}function $(e){return e==="VERIFIED_SAFE"?"ss-badge--safe":e==="MODERATE_RISK"?"ss-badge--moderate":e==="HIGH_RISK"?"ss-badge--risk":e==="LOADING"?"ss-badge--loading":"ss-badge--error"}function R(e){return e==="VERIFIED_SAFE"?"🟢":e==="MODERATE_RISK"?"🟡":e==="HIGH_RISK"?"🔴":e==="LOADING"?"⏳":"⚪"}function T(e){return e==="VERIFIED_SAFE"?"Verified Safe":e==="MODERATE_RISK"?"Moderate Risk":e==="HIGH_RISK"?"High Risk":e==="LOADING"?"Scanning…":"Scan Error"}function M(e){return e==="VERIFIED_SAFE"?"ss-tooltip-score--safe":e==="MODERATE_RISK"?"ss-tooltip-score--moderate":e==="HIGH_RISK"?"ss-tooltip-score--risk":""}function u(e,r,s="before"){G(),A(r.badgeId);const t=document.createElement("div");t.className="ss-badge-wrapper",t.setAttribute(y,r.badgeId);const a=document.createElement("button");a.className=`ss-badge ${$(r.verdict)}`,a.setAttribute("aria-label",`ShadowSense: ${T(r.verdict)}`),a.setAttribute("type","button");const n=document.createElement("span");n.textContent=R(r.verdict),n.setAttribute("aria-hidden","true");const i=document.createElement("span");if(i.textContent=T(r.verdict),a.appendChild(n),a.appendChild(i),r.verdict!=="LOADING"&&r.verdict!=="ERROR"){const o=document.createElement("span");o.className="ss-score-chip",o.textContent=String(r.score),a.appendChild(o)}else if(r.verdict==="LOADING"){const o=document.createElement("span");o.className="ss-spinner",a.appendChild(o)}const c=document.createElement("div");c.className="ss-tooltip",c.setAttribute("role","tooltip");const l=document.createElement("div");if(l.className="ss-tooltip-title",l.textContent=`${R(r.verdict)} ShadowSense Pre-Engage Score`,c.appendChild(l),r.verdict!=="LOADING"&&r.verdict!=="ERROR"){const o=document.createElement("div");o.className=`ss-tooltip-score ${M(r.verdict)}`,o.textContent=`${r.score} / 100`,c.appendChild(o)}if(r.redFlags.length>0){const o=document.createElement("ul");o.className="ss-tooltip-flags",r.redFlags.slice(0,5).forEach(w=>{const m=document.createElement("li");m.textContent=w,o.appendChild(m)}),c.appendChild(o)}else if(r.verdict==="VERIFIED_SAFE"){const o=document.createElement("p");o.style.cssText="margin:6px 0 0;color:var(--ss-color-clear-primary);font-size:11px",o.textContent="✓ No scam indicators detected.",c.appendChild(o)}if(r.topPatternType){const o=document.createElement("p");o.style.cssText="margin:5px 0 0;font-size:10.5px;color:var(--ss-color-text-tertiary)",o.textContent=`Similar pattern: ${r.topPatternType}`,c.appendChild(o)}const p=document.createElement("div");p.className="ss-tooltip-footer",p.textContent=`🛡 ShadowSense Aurora · ${r.platform.charAt(0).toUpperCase()+r.platform.slice(1)} pre-engagement scan`,c.appendChild(p),t.appendChild(a),t.appendChild(c);const g=e.parentElement;return g?s==="before"?g.insertBefore(t,e):g.insertBefore(t,e.nextSibling):e.appendChild(t),t}function A(e){document.querySelectorAll(`[${y}="${e}"]`).forEach(r=>r.remove())}const f="upwork",E=15*60*1e3,b="ss_pre_engage_upwork_cache",U=900,D=3,N=["h1[data-v-app]","h1[class*='title']","[data-test='job-title']","[data-qa='job-title']","h1"],B=["[data-test='description']","[data-qa='description']","[class*='description']",".break","section p","p"],j=["[data-test='budget']","[data-qa='budget']","[class*='budget']","[data-test='hourly-rate']","[class*='hourly-rate']","[data-test='fixed-price']"],z=["[data-test='client-spend']","[data-qa='client-spend']","[class*='total-spent']","[class*='totalSpent']"],H=["[data-test='hire-rate']","[data-qa='hire-rate']","[class*='hire-rate']","[class*='hireRate']"],J=["[data-test='reviews-count']","[data-qa='reviews-count']","[class*='reviews']","[class*='feedback-count']"],K=["[data-test='member-since']","[data-qa='member-since']","[class*='member-since']","[class*='memberSince']"],V=["[data-test='client-location']","[data-qa='client-location']","[class*='location']"],Y=["[data-test='payment-verified']","[data-qa='payment-verified']","[aria-label*='payment verified' i]","[class*='payment-verified']","[class*='verified-badge']"],W=["[data-test='jobs-posted']","[data-qa='jobs-posted']","[class*='jobs-posted']"],X=["[data-test='job-tile']","[data-qa='job-tile']","[class*='job-tile']","[class*='JobTile']","article[class*='job']","section[class*='job']"],Z=["h2[class*='title']","h3[class*='title']","[data-test='job-title']","[data-qa='job-title']","h2","h3"],Q=["[data-test='budget']","[data-qa='budget']","[class*='budget']","[class*='price']"];function d(e,r){for(const s of r)try{const t=e.querySelector(s);if(t)return t}catch{}return null}function ee(e,r){for(const s of r)try{const t=Array.from(e.querySelectorAll(s));if(t.length>0)return t}catch{}return[]}function re(){return/\/jobs\/[^/]+/.test(window.location.pathname)}function O(){const e=window.location.pathname;return e.includes("/search/jobs")||e.includes("/ab/jobs/search")||e.includes("/nx/search/jobs")}function te(e){const r=e.toLowerCase().trim(),s=r.match(/([a-z]+)\s+(\d{4})/);if(s){const i=new Date(`${s[1]} 1, ${s[2]}`);if(!isNaN(i.getTime()))return Math.floor((Date.now()-i.getTime())/864e5)}const t=r.match(/(\d+)\s+year/);if(t)return parseInt(t[1])*365;const a=r.match(/(\d+)\s+month/);if(a)return parseInt(a[1])*30;const n=r.match(/(\d+)\s+day/);if(n)return parseInt(n[1])}function se(e){const r=e.replace(/[$,\s]/g,""),s=r.match(/([\d.]+)k\+?/i);if(s)return parseFloat(s[1])*1e3;const t=parseFloat(r);return isNaN(t)?void 0:t}function ae(e){const r=e.match(/([\d.]+)\s*%/);return r?parseFloat(r[1]):void 0}function L(e){const r=parseInt(e.replace(/[,()\s]/g,""));return isNaN(r)?void 0:r}function v(e){try{return new URL(e).pathname}catch{return e}}const S=new Map;async function oe(e){const r=S.get(e);return r&&Date.now()-r.cachedAt<E?r:new Promise(s=>{chrome.storage.local.get([b],t=>{const n=(t[b]??{})[e];n&&Date.now()-n.cachedAt<E?(S.set(e,n),s(n)):s(null)})})}async function ne(e,r){return S.set(e,r),new Promise(s=>{chrome.storage.local.get([b],t=>{const a=t[b]??{},n=Date.now();for(const[i,c]of Object.entries(a))n-c.cachedAt>=E&&delete a[i];a[e]=r,chrome.storage.local.set({[b]:a},()=>s())})})}function ce(){var s,t,a,n,i,c,l,p,g,o,w,m;const e=d(document,N);if(!e)return null;const r=((s=e.textContent)==null?void 0:s.trim())??"";return!r||r.length<3?null:{jobTitle:r,jobDescription:((a=(t=d(document,B))==null?void 0:t.textContent)==null?void 0:a.trim())||r,budget:((i=(n=d(document,j))==null?void 0:n.textContent)==null?void 0:i.trim())||void 0,totalSpend:se(((c=d(document,z))==null?void 0:c.textContent)??""),hireRate:ae(((l=d(document,H))==null?void 0:l.textContent)??""),reviews:L(((p=d(document,J))==null?void 0:p.textContent)??""),memberSinceDays:te(((g=d(document,K))==null?void 0:g.textContent)??""),country:((w=(o=d(document,V))==null?void 0:o.textContent)==null?void 0:w.trim())||void 0,verified:!!d(document,Y),jobsPosted:L(((m=d(document,W))==null?void 0:m.textContent)??""),pageUrl:window.location.href,anchorElement:e,badgeId:`ss-upwork-${v(window.location.href)}`}}function ie(e,r){var i,c,l;const s=d(e,Z);if(!s)return null;const t=((i=s.textContent)==null?void 0:i.trim())??"";if(!t||t.length<3)return null;const a=e.querySelector("a[href*='/jobs/']"),n=a?new URL(a.href,window.location.origin).href:window.location.href+`#card-${r}`;return{jobTitle:t,jobDescription:t,budget:((l=(c=d(e,Q))==null?void 0:c.textContent)==null?void 0:l.trim())||void 0,reviews:void 0,memberSinceDays:void 0,totalSpend:void 0,hireRate:void 0,country:void 0,verified:!1,jobsPosted:void 0,pageUrl:n,anchorElement:s,badgeId:`ss-upwork-card-${r}-${v(n)}`}}let C=0;async function P(e){var t,a;if(document.querySelector(`[${y}="${e.badgeId}"]`))return;u(e.anchorElement,{badgeId:e.badgeId,score:0,verdict:"LOADING",redFlags:[],platform:f},"after");const r=v(e.pageUrl),s=await oe(r);if(s){u(e.anchorElement,{badgeId:e.badgeId,score:s.score,verdict:s.verdict,redFlags:s.redFlags,topPatternType:s.topPatternType,platform:f},"after");return}if(C>=D){A(e.badgeId);return}C++;try{const n={platform:f,job_url:e.pageUrl,job_title:e.jobTitle,job_description:e.jobDescription,budget:e.budget,client_profile:{reviews:e.reviews,member_since_days:e.memberSinceDays,total_spend:e.totalSpend,hire_rate:e.hireRate,country:e.country,verified:e.verified,jobs_posted:e.jobsPosted}},i=await q(n),c=i.verdict,l={score:i.pre_engage_score,verdict:c,redFlags:i.red_flags??[],topPatternType:(a=(t=i.similar_patterns)==null?void 0:t[0])==null?void 0:a.type,cachedAt:Date.now()};await ne(r,l);const p=e.anchorElement.isConnected?e.anchorElement:d(document,N)??e.anchorElement;u(p,{badgeId:e.badgeId,score:l.score,verdict:l.verdict,redFlags:l.redFlags,topPatternType:l.topPatternType,platform:f},"after"),console.log(`[ShadowSense] Upwork job: "${e.jobTitle}" → ${l.score} ${l.verdict}`)}catch(n){console.warn("[ShadowSense] Upwork pre-engage failed:",n),u(e.anchorElement,{badgeId:e.badgeId,score:50,verdict:"ERROR",redFlags:["Backend unreachable — start ShadowSense backend"],platform:f},"after")}finally{C--}}async function k(){if(re()){const e=ce();e&&await P(e);return}if(O()){const e=ee(document,X).slice(0,D*2);for(let r=0;r<e.length;r++){const s=ie(e[r],r);s&&P(s)}}}let F=window.location.href,h=null;function _(){window.location.href!==F&&(F=window.location.href,h!==null&&clearTimeout(h),h=setTimeout(()=>{h=null,k().catch(()=>{})},U))}(function(){const r=history.pushState.bind(history),s=history.replaceState.bind(history);history.pushState=(...t)=>{r(...t),_()},history.replaceState=(...t)=>{s(...t),_()}})(),window.addEventListener("popstate",_);let x=null;new MutationObserver(()=>{x!==null&&clearTimeout(x),x=setTimeout(()=>{x=null,O()&&k().catch(()=>{})},700)}).observe(document.body,{childList:!0,subtree:!0}),function(){console.log("[ShadowSense] Upwork pre-engage script loaded."),k().catch(r=>console.error("[ShadowSense] Upwork scan error:",r))}()})();
