"""Shield orchestrator -- coordinates all 3 sub-agents and synthesises the Trust Score."""
import sys
import logging
import concurrent.futures
from pathlib import Path
from typing import Any

from ._crewai_stub import Agent  # TODO: replace with `from crewai import Agent` once crewai-core is on PyPI
from .linguistic import LinguisticAgent
from .identity import IdentityAgent
from .payload import PayloadAgent
from backend.config import (
    SHIELD_AGENT_TIMEOUT_S,
    SHIELD_EXECUTOR_WORKERS,
    CHROMADB_PENALTY_THRESHOLD,
    CHROMADB_PENALTY_SCALE,
)

# ---------------------------------------------------------------------------
# ChromaDB / semantic similarity (ml-pipeline) -- optional, graceful fallback
# ---------------------------------------------------------------------------
_ML_PIPELINE_DIR = Path(__file__).resolve().parent.parent.parent / "ml-pipeline"
if str(_ML_PIPELINE_DIR) not in sys.path:
    sys.path.insert(0, str(_ML_PIPELINE_DIR))

try:
    from embeddings import query_similar_scams as _query_similar_scams  # type: ignore
    _CHROMADB_ENABLED = True
except Exception as _import_err:
    _query_similar_scams = None  # type: ignore[assignment]
    _CHROMADB_ENABLED = False

# ---------------------------------------------------------------------------
# Feedback loop — benign-pattern trust-score boost (M1 coordination)
# ---------------------------------------------------------------------------
try:
    from feedback_loop import get_trust_score_boost as _get_trust_score_boost  # type: ignore
    _FEEDBACK_LOOP_ENABLED = True
except Exception:
    _get_trust_score_boost = None  # type: ignore[assignment]
    _FEEDBACK_LOOP_ENABLED = False

logger = logging.getLogger(__name__)

# Weighted contribution of each agent to the final *risk* score
# (Trust Score = 100 - weighted_risk)
# Week 2 tuned values — balances linguistic sensitivity with identity signal
_WEIGHTS = {
    "linguistic": 0.45,  # Primary signal — most reliable real-time indicator
    "identity":   0.35,  # Secondary — profile metadata
    "payload":    0.20,  # Tertiary — stub in Week 2, DeepSeek in Week 3
}

# Module-level shared executor — avoids creating a new thread pool per request.
# max_workers=SHIELD_EXECUTOR_WORKERS (default 4): one per sub-agent + headroom.
_SHIELD_EXECUTOR = concurrent.futures.ThreadPoolExecutor(
    max_workers=SHIELD_EXECUTOR_WORKERS,
    thread_name_prefix="shield",
)


