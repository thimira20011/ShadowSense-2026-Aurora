# ShadowSense Aurora — 2-Minute Demo Video Script

**Total runtime:** ~2 minutes  
**Recording tool suggestions:** OBS Studio, Windows Game Bar (`Win + G`), Loom  
**Resolution:** 1920×1080 recommended  

> Tip: Do a dry run once before recording. The whole flow takes ~90 seconds when the backend is warmed up.

---

## Pre-Recording Checklist

- [ ] Backend running: `uvicorn backend.main:app --host 0.0.0.0 --port 8000`
- [ ] Terminal visible and readable (font size ≥ 14pt, dark background)
- [ ] Chrome extension loaded (M2's unpacked extension from `extension/dist/`)
- [ ] Fiverr tab open in Chrome (logged in, in a conversation)
- [ ] Microphone working (test with a short recording first)

---

## Script

### 0:00 – 0:15 — Hook (Server Start)

**[Screen: Terminal]**

Say:
> "Every 11 minutes, a freelancer somewhere loses money to a scam. ShadowSense Aurora is a real-time AI co-pilot that detects scams before they happen."

*Type and run:*
```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

*Show the startup logs:*
```
INFO  ShadowSense Aurora starting up …
INFO  Environment validation passed.
INFO  Uvicorn running on http://0.0.0.0:8000
```

Say:
> "Four AI agents start up — Linguistic, Identity, Payload, and Shield. Let's see them in action."

---

### 0:15 – 0:35 — Health Check + Safe Message

**[Screen: Terminal with split view or switch quickly]**

*Run:*
```bash
curl http://localhost:8000/health
```

*Show output:*
```json
{"status": "healthy", "providers": {"groq": "configured", "gemini": "configured"}}
```

*Then run a safe message:*
```bash
curl -X POST http://localhost:8000/api/analyze/ \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"Hi! I have a logo design project, budget is $300 via Upwork. Timeline is 1 week.\", \"context\": {\"account_age_days\": 365, \"reviews\": 47, \"verified\": true}}"
```

*Show output (highlight the score):*
```json
{"trust_score": 88, "verdict": {"trust_score": {"score": 88, "level": "CLEAR", ...}}}
```

Say:
> "Score: 88, CLEAR. Established account, no red flags. The extension would show a green gauge — no overlay, freelancer can safely reply."

---

### 0:35 – 1:20 — Scam Message (Core Demo)

**[Screen: Terminal]**

Say:
> "Now let's try what a real scam looks like."

*Run:*
```bash
curl -X POST http://localhost:8000/api/analyze/ \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"URGENT: I need this done in 30 minutes or I go to another seller. Contact me on Telegram to avoid Fiverr fees. I will send you the full brief there. Here is the starter file.\", \"sender\": \"client_x99\", \"context\": {\"account_age_days\": 1, \"reviews\": 0, \"verified\": false, \"filename\": \"brief.exe\"}}"
```

*Wait for response. Show and talk through it:*
```json
{
  "trust_score": 9,
  "verdict": {
    "trust_score": {"score": 9, "level": "HIGH_RISK"},
    "reasons": [
      "Linguistic Analyst detected: Artificial Urgency",
      "Linguistic Analyst detected: Off-platform luring",
      "Identity Profiler flagged: Account is less than 3 days old",
      "Identity Profiler flagged: No completed reviews on profile",
      "Payload Auditor found: Suspicious executable (.exe) attachment"
    ]
  }
}
```

Say:
> "Score: 9 — HIGH_RISK. Look at the reasons array. The Linguistic agent caught the urgency and the Telegram redirect. The Identity agent flagged a 1-day-old account with zero reviews. The Payload agent flagged the .exe attachment. Three independent AI agents, one combined verdict."

---

### 1:20 – 1:45 — Extension UI (Chrome)

**[Switch to Chrome — Fiverr tab with extension visible]**

Say:
> "In the Chrome extension, the freelancer sees this in real-time. The Trust Gauge drops, and a red blocking modal appears over the chat input. They can't accidentally reply without reading the warning."

*Point to:*
1. The Trust Gauge showing ~9 (red zone)
2. The red modal over the chat input
3. The "Reasons" section with bullet points

Say:
> "If the freelancer believes it's a false positive, they click 'Override + Report'. That event gets sent to our feedback API and logged to ChromaDB — so the system learns."

---

### 1:45 – 2:00 — Closing

**[Screen: Terminal or slide with architecture diagram]**

Say:
> "ShadowSense Aurora: four AI agents, privacy-first local inference with DeepSeek-R1, and a self-learning feedback loop via ChromaDB. Built for the 1.57 billion freelancers who deserve better protection."

*Hold final frame for 3–5 seconds for thumbnail capture.*

---

## Post-Recording

1. Export as MP4: `docs/demo-video.mp4` OR upload to YouTube/Loom
2. Copy the video URL and update the `README.md` demo video badge:
   ```markdown
   [![ShadowSense Demo](https://img.shields.io/badge/Demo%20Video-Play-red?logo=youtube)](YOUR_VIDEO_URL)
   ```
3. Take a screenshot of the Trust Gauge (green, yellow, red states) for the pitch deck

---

## Backup: If Live Demo Fails

If the backend is slow or the extension has issues on demo day, use these pre-recorded terminal outputs in a text file and paste them into the terminal during the demo.

**Safe message response:**
```json
{"trust_score": 88, "verdict": {"trust_score": {"score": 88, "level": "CLEAR", "explanation": "Conversation appears safe. No significant scam indicators were detected."}, "reasons": ["No threat indicators identified by any agent."]}}
```

**Scam message response:**
```json
{"trust_score": 9, "verdict": {"trust_score": {"score": 9, "level": "HIGH_RISK", "explanation": "High-risk patterns detected."}, "reasons": ["Linguistic Analyst detected: Artificial Urgency", "Linguistic Analyst detected: Off-platform luring", "Identity Profiler flagged: Account is less than 3 days old", "Payload Auditor found: Suspicious executable (.exe) attachment"]}}
```
