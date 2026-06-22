"""FastAPI application entry point for ShadowSense Aurora.

Startup sequence
----------------
1. ``setup_logging()`` — configures the root logger before any module logs.
2. ``validate_env()``  — crashes with a clear error if API keys are missing.
3. Agents are initialised lazily on first request.

Health Check
------------
``GET /health`` returns a JSON payload with server status and provider
reachability so monitoring tools (UptimeRobot, Grafana, etc.) can alert
on degraded states without hitting a full analysis endpoint.
"""
import sys
import logging
from contextlib import asynccontextmanager
from pathlib import Path

# Add project root to sys.path so 'backend' module is found when run directly
_project_root = Path(__file__).resolve().parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from backend.logging_config import setup_logging
from backend.config import (
    API_HOST, API_PORT, DEBUG, LOG_LEVEL, LOG_FORMAT,
    validate_env, GROQ_API_KEYS, GEMINI_API_KEYS, OLLAMA_HOST,
    RATE_LIMIT_ANALYZE, RATE_LIMIT_FEEDBACK, CHROMADB_PATH,
)
from backend.api import analyze, feedback, pre_engage


# ---------------------------------------------------------------------------
# Lifespan — startup / shutdown hooks
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    """FastAPI lifespan handler.

    Runs setup_logging and validate_env before the application starts
    accepting requests, ensuring early failure on misconfiguration.
    """
    # 1. Configure logging (must be first so all subsequent code can log)
    setup_logging(level=LOG_LEVEL, fmt=LOG_FORMAT)
    logger = logging.getLogger(__name__)
    logger.info("ShadowSense Aurora starting up …")

    # 2. Validate required environment variables — exits if any are missing
    validate_env()
    logger.info("Environment validation passed.")

    # 3. Ensure ChromaDB directory exists
    try:
        Path(CHROMADB_PATH).mkdir(parents=True, exist_ok=True)
        logger.info("ChromaDB directory verified at: %s", CHROMADB_PATH)
    except Exception as exc:
        logger.warning("Could not create ChromaDB directory: %s", exc)

    yield  # Application is now running

    logger.info("ShadowSense Aurora shutting down.")


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="ShadowSense Aurora",
    description=(
        "AI-powered scam detection for freelance platforms. "
        "Analyses chat messages and job listings in real-time using a "
        "4-agent CrewAI pipeline (Linguistic, Identity, Payload, Shield)."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Rate limiter
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address, default_limits=[])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Attach the limiter and per-route limits to the sub-routers
analyze.router.route_class  # no-op reference to ensure module loaded
feedback.router.route_class

# Store limits in app state so router decorators can reference them
app.state.rate_limit_analyze  = RATE_LIMIT_ANALYZE
app.state.rate_limit_feedback = RATE_LIMIT_FEEDBACK

# CORS — allow the Chrome extension (and local dev tools) to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5173",  # React / Vite local dev port
    ],
    allow_origin_regex="chrome-extension://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include feature routers
app.include_router(analyze.router)
app.include_router(feedback.router)
app.include_router(pre_engage.router)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["monitoring"])
async def health_check():
    """Health check endpoint for monitoring and load-balancer probes.

    Returns the service status plus a summary of which LLM providers are
    configured (not whether they are reachable — that would add latency).

    Example response::

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
    """
    _placeholder_tokens = {"placeholder", "your-", "change-me", "todo", "xxx"}

    def _configured(keys: list) -> str:
        valid = [k for k in keys if k and not any(t in k.lower() for t in _placeholder_tokens)]
        return "configured" if valid else "not configured (mock mode)"

    return {
        "status": "healthy",
        "service": "ShadowSense Aurora",
        "version": app.version,
        "providers": {
            "groq":   _configured(GROQ_API_KEYS),
            "gemini": _configured(GEMINI_API_KEYS),
            "ollama": f"configured ({OLLAMA_HOST})",
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=API_HOST, port=API_PORT, reload=DEBUG)

