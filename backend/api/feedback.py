"""
backend/api/feedback.py
=======================
FastAPI endpoint for "Override + Report" events from the ShadowSense extension.

When a user clicks "Override + Report":
  1.  The extension POSTs to ``POST /api/feedback/override``.
  2.  This endpoint calls ``ml-pipeline/feedback_loop.process_override()``.
  3.  The feedback loop stores the message in ChromaDB with
      ``{false_positive: true, trust_score: 22}`` and increments the
      per-pattern override counter.
  4.  If 3+ users have overridden the same pattern it is automatically
      promoted to benign status, granting a ``+20`` trust-score boost in
      future ShieldAgent analyses.

Week 4 addition: every event is also appended to ``logs/feedback.jsonl``
for offline analysis and debugging.
"""

from __future__ import annotations

import sys
import json
import logging
import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Bootstrap ml-pipeline import path
# ---------------------------------------------------------------------------
_ML_PIPELINE_DIR = Path(__file__).resolve().parent.parent.parent / "ml-pipeline"
if str(_ML_PIPELINE_DIR) not in sys.path:
    sys.path.insert(0, str(_ML_PIPELINE_DIR))

try:
    from feedback_loop import process_override, OverrideResult  # type: ignore
    _FEEDBACK_LOOP_AVAILABLE = True
except Exception as _import_err:
    _FEEDBACK_LOOP_AVAILABLE = False
    process_override = None  # type: ignore[assignment]
    OverrideResult   = None  # type: ignore[assignment,misc]

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/feedback", tags=["feedback"])

# ---------------------------------------------------------------------------
# JSONL logging helpers (Week 4)
# ---------------------------------------------------------------------------

_LOGS_DIR = Path(__file__).resolve().parent.parent.parent / "logs"
_FEEDBACK_LOG = _LOGS_DIR / "feedback.jsonl"


def _append_feedback_log(record: dict) -> None:
    """Append a single feedback event as a JSON line to logs/feedback.jsonl.

    Creates the file (and parent directory) if they do not yet exist.
    Failures are logged as warnings — never crash the endpoint.
    """
    try:
        _LOGS_DIR.mkdir(parents=True, exist_ok=True)
        with _FEEDBACK_LOG.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(record, ensure_ascii=False) + "\n")
        logger.debug("feedback.jsonl ← %s", record)
    except Exception as _log_err:
        logger.warning("Could not write to feedback.jsonl: %s", _log_err)


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

class FeedbackRequest(BaseModel):
    """Legacy user feedback schema (general accuracy report)."""
    analysis_id:        str
    user_feedback:      str
    was_accurate:       bool
    additional_context: dict = Field(default_factory=dict)


class FeedbackResponse(BaseModel):
    """Feedback submission response."""
    success: bool
    message: str


class OverrideRequest(BaseModel):
    """
    Payload sent by the extension when the user clicks "Override + Report".

    Fields
    ------
    analysis_id   : Unique ID of the analysis event (from the /api/analyze response).
    pattern_text  : The raw message text that was flagged and overridden.
    user_id       : Anonymised / pseudonymous user identifier (optional).
    trust_score   : The original trust score assigned by ShieldAgent (default 22).
    """
    analysis_id:  str            = Field(..., description="Unique analysis event ID")
    pattern_text: str            = Field(..., description="Flagged message text being overridden")
    user_id:      Optional[str]  = Field("anonymous", description="Anonymised user identifier")
    trust_score:  int            = Field(22, description="Original ShieldAgent trust score")


class OverrideResponse(BaseModel):
    """Response returned after processing an Override + Report event."""
    success:           bool
    analysis_id:       str
    pattern_key:       str  = Field(..., description="SHA-256 short key for the pattern")
    override_count:    int  = Field(..., description="Total users who overrode this pattern")
    marked_benign:     bool = Field(..., description="True if pattern is now promoted to benign")
    trust_score_boost: int  = Field(..., description="Trust-score boost applied for future matches")
    message:           str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/", response_model=FeedbackResponse)
