"""
backend/agents/job_risk.py
==========================
JobRiskAgent — Pre-Engagement trust scoring for freelancer job listings.

Analyses a job posting BEFORE the freelancer applies by combining:
  1. Client profile metadata scoring (account age, reviews, spend, verification)
  2. ChromaDB semantic similarity against the ``job_scam_patterns`` collection
  3. Keyword heuristics over the job description text

Score formula:
    pre_engage_score = clamp(100 - client_penalty - semantic_penalty - keyword_penalty, 0, 100)
"""

from __future__ import annotations

import logging
import re
import sys
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# ChromaDB / embeddings import (ml-pipeline) — optional, graceful fallback
# ---------------------------------------------------------------------------
_ML_PIPELINE_DIR = Path(__file__).resolve().parent.parent.parent / "ml-pipeline"
if str(_ML_PIPELINE_DIR) not in sys.path:
    sys.path.insert(0, str(_ML_PIPELINE_DIR))

try:
    from embeddings import query_similar_scams as _query_similar_scams  # type: ignore
    from embeddings import JOB_SCAM_COLLECTION                           # type: ignore
    _CHROMADB_ENABLED = True
except Exception as _import_err:
    _query_similar_scams = None           # type: ignore[assignment]
    JOB_SCAM_COLLECTION  = "job_scam_patterns"
    _CHROMADB_ENABLED    = False
    logger.warning("ChromaDB/embeddings import failed (JobRiskAgent): %s", _import_err)

# ---------------------------------------------------------------------------
# Keyword red-flag catalogue (compiled once at module load)
# ---------------------------------------------------------------------------
# Each tuple: (regex_pattern, display_label, penalty_points)
_KEYWORD_FLAGS: list[tuple[re.Pattern, str, int]] = [
    (re.compile(r"\b(pay|payment|deposit|advance)\s+(outside|off|via)\b", re.I),
     "Requests payment outside the platform", 25),
    (re.compile(r"\b(whatsapp|telegram|signal|wechat|viber)\b", re.I),
     "Asks to communicate via external messaging app", 20),
    (re.compile(r"\b(gift\s*card|itunes|google\s*play|amazon\s*card)\b", re.I),
     "Requests gift card payment method", 30),
    (re.compile(r"\b(bitcoin|crypto|btc|eth|usdt|wire\s*transfer|western\s*union|moneygram)\b", re.I),
     "Requests cryptocurrency or wire transfer payment", 28),
    (re.compile(r"\b(click\s+(?:this\s+)?link|download\s+(?:this|the|our))\b", re.I),
     "Contains suspicious download/external link instruction", 18),
    (re.compile(r"\b(setup\.exe|\.bat\b|install\s+this|run\s+this\s+script)\b", re.I),
     "Asks freelancer to run/install an executable", 35),
    (re.compile(r"\burgen(t|cy)\b.{0,40}\b(hire|need|require|looking)\b", re.I),
     "Extreme urgency language combined with hire request", 12),
    (re.compile(r"\b(confidential|nda|non.?disclosure|secret)\b.{0,60}\b(before|prior|first)\b", re.I),
     "NDA/secrecy required before job details are shared", 15),
    (re.compile(r"\b(escrow|third.?party|middleman)\b", re.I),
     "References unofficial escrow or middleman arrangement", 20),
    (re.compile(r"\b(no\s+experience|anyone\s+can|easy\s+money|guaranteed\s+income)\b", re.I),
     "Unrealistic 'anyone can do this / easy money' language", 18),
    (re.compile(r"\b(personal\s+(?:bank\s+)?account|bank\s+(?:account\s+)?(?:number|details))\b", re.I),
     "Requests personal bank account information", 30),
    (re.compile(r"\b(test\s+task|trial\s+(?:work|task)|free\s+sample|unpaid\s+test)\b", re.I),
     "Requests unpaid trial/test work", 14),
    (re.compile(r"\b(resell|reshipping|package\s+forwarding|mystery\s+shopper)\b", re.I),
     "Package reshipping / mystery shopper (money mule vector)", 32),
    (re.compile(r"\b(protonmail|guerrillamail|tempmail|throwaway)\b", re.I),
     "Uses anonymous/disposable email provider", 18),
    (re.compile(r"\b(invoice|send\s+me\s+an?\s+invoice).{0,60}(outside|off|email|gmail|yahoo)\b", re.I),
     "Requests invoice sent to off-platform email", 22),
]

