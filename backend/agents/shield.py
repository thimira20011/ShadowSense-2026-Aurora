"""Shield orchestrator — coordinates all 3 sub-agents and synthesises the Trust Score."""
import logging
from typing import Dict, Any, List

from ._crewai_stub import Agent  # TODO: replace with `from crewai import Agent` once crewai-core is on PyPI
from .linguistic import LinguisticAgent
from .identity import IdentityAgent
from .payload import PayloadAgent

logger = logging.getLogger(__name__)

# Weighted contribution of each agent to the final *risk* score
# (Trust Score = 100 - weighted_risk)
# Week 2 tuned values — balances linguistic sensitivity with identity signal
_WEIGHTS = {
    "linguistic": 0.45,  # Primary signal — most reliable real-time indicator
    "identity":   0.35,  # Secondary — profile metadata
    "payload":    0.20,  # Tertiary — stub in Week 2, DeepSeek in Week 3
}


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
            "ShieldAgent initialised. Weights — linguistic: %.1f  identity: %.1f  payload: %.1f",
            _WEIGHTS["linguistic"], _WEIGHTS["identity"], _WEIGHTS["payload"],
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def defend(self, context: Dict[str, Any]) -> Dict[str, Any]:
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

        # ── 1. Linguistic analysis (Groq) ─────────────────────────────
        linguistic_res    = self.linguistic.analyze(text)
        linguistic_urgency = float(linguistic_res.get("urgency_score", 0.0))

        # ── 2. Identity profiling (Gemini) ────────────────────────────
        profile_meta: Dict[str, Any] = {}
        for key in ("account_age_days", "reviews", "verified", "username", "country", "bio"):
            if key in extra_ctx:
                profile_meta[key] = extra_ctx[key]
        if sender:
            profile_meta.setdefault("username", sender)

        identity_res  = self.identity.verify(profile_meta)
        identity_risk = float(identity_res.get("identity_risk", 0.0))

        # ── 3. Payload analysis (stub → DeepSeek in Week 3) ───────────
        payload_file  = extra_ctx.get("filename", "")
        payload_res   = self.payload.analyze(payload_file)
        payload_risk  = float(payload_res.get("payload_risk", 0.0))

        # ── 4. Weighted Trust Score ───────────────────────────────────
        weighted_risk = (
            _WEIGHTS["linguistic"] * linguistic_urgency
            + _WEIGHTS["identity"]  * identity_risk
            + _WEIGHTS["payload"]   * payload_risk
        )
        score = max(0, min(100, int(round(100 - weighted_risk))))

        logger.info(
            "Shield Trust Score: %d  (linguistic=%.1f, identity=%.1f, payload=%.1f, "
            "weighted_risk=%.2f)",
            score, linguistic_urgency, identity_risk, payload_risk, weighted_risk,
        )

        # ── 5. Intervention level ─────────────────────────────────────
        level, explanation = self._classify(score)

        # ── 6. Explainable narrative (bullet reasons) ─────────────────
        reasons = self._build_reasons(
            score, linguistic_res, identity_res, payload_res
        )

        # ── 7. Suggested response templates ───────────────────────────
        suggested_responses = self._suggested_responses(score)

        return {
            "trust_score": {
                "score":       score,
                "level":       level,
                "explanation": explanation,
            },
            "reasons":             reasons,
            "suggested_responses": suggested_responses,
            # Full per-agent raw results — useful for debugging / UI expansion
            "agent_details": {
                "linguistic": linguistic_res,
                "identity":   identity_res,
                "payload":    payload_res,
            },
        }

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _classify(score: int):
        """Map Trust Score to (level, explanation) tuple."""
        if score >= 70:
            return (
                "CLEAR",
                "Conversation appears safe. No significant scam indicators were detected.",
            )
        if score >= 40:
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
        linguistic_res: Dict[str, Any],
        identity_res:   Dict[str, Any],
        payload_res:    Dict[str, Any],
    ) -> List[str]:
        """Build human-readable bullet-point reasons for the Trust Score."""
        reasons: List[str] = []

        # Linguistic flags
        for flag in linguistic_res.get("red_flags", []):
            reasons.append(f"Linguistic Analyst detected: {flag}")

        # Identity anomalies
        for anomaly in identity_res.get("anomalies", []):
            reasons.append(f"Identity Profiler flagged: {anomaly}")

        # Payload threats
        for threat in payload_res.get("threats", []):
            reasons.append(f"Payload Auditor found: {threat}")

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
    def _suggested_responses(score: int) -> List[str]:
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
