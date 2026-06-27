# Installation & Setup Guide

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Python | 3.10+ | Backend & ML pipeline |
| Infisical CLI | latest | Secrets management — [install](https://infisical.com/docs/cli/overview) |
| Ollama | latest | Local DeepSeek-R1 inference (optional) |
| Chrome | any | Loading the extension |

> Node.js is **not required** — the extension is pre-built in `extension/dist/`.

---

## Step 1 — Clone & Set Up Python Environment

```powershell
# From the repo root
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install backend dependencies
pip install -r backend/requirements.txt

# Install ML pipeline dependencies
pip install -r ml-pipeline/requirements.txt
```

---

## Step 2 — Authenticate with Infisical

All secrets (API keys) are stored in Infisical — no `.env` file needed.

```powershell
infisical login          # authenticate with your Infisical account
infisical init           # link this project (only needed once per machine)
```

The project is already linked via `.infisical.json` — `infisical init` will confirm it.

> **Required secrets in Infisical (env: `dev`)**
> - `GROQ_API_KEY` — get free at [console.groq.com](https://console.groq.com)
> - `GEMINI_API_KEY` — get free at [aistudio.google.com](https://aistudio.google.com/app/apikey)

---

## Step 3 — Start Ollama (Optional but Recommended)

Ollama powers the PayloadAgent and AI-generated response suggestions.

```powershell
# Install from https://ollama.com, then:
ollama pull deepseek-r1:8b    # ~5 GB download, runs on 8 GB RAM
ollama serve                   # start local inference server (port 11434)
```

If Ollama is not running, payload analysis is gracefully skipped — the rest of the system still works.

---

## Step 4 — Start the Backend

```powershell
# From the repo root, with .venv activated:
infisical run --env=dev -- python backend\main.py
```

You should see:
```
INFO  ShadowSense Aurora starting up …
INFO  Environment validation passed.
INFO  ChromaDB directory verified at: ./data/chromadb
INFO  Uvicorn running on http://0.0.0.0:8000
```

Verify: open **http://localhost:8000/health** — should return `{"status": "healthy", ...}`

Interactive API docs: **http://localhost:8000/docs**

---

## Step 5 — Load the Chrome Extension

The extension is pre-built — no `npm run build` needed.

1. Open Chrome → **`chrome://extensions/`**
2. Enable **Developer mode** (top-right toggle)
3. Click **"Load unpacked"**
4. Select the `extension/dist/` folder from this repo
5. The ShadowSense icon appears in your Chrome toolbar

Navigate to **[fiverr.com](https://www.fiverr.com)**, open any conversation, and the extension will analyse messages in real time.

---

## ChromaDB (Already Seeded)

The vector database is pre-seeded and committed at `data/chromadb/`.

| Collection | Documents | Content |
|------------|-----------|---------|
| `scam_patterns` | 40 | Chat scam templates (phishing, malware, impersonation) |
| `job_scam_patterns` | 35 | Job listing scam templates |

To re-seed from scratch (e.g., after adding new patterns to `ml-pipeline/data/seed_scams.json`):

```powershell
.\.venv\Scripts\Activate.ps1
python ml-pipeline/scripts/import_seed_scams.py
python ml-pipeline/scripts/import_seed_job_scams.py
```

---

## Running Tests

```powershell
# With venv active and Infisical secrets injected:
infisical run --env=dev -- pytest tests/ -v

# Unit tests only (no API keys needed):
pytest tests/unit/ -v

# Integration tests:
infisical run --env=dev -- pytest tests/integration/ -v

# ChromaDB integration tests:
pytest tests/test_chromadb_integration.py -v
```

---

## Graceful Degradation

The backend stays online even when optional services are down:

| Service | Fallback behaviour |
|---------|-------------------|
| Ollama / DeepSeek | Payload analysis skipped (`payload_risk = 0`) |
| Groq API | Falls back to Gemini for linguistic analysis |
| Gemini API | Falls back to rule-based mock analysis |
| ChromaDB empty | Similarity scoring skipped silently |
