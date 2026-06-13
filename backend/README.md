# ShadowSense Aurora — Backend

FastAPI + CrewAI backend powering real-time scam detection for freelance platforms (Fiverr, Upwork).

---

## Architecture

```
Chrome Extension (M2)
       │  POST /api/analyze
       ▼
┌─────────────────────────────────────────────────────────┐
│                   FastAPI Backend (M1)                  │
│                                                         │
│  ShieldAgent (Orchestrator)                             │
│    ├── LinguisticAgent  ──► Groq  llama-4-scout         │
│    │     (urgency, grammar, manipulation detection)     │
│    │     fallback ──────► Gemini 2.0 Flash              │
│    │                                                    │
│    ├── IdentityAgent   ──► Gemini 2.0 Flash             │
│    │     (account age, reviews, verification)           │
│    │                                                    │
│    └── PayloadAgent    ──► Ollama DeepSeek-R1 (local)   │
│          (file hashes, malicious extensions)            │
│          graceful skip if Ollama is offline             │
│                                                         │
│  ChromaDB (M3 ml-pipeline)                              │
│    └── query_similar_scams() ─ top-3 semantic matches   │
│         (confidence boost + chromadb_penalty)           │
│                                                         │
│  Trust Score formula:                                   │
│    weighted_risk = 0.45 * linguistic                    │
│                  + 0.35 * identity                      │
│                  + 0.20 * payload                       │
│    score = clamp(100 - weighted_risk - chromadb_penalty │
│                  + benign_boost, 0, 100)                │
│                                                         │
│  Thresholds:  CLEAR ≥ 70  │  ADVISORY 30–69  │ HIGH_RISK < 30
└─────────────────────────────────────────────────────────┘
       │  response: trust_score, reasons, suggested_responses
       ▼
Chrome Extension renders Trust Gauge + Alert Overlay
```

---

