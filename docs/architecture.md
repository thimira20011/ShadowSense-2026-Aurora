# Architecture Overview

## System Design

ShadowSense Aurora is built on a multi-tier architecture:

### Backend Layer
- **FastAPI Application**: RESTful API for analysis and feedback
- **CrewAI Agents**: Four specialized agents for detection
  - Linguistic Agent: Pattern and language analysis
  - Identity Agent: Verification of user claims
  - Payload Agent: Malicious content detection
  - Shield Agent: Orchestration and defense coordination

### ML Pipeline
- **Vector Database**: ChromaDB for embedding storage
- **Embeddings**: DeepSeek-R1 powered text vectorization
- **Feedback Loop**: Continuous learning from user overrides

### Extension Layer
- **Content Script**: DOM monitoring for Fiverr gigs
- **React Components**: Visual threat indicators and alerts
- **API Client**: Communication with backend

## Data Flow

1. User encounters suspicious content on Fiverr
2. Content script captures data
3. Sent to backend for analysis
4. Multi-agent evaluation
5. Risk assessment with visual indicators
6. User feedback improves future detection

## Technologies

- **Backend**: Python, FastAPI, CrewAI, Pydantic
- **Frontend**: TypeScript, React, Vite
- **ML**: Ollama, DeepSeek-R1, ChromaDB
- **Testing**: Pytest, integration tests
