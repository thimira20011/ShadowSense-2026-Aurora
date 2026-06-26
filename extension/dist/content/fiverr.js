var Y=Object.defineProperty;var V=(S,y,E)=>y in S?Y(S,y,{enumerable:!0,configurable:!0,writable:!0,value:E}):S[y]=E;var x=(S,y,E)=>V(S,typeof y!="symbol"?y+"":y,E);(function(){"use strict";const S="shadowsense_fiverr_messages",y="shadowsense_cached_score";function F(){var f,h,v,b,c;const a={},e=['[data-testid*="username"]','[data-testid*="seller-name"]','[data-testid*="buyer-name"]','.conversation-sidebar [class*="username"]','.conversation-sidebar [class*="userName"]','aside [class*="username"]','aside [class*="userName"]','[class*="user-info"] [class*="username"]','[class*="userInfo"] [class*="username"]'];for(const d of e)try{const r=document.querySelector(d),n=(f=r==null?void 0:r.textContent)==null?void 0:f.trim();if(n&&n.length>0&&n.length<60){a.username=n;break}}catch{}const o=['[data-testid*="country"]','[class*="country"]','[aria-label*="country" i]','aside [class*="location"]','[class*="user-info"] [class*="location"]'];for(const d of o)try{const r=document.querySelector(d),n=(h=r==null?void 0:r.textContent)==null?void 0:h.trim();if(n&&n.length>0&&n.length<60){a.country=n;break}}catch{}const i=['[data-testid*="member-since"]','[class*="memberSince"]','[class*="member-since"]'],t=["aside",".conversation-sidebar",'[class*="user-info"]','[class*="userInfo"]'];let s=null;for(const d of i)try{const r=document.querySelector(d);if(r!=null&&r.textContent){s=r.textContent;break}}catch{}if(!s)for(const d of t)try{const r=document.querySelector(d);if(!r)continue;const u=(r.textContent??"").match(/member\s+since[:\s]+([A-Za-z]+\.?\s+\d{4})/i);if(u){s=u[1];break}}catch{}if(s){const d=s.replace(/member\s+since[:\s]*/i,"").trim(),r=Date.parse(d);if(!isNaN(r)){const n=Math.floor((Date.now()-r)/864e5);n>=0&&n<365*30&&(a.account_age_days=n)}}const m=['[data-testid*="reviews-count"]','[data-testid*="review-count"]','[class*="reviewsCount"]','[class*="reviews-count"]'];for(const d of m)try{const r=document.querySelector(d),n=((v=r==null?void 0:r.textContent)==null?void 0:v.trim())??"",u=parseInt(n.replace(/[^0-9]/g,""),10);if(!isNaN(u)){a.reviews=u;break}}catch{}if(a.reviews===void 0)for(const d of t)try{const r=document.querySelector(d);if(!r)continue;const u=(r.textContent??"").match(/(\d+)\s+reviews?/i);if(u){a.reviews=parseInt(u[1],10);break}}catch{}const l=['[data-testid*="verified"]','[class*="verified"]','[aria-label*="verified" i]','[title*="verified" i]','aside img[alt*="verified" i]'];for(const d of l)try{if(document.querySelector(d)){a.verified=!0;break}}catch{}a.verified===void 0&&(a.username||a.account_age_days!==void 0)&&(a.verified=!1);const p=['[data-testid*="bio"]','[data-testid*="description"]','[class*="userDescription"]','[class*="user-description"]','aside [class*="bio"]',"aside p"];for(const d of p)try{const r=document.querySelector(d),n=(b=r==null?void 0:r.textContent)==null?void 0:b.trim();if(n&&n.length>5&&n.length<500){a.bio=n;break}}catch{}const g=['[data-testid*="level"]','[class*="buyerLevel"]','[class*="buyer-level"]','[class*="userLevel"]'];for(const d of g)try{const r=document.querySelector(d),n=(c=r==null?void 0:r.textContent)==null?void 0:c.trim();if(n&&n.length>0&&n.length<40){a.level=n;break}}catch{}return a}const H=['[role="log"]','[role="list"][aria-label*="message" i]','[data-testid*="message-list"]','[data-testid*="chat-log"]','[data-testid*="conversation"]',"main [class*='conversation']","main [class*='messages']","main [class*='chat']"],I=['[role="listitem"]','[data-testid*="message-row"]','[data-testid*="message-item"]',"[data-message-id]",'article[class*="message"]','div[class*="message-row"]','div[class*="messageRow"]','div[class*="message_row"]','li[class*="message"]'],$=['[data-testid*="sender"]','[data-testid*="username"]','[aria-label*="sender" i]','[class*="sender"]','[class*="username"]','[class*="userName"]','[class*="user-name"]',"strong","b"],R=["time",'[data-testid*="timestamp"]','[data-testid*="time"]','[aria-label*="sent at" i]','[class*="timestamp"]','[class*="timeStamp"]','[class*="time-stamp"]','[class*="message-time"]','[class*="messageTime"]'],G=['[data-testid*="message-text"]','[data-testid*="message-content"]','[class*="message-text"]','[class*="messageText"]','[class*="message-content"]','[class*="messageContent"]','[class*="bubble"]',"p"];function C(a,e){for(const o of e)try{const i=a.querySelector(o);if(i)return i}catch{}return null}function O(a,e){for(const o of e)try{const i=Array.from(a.querySelectorAll(o));if(i.length>0)return i}catch{}return[]}function M(a,e,o){const i=`${a}|${e}|${o}`;let t=2166136261;for(let s=0;s<i.length;s++)t^=i.charCodeAt(s),t=t*16777619>>>0;return t.toString(16)}function T(){return typeof chrome<"u"&&!!chrome.runtime&&!!chrome.runtime.id}function U(a){var s;const e=C(a,R);if(!e)return"";const o=e.getAttribute("datetime")||e.getAttribute("title")||e.getAttribute("aria-label");if(o){const m=Date.parse(o);if(!isNaN(m))return new Date(m).toISOString()}const i=((s=e.textContent)==null?void 0:s.trim())??"",t=Date.parse(i);return isNaN(t)?i||"":new Date(t).toISOString()}function N(a){const e=a.getAttribute("style")??"",o=[a.getAttribute("data-self"),a.getAttribute("data-is-self"),a.getAttribute("data-sender-is-me"),a.getAttribute("aria-label")];for(const m of o){if(!m)continue;const l=m.toLowerCase();if(l.includes("self")||l.includes("own")||l.includes("outgoing")||l.includes("sent by me")||l.includes("sent by myself")||/\bme\b/i.test(m))return"self"}const i=a.className??"",t=i.toLowerCase();if(t.includes("self")||t.includes("own")||t.includes("outgoing")||t.includes("sent by me")||t.includes("sent by myself")||/\bme\b/i.test(i)||t.includes("is-me")||t.includes("sender-me"))return"self";const s=window.getComputedStyle(a);return s.justifyContent==="flex-end"||s.alignSelf==="flex-end"||a.className.includes("flex-end")||e.includes("flex-end")?"self":"other"}function L(){const a=window.location.pathname.match(/\/inbox\/([^/?#]+)/);return(a==null?void 0:a[1])??"unknown"}async function B(a){return new Promise(e=>{chrome.storage.local.get([S],o=>{const i=o[S]??{};e(i[a]??[])})})}async function K(a,e){return new Promise(o=>{chrome.storage.local.get([S],i=>{const t=i[S]??{},s=[...t[a]??[],...e],m=Array.from(new Map(s.map(p=>[p.id,p])).values()),l=m.length>500?m.slice(m.length-500):m;t[a]=l,chrome.storage.local.set({[S]:t},()=>{chrome.runtime.lastError&&console.error("[ShadowSense] Storage error:",chrome.runtime.lastError),o()})})})}class q{constructor(){x(this,"seen",new Set);x(this,"preloadedIds",new Set);x(this,"observer",null);x(this,"debounceTimer",null);x(this,"attachRetryTimer",null);x(this,"intervalTimer",null);x(this,"chatContainer",null);x(this,"stopped",!1);x(this,"isScanning",!1);x(this,"scanQueued",!1);x(this,"lastSentTranscriptHash",null)}async init(){var i;if(!T())return;this.stopped=!1,(i=this.observer)==null||i.disconnect(),this.observer=null,this.chatContainer=null,this.preloadedIds.clear(),this.seen.clear(),this.lastSentTranscriptHash=null;const e=L(),o=await B(e);for(const t of o)this.preloadedIds.add(t.id);console.log(`[ShadowSense] Loaded ${this.preloadedIds.size} existing messages for conversation "${e}"`),this.attach(),await this.scanAll(),this.intervalTimer!==null&&clearInterval(this.intervalTimer),this.intervalTimer=setInterval(()=>{if(!T()){this.stop();return}this.stopped||this.scanAll().catch(t=>console.error("[ShadowSense] Interval scan error:",t))},1e4)}attach(e=0){if(!T()||this.stopped)return;const o=C(document,H);o?(this.attachRetryTimer!==null&&(clearTimeout(this.attachRetryTimer),this.attachRetryTimer=null),this.chatContainer=o,this.observer=new MutationObserver(()=>{if(!T()){this.stop();return}this.scheduleExtraction()}),this.observer.observe(o,{childList:!0,subtree:!0,characterData:!0,attributes:!1}),console.log("[ShadowSense] MutationObserver attached to chat container:",o.tagName,o.className.slice(0,60)),this.scanAll().catch(i=>console.error("[ShadowSense] Post-attach scan error:",i))):e<30?(this.attachRetryTimer!==null&&clearTimeout(this.attachRetryTimer),this.attachRetryTimer=setTimeout(()=>this.attach(e+1),1e3)):console.warn("[ShadowSense] Could not find a chat container after 30 s. Fiverr's DOM structure may have changed.")}stop(){var e;this.stopped=!0,(e=this.observer)==null||e.disconnect(),this.observer=null,this.debounceTimer!==null&&clearTimeout(this.debounceTimer),this.debounceTimer=null,this.attachRetryTimer!==null&&clearTimeout(this.attachRetryTimer),this.attachRetryTimer=null,this.intervalTimer!==null&&clearInterval(this.intervalTimer),this.intervalTimer=null}scheduleExtraction(){this.debounceTimer!==null&&clearTimeout(this.debounceTimer),this.debounceTimer=setTimeout(()=>{this.debounceTimer=null,this.scanAll().catch(e=>console.error("[ShadowSense] Scan error:",e))},300)}async scanAll(){if(!T()){this.stop();return}if(this.isScanning){this.scanQueued=!0;return}this.isScanning=!0;try{const e=this.chatContainer??document,o=O(e,I);if(o.length===0)return;const i=L(),t=[];for(const g of o){const f=this.extractMessage(g,i);f&&(this.seen.has(f.id)||this.preloadedIds.has(f.id)||(this.seen.add(f.id),t.push(f)))}if(t.length===0)return;console.log(`[ShadowSense] Captured ${t.length} new message(s) in conversation "${i}"`),await K(i,t);const m=(await B(i)).slice(-10),l=m.filter(g=>g.senderRole==="other"),p=M("transcript",l.map(g=>g.text).join("|"),i);if(p===this.lastSentTranscriptHash){console.debug("[ShadowSense] Transcript unchanged — skipping redundant re-analysis.");return}this.lastSentTranscriptHash=p,this.notifyBackground(m)}finally{this.isScanning=!1,this.scanQueued&&(this.scanQueued=!1,this.scheduleExtraction())}}extractMessage(e,o){var c,d,r;const t=((c=(C(e,G)??e).textContent)==null?void 0:c.trim())??"";if(t.length===0||t.length>1e4)return null;let s="Unknown";const m=e.getAttribute("data-username")||e.getAttribute("data-sender")||e.getAttribute("data-user");if(m)s=m;else{const n=C(e,$);if(n){const u=((d=n.textContent)==null?void 0:d.trim())??"";u.length>0&&u.length<80&&(s=u)}}const l=C(e,R),p=U(e),g=(l==null?void 0:l.getAttribute("datetime"))||(l==null?void 0:l.getAttribute("title"))||(l==null?void 0:l.getAttribute("aria-label"))||((r=l==null?void 0:l.textContent)==null?void 0:r.trim())||"",f=N(e),h=e.getAttribute("data-message-id")||e.getAttribute("data-messageid")||e.getAttribute("data-testid")||e.getAttribute("id");return{id:h?`fiverr:${o}:${h}`:M(s,t,g),conversationId:o,sender:s,senderRole:f,text:t,timestamp:p,capturedAt:Date.now(),pageUrl:window.location.href}}showAnalyzingBadge(){const e="ss-analyzing-badge";if(document.getElementById(e))return;const o=document.createElement("div");o.id=e,o.setAttribute("role","status"),o.setAttribute("aria-live","polite"),o.style.cssText=["position:fixed","bottom:80px","right:16px","z-index:2147483647","background:#312e81","color:#fff","font-size:11px","font-family:system-ui,sans-serif","font-weight:500","padding:7px 14px","border-radius:8px","box-shadow:0 4px 16px rgba(0,0,0,0.3)","display:flex","align-items:center","gap:8px","opacity:0","transition:opacity 0.2s ease"].join(";"),o.innerHTML="<span>🛡</span><span>ShadowSense — Analyzing…</span>",document.body.appendChild(o),requestAnimationFrame(()=>{o.style.opacity="1"})}hideAnalyzingBadge(){const e=document.getElementById("ss-analyzing-badge");e&&(e.style.opacity="0",setTimeout(()=>e.remove(),200))}notifyBackground(e){if(!T()){this.stop();return}this.saveLastKnownScore(),this.showAnalyzingBadge();const o=setTimeout(()=>{this.hideAnalyzingBadge(),this.showOfflineBadge()},12e4),i=e.filter(s=>s.senderRole==="other"),t=i.length>0?i[i.length-1].text:"";try{const s=F(),m=Object.keys(s).length>0;m?console.log("[ShadowSense] Extracted buyer profile:",JSON.stringify(s)):console.debug("[ShadowSense] No buyer profile data found in DOM sidebar."),chrome.runtime.sendMessage({type:"FIVERR_MESSAGES_CAPTURED",payload:e,buyerProfile:m?s:void 0},l=>{if(clearTimeout(o),this.hideAnalyzingBadge(),chrome.runtime.lastError){console.debug("[ShadowSense] Background response error:",chrome.runtime.lastError),this.showOfflineBadge();return}if(l&&l.success){const p=l.level??"clear",g=l.trust_score??100,f=l.reasons??[],h=l.analysis_id??"",v=l.suggested_responses??[];if(p==="high-risk"||p==="advisory"){const d=p==="high-risk"?["Thanks, but I need to verify this request with Fiverr support first.","I'm only able to accept files through the official Fiverr platform. Please use the attachment feature here.","I prefer to keep all communication within Fiverr to protect both of us. Let's continue here."]:["Thank you for your message. Please share all project details directly on the platform.","I'd love to help — could we keep all communication and files within the platform?","Let's discuss the full scope of work here before I commit to anything."];this.injectResponseTemplates(v.length>0?v:d)}this.injectInterventionOverlay(g,p,f,h,t)}else l&&!l.success&&this.showOfflineBadge()})}catch(s){clearTimeout(o),console.debug("[ShadowSense] Could not notify background:",s),this.showOfflineBadge()}}saveLastKnownScore(){chrome.storage.local.get([y],e=>{console.debug("[ShadowSense] Cached score available:",e[y])})}showOfflineBadge(){const e="ss-offline-badge";document.getElementById(e)||chrome.storage.local.get([y],o=>{const i=o[y],t=i!=null?`cached score: ${i}`:"no cached data",s=document.createElement("div");s.id=e,s.setAttribute("role","status"),s.setAttribute("aria-live","polite"),s.style.cssText=["position:fixed","bottom:80px","right:16px","z-index:2147483647","background:#27272a","color:#fafafa","font-size:11px","font-family:system-ui,sans-serif","font-weight:500","padding:7px 12px","border-radius:8px","box-shadow:0 4px 16px rgba(0,0,0,0.3)","display:flex","align-items:center","gap:6px","opacity:0","transition:opacity 0.2s ease","pointer-events:none"].join(";"),s.innerHTML=`⚠️ <span>Offline — showing ${t}</span>`,document.body.appendChild(s),requestAnimationFrame(()=>{s.style.opacity="1"}),setTimeout(()=>{s.style.opacity="0",setTimeout(()=>s.remove(),250)},6e3)})}injectResponseTemplates(e){var f,h,v;const o="ss-response-templates";(f=document.getElementById(o))==null||f.remove();const i=['[data-testid*="message-input"]','[data-testid*="chat-input"]','[aria-label*="message" i][contenteditable]','[role="textbox"]','textarea[placeholder*="message" i]','textarea[placeholder*="reply" i]','textarea[placeholder*="write" i]','div[contenteditable="true"]'];let t=null;for(const b of i)try{if(t=document.querySelector(b),t)break}catch{}if(!t){console.debug("[ShadowSense] Chat input not found — skipping template injection");return}const s=document.createElement("div");if(s.id=o,s.setAttribute("role","region"),s.setAttribute("aria-label","ShadowSense — Suggested safe responses"),s.style.cssText=["display:flex","flex-direction:column","gap:6px","padding:8px 12px","margin-top:4px","background:linear-gradient(135deg,#fcebeb,#fafafa)","border-top:2px solid #e24b4a","animation:ss-tmpl-in 0.25s ease both","font-family:system-ui,sans-serif"].join(";"),!document.getElementById("ss-tmpl-style")){const b=document.createElement("style");b.id="ss-tmpl-style",b.textContent=`
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
      `,document.head.appendChild(b)}const m=document.createElement("div");m.id="ss-header-row";const l=document.createElement("span");l.textContent="🛡 ShadowSense — Shield Responses";const p=document.createElement("button");p.id="ss-dismiss-btn",p.textContent="✕ Dismiss",p.onclick=()=>s.remove(),m.appendChild(l),m.appendChild(p),s.appendChild(m),e.forEach(b=>{const c=document.createElement("div");c.className="ss-chip";const d=document.createElement("span");d.className="ss-chip-text",d.textContent=b;const r=document.createElement("button");r.className="ss-chip-copy",r.textContent="Copy",r.setAttribute("aria-label","Copy response to clipboard"),r.onclick=()=>{navigator.clipboard.writeText(b).catch(()=>{const n=document.createElement("textarea");n.value=b,document.body.appendChild(n),n.select(),document.execCommand("copy"),document.body.removeChild(n)}),r.textContent="✓ Copied!",r.classList.add("copied"),setTimeout(()=>{r.textContent="Copy",r.classList.remove("copied")},1500)},c.appendChild(d),c.appendChild(r),s.appendChild(c)}),(h=t.parentElement)!=null&&h.insertBefore(s,t.nextSibling)||((v=t.parentElement)==null||v.appendChild(s));const g=()=>{s.remove(),t.removeEventListener("input",g)};t.addEventListener("input",g),setTimeout(()=>s.remove(),3e4),console.log("[ShadowSense] Response templates injected below chat input.")}ensureStyles(){if(document.getElementById("ss-intervention-styles"))return;const e=document.createElement("style");e.id="ss-intervention-styles",e.textContent=`
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
    `,document.head.appendChild(e)}cleanInterventions(){document.querySelectorAll(".ss-intervention-wrapper, .ss-floating-mini-badge").forEach(e=>e.remove()),document.querySelectorAll(".ss-input-blocking-overlay").forEach(e=>e.remove()),document.querySelectorAll(".ss-high-risk-input-border").forEach(e=>{e.classList.remove("ss-high-risk-input-border")})}injectInterventionOverlay(e,o,i,t,s){var f,h,v,b;this.ensureStyles(),this.cleanInterventions();const m=this.chatContainer??document,l=O(m,I);if(l.length===0)return;let p=null;for(let c=l.length-1;c>=0;c--)if(N(l[c])==="other"){p=l[c];break}if(p||(p=l[l.length-1]),!p||!p.parentElement)return;const g=i&&i.length>0?'<ul style="margin:4px 0 0 0;padding-left:18px;">'+i.slice(0,5).map(c=>`<li style="font-size:11px;line-height:1.55;margin-bottom:3px;">${c}</li>`).join("")+"</ul>":'<p style="font-size:11px;margin:0;">Suspicious metadata or behavioral characteristics detected.</p>';if(o==="high-risk"){const c=document.createElement("div");c.className="ss-intervention-wrapper",c.innerHTML=`
        <div class="ss-intervention-banner">
          <div class="ss-intervention-banner-left">
            <span>⚠️ ShadowSense Agentic Shield Active</span>
          </div>
          <span style="font-size:9px" class="text-mono">Blocked</span>
        </div>
        <div class="ss-intervention-body">
          <div class="ss-intervention-title">Shield Block Applied (Trust Score: ${e})</div>
          <div class="ss-intervention-desc">
            ${g}
          </div>
          <div class="ss-intervention-actions">
            <button class="ss-inter-btn-white" id="ss-report-btn">Report Scam</button>
            <button class="ss-inter-btn-accent" id="ss-bypass-btn">Bypass Warning</button>
          </div>
        </div>
      `,p.parentElement.insertBefore(c,p),(f=c.querySelector("#ss-bypass-btn"))==null||f.addEventListener("click",()=>{chrome.runtime.sendMessage({type:"SUBMIT_OVERRIDE_FEEDBACK",payload:{analysis_id:t,pattern_text:s||"Override flagged conversation",user_id:"anonymous",trust_score:e}},n=>{console.log("[ShadowSense] Override submitted:",n);const u=c.querySelector(".ss-intervention-body");if(u){c.style.borderColor="var(--ss-color-clear-primary)",c.style.background="linear-gradient(135deg, var(--ss-color-clear-bg) 0%, #ffffff 100%)";const w=c.querySelector(".ss-intervention-banner");if(w){w.style.background="var(--ss-color-clear-primary)";const j=w.querySelector("span");j&&(j.textContent="✓ Warning Overridden")}u.innerHTML=`
              <div style="display:flex;align-items:flex-start;gap:10px;">
                <div style="width:24px;height:24px;border-radius:50%;background:var(--ss-color-clear-bg);border:1px solid var(--ss-color-clear-border);display:flex;align-items:center;justify-content:center;color:var(--ss-color-clear-primary);font-weight:bold;flex-shrink:0;">✓</div>
                <div>
                  <div class="ss-intervention-title" style="color: var(--ss-color-clear-text);margin-bottom:2px;">Override Processed</div>
                  <div class="ss-intervention-desc" style="color: var(--ss-color-clear-text);margin:0;">Safety warning bypassed successfully.</div>
                </div>
              </div>
            `;const A=document.querySelector(".ss-input-blocking-overlay");A&&A.remove();const D=document.querySelector(".ss-high-risk-input-border");D&&D.classList.remove("ss-high-risk-input-border")}setTimeout(()=>this.cleanInterventions(),1e3)})}),(h=c.querySelector("#ss-report-btn"))==null||h.addEventListener("click",()=>{chrome.runtime.sendMessage({type:"SUBMIT_GENERAL_FEEDBACK",payload:{analysis_id:t,user_feedback:"report",was_accurate:!0,additional_context:{platform:"fiverr",score:e}}},n=>{console.log("[ShadowSense] Report submitted:",n);const u=c.querySelector(".ss-intervention-body");if(u){c.style.borderColor="var(--ss-color-clear-primary)",c.style.background="linear-gradient(135deg, var(--ss-color-clear-bg) 0%, #ffffff 100%)",c.style.boxShadow="0 8px 32px rgba(16, 185, 129, 0.08)";const w=c.querySelector(".ss-intervention-banner");if(w){w.style.background="var(--ss-color-clear-primary)";const A=w.querySelector("span");A&&(A.textContent="✓ ShadowSense Threat Flagged")}u.innerHTML=`
              <div style="display:flex;align-items:flex-start;gap:10px;">
                <div style="width:24px;height:24px;border-radius:50%;background:var(--ss-color-clear-bg);border:1px solid var(--ss-color-clear-border);display:flex;align-items:center;justify-content:center;color:var(--ss-color-clear-primary);font-weight:bold;flex-shrink:0;">✓</div>
                <div>
                  <div class="ss-intervention-title" style="color: var(--ss-color-clear-text);margin-bottom:2px;">Thank you for reporting!</div>
                  <div class="ss-intervention-desc" style="color: var(--ss-color-clear-text);margin:0;">The threat signature has been flagged for analysis. You can now close this conversation safely.</div>
                </div>
              </div>
            `}})});const d=['[data-testid*="message-input"]','[data-testid*="chat-input"]','[aria-label*="message" i][contenteditable]','[role="textbox"]','textarea[placeholder*="message" i]','textarea[placeholder*="reply" i]','textarea[placeholder*="write" i]','div[contenteditable="true"]'];let r=null;for(const n of d)try{if(r=document.querySelector(n),r)break}catch{}if(r){const n=r.parentElement;if(n){n.classList.add("ss-high-risk-input-border");const u=window.getComputedStyle(n).position;u!=="relative"&&u!=="absolute"&&u!=="fixed"&&(n.style.position="relative");const w=document.createElement("div");w.className="ss-input-blocking-overlay",w.innerHTML=`
            <div class="ss-blocking-text">
              ⚠️ Typing disabled. Please review safety warning above.
            </div>
          `,n.appendChild(w)}}}else if(o==="advisory"){const c=document.createElement("div");c.className="ss-intervention-wrapper ss-advisory",c.innerHTML=`
        <div class="ss-intervention-banner">
          <div class="ss-intervention-banner-left">
            <span>⚠️ ShadowSense Advisory Active</span>
          </div>
          <button class="ss-dismiss-btn" id="ss-advisory-dismiss">Dismiss ×</button>
        </div>
        <div class="ss-intervention-body">
          <div class="ss-intervention-title">Caution (Trust Score: ${e})</div>
          <div class="ss-intervention-desc">
            ${g}
          </div>
          <div class="ss-intervention-actions" style="margin-top: 8px;">
            <button class="ss-inter-btn-white" id="ss-advisory-report" style="border-color: var(--ss-color-warn-border); color: var(--ss-color-warn-text); background: white;">Report Client</button>
          </div>
        </div>
      `,p.parentElement.insertBefore(c,p),(v=c.querySelector("#ss-advisory-dismiss"))==null||v.addEventListener("click",()=>{this.cleanInterventions()}),(b=c.querySelector("#ss-advisory-report"))==null||b.addEventListener("click",()=>{chrome.runtime.sendMessage({type:"SUBMIT_GENERAL_FEEDBACK",payload:{analysis_id:t,user_feedback:"report",was_accurate:!0,additional_context:{platform:"fiverr",score:e}}},d=>{console.log("[ShadowSense] Report submitted:",d);const r=c.querySelector(".ss-intervention-body");if(r){c.style.borderColor="var(--ss-color-clear-primary)",c.style.background="linear-gradient(135deg, var(--ss-color-clear-bg) 0%, #ffffff 100%)",c.style.boxShadow="0 8px 32px rgba(16, 185, 129, 0.08)";const n=c.querySelector(".ss-intervention-banner");if(n){n.style.background="var(--ss-color-clear-primary)";const u=n.querySelector("span");u&&(u.textContent="✓ ShadowSense Threat Flagged")}r.innerHTML=`
              <div style="display:flex;align-items:flex-start;gap:10px;">
                <div style="width:24px;height:24px;border-radius:50%;background:var(--ss-color-clear-bg);border:1px solid var(--ss-color-clear-border);display:flex;align-items:center;justify-content:center;color:var(--ss-color-clear-primary);font-weight:bold;flex-shrink:0;">✓</div>
                <div>
                  <div class="ss-intervention-title" style="color: var(--ss-color-clear-text);margin-bottom:2px;">Thank you for reporting!</div>
                  <div class="ss-intervention-desc" style="color: var(--ss-color-clear-text);margin:0;">The warning has been reported to the community moderation system.</div>
                </div>
              </div>
            `,setTimeout(()=>this.cleanInterventions(),2e3)}})})}else if(o==="clear"){const c=document.createElement("div");c.className="ss-floating-mini-badge",c.innerHTML=`
        <span>🛡 Checked by ShadowSense: Safe Client (${e}/100)</span>
      `,p.parentElement.insertBefore(c,p)}}}let k=null,z=window.location.pathname;function P(){return window.location.pathname.startsWith("/inbox")}async function _(){const a=window.location.pathname;a!==z&&(z=a,console.log("[ShadowSense] Navigation detected →",a),k==null||k.stop(),k=null,P()&&(k=new q,await k.init()))}(function(){const e=history.pushState.bind(history),o=history.replaceState.bind(history);history.pushState=(...i)=>{e(...i),_().catch(t=>console.error("[ShadowSense] PushState navigation error:",t))},history.replaceState=(...i)=>{o(...i),_().catch(t=>console.error("[ShadowSense] ReplaceState navigation error:",t))}})(),window.addEventListener("popstate",()=>{_().catch(a=>console.error("[ShadowSense] Popstate navigation error:",a))}),function(){console.log("[ShadowSense] Fiverr content script loaded."),P()?(k=new q,k.init().catch(e=>console.error("[ShadowSense] Initialization error:",e))):console.log("[ShadowSense] Not on an inbox page – observer will activate on navigation.")}()})();