## Setup

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Python | 3.12+ | `python --version` |
| Groq API key | — | [console.groq.com](https://console.groq.com) (free tier) |
| Gemini API key | — | [aistudio.google.com](https://aistudio.google.com/app/apikey) (free tier) |
| Ollama *(optional)* | latest | [ollama.com](https://ollama.com) — for payload analysis |

### Install

```bash
# From the project root:
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux

pip install -r backend/requirements.txt
```

### Configure

```bash
copy backend\.env.example backend\.env   # Windows
# cp backend/.env.example backend/.env  # macOS / Linux
```

Open `backend/.env` and fill in:

```ini
GROQ_API_KEY=gsk_...          # Required
GEMINI_API_KEY=AIzaSy...      # Required
```

Everything else has sensible defaults.

### Run the server

```bash
# From the project root (with .venv activated):
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

The server validates API keys on startup and **refuses to start** if they are missing.

You should see:

```
INFO  ShadowSense Aurora starting up …
INFO  Environment validation passed.
INFO  Uvicorn running on http://0.0.0.0:8000
```

---

## API Reference

### `POST /api/analyze`

Analyse a chat message for scam indicators.

**Request**

```json
{
  "text": "I need this URGENTLY. Please contact me on Telegram to avoid fees.",
  "sender": "client123",
  "timestamp": "2026-06-13T10:00:00Z",
  "context": {
    "account_age_days": 2,
    "reviews": 0,
    "verified": false,
    "filename": "project_details.exe"
  }
}
```

**Response**

```json
{
  "trust_score": 12,
  "verdict": {
    "trust_score": {
      "score": 12,
      "level": "HIGH_RISK",
      "explanation": "High-risk patterns detected. Communication strongly matches known scam templates."
    },
    "reasons": [
      "Linguistic Analyst detected: Artificial Urgency",
      "Linguistic Analyst detected: Off-platform luring",
      "Identity Profiler flagged: Account is less than 3 days old",
      "Payload Auditor found: Suspicious executable (.exe) attachment"
    ],
    "suggested_responses": [
      "All payments and communications must remain on this platform...",
      "I'll need to verify this request with platform support...",
      "Please share all project files through the platform's official attachment system..."
    ]
  },
  "agent_details": {
    "linguistic": { "urgency_score": 85.0, "red_flags": ["Artificial Urgency", "Off-platform luring"], "confidence": 0.95 },
    "identity":   { "identity_risk": 85.0, "anomalies": ["Account is less than 3 days old"], "confidence": 0.9 },
    "payload":    { "payload_risk": 70.0, "threats": ["Suspicious executable (.exe) attachment"], "confidence": 1.0 },
    "similar_patterns": []
  }
}
```

**Trust Score Levels**

| Score | Level | Intervention |
|-------|-------|-------------|
| 70–100 | `CLEAR` | No overlay (silent) |
| 30–69 | `ADVISORY` | Yellow banner |
| 0–29 | `HIGH_RISK` | Red blocking modal |

**curl example**

```bash
curl -X POST http://localhost:8000/api/analyze/ \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, I have a project for you. Budget is $500 via Upwork.", "context": {"account_age_days": 300, "reviews": 45, "verified": true}}'
```

---

### `POST /api/feedback/`

Submit general accuracy feedback.

```bash
curl -X POST http://localhost:8000/api/feedback/ \
  -H "Content-Type: application/json" \
  -d '{"analysis_id": "abc123", "user_feedback": "report", "was_accurate": true}'
```

---

### `POST /api/feedback/override`

Report a false positive ("Override + Report" button in the extension).

```bash
curl -X POST http://localhost:8000/api/feedback/override \
  -H "Content-Type: application/json" \
  -d '{"analysis_id": "abc123", "pattern_text": "Need this done TODAY!", "trust_score": 22}'
```

When ≥ 3 unique users override the same pattern, it is automatically promoted to **benign** and future matches receive a `+20` trust-score boost.

---

### `POST /api/pre-engage/`

Analyse a job listing **before** applying.

```bash
curl -X POST http://localhost:8000/api/pre-engage/ \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "fiverr",
    "job_url": "https://www.fiverr.com/jobs/abc",
    "job_title": "Need writer for urgent article",
    "job_description": "Pay via gift card. Contact on WhatsApp first.",
    "client_profile": {"member_since_days": 1, "reviews": 0, "verified": false}
  }'
```

---

### `GET /health`

Health check + provider status.

```bash
curl http://localhost:8000/health
```

```json
{
  "status": "healthy",
  "service": "ShadowSense Aurora",
  "version": "1.0.0",
  "providers": {
    "groq": "configured",
    "gemini": "configured",
    "ollama": "configured (http://localhost:11434)"
  }
}
```

---

## Running Tests

```bash
# Unit tests (fast, no API calls required):
python -m pytest tests/unit/ -v

# Integration tests (requires backend running + API keys):
python -m pytest tests/ -v --ignore=tests/unit

# Single test file:
python -m pytest tests/unit/test_agents.py -v
```

---

## Project Structure

```
backend/
├── main.py             # FastAPI app, lifespan, health check
├── config.py           # All env vars + startup validation
├── logging_config.py   # Centralised logging setup
├── requirements.txt    # Pinned dependencies
├── .env.example        # Template — copy to .env
├── agents/
│   ├── shield.py       # Orchestrator — combines all agent results
│   ├── linguistic.py   # Groq llama-4-scout (urgency/grammar/manipulation)
│   ├── identity.py     # Gemini Flash (account age/reviews/verification)
│   ├── payload.py      # Ollama DeepSeek-R1 (file/link threats)
│   └── job_risk.py     # Pre-engagement job listing scorer
├── api/
│   ├── analyze.py      # POST /api/analyze
│   ├── feedback.py     # POST /api/feedback + /api/feedback/override
│   └── pre_engage.py   # POST /api/pre-engage
└── models/
    └── analysis.py     # Pydantic schemas
```

---

## Environment Variables Quick Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GROQ_API_KEY` | ✅ Yes | — | Groq API key for LinguisticAgent |
| `GEMINI_API_KEY` | ✅ Yes | — | Gemini key for IdentityAgent + fallback |
| `API_PORT` | No | `8000` | Server port |
| `DEBUG` | No | `False` | Enable hot-reload |
| `LOG_LEVEL` | No | `INFO` | `DEBUG\|INFO\|WARNING\|ERROR` |
| `LOG_FORMAT` | No | `console` | `console` or `json` |
| `OLLAMA_HOST` | No | `http://localhost:11434` | Ollama endpoint |
| `DEEPSEEK_MODEL` | No | `deepseek-r1` | Ollama model for payload |
| `CHROMADB_PATH` | No | `./data/chromadb` | ChromaDB persistence path |

See [`backend/.env.example`](.env.example) for the full annotated reference.

---

## Graceful Degradation

The backend is designed to stay online even when optional services fail:

| Service down | Behaviour |
|---|---|
| Groq API | Falls back to Gemini for linguistic analysis |
| Gemini API | Falls back to rule-based mock analysis |
| Ollama / DeepSeek | Payload analysis skipped (payload_risk = 0) |
| ChromaDB | Similarity scoring skipped (no penalty/boost) |
| 1 agent timeout | Partial Trust Score from remaining 2 agents |

---

## Logging

The server emits structured logs to stdout.

**Development** (default):
```
2026-06-13 12:00:00  INFO      backend.agents.shield  Shield Trust Score: 82 (raw=82, benign_boost=0, ...)
```

**Production** (set `LOG_FORMAT=json`):
```json
{"timestamp": "2026-06-13T12:00:00Z", "level": "INFO", "logger": "backend.agents.shield", "message": "Shield Trust Score: 82 ..."}
```
