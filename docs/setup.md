# Installation & Setup Guide

## Prerequisites

- Python 3.10+
- Node.js 16+
- Ollama with DeepSeek-R1 model
- ChromaDB

## Backend Setup

1. **Install dependencies**:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Start backend**:
   ```bash
   python main.py
   ```

Backend will be available at `http://localhost:8000`

## Extension Setup

1. **Install dependencies**:
   ```bash
   cd extension
   npm install
   ```

2. **Build extension**:
   ```bash
   npm run build
   ```

3. **Load in Chrome**:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension/dist` folder

## ML Pipeline Setup

1. **Install Ollama**: https://ollama.ai

2. **Pull DeepSeek model**:
   ```bash
   ollama pull deepseek-r1
   ```

3. **Initialize ChromaDB**:
   ```bash
   cd ml-pipeline
   python chromadb_setup.py
   ```

## Testing

Run all tests:
```bash
./scripts/run_tests.sh
```

Run specific test suite:
```bash
pytest tests/unit/ -v
pytest tests/integration/ -v
```
