var W=Object.defineProperty;var Y=(S,v,_)=>v in S?W(S,v,{enumerable:!0,configurable:!0,writable:!0,value:_}):S[v]=_;var w=(S,v,_)=>Y(S,typeof v!="symbol"?v+"":v,_);(function(){"use strict";const S="shadowsense_upwork_messages",v="shadowsense_cached_score",j=["#story-viewport",".scroll-wrapper.custom-scrollbar",'[class*="chat-thread"]','[class*="ChatThread"]','[class*="message-thread"]','[class*="MessageThread"]','[class*="messages-list"]','[class*="MessagesList"]','[class*="conversation-body"]','[class*="ConversationBody"]',".fe-chat-thread",'[data-qa="chat-thread"]',".message-list",".chat-thread",'[role="log"]','main [class*="chat"]','main [class*="message"]',"main"],L=["#story-viewport > div",'#story-viewport > [class*="story"]',".story-message",".story",'div[id^="story-"]','[class*="MessageBubble"]','[class*="message-bubble"]','[class*="MessageItem"]','[class*="message-item"]','[class*="MessageRow"]','[class*="message-row"]','[class*="chat-item"]','[class*="ChatItem"]','[class*="story-bubble"]','[class*="StoryBubble"]','[class*="RoomMessage"]','[class*="room-message"]','[data-qa="message"]','[data-testid="message"]',"[data-message-id]",".fe-message",".message-row",'[role="listitem"]',".message","article"],H=['[class*="sender-name"]','[class*="SenderName"]','[class*="user-name"]','[class*="UserName"]','[class*="username"]','[class*="author-name"]','[class*="AuthorName"]',".sender-name",'[data-qa="sender-name"]','[data-testid="sender-name"]',".author","strong","b",'[class*="sender"]','[class*="author"]'],N=["time","[datetime]",'[class*="timestamp"]','[class*="TimeStamp"]','[class*="message-time"]','[class*="MessageTime"]',".time",'[data-qa="timestamp"]','[data-testid="timestamp"]','[class*="time"]','[class*="date"]'],$=['[class*="message-text"]','[class*="MessageText"]','[class*="message-body"]','[class*="MessageBody"]','[class*="message-content"]','[class*="MessageContent"]','[class*="story-content"]','[class*="StoryContent"]','[class*="bubble-text"]','[class*="BubbleText"]',".message-text",".fe-message-text",'[data-qa="message-text"]','[data-testid="message-text"]',".story-bubble","p","span"];function R(n,e){for(const o of e)try{const s=n.querySelector(o);if(s)return s}catch{}return null}function O(n,e){for(const o of e)try{const s=Array.from(n.querySelectorAll(o));if(s.length>0)return s}catch{}return[]}function M(n,e,o){const s=`${n}|${e}|${o}`;let r=2166136261;for(let t=0;t<s.length;t++)r^=s.charCodeAt(t),r=r*16777619>>>0;return r.toString(16)}function A(){return typeof chrome<"u"&&!!chrome.runtime&&!!chrome.runtime.id}function G(n){var t;const e=R(n,N);if(!e)return"";const o=e.getAttribute("datetime")||e.getAttribute("title")||e.getAttribute("aria-label");if(o){const i=Date.parse(o);if(!isNaN(i))return new Date(i).toISOString()}const s=((t=e.textContent)==null?void 0:t.trim())??"",r=Date.parse(s);return isNaN(r)?s||"":new Date(r).toISOString()}function B(n){const e=n.getAttribute("style")??"",o=[n.getAttribute("data-self"),n.getAttribute("data-is-self"),n.getAttribute("data-sender-is-me"),n.getAttribute("aria-label")];for(const i of o){if(!i)continue;const m=i.toLowerCase();if(m.includes("self")||m.includes("own")||m.includes("outgoing")||m.includes("sent by me")||m.includes("sent by myself")||/\bme\b/i.test(i))return"self"}const s=n.className??"",r=s.toLowerCase();if(r.includes("self")||r.includes("own")||r.includes("outgoing")||r.includes("sent by me")||r.includes("sent by myself")||/\bme\b/i.test(s)||r.includes("is-me")||r.includes("sender-me"))return"self";const t=window.getComputedStyle(n);return t.justifyContent==="flex-end"||t.alignSelf==="flex-end"||n.className.includes("flex-end")||e.includes("flex-end")?"self":"other"}function q(){const n=window.location.pathname.match(/\/rooms\/(?:room_)?([^/?#]+)/);return(n==null?void 0:n[1])??"unknown"}async function z(n){return new Promise(e=>{chrome.storage.local.get([S],o=>{const s=o[S]??{};e(s[n]??[])})})}async function P(n,e){return new Promise(o=>{chrome.storage.local.get([S],s=>{const r=s[S]??{},t=[...r[n]??[],...e],i=Array.from(new Map(t.map(l=>[l.id,l])).values()),m=i.length>500?i.slice(i.length-500):i;r[n]=m,chrome.storage.local.set({[S]:r},()=>{chrome.runtime.lastError&&console.error("[ShadowSense] Storage error:",chrome.runtime.lastError),o()})})})}class U{constructor(){w(this,"seen",new Set);w(this,"preloadedIds",new Set);w(this,"observer",null);w(this,"debounceTimer",null);w(this,"attachRetryTimer",null);w(this,"intervalTimer",null);w(this,"chatContainer",null);w(this,"stopped",!1);w(this,"isScanning",!1);w(this,"scanQueued",!1);w(this,"lastSentTranscriptHash",null)}async init(){var s;if(!A())return;this.stopped=!1,(s=this.observer)==null||s.disconnect(),this.observer=null,this.chatContainer=null,this.preloadedIds.clear(),this.seen.clear(),this.lastSentTranscriptHash=null;const e=q(),o=await z(e);for(const r of o)this.preloadedIds.add(r.id);console.log(`[ShadowSense] Loaded ${this.preloadedIds.size} existing messages for Upwork conversation "${e}"`),this.attach(),await this.scanAll(),this.intervalTimer!==null&&clearInterval(this.intervalTimer),this.intervalTimer=setInterval(()=>{if(!A()){this.stop();return}this.stopped||this.scanAll().catch(r=>console.error("[ShadowSense] Interval scan error:",r))},8e3)}attach(e=0){if(!A()||this.stopped)return;const o=R(document,j);o?(this.attachRetryTimer!==null&&(clearTimeout(this.attachRetryTimer),this.attachRetryTimer=null),this.chatContainer=o,this.observer=new MutationObserver(()=>{if(!A()){this.stop();return}this.scheduleExtraction()}),this.observer.observe(o,{childList:!0,subtree:!0,characterData:!0,attributes:!1}),console.log("[ShadowSense] MutationObserver attached to Upwork chat container:",o.tagName,o.className.slice(0,60)),this.scanAll().catch(s=>console.error("[ShadowSense] Post-attach scan error:",s))):e<30?(this.attachRetryTimer!==null&&clearTimeout(this.attachRetryTimer),this.attachRetryTimer=setTimeout(()=>this.attach(e+1),1e3)):console.warn("[ShadowSense] Could not find an Upwork chat container after 30 s.")}stop(){var e;this.stopped=!0,(e=this.observer)==null||e.disconnect(),this.observer=null,this.debounceTimer!==null&&clearTimeout(this.debounceTimer),this.debounceTimer=null,this.attachRetryTimer!==null&&clearTimeout(this.attachRetryTimer),this.attachRetryTimer=null,this.intervalTimer!==null&&clearInterval(this.intervalTimer),this.intervalTimer=null}scheduleExtraction(){this.debounceTimer!==null&&clearTimeout(this.debounceTimer),this.debounceTimer=setTimeout(()=>{this.debounceTimer=null,this.scanAll().catch(e=>console.error("[ShadowSense] Scan error:",e))},300)}async scanAll(){if(!A()){this.stop();return}if(this.isScanning){this.scanQueued=!0;return}this.isScanning=!0;try{const e=this.chatContainer??document;let o=O(e,L);const s=q(),r=[];if(o.length===0){const d=this.extractFallbackMessage(e,s);if(!d||this.seen.has(d.id))return;this.seen.add(d.id),console.log(`[ShadowSense] Fallback extraction — sending full conversation text (${d.text.length} chars) for analysis`),await P(s,[d]),this.notifyBackground([d]);return}for(const d of o){const c=this.extractMessage(d,s);c&&(this.seen.has(c.id)||this.preloadedIds.has(c.id)||(this.seen.add(c.id),r.push(c)))}if(r.length===0)return;console.log(`[ShadowSense] Captured ${r.length} new message(s) in Upwork conversation "${s}"`),await P(s,r);const i=(await z(s)).slice(-10),m=i.filter(d=>d.senderRole==="other"),l=M("transcript",m.map(d=>d.text).join("|"),s);if(l===this.lastSentTranscriptHash){console.debug("[ShadowSense] Transcript unchanged — skipping redundant re-analysis.");return}this.lastSentTranscriptHash=l,this.notifyBackground(i)}finally{this.isScanning=!1,this.scanQueued&&(this.scanQueued=!1,this.scheduleExtraction())}}extractFallbackMessage(e,o){var x;const s=['[class*="conversation"]','[class*="messages"]','[class*="chat"]','[class*="thread"]',"main"];let r=null;for(const u of s)try{const a=(e instanceof Document?e:e.ownerDocument??document).querySelector(u);if(a&&a.textContent&&a.textContent.trim().length>50){r=a;break}}catch{}const t=[],i=r??(e instanceof Document?e.body:e),m=document.createTreeWalker(i,NodeFilter.SHOW_TEXT,{acceptNode(u){var p;if((((p=u.textContent)==null?void 0:p.trim())??"").length<10)return NodeFilter.FILTER_REJECT;const b=u.parentElement;if(!b)return NodeFilter.FILTER_REJECT;const g=b.tagName.toLowerCase();return g==="script"||g==="style"||g==="noscript"?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT}});let l;const d=new Set;for(;l=m.nextNode();){const u=((x=l.textContent)==null?void 0:x.trim())??"";if(d.has(u)||(d.add(u),t.push(u)),t.length>=50)break}const c=t.join(" ").slice(0,4e3);return c.length<20?null:{id:M("fallback",c,o),conversationId:o,sender:"Unknown (fallback)",senderRole:"other",text:c,timestamp:new Date().toISOString(),capturedAt:Date.now(),pageUrl:window.location.href}}extractMessage(e,o){var b,g,p,h,f;let s="Unknown";const r=e.getAttribute("data-username")||e.getAttribute("data-sender")||e.getAttribute("data-user");if(r)s=r;else{const y=R(e,H);if(y){const C=((b=y.textContent)==null?void 0:b.trim())??"";C.length>0&&C.length<80&&(s=C)}}const t=R(e,N),i=G(e),m=(t==null?void 0:t.getAttribute("datetime"))||(t==null?void 0:t.getAttribute("title"))||(t==null?void 0:t.getAttribute("aria-label"))||((g=t==null?void 0:t.textContent)==null?void 0:g.trim())||"",l=$.filter(y=>y!=="span"&&y!=="p"),d=R(e,l);let c="";if(d)c=((p=d.textContent)==null?void 0:p.trim())??"";else{const y=Array.from(e.querySelectorAll("p, span, div, text"));for(const C of y){const k=((h=C.textContent)==null?void 0:h.trim())??"";k.length>0&&k!==s&&k!==i&&!k.includes(i)&&!k.includes(s)&&k.length>c.length&&k.length<1e4&&(c=k)}}if(c||(c=((f=e.textContent)==null?void 0:f.trim())??""),c.length===0||c.length>1e4)return null;const T=B(e),x=e.getAttribute("data-message-id")||e.getAttribute("data-messageid")||e.getAttribute("data-testid")||e.getAttribute("id");return{id:x?`upwork:${o}:${x}`:M(s,c,m),conversationId:o,sender:s,senderRole:T,text:c,timestamp:i,capturedAt:Date.now(),pageUrl:window.location.href}}showAnalyzingBadge(){const e="ss-analyzing-badge";if(document.getElementById(e))return;const o=document.createElement("div");o.id=e,o.setAttribute("role","status"),o.setAttribute("aria-live","polite"),o.style.cssText=["position:fixed","bottom:80px","right:16px","z-index:2147483647","background:#312e81","color:#fff","font-size:11px","font-family:system-ui,sans-serif","font-weight:500","padding:7px 14px","border-radius:8px","box-shadow:0 4px 16px rgba(0,0,0,0.3)","display:flex","align-items:center","gap:8px","opacity:0","transition:opacity 0.2s ease"].join(";"),o.innerHTML="<span>🛡</span><span>ShadowSense — Analyzing…</span>",document.body.appendChild(o),requestAnimationFrame(()=>{o.style.opacity="1"})}hideAnalyzingBadge(){const e=document.getElementById("ss-analyzing-badge");e&&(e.style.opacity="0",setTimeout(()=>e.remove(),200))}notifyBackground(e){if(!A()){this.stop();return}this.saveLastKnownScore(),this.showAnalyzingBadge();const o=setTimeout(()=>{this.hideAnalyzingBadge(),this.showOfflineBadge()},12e4),s=e.filter(t=>t.senderRole==="other"),r=s.length>0?s[s.length-1].text:"";try{chrome.runtime.sendMessage({type:"UPWORK_MESSAGES_CAPTURED",payload:e},t=>{if(clearTimeout(o),this.hideAnalyzingBadge(),chrome.runtime.lastError){console.debug("[ShadowSense] Background response error:",chrome.runtime.lastError),this.showOfflineBadge();return}if(t&&t.success){const i=t.level??"clear",m=t.trust_score??100,l=t.reasons??[],d=t.analysis_id??"",c=t.suggested_responses??[];if(i==="high-risk"||i==="advisory"){const u=i==="high-risk"?["Thanks, but I need to verify this request with Upwork support first.","I'm only able to accept files through the official Upwork platform. Please use the attachment feature here.","I prefer to keep all communication within Upwork to protect both of us. Let's continue here."]:["Thank you for your message. Please share all project details directly on the platform.","I'd love to help — could we keep all communication and files within the platform?","Let's discuss the full scope of work here before I commit to anything."];this.injectResponseTemplates(c.length>0?c:u)}this.injectInterventionOverlay(m,i,l,d,r)}else t&&!t.success&&this.showOfflineBadge()})}catch(t){clearTimeout(o),console.debug("[ShadowSense] Could not notify background:",t),this.showOfflineBadge()}}saveLastKnownScore(){chrome.storage.local.get([v],e=>{console.debug("[ShadowSense] Cached score available:",e[v])})}showOfflineBadge(){const e="ss-offline-badge";document.getElementById(e)||chrome.storage.local.get([v],o=>{const s=o[v],r=s!=null?`cached score: ${s}`:"no cached data",t=document.createElement("div");t.id=e,t.setAttribute("role","status"),t.setAttribute("aria-live","polite"),t.style.cssText=["position:fixed","bottom:80px","right:16px","z-index:2147483647","background:#27272a","color:#fafafa","font-size:11px","font-family:system-ui,sans-serif","font-weight:500","padding:7px 12px","border-radius:8px","box-shadow:0 4px 16px rgba(0,0,0,0.3)","display:flex","align-items:center","gap:6px","opacity:0","transition:opacity 0.2s ease","pointer-events:none"].join(";"),t.innerHTML=`⚠️ <span>Offline — showing ${r}</span>`,document.body.appendChild(t),requestAnimationFrame(()=>{t.style.opacity="1"}),setTimeout(()=>{t.style.opacity="0",setTimeout(()=>t.remove(),250)},6e3)})}injectResponseTemplates(e){var c,T,x;const o="ss-response-templates";(c=document.getElementById(o))==null||c.remove();const s=['[data-testid*="message-input"]','[data-testid*="chat-input"]','[aria-label*="message" i][contenteditable]','[role="textbox"]','textarea[placeholder*="message" i]','textarea[placeholder*="reply" i]','textarea[placeholder*="write" i]','div[contenteditable="true"]'];let r=null;for(const u of s)try{if(r=document.querySelector(u),r)break}catch{}if(!r){console.debug("[ShadowSense] Chat input not found — skipping template injection");return}const t=document.createElement("div");if(t.id=o,t.setAttribute("role","region"),t.setAttribute("aria-label","ShadowSense — Suggested safe responses"),t.style.cssText=["display:flex","flex-direction:column","gap:6px","padding:8px 12px","margin-top:4px","background:linear-gradient(135deg,#fcebeb,#fafafa)","border-top:2px solid #e24b4a","animation:ss-tmpl-in 0.25s ease both","font-family:system-ui,sans-serif"].join(";"),!document.getElementById("ss-tmpl-style")){const u=document.createElement("style");u.id="ss-tmpl-style",u.textContent=`
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
      `,document.head.appendChild(u)}const i=document.createElement("div");i.id="ss-header-row";const m=document.createElement("span");m.textContent="🛡 ShadowSense — Shield Responses";const l=document.createElement("button");l.id="ss-dismiss-btn",l.textContent="✕ Dismiss",l.onclick=()=>t.remove(),i.appendChild(m),i.appendChild(l),t.appendChild(i),e.forEach(u=>{const a=document.createElement("div");a.className="ss-chip";const b=document.createElement("span");b.className="ss-chip-text",b.textContent=u;const g=document.createElement("button");g.className="ss-chip-copy",g.textContent="Copy",g.setAttribute("aria-label","Copy response to clipboard"),g.onclick=()=>{navigator.clipboard.writeText(u).catch(()=>{const p=document.createElement("textarea");p.value=u,document.body.appendChild(p),p.select(),document.execCommand("copy"),document.body.removeChild(p)}),g.textContent="✓ Copied!",g.classList.add("copied"),setTimeout(()=>{g.textContent="Copy",g.classList.remove("copied")},1500)},a.appendChild(b),a.appendChild(g),t.appendChild(a)}),(T=r.parentElement)!=null&&T.insertBefore(t,r.nextSibling)||((x=r.parentElement)==null||x.appendChild(t));const d=()=>{t.remove(),r.removeEventListener("input",d)};r.addEventListener("input",d),setTimeout(()=>t.remove(),3e4),console.log("[ShadowSense] Response templates injected below chat input.")}ensureStyles(){if(document.getElementById("ss-intervention-styles"))return;const e=document.createElement("style");e.id="ss-intervention-styles",e.textContent=`
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
        color: var(--ss-color-bg-surface) !important;
        padding: 0 !important;
        font-weight: bold !important;
      }
    `,document.head.appendChild(e)}cleanInterventions(){document.querySelectorAll(".ss-intervention-wrapper, .ss-floating-mini-badge").forEach(e=>e.remove()),document.querySelectorAll(".ss-input-blocking-overlay").forEach(e=>e.remove()),document.querySelectorAll(".ss-high-risk-input-border").forEach(e=>{e.classList.remove("ss-high-risk-input-border")})}injectInterventionOverlay(e,o,s,r,t){var c,T,x,u;this.ensureStyles(),this.cleanInterventions();const i=this.chatContainer??document,m=O(i,L);if(m.length===0)return;let l=null;for(let a=m.length-1;a>=0;a--)if(B(m[a])==="other"){l=m[a];break}if(l||(l=m[m.length-1]),!l||!l.parentElement)return;const d=s&&s.length>0?'<ul style="margin:4px 0 0 0;padding-left:18px;">'+s.slice(0,5).map(a=>`<li style="font-size:11px;line-height:1.55;margin-bottom:3px;">${a}</li>`).join("")+"</ul>":'<p style="font-size:11px;margin:0;">Suspicious metadata or behavioral characteristics detected.</p>';if(o==="high-risk"){const a=document.createElement("div");a.className="ss-intervention-wrapper",a.innerHTML=`
        <div class="ss-intervention-banner">
          <div class="ss-intervention-banner-left">
            <span>⚠️ ShadowSense Agentic Shield Active</span>
          </div>
          <span style="font-size:9px" class="text-mono">Blocked</span>
        </div>
        <div class="ss-intervention-body">
          <div class="ss-intervention-title">Shield Block Applied (Trust Score: ${e})</div>
          <div class="ss-intervention-desc">
            ${d}
          </div>
          <div class="ss-intervention-actions">
            <button class="ss-inter-btn-white" id="ss-report-btn">Report Scam</button>
            <button class="ss-inter-btn-accent" id="ss-bypass-btn">Bypass Warning</button>
          </div>
        </div>
      `,l.parentElement.insertBefore(a,l),(c=a.querySelector("#ss-bypass-btn"))==null||c.addEventListener("click",()=>{chrome.runtime.sendMessage({type:"SUBMIT_OVERRIDE_FEEDBACK",payload:{analysis_id:r,pattern_text:t||"Override flagged conversation",user_id:"anonymous",trust_score:e}},p=>{console.log("[ShadowSense] Override submitted:",p);const h=a.querySelector(".ss-intervention-body");if(h){a.style.borderColor="var(--ss-color-clear-primary)",a.style.background="linear-gradient(135deg, var(--ss-color-clear-bg) 0%, #ffffff 100%)";const f=a.querySelector(".ss-intervention-banner");if(f){f.style.background="var(--ss-color-clear-primary)";const k=f.querySelector("span");k&&(k.textContent="✓ Warning Overridden")}h.innerHTML=`
              <div style="display:flex;align-items:flex-start;gap:10px;">
                <div style="width:24px;height:24px;border-radius:50%;background:var(--ss-color-clear-bg);border:1px solid var(--ss-color-clear-border);display:flex;align-items:center;justify-content:center;color:var(--ss-color-clear-primary);font-weight:bold;flex-shrink:0;">✓</div>
                <div>
                  <div class="ss-intervention-title" style="color: var(--ss-color-clear-text);margin-bottom:2px;">Override Processed</div>
                  <div class="ss-intervention-desc" style="color: var(--ss-color-clear-text);margin:0;">Safety warning bypassed successfully.</div>
                </div>
              </div>
            `;const y=document.querySelector(".ss-input-blocking-overlay");y&&y.remove();const C=document.querySelector(".ss-high-risk-input-border");C&&C.classList.remove("ss-high-risk-input-border")}setTimeout(()=>this.cleanInterventions(),1e3)})}),(T=a.querySelector("#ss-report-btn"))==null||T.addEventListener("click",()=>{chrome.runtime.sendMessage({type:"SUBMIT_GENERAL_FEEDBACK",payload:{analysis_id:r,user_feedback:"report",was_accurate:!0,additional_context:{platform:"upwork",score:e}}},p=>{console.log("[ShadowSense] Report submitted:",p);const h=a.querySelector(".ss-intervention-body");if(h){a.style.borderColor="var(--ss-color-clear-primary)",a.style.background="linear-gradient(135deg, var(--ss-color-clear-bg) 0%, #ffffff 100%)",a.style.boxShadow="0 8px 32px rgba(16, 185, 129, 0.08)";const f=a.querySelector(".ss-intervention-banner");if(f){f.style.background="var(--ss-color-clear-primary)";const y=f.querySelector("span");y&&(y.textContent="✓ ShadowSense Threat Flagged")}h.innerHTML=`
              <div style="display:flex;align-items:flex-start;gap:10px;">
                <div style="width:24px;height:24px;border-radius:50%;background:var(--ss-color-clear-bg);border:1px solid var(--ss-color-clear-border);display:flex;align-items:center;justify-content:center;color:var(--ss-color-clear-primary);font-weight:bold;flex-shrink:0;">✓</div>
                <div>
                  <div class="ss-intervention-title" style="color: var(--ss-color-clear-text);margin-bottom:2px;">Thank you for reporting!</div>
                  <div class="ss-intervention-desc" style="color: var(--ss-color-clear-text);margin:0;">The threat signature has been flagged for analysis. You can now close this conversation safely.</div>
                </div>
              </div>
            `}})});const b=['[data-testid*="message-input"]','[data-testid*="chat-input"]','[aria-label*="message" i][contenteditable]','[role="textbox"]','textarea[placeholder*="message" i]','textarea[placeholder*="reply" i]','textarea[placeholder*="write" i]','div[contenteditable="true"]'];let g=null;for(const p of b)try{if(g=document.querySelector(p),g)break}catch{}if(g){const p=g.parentElement;if(p){p.classList.add("ss-high-risk-input-border");const h=window.getComputedStyle(p).position;h!=="relative"&&h!=="absolute"&&h!=="fixed"&&(p.style.position="relative");const f=document.createElement("div");f.className="ss-input-blocking-overlay",f.innerHTML=`
            <div class="ss-blocking-text">
              ⚠️ Typing disabled. Please review safety warning above.
            </div>
          `,p.appendChild(f)}}}else if(o==="advisory"){const a=document.createElement("div");a.className="ss-intervention-wrapper ss-advisory",a.innerHTML=`
        <div class="ss-intervention-banner">
          <div class="ss-intervention-banner-left">
            <span>⚠️ ShadowSense Advisory Active</span>
          </div>
          <button class="ss-dismiss-btn" id="ss-advisory-dismiss">Dismiss ×</button>
        </div>
        <div class="ss-intervention-body">
          <div class="ss-intervention-title">Caution (Trust Score: ${e})</div>
          <div class="ss-intervention-desc">
            ${d}
          </div>
          <div class="ss-intervention-actions" style="margin-top: 8px;">
            <button class="ss-inter-btn-white" id="ss-advisory-report" style="border-color: var(--ss-color-warn-border); color: var(--ss-color-warn-text); background: white;">Report Client</button>
          </div>
        </div>
      `,l.parentElement.insertBefore(a,l),(x=a.querySelector("#ss-advisory-dismiss"))==null||x.addEventListener("click",()=>{this.cleanInterventions()}),(u=a.querySelector("#ss-advisory-report"))==null||u.addEventListener("click",()=>{chrome.runtime.sendMessage({type:"SUBMIT_GENERAL_FEEDBACK",payload:{analysis_id:r,user_feedback:"report",was_accurate:!0,additional_context:{platform:"upwork",score:e}}},b=>{console.log("[ShadowSense] Report submitted:",b);const g=a.querySelector(".ss-intervention-body");if(g){a.style.borderColor="var(--ss-color-clear-primary)",a.style.background="linear-gradient(135deg, var(--ss-color-clear-bg) 0%, #ffffff 100%)",a.style.boxShadow="0 8px 32px rgba(16, 185, 129, 0.08)";const p=a.querySelector(".ss-intervention-banner");if(p){p.style.background="var(--ss-color-clear-primary)";const h=p.querySelector("span");h&&(h.textContent="✓ ShadowSense Threat Flagged")}g.innerHTML=`
              <div style="display:flex;align-items:flex-start;gap:10px;">
                <div style="width:24px;height:24px;border-radius:50%;background:var(--ss-color-clear-bg);border:1px solid var(--ss-color-clear-border);display:flex;align-items:center;justify-content:center;color:var(--ss-color-clear-primary);font-weight:bold;flex-shrink:0;">✓</div>
                <div>
                  <div class="ss-intervention-title" style="color: var(--ss-color-clear-text);margin-bottom:2px;">Thank you for reporting!</div>
                  <div class="ss-intervention-desc" style="color: var(--ss-color-clear-text);margin:0;">The warning has been reported to the community moderation system.</div>
                </div>
              </div>
            `,setTimeout(()=>this.cleanInterventions(),2e3)}})})}else if(o==="clear"){const a=document.createElement("div");a.className="ss-floating-mini-badge",a.innerHTML=`
        <span>🛡 Checked by ShadowSense: Safe Client (${e}/100)</span>
      `,l.parentElement.insertBefore(a,l)}}}let E=null,D=window.location.pathname;function F(){const n=window.location.pathname;return n.includes("/messages")||n.includes("/rooms")}async function I(){const n=window.location.pathname;n!==D&&(D=n,console.log("[ShadowSense] Upwork navigation detected →",n),E==null||E.stop(),E=null,F()&&(E=new U,await E.init()))}(function(){const e=history.pushState.bind(history),o=history.replaceState.bind(history);history.pushState=(...s)=>{e(...s),I().catch(r=>console.error("[ShadowSense] PushState navigation error:",r))},history.replaceState=(...s)=>{o(...s),I().catch(r=>console.error("[ShadowSense] ReplaceState navigation error:",r))}})(),window.addEventListener("popstate",()=>{I().catch(n=>console.error("[ShadowSense] Popstate navigation error:",n))});const K=setInterval(()=>{if(!A()){clearInterval(K);return}I().catch(n=>console.error("[ShadowSense] URL-poll navigation error:",n))},1e3);(function(){console.log("[ShadowSense] Upwork Inbox content script loaded."),F()?(E=new U,E.init().catch(e=>console.error("[ShadowSense] Initialization error:",e))):console.log("[ShadowSense] Not on an Upwork messages page – observer will activate on navigation.")})()})();