async def submit_feedback(request: FeedbackRequest):
    """Submit general user feedback (was the analysis accurate?).

    Week 4: All submissions are appended to ``logs/feedback.jsonl``.
    """
    logger.info(
        "submit_feedback: analysis_id=%s  was_accurate=%s",
        request.analysis_id, request.was_accurate,
    )

    # ── Week 4: JSONL log ────────────────────────────────────────────────
    _append_feedback_log({
        "timestamp":          datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        "event":              "general_feedback",
        "analysis_id":        request.analysis_id,
        "action":             request.user_feedback,
        "was_accurate":       request.was_accurate,
        "additional_context": request.additional_context,
    })

    # General feedback is logged; override-specific logic uses /override
    return FeedbackResponse(
        success=True,
        message="Feedback recorded successfully.",
    )


@router.post("/override", response_model=OverrideResponse)
async def submit_override(request: OverrideRequest):
    """
    Handle an "Override + Report" action from the ShadowSense extension.

    Stores the override in ChromaDB with ``{false_positive: true, trust_score: 22}``,
    increments the per-pattern counter, and auto-promotes the pattern to benign
    if ≥ 3 unique users have overridden it (granting a ``+20`` trust-score boost).

    Week 4: Every override is also appended to ``logs/feedback.jsonl``.
    """
    if not _FEEDBACK_LOOP_AVAILABLE or process_override is None:
        logger.error("FeedbackLoop unavailable — ml-pipeline not importable.")
        raise HTTPException(
            status_code=503,
            detail=(
                "Feedback loop service unavailable. "
                "Ensure ml-pipeline dependencies are installed."
            ),
        )

    logger.info(
        "submit_override: analysis_id=%s  user=%s  trust_score=%d",
        request.analysis_id, request.user_id, request.trust_score,
    )

    try:
        result: OverrideResult = process_override({
            "analysis_id":  request.analysis_id,
            "pattern_text": request.pattern_text,
            "user_id":      request.user_id or "anonymous",
            "trust_score":  request.trust_score,
        })
    except ValueError as ve:
        raise HTTPException(status_code=422, detail=str(ve))
    except Exception as exc:
        logger.exception("process_override raised an unexpected error: %s", exc)
        raise HTTPException(status_code=500, detail="Internal feedback-loop error.")

    # ── Week 4: JSONL log ────────────────────────────────────────────────
    _append_feedback_log({
        "timestamp":       datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        "event":           "override",
        "analysis_id":     result.analysis_id,
        "pattern_key":     result.pattern_key,
        "action":          "override",
        "trust_score":     request.trust_score,
        "override_count":  result.override_count,
        "marked_benign":   result.marked_benign,
        "trust_score_boost": result.trust_score_boost,
        "user_id":         request.user_id or "anonymous",
    })

    return OverrideResponse(
        success           = result.success,
        analysis_id       = result.analysis_id,
        pattern_key       = result.pattern_key,
        override_count    = result.override_count,
        marked_benign     = result.marked_benign,
        trust_score_boost = result.trust_score_boost,
        message           = result.message,
    )


@router.get("/benign-patterns")
async def list_benign_patterns():
    """
    Return all patterns currently marked as benign.

    Used by the admin dashboard to review community-verified safe patterns.
    """
    if not _FEEDBACK_LOOP_AVAILABLE:
        raise HTTPException(status_code=503, detail="Feedback loop unavailable.")

    try:
        from feedback_loop import _get_feedback_loop  # type: ignore
        loop    = _get_feedback_loop()
        patterns = loop.list_benign_patterns()
        return {"benign_patterns": patterns, "count": len(patterns)}
    except Exception as exc:
        logger.exception("list_benign_patterns error: %s", exc)
        raise HTTPException(status_code=500, detail="Could not retrieve benign patterns.")
