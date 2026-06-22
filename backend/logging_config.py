"""
backend/logging_config.py
=========================
Centralised logging setup for ShadowSense Aurora.

Usage
-----
Call ``setup_logging()`` once at application startup (inside ``main.py``'s
lifespan handler) before any other module emits log records.

Configuration is controlled entirely via environment variables so the
application never requires a file change to adjust verbosity in production:

    LOG_LEVEL   - Logging level string (DEBUG, INFO, WARNING, ERROR, CRITICAL).
                  Defaults to INFO.
    LOG_FORMAT  - Output format.  Set to ``json`` for structured JSON logs
                  (useful in production / log aggregators like Datadog/Loki).
                  Any other value (or absent) gives human-readable console logs.
"""
from __future__ import annotations

import json
import logging
import os
import sys
import datetime


# ---------------------------------------------------------------------------
# JSON formatter (production / log-aggregation mode)
# ---------------------------------------------------------------------------

class _JSONFormatter(logging.Formatter):
    """Emit each log record as a single-line JSON object.

    Fields emitted:
        timestamp  - ISO-8601 UTC timestamp
        level      - Logging level name (INFO, WARNING, …)
        logger     - Logger name (module path)
        message    - Rendered log message
        exc_info   - Exception traceback string, only present on errors
    """

    def format(self, record: logging.LogRecord) -> str:
        payload: dict = {
            "timestamp": datetime.datetime.fromtimestamp(
                record.created, tz=datetime.UTC
            ).isoformat().replace("+00:00", "Z"),
            "level":   record.levelname,
            "logger":  record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Human-readable formatter (development mode)
# ---------------------------------------------------------------------------

_CONSOLE_FORMAT = (
    "%(asctime)s  %(levelname)-8s  %(name)s  %(message)s"
)
_CONSOLE_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def setup_logging(level: str | None = None, fmt: str | None = None) -> None:
    """Configure the root logger for ShadowSense Aurora.

    This function is idempotent — calling it more than once has no effect
    beyond the first call (handlers are not duplicated).

    Args:
        level: Override log level (e.g. ``"DEBUG"``).  If *None*, reads
               ``LOG_LEVEL`` from the environment; falls back to ``INFO``.
        fmt:   Override format mode.  Pass ``"json"`` for structured logs.
               If *None*, reads ``LOG_FORMAT`` from the environment.
    """
    root = logging.getLogger()

    # Idempotency guard — only configure once.
    if root.handlers:
        return

    # Resolve level
    level_str = (level or os.getenv("LOG_LEVEL", "INFO")).upper()
    numeric_level = getattr(logging, level_str, logging.INFO)
    root.setLevel(numeric_level)

    # Resolve format
    fmt_mode = (fmt or os.getenv("LOG_FORMAT", "console")).lower()

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(numeric_level)

    if fmt_mode == "json":
        handler.setFormatter(_JSONFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(_CONSOLE_FORMAT, datefmt=_CONSOLE_DATE_FORMAT)
        )

    root.addHandler(handler)

    # Silence noisy third-party loggers in production
    for noisy in ("httpx", "httpcore", "groq", "google.auth"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    logging.getLogger(__name__).info(
        "Logging configured — level=%s  format=%s", level_str, fmt_mode
    )