class ShieldAgent:
    """Orchestrates the multi-agent defence pipeline and produces a final Trust Score.

    Architecture (Week 2):
        Shield ─► LinguisticAgent  (Groq / llama-4-scout)
               ─► IdentityAgent    (Gemini Flash-Lite)
               ─► PayloadAgent     (stub; DeepSeek-R1 / Ollama in Week 3)

    Weighted Trust Score formula:
        weighted_risk = 0.4 * linguistic_urgency_score
                      + 0.3 * identity_risk
                      + 0.3 * payload_risk
        trust_score   = clamp(100 - weighted_risk, 0, 100)
    """

    def __init__(self) -> None:
        # CrewAI agent definition (orchestrator role)
        self.agent = Agent(
            role="Defense Shield Coordinator",
            goal=(
                "Coordinate comprehensive scam detection across linguistic, identity, "
                "and payload analysis agents. Synthesise their findings into a single "
                "explainable Trust Score and provide actionable defence recommendations."
            ),
            backstory=(
                "Senior security analyst overseeing all threat-intelligence feeds, "
                "managing defence posture, and advising freelancers on scam mitigation."
            ),
            verbose=True,
            allow_delegation=True,
        )

        # Sub-agents
        self.linguistic = LinguisticAgent()
        self.identity   = IdentityAgent()
        self.payload    = PayloadAgent()

        logger.info(
            "ShieldAgent initialised. Weights -- linguistic: %.1f  identity: %.1f  payload: %.1f  "
            "chromadb_enabled: %s",
            _WEIGHTS["linguistic"], _WEIGHTS["identity"], _WEIGHTS["payload"],
            _CHROMADB_ENABLED,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def defend(self, context: dict[str, Any]) -> dict[str, Any]:
        """Run the full multi-agent pipeline and return a structured verdict.

        Args:
            context: dict with keys:
                - text      (str)  — message body to analyse
                - sender    (str, optional)  — sender display name
                - timestamp (str, optional)
                - context   (dict, optional) — extra metadata:
                    - account_age_days, reviews, verified, bio, filename …

        Returns:
            {
                "trust_score": {"score": int, "level": str, "explanation": str},
                "reasons":     [str, …],
                "suggested_responses": [str, …],
                "agent_details": {
                    "linguistic": {...},
                    "identity":   {...},
                    "payload":    {...},
                }
            }
        """
        text         = context.get("text", "")
        extra_ctx    = context.get("context", {}) or {}
        sender       = context.get("sender")

        profile_meta: dict[str, Any] = {}
        for key in ("account_age_days", "reviews", "verified", "username", "country", "bio"):
            if key in extra_ctx:
                profile_meta[key] = extra_ctx[key]
        if sender:
            profile_meta.setdefault("username", sender)

        payload_file  = extra_ctx.get("filename", "")

        # ── 1. Concurrent Execution (SHIELD_AGENT_TIMEOUT_S = 22s default) ─
        # Uses the module-level singleton executor — no thread pool created per request.
        future_linguistic = _SHIELD_EXECUTOR.submit(self.linguistic.analyze, text)
        future_identity   = _SHIELD_EXECUTOR.submit(self.identity.verify, profile_meta, text)
        future_payload    = _SHIELD_EXECUTOR.submit(self.payload.analyze, payload_file)

        done, _not_done = concurrent.futures.wait(
            [future_linguistic, future_identity, future_payload],
            timeout=SHIELD_AGENT_TIMEOUT_S,
            return_when=concurrent.futures.ALL_COMPLETED,
        )

        try:
            linguistic_res = future_linguistic.result() if future_linguistic in done else {"urgency_score": 0.0, "red_flags": ["Analysis timeout"], "confidence": 0.0}
        except Exception as e:
            logger.error("Linguistic failed: %s", e)
            linguistic_res = {"urgency_score": 0.0, "red_flags": ["Analysis failed"], "confidence": 0.0}

        try:
            identity_res = future_identity.result() if future_identity in done else {"identity_risk": 0.0, "anomalies": ["Analysis timeout"], "confidence": 0.0}
        except Exception as e:
            logger.error("Identity failed: %s", e)
            identity_res = {"identity_risk": 0.0, "anomalies": ["Analysis failed"], "confidence": 0.0}

        try:
            payload_res = future_payload.result() if future_payload in done else {"payload_risk": 0.0, "threats": ["Analysis timeout"], "confidence": 0.0}
        except Exception as e:
            logger.error("Payload failed: %s", e)
            payload_res = {"payload_risk": 0.0, "threats": ["Analysis failed"], "confidence": 0.0}

        linguistic_urgency = float(linguistic_res.get("urgency_score", 0.0))
        identity_risk = float(identity_res.get("identity_risk", 0.0))
        payload_risk = float(payload_res.get("payload_risk", 0.0))

        # -- 2. Semantic similarity (ChromaDB) -- M1 Week-2/3 checkpoint ------
        similar_patterns: list[dict[str, Any]] = []
        chromadb_penalty = 0.0
        if _CHROMADB_ENABLED and _query_similar_scams is not None:
            try:
                similar_patterns = _query_similar_scams(text, top_k=3)
                if similar_patterns:
                    top_sim = similar_patterns[0]["similarity"]
                    logger.info(
                        "ChromaDB top-3 retrieved. Top similarity: %.4f  type: %s",
                        top_sim,
                        similar_patterns[0]["type"],
                    )
                    # Week 3 task: Penalize trust score based on similarity hits
                    if top_sim >= CHROMADB_PENALTY_THRESHOLD:
                        # Penalty is 0 at threshold and scales linearly above it.
                        # e.g. sim=0.8 → (0.8 - 0.5) * 25 = 7.5 penalty points
                        chromadb_penalty = (top_sim - CHROMADB_PENALTY_THRESHOLD) * CHROMADB_PENALTY_SCALE
            except Exception as exc:
                logger.warning("ChromaDB query failed (non-fatal): %s", exc)

        # -- 3. Weighted Trust Score ----------------------------------------
        weighted_risk = (
            _WEIGHTS["linguistic"] * linguistic_urgency
            + _WEIGHTS["identity"]  * identity_risk
            + _WEIGHTS["payload"]   * payload_risk
        )
        raw_score = max(0, min(100, int(round(100 - weighted_risk - chromadb_penalty))))

        # -- 3a. Benign-pattern boost (feedback loop coordination) -----------
        # If 3+ users have overridden this same pattern via "Override + Report",
        # the feedback loop marks it as benign and grants a +20 trust-score boost.
        benign_boost = 0
        if _FEEDBACK_LOOP_ENABLED and _get_trust_score_boost is not None:
            try:
                benign_boost = _get_trust_score_boost(text)
            except Exception as _fb_err:
                logger.warning("Benign boost lookup failed (non-fatal): %s", _fb_err)

        score = max(0, min(100, raw_score + benign_boost))

        logger.info(
            "Shield Trust Score: %d  (raw=%d, benign_boost=%d, linguistic=%.1f, "
            "identity=%.1f, payload=%.1f, chromadb_penalty=%.1f, weighted_risk=%.2f, chromadb_patterns=%d)",
            score, raw_score, benign_boost,
            linguistic_urgency, identity_risk, payload_risk, chromadb_penalty, weighted_risk,
            len(similar_patterns),
        )

        # -- 6. Intervention level -------------------------------------------
        level, explanation = self._classify(score)

        # -- 7. Explainable narrative (bullet reasons) -----------------------
        reasons = self._build_reasons(
            score, linguistic_res, identity_res, payload_res, similar_patterns
        )

        # -- 8. Suggested response templates ---------------------------------
        suggested_responses = self._suggested_responses(score)

        return {
            "trust_score": {
                "score":       score,
                "level":       level,
                "explanation": explanation,
            },
            "reasons":             reasons,
            "suggested_responses": suggested_responses,
            # Full per-agent raw results -- useful for debugging / UI expansion
            "agent_details": {
                "linguistic":        linguistic_res,
                "identity":          identity_res,
                "payload":           payload_res,
                "similar_patterns":  similar_patterns,  # ChromaDB top-k
            },
        }

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _classify(score: int):
        """Map Trust Score to (level, explanation) tuple.

        Week 4 tuned thresholds (shifted from 40→30):
          CLEAR     70–100 — No significant indicators detected.
          ADVISORY  30–69  — Moderate risk; review before proceeding.
          HIGH_RISK  0–29  — High-confidence scam patterns; block recommended.

        Widening ADVISORY from [40,69] to [30,69] reduces false hard-blocks
        on borderline conversations while keeping the block threshold tight.
        """
        if score >= 70:
            return (
                "CLEAR",
                "Conversation appears safe. No significant scam indicators were detected.",
            )
        if score >= 30:
            return (
                "ADVISORY",
                "Moderate risk signals detected. Review the reasons below before proceeding.",
            )
        return (
            "HIGH_RISK",
            "High-risk patterns detected. Communication strongly matches known scam templates. "
            "We recommend not proceeding outside the platform.",
        )

    @staticmethod
    def _build_reasons(
        score: int,
        linguistic_res: dict[str, Any],
        identity_res:   dict[str, Any],
        payload_res:    dict[str, Any],
        similar_patterns: list[dict[str, Any]] = None,
    ) -> list[str]:
        """Build human-readable bullet-point reasons for the Trust Score."""
        reasons: list[str] = []

        # Linguistic flags
        for flag in linguistic_res.get("red_flags", []):
            reasons.append(f"Linguistic Analyst detected: {flag}")

        # Identity anomalies
        for anomaly in identity_res.get("anomalies", []):
            reasons.append(f"Identity Profiler flagged: {anomaly}")

        # Payload threats
        for threat in payload_res.get("threats", []):
            reasons.append(f"Payload Auditor found: {threat}")

        # ChromaDB semantic matches (only surface high-confidence hits)
        if similar_patterns:
            for pat in similar_patterns:
                sim = pat.get("similarity", 0.0)
                if sim >= 0.55:   # threshold: meaningful semantic overlap
                    reasons.append(
                        f"ChromaDB: message matches known {pat['type']} pattern "
                        f"(similarity {sim:.2f}, category: {pat.get('category', 'unknown')})"
                    )

        # Fallback when no flags raised but score is still low (weighted combination)
        if not reasons and score < 70:
            reasons.append(
                "Multiple mild signals combined pushed the risk above threshold. "
                "No single high-confidence flag was detected."
            )

        if not reasons:
            reasons.append("No threat indicators identified by any agent.")

        return reasons

    @staticmethod
    def _suggested_responses(score: int) -> list[str]:
        """Return platform-appropriate response templates based on risk level."""
        if score >= 70:
            return [
                "I would be happy to help with this project. Could you share the full specifications?",
                "Thanks for reaching out — I look forward to collaborating!",
                "Sounds interesting. Please send the project brief and I'll get back to you shortly.",
            ]
        if score >= 40:
            return [
                "Thank you for your message. Please share all project details directly on the platform.",
                "I'd love to help — could we keep all communication and files within the platform?",
                "Let's discuss the full scope of work here before I commit to anything.",
            ]
        # HIGH_RISK
        return [
            "Thank you for reaching out. Please share all project files through the platform's "
            "official attachment system. I do not accept files via third-party download links.",
            "All payments and communications must remain on this platform to comply with the "
            "terms of service. I cannot proceed outside these channels.",
            "I'll need to verify this request with platform support before continuing. "
            "Please provide your verified profile link.",
        ]
