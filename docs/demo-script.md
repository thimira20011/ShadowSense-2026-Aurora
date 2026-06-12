# ShadowSense Aurora 2026 — 3-Minute Timed Demo Script
*Presenter: Product Manager & Testing Lead (Member 4)*

---

### **0:00 – 0:30 | Introduction & Product Mission**
* **Visuals:** 
  * Open browser to Fiverr/Upwork freelancer dashboard.
  * Zoom in on the inactive ShadowSense Aurora icon in the Chrome Extension toolbar.
* **Audio (Voiceover):**
  > "Hello everyone. Today, we are showcasing ShadowSense Aurora, an AI-powered defense system designed specifically to protect freelancers on platforms like Fiverr and Upwork.
  > 
  > Freelancers are increasingly targeted by sophisticated scams—ranging from off-platform payment fraud to malicious files hidden inside project briefs. Platform safety filters are often bypassed.
  > 
  > ShadowSense sits silently in the browser, providing a zero-configuration, real-time safety net. Let's see it in action."

---

### **0:30 – 1:15 | Scenario 1: Real-Time Fiverr Chat Monitoring**
* **Visuals:** 
  * Open a simulated Fiverr message thread.
  * A message from a new buyer appears: *"Hi, I want to hire you but platforms fees are too high. Let's discuss on WhatsApp +1-555-0192 and I'll send payment via Amazon gift card."*
  * Watch the **Trust Gauge** container appear beside the chat bubble, dropping dynamically from default clear to a bright red `HIGH_RISK` indicator with a Trust Score of `39` or lower.
  * Show the **Alert Overlay** locking the text input area so the freelancer cannot accidentally reply.
  * Click to expand the **Defense Narrative** showing the reasons: *Linguistic Analyst flagged: Off-platform payment request (Gift Card)*, *WhatsApp redirect detected*.
* **Audio (Voiceover):**
  > "Here, a buyer suggests moving off-platform to WhatsApp and paying via gift cards.
  > 
  > Instantly, the Linguistic Agent—powered by Groq llama-4-scout—flags these verbal tactics. 
  > 
  > Because the score drops below our high-risk threshold of 30, the extension triggers a hard block, disabling the text input so the freelancer cannot engage.
  > 
  > The extension also suggests safe response templates to steer the conversation back on-platform."

---

### **1:15 – 2:00 | Scenario 2: Payload Auditor (Malicious File Brief)**
* **Visuals:**
  * Client sends a file attachment in chat: `company_brief_internal.zip`.
  * The extension automatically detects the file and triggers the Payload Agent.
  * Click on the extension panel to show the auditor log: *Executable file 'installer.exe' found inside ZIP archive*, *Unsigned binary from unknown publisher*.
  * The Trust Score plunges to `18/100`, keeping the hard block active.
* **Audio (Voiceover):**
  > "Scammers frequently distribute malware disguised as project requirements.
  > 
  > When a file is received, our local Payload Agent scans its name, extension, and structure.
  > 
  > Here, it reveals a hidden executable within a password-protected zip file designed to evade standard anti-virus scanners.
  > 
  > ShadowSense flags the threat immediately, saving the freelancer from installing a Remote Access Trojan."

---

### **2:00 – 2:45 | Scenario 3: Feedback Loop & Adaptive Boost**
* **Visuals:**
  * Show a borderline message in the inbox: *"Hi, I need a React landing page by this Friday. It's very urgent. Let me know if you can take this."*
  * Trust Gauge shows `ADVISORY` (orange) with a score of `57/100`.
  * The presenter clicks **"Report False Positive / Override"** in the extension popup.
  * Click the **"Submit Override"** button to signal that this was a legitimate, albeit urgent, inquiry.
  * Send the exact same text again. The score now updates to `77/100` (`CLEAR` / green).
* **Audio (Voiceover):**
  > "Sometimes legitimate clients are just in a hurry, raising false positive alerts. 
  > 
  > ShadowSense solves this with an adaptive feedback loop. 
  > 
  > When a freelancer reports a false positive, it logs it to our local database.
  > 
  > If multiple users override the same pattern, the backend learns it is benign. On the next check, the system grants a +20 trust score boost, transitioning the conversation to CLEAR and keeping the pipeline adaptive."

---

### **2:45 – 3:00 | Outro & Architecture Summary**
* **Visuals:**
  * Display a summary slide with key stats: *Average latency: 2.3s*, *Core AI agents: 3*, *Zero PII shared outside*.
  * Fade out.
* **Audio (Voiceover):**
  > "By combining parallel multi-agent checks with local vector matching, ShadowSense Aurora runs in under 3 seconds with absolute user privacy.
  > 
  > It is the ultimate shield for the modern freelancer. Thank you!"
