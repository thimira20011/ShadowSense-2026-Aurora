# Architecture Overview

## System Design

ShadowSense Aurora is built on a multi-tier local/cloud hybrid architecture designed to run at zero-cost to the user while keeping all conversation data private and on-device.

### Browser Extension Layer
- **Content Script (DOM Observer)**: Monitors real-time chat interactions on freelance platform interfaces (Fiverr, Upwork, Freelancer.com).
- **React UI Components**: Renders visual indicators including the **Trust Gauge** (score 0–100), alert overlays, and pre-engagement trust badges.
- **WebSocket Client**: Establishes a real-time, low-latency link with the local backend.

### API Gateway / Backend Layer
- **FastAPI Core**: Handles WebSocket and REST traffic. Routes payloads and controls confidence-threshold orchestration.
- **CrewAI / LangGraph Agentic Core**: Runs a 4-agent crew in parallel:
  - **Linguistic Analyst**: Inspects chat text for psychological manipulation (urgency, authority bias, luring). Runs via **Groq (Llama 4 Scout)**.
  - **Identity Profiler**: Cross-references public profile metadata (account age, verification status). Runs via **Gemini Flash Lite**.
  - **Payload Auditor**: Evaluates links and files (like `.zip` attachments) for malicious indicators. Runs locally via **DeepSeek-R1 (Ollama)**.
  - **Shield Orchestrator**: Aggregates agent findings into a final Trust Score and writes the Explainable Defense Narrative.

### Local ML & Memory Layer
- **ChromaDB (Vector Database)**: Stores scam pattern embeddings locally to enable similarity search and feedback loops.
- **Local LLM Engine**: Runs quantized models (DeepSeek-R1) via **Ollama** locally, ensuring sensitive analysis remains private.

---

## Data Flow

```
+------------------+                   +----------------------------------+
|                  |   WebSockets      |          FastAPI Backend         |
|  Chrome Browser  | <===============> |                                  |
|  (React/TS UI)   |   Real-time Msg   |   +--------------------------+   |
|                  |                   |   |    Shield Orchestrator   |   |
+------------------+                   |   +--------------------------+   |
                                       |      |            |          |   |
                                       |      v            v          v   |
                                       |  Linguistic    Identity   Payload|
                                       |  Analyst       Profiler   Auditor|
                                       |  (Groq/Llama)  (Gemini)   (Ollama|
                                       |                           DSeek) |
                                       |      |            |          |   |
                                       |      +------------+----------+   |
                                       |                   |              |
                                       |                   v              |
                                       |          +------------------+    |
                                       |          |  Local ChromaDB  |    |
                                       |          +------------------+    |
                                       +----------------------------------+
```

1. **Capture**: The browser extension DOM observer detects a new message on Fiverr.
2. **Transport**: The message is sent to the local FastAPI backend over a persistent WebSocket connection.
3. **Analysis**: The Shield Orchestrator invokes the Linguistic, Identity, and Payload agents in parallel.
4. **Synthesis**: Shield aggregates the verdicts, checks ChromaDB for similar past patterns, and calculates a 0–100 Trust Score.
5. **Intervention**: The backend returns the score and the Explainable Narrative. The UI triggers a block (<40), warning (40–69), or passes cleanly (70–100).
6. **Feedback**: User overrides or reports are saved back into ChromaDB for local fine-tuning.

---

## Technologies

- **Backend**: Python 3.12+, FastAPI, CrewAI, LangGraph, Pydantic
- **Frontend**: TypeScript, React, Vite (Browser Extension)
- **Local Inference**: Ollama (DeepSeek-R1 1.5B/8B)
- **Cloud API Inference**: Groq API (Llama), Google Gemini API
- **Vector Storage**: ChromaDB (Local vector database)
- **Testing**: Pytest, FastAPI TestClient

---

## Week 3 Documentation Gaps

The following architectural specifications are scheduled to be fully integrated in the **Week 3 (`feature/m4-architecture-docs`)** phase:
1. **Granular Sequence Diagrams**: Fully tracing the asynchronous agent debate and consensus-finding phases.
2. **API Endpoint Documentation**: Formal request and response schemas for `/api/analyze`, `/api/feedback`, and `/api/health`.
3. **Agent Prompt Templates**: Complete listings of the instructions and system prompts used for each agent (redacting any private keys/credentials).
