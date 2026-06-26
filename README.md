# ShadowSense Aurora

[![Build Status](https://github.com/thimira20011/ShadowSense-2026-Aurora/actions/workflows/ci.yml/badge.svg)](https://github.com/thimira20011/ShadowSense-2026-Aurora/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**AI-Powered Scam Detection for Freelance Marketplaces**

ShadowSense Aurora is a real-time scam detection system built on a 4-agent AI architecture. It protects freelancers on Fiverr and Upwork by analysing chat messages and job listings for fraud patterns — and intervening with visual alerts and suggested safe responses.

---

## How It Works

```
 Fiverr / Upwork chat message
        │
        ▼
 Chrome Extension (content script)
        │  POST /api/analyze
        ▼
 ┌──────────────────────────────────────────┐
 │         FastAPI Backend (ShieldAgent)    │
 │                                          │
 │  ┌─────────────┐  ┌──────────────────┐  │
 │  │ Linguistic  │  │    Identity      │  │
 │  │ Agent       │  │    Agent         │  │
 │  │ Groq Scout  │  │  Gemini Flash    │  │
 │  └─────────────┘  └──────────────────┘  │
 │  ┌─────────────┐  ┌──────────────────┐  │
 │  │  Payload    │  │  ChromaDB        │  │
 │  │  Agent      │  │  Semantic Search │  │
 │  │ DeepSeek-R1 │  │  (75 patterns)   │  │
 │  └─────────────┘  └──────────────────┘  │
 │                                          │
 │  Trust Score = 100 − weighted_risk       │
 └──────────────────────────────────────────┘
        │
        ▼
 🟢 CLEAR (≥70) · 🟡 ADVISORY (30–69) · 🔴 HIGH RISK (<30)
```

---

## Key Features

- **4-Agent Pipeline** — Linguistic, Identity, Payload, and Shield Orchestrator agents run concurrently
- **Semantic Similarity** — ChromaDB vector search matches messages against 75 known scam patterns
- **Adaptive Feedback Loop** — users can override false positives; patterns with 3+ overrides get a benign boost
- **Real-time Chrome Extension** — Trust Gauge, alert overlays, and suggested safe responses
- **Graceful Degradation** — system keeps scoring even when Ollama or Groq are offline
- **Privacy-First** — payload analysis runs locally via Ollama (no data sent externally)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | FastAPI + uvicorn |
| Agent Orchestration | CrewAI (stub) |
| Linguistic Agent | Groq llama-4-scout-17b (→ Gemini fallback) |
| Identity Agent | Google Gemini 2.0 Flash |
| Payload Agent | Ollama DeepSeek-R1 (local) |
| Vector DB | ChromaDB with `all-MiniLM-L6-v2` embeddings |
| Chrome Extension | React + TypeScript (Vite) |
| Secrets Management | Infisical |

---

## Project Structure

```
Shadow Sense/
├── backend/               # FastAPI app + multi-agent pipeline
│   ├── main.py            # Entry point + health check
│   ├── config.py          # Environment config + validation
│   ├── agents/
│   │   ├── shield.py      # Orchestrator — combines all scores
│   │   ├── linguistic.py  # Groq-powered urgency/grammar analysis
│   │   ├── identity.py    # Gemini-powered account profiling
│   │   ├── payload.py     # Ollama-powered file/link threat scan
│   │   └── job_risk.py    # Pre-engagement job listing scorer
│   └── api/
│       ├── analyze.py     # POST /api/analyze
│       ├── feedback.py    # POST /api/feedback + /override
│       └── pre_engage.py  # POST /api/pre-engage
├── extension/             # Chrome extension (React + TypeScript)
│   ├── src/               # Source files
│   └── dist/              # Pre-built — load directly in Chrome
├── ml-pipeline/           # Vector DB + embeddings
│   ├── embeddings.py      # query_similar_scams() public API
│   ├── feedback_loop.py   # Benign-pattern boost logic
│   ├── chromadb_setup.py  # Collection initialisation helper
│   └── scripts/           # Seed data importers
├── data/
│   └── chromadb/          # Persisted vector database (75 patterns)
├── tests/
│   ├── unit/              # Fast offline tests
│   ├── integration/       # End-to-end API tests
│   └── test_scenarios/    # 30 real scam scenario JSON files
├── docs/
│   ├── setup.md           # Full installation guide
│   └── architecture.md    # System design deep-dive
└── scripts/               # Dev utilities
```

---

## Quick Start

> Full instructions: [docs/setup.md](docs/setup.md)

```powershell
# 1. Set up Python environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt

# 2. Start Ollama (optional)
ollama serve

# 3. Start the backend (secrets via Infisical)
infisical run --env=dev -- python backend\main.py

# 4. Load extension/dist/ in Chrome via chrome://extensions/ → Load unpacked
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/analyze` | Analyse a chat message → Trust Score |
| `POST` | `/api/pre-engage` | Analyse a job listing before applying |
| `POST` | `/api/feedback` | Submit accuracy feedback |
| `POST` | `/api/feedback/override` | Override a false positive |
| `GET` | `/health` | Server + provider status |
| `GET` | `/docs` | Interactive Swagger UI |

---

## Trust Score Formula

```
weighted_risk = 0.45 × linguistic_urgency
              + 0.35 × identity_risk
              + 0.20 × payload_risk

trust_score = clamp(100 − weighted_risk − chromadb_penalty + benign_boost, 0, 100)
```

| Score | Level | UI Behaviour |
|-------|-------|-------------|
| 70–100 | `CLEAR` | Silent (no overlay) |
| 30–69 | `ADVISORY` | Yellow banner |
| 0–29 | `HIGH_RISK` | Red blocking modal |

---

## Running Tests

```powershell
# Unit tests (no API keys required)
pytest tests/unit/ -v

# Full suite with secrets
infisical run --env=dev -- pytest tests/ -v
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

[MIT](LICENSE)
