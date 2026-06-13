"""Configuration settings for ShadowSense Aurora.

Environment variables are loaded from ``backend/.env`` at import time.
Call :func:`validate_env` during application startup to assert that all
required secrets are present — the server will refuse to start if they are
missing, preventing silent mock-mode surprises in production.
"""
import os
import pathlib
import sys
from dotenv import load_dotenv

# Load from the backend directory no matter where the process is started from
_HERE = pathlib.Path(__file__).parent
load_dotenv(_HERE / ".env")


# ---------------------------------------------------------------------------
# Server
# ---------------------------------------------------------------------------
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", 8000))
DEBUG = os.getenv("DEBUG", "False") == "True"

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///shadowsense.db")

# ---------------------------------------------------------------------------
# ML Pipeline (Ollama / ChromaDB)
# ---------------------------------------------------------------------------
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-r1")
CHROMADB_PATH = os.getenv("CHROMADB_PATH", "./chromadb")

# ---------------------------------------------------------------------------
# CrewAI
# ---------------------------------------------------------------------------
CREWAI_VERBOSE = os.getenv("CREWAI_VERBOSE", "True") == "True"

# ---------------------------------------------------------------------------
# Groq (LinguisticAgent primary LLM)
# ---------------------------------------------------------------------------
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
_raw_groq_keys = os.getenv("GROQ_API_KEYS")
if _raw_groq_keys:
    GROQ_API_KEYS = [k.strip() for k in _raw_groq_keys.split(",") if k.strip()]
else:
    GROQ_API_KEYS = [GROQ_API_KEY] if GROQ_API_KEY else []

_raw_model = os.getenv("GROQ_MODEL", "llama-4-scout")
GROQ_MODEL = (
    "meta-llama/llama-4-scout-17b-16e-instruct"
    if _raw_model == "llama-4-scout"
    else _raw_model
)

# ---------------------------------------------------------------------------
# Google Gemini (IdentityAgent + LinguisticAgent fallback)
# ---------------------------------------------------------------------------
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
_raw_gemini_keys = os.getenv("GEMINI_API_KEYS")
if _raw_gemini_keys:
    GEMINI_API_KEYS = [k.strip() for k in _raw_gemini_keys.split(",") if k.strip()]
else:
    GEMINI_API_KEYS = [GEMINI_API_KEY] if GEMINI_API_KEY else []

# ---------------------------------------------------------------------------
# Chrome Extension
# ---------------------------------------------------------------------------
EXTENSION_ID = os.getenv("EXTENSION_ID", "shadowsense-aurora")

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
# Set LOG_FORMAT=json for structured JSON logs (production / log aggregators)
LOG_FORMAT = os.getenv("LOG_FORMAT", "console")


# ---------------------------------------------------------------------------
# Startup validation
# ---------------------------------------------------------------------------

def validate_env() -> None:
    """Validate that all required environment variables are present.

    Raises:
        SystemExit: If any required variable is missing or set to its
                    placeholder value.  The error message lists every
                    missing variable so the operator can fix them all at
                    once rather than discovering them one by one.

    This should be called once inside FastAPI's ``lifespan`` handler so the
    server refuses to start rather than falling back to mock-mode silently
    in production.
    """
    _PLACEHOLDER_TOKENS = {"placeholder", "your-", "change-me", "todo", "xxx"}

    def _is_placeholder(value: str) -> bool:
        low = value.lower()
        return any(tok in low for tok in _PLACEHOLDER_TOKENS)

    missing: list[str] = []

    # At least one Groq key is required (LinguisticAgent primary)
    valid_groq = [k for k in GROQ_API_KEYS if k and not _is_placeholder(k)]
    if not valid_groq:
        missing.append(
            "GROQ_API_KEY / GROQ_API_KEYS — required for LinguisticAgent "
            "(Groq llama-4-scout).  Get one at https://console.groq.com"
        )

    # At least one Gemini key is required (IdentityAgent + Groq fallback)
    valid_gemini = [k for k in GEMINI_API_KEYS if k and not _is_placeholder(k)]
    if not valid_gemini:
        missing.append(
            "GEMINI_API_KEY / GEMINI_API_KEYS — required for IdentityAgent "
            "(Gemini Flash) and LinguisticAgent fallback.  "
            "Get one at https://aistudio.google.com/app/apikey"
        )

    if missing:
        lines = "\n".join(f"  • {m}" for m in missing)
        print(  # noqa: T201 – intentional startup stderr before logging is configured
            f"\n[ShadowSense] ❌  Startup aborted — missing required environment variables:\n"
            f"{lines}\n\n"
            f"Copy backend/.env.example → backend/.env and fill in the values.\n",
            file=sys.stderr,
        )
        sys.exit(1)