_SIM_HIGH_THRESHOLD   = 0.70
_SIM_MEDIUM_THRESHOLD = 0.50
_SIM_LOW_THRESHOLD    = 0.35


class JobRiskAgent:
    """
    Scores a job posting for scam/fraud risk before the freelancer applies.

    Combines three independent signals:
      1. Client profile metadata scoring
      2. ChromaDB semantic similarity (job_scam_patterns collection)
      3. Keyword heuristics

    Returns a dict matching the PreEngageResponse schema.
    """

    def score(
        self,
        platform: str,
        job_url: str,
        job_title: str,
        job_description: str,
        budget: str | None = None,
        client_profile: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        client_profile = client_profile or {}
        full_text = f"{job_title}\n\n{job_description}"

        # ── 1. Client metadata scoring ────────────────────────────────────
        client_penalty, client_breakdown, client_flags = self._score_client(client_profile)

        # ── 2. Semantic similarity (ChromaDB) ─────────────────────────────
        similar_patterns: list[dict[str, Any]] = []
        semantic_penalty = 0
        semantic_flags: list[str] = []

        if _CHROMADB_ENABLED and _query_similar_scams is not None and full_text.strip():
            try:
                similar_patterns = _query_similar_scams(
                    full_text,
                    top_k=5,
                    collection_name=JOB_SCAM_COLLECTION,
                )
            except Exception as exc:
                logger.warning("ChromaDB job_scam_patterns query failed (non-fatal): %s", exc)

            # Also check general scam_patterns as fallback signal
            try:
                general_matches = _query_similar_scams(full_text, top_k=3)
                existing_ids = {p.get("id") for p in similar_patterns}
                for gm in general_matches:
                    if gm.get("id") not in existing_ids and gm.get("similarity", 0) >= 0.50:
                        similar_patterns.append(gm)
            except Exception:
                pass

        if similar_patterns:
            top_sim  = similar_patterns[0].get("similarity", 0.0)
            top_type = similar_patterns[0].get("type", "unknown")

            if top_sim >= _SIM_HIGH_THRESHOLD:
                semantic_penalty = 40
                semantic_flags.append(
                    f"Job description strongly matches known {top_type} scam pattern "
                    f"(similarity {top_sim:.2f})"
                )
            elif top_sim >= _SIM_MEDIUM_THRESHOLD:
                semantic_penalty = 22
                semantic_flags.append(
                    f"Job description moderately matches a {top_type} scam pattern "
                    f"(similarity {top_sim:.2f})"
                )
            elif top_sim >= _SIM_LOW_THRESHOLD:
                semantic_penalty = 10
                semantic_flags.append(
                    f"Weak semantic resemblance to {top_type} pattern "
                    f"(similarity {top_sim:.2f}) — low confidence signal"
                )

        # ── 3. Keyword heuristics ─────────────────────────────────────────
        keyword_penalty, keyword_flags = self._scan_keywords(full_text)

        # ── 4. Final score ────────────────────────────────────────────────
        total_penalty = client_penalty + semantic_penalty + keyword_penalty
        raw_score     = max(0, min(100, 100 - total_penalty))

        signals_fired = (
            int(client_penalty > 0)
            + int(semantic_penalty > 0)
            + int(keyword_penalty > 0)
        )
        confidence = round(min(0.99, 0.50 + signals_fired * 0.16), 2)

        all_flags: list[str] = []
        seen: set = set()
        for flag in client_flags + semantic_flags + keyword_flags:
            if flag not in seen:
                seen.add(flag)
                all_flags.append(flag)

        verdict = self._classify(raw_score)

        logger.info(
            "JobRiskAgent: score=%d  verdict=%s  client_penalty=%d  "
            "semantic_penalty=%d  keyword_penalty=%d  "
            "similar_patterns=%d  flags=%d  platform=%s",
            raw_score, verdict, client_penalty, semantic_penalty,
            keyword_penalty, len(similar_patterns), len(all_flags), platform,
        )

        return {
            "pre_engage_score":       raw_score,
            "verdict":                verdict,
            "confidence":             confidence,
            "red_flags":              all_flags,
            "similar_patterns":       similar_patterns,
            "client_risk_breakdown":  client_breakdown,
            "platform":               platform,
            "job_url":                job_url,
        }

    # ── Private helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _classify(score: int) -> str:
        if score >= 70:
            return "VERIFIED_SAFE"
        if score >= 40:
            return "MODERATE_RISK"
        return "HIGH_RISK"

    @staticmethod
    def _score_client(
        profile: dict[str, Any],
    ) -> tuple[int, dict[str, Any], list[str]]:
        """Score client profile metadata. Returns (penalty, breakdown, flags)."""
        penalty   = 0
        breakdown: dict[str, Any] = {}
        flags:     list[str]      = []

        reviews = profile.get("reviews")
        if reviews is not None:
            if reviews == 0:
                penalty += 15
                flags.append("Client has zero reviews on the platform")
                breakdown["reviews"] = {"value": 0, "penalty": 15}
            elif reviews < 3:
                penalty += 8
                breakdown["reviews"] = {"value": reviews, "penalty": 8}
            else:
                breakdown["reviews"] = {"value": reviews, "penalty": 0}

        days = profile.get("member_since_days")
        if days is not None:
            if days < 7:
                penalty += 25
                flags.append(f"Brand-new client account (only {days} day(s) old)")
                breakdown["account_age_days"] = {"value": days, "penalty": 25}
            elif days < 30:
                penalty += 15
                flags.append(f"Very new client account ({days} days old)")
                breakdown["account_age_days"] = {"value": days, "penalty": 15}
            elif days < 90:
                penalty += 5
                breakdown["account_age_days"] = {"value": days, "penalty": 5}
            else:
                breakdown["account_age_days"] = {"value": days, "penalty": 0}

        verified = profile.get("verified")
        if verified is not None:
            if verified is False:
                penalty += 10
                flags.append("Client payment method is not verified")
                breakdown["verified"] = {"value": False, "penalty": 10}
            else:
                breakdown["verified"] = {"value": True, "penalty": 0}

        spend = profile.get("total_spend")
        if spend is not None:
            if spend == 0:
                penalty += 10
                flags.append("Client has never spent money on the platform")
                breakdown["total_spend"] = {"value": 0, "penalty": 10}
            elif spend >= 1000:
                penalty = max(0, penalty - 5)
                breakdown["total_spend"] = {"value": spend, "bonus": 5}
            else:
                breakdown["total_spend"] = {"value": spend, "penalty": 0}

        hire_rate = profile.get("hire_rate")
        if hire_rate is not None:
            if hire_rate < 10:
                penalty += 8
                flags.append(f"Very low hire rate ({hire_rate:.0f}%) — client rarely follows through")
                breakdown["hire_rate"] = {"value": hire_rate, "penalty": 8}
            else:
                breakdown["hire_rate"] = {"value": hire_rate, "penalty": 0}

        jobs_posted = profile.get("jobs_posted")
        if jobs_posted is not None:
            breakdown["jobs_posted"] = {"value": jobs_posted, "penalty": 0}

        return penalty, breakdown, flags

    @staticmethod
    def _scan_keywords(text: str) -> tuple[int, list[str]]:
        """Run keyword heuristics. Returns (total_penalty capped at 50, flags)."""
        total  = 0
        flags: list[str] = []
        for pattern, label, penalty in _KEYWORD_FLAGS:
            if pattern.search(text):
                total += penalty
                flags.append(label)
        return min(total, 50), flags


def analyze_job_listing(job_text: str, client_profile: dict[str, Any] | None = None) -> dict[str, Any]:
    """Exposes standalone function to score a job listing for scam indicators.

    Separates title and description from the raw job_text and delegates to JobRiskAgent.
    """
    agent = JobRiskAgent()
    parts = job_text.split("\n", 1)
    if len(parts) == 2:
        title = parts[0].strip()
        description = parts[1].strip()
    else:
        title = job_text.strip()
        description = job_text.strip()

    return agent.score(
        platform="fiverr",
        job_url="http://localhost/quick-check",
        job_title=title,
        job_description=description,
        client_profile=client_profile,
    )

