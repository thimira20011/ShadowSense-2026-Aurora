"""
tests/unit/test_agents.py
==========================
Unit tests for individual ShadowSense agents (Week 4 expansion).

All tests run in **mock mode** (no API keys required).  
Live-API integration tests are marked ``@pytest.mark.live`` and are
skipped in CI unless the ``SHADOSENSE_LIVE_TESTS`` env var is set to ``1``.

Run mock tests:
    pytest tests/unit/test_agents.py -v

Run including live tests (requires valid API keys in backend/.env):
    SHADOSENSE_LIVE_TESTS=1 pytest tests/unit/test_agents.py -v -m "live"
"""
import os
import sys
import pytest
from pathlib import Path

# Ensure project root is on the path regardless of where pytest runs from
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from backend.agents.linguistic import LinguisticAgent
from backend.agents.identity import IdentityAgent
from backend.agents.payload import PayloadAgent
from backend.agents.shield import ShieldAgent

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

LIVE = pytest.mark.skipif(
    os.getenv("SHADOSENSE_LIVE_TESTS") != "1",
    reason="Set SHADOSENSE_LIVE_TESTS=1 to run live API tests",
)


# ===========================================================================
# LinguisticAgent — 4 tests (3 required + 1 edge case)
# ===========================================================================

class TestLinguisticAgent:
    """Mock-mode tests for LinguisticAgent."""

    def test_agent_initialization(self):
        """Agent can be instantiated without API keys (falls back to mock mode)."""
        agent = LinguisticAgent()
        assert agent.agent is not None

    def test_clear_message_returns_zero_risk(self):
        """Benign message should return zero urgency score and no red flags."""
        agent = LinguisticAgent()
        result = agent.analyze("Hi, I'd love to hire you for a logo design. Here is my brief.")
        assert "urgency_score" in result
        assert "red_flags" in result
        assert result["urgency_score"] == 0.0, (
            f"Expected 0.0 urgency for benign message, got {result['urgency_score']}"
        )
        assert result["red_flags"] == [], (
            f"Expected no red flags for benign message, got {result['red_flags']}"
        )
        assert result["confidence"] > 0.0

    def test_urgent_scam_message_detected(self):
        """Message with urgency keywords should score ≥ 60."""
        agent = LinguisticAgent()
        scam_text = "I need this done in 30 minutes or I will cancel — HURRY UP! No time to waste!"
        result = agent.analyze(scam_text)
        assert result["urgency_score"] >= 60, (
            f"Expected urgency_score ≥ 60 for scam message, got {result['urgency_score']}"
        )
        assert len(result["red_flags"]) > 0, "Expected at least one red flag for scam message"

    def test_unicode_handling_does_not_crash(self):
        """Messages with emoji, Arabic, CJK, and zero-width spaces must not raise."""
        agent = LinguisticAgent()
        unicode_text = (
            "مرحبا 👋 I need help with my project 🚀 "
            "请联系我 \u200b\u200b urgent!!!"  # zero-width spaces included
        )
        result = agent.analyze(unicode_text)
        # Should complete without exception and return a valid structure
        assert "urgency_score" in result
        assert "red_flags" in result
        assert isinstance(result["urgency_score"], float)
        assert isinstance(result["red_flags"], list)

    def test_empty_text_returns_zero_risk(self):
        """Empty / whitespace-only text should return zero risk without an API call."""
        agent = LinguisticAgent()
        for empty_input in ("", "   ", "\n\t\n"):
            result = agent.analyze(empty_input)
            assert result["urgency_score"] == 0.0, (
                f"Expected 0.0 for empty input '{repr(empty_input)}', got {result['urgency_score']}"
            )
            assert result["red_flags"] == []

    def test_very_long_message_truncated_gracefully(self):
        """Messages > 4,000 chars must be truncated and a truncation flag added."""
        agent = LinguisticAgent()
        long_text = "Hello " * 1_500   # ~9,000 chars
        result = agent.analyze(long_text)
        # Must not raise; must contain truncation flag
        assert "urgency_score" in result
        assert any(
            "truncated" in flag.lower() for flag in result["red_flags"]
        ), f"Expected truncation flag in red_flags, got: {result['red_flags']}"

    # ── Live tests (skipped by default) ─────────────────────────────────────
    @LIVE
    def test_live_groq_api(self):
        """Live call to Groq API — requires valid GROQ_API_KEY in .env."""
        agent = LinguisticAgent()
        if agent.is_mock:
            pytest.skip("No valid Groq API key configured.")
        result = agent.analyze("Contact me outside the platform for payment via PayPal friends.")
        assert result["urgency_score"] >= 30, (
            f"Live Groq should flag off-platform redirect, got {result['urgency_score']}"
        )


# ===========================================================================
# IdentityAgent — 4 tests (3 required + 1 edge case)
# ===========================================================================

class TestIdentityAgent:
    """Mock-mode tests for IdentityAgent."""

    def test_agent_initialization(self):
        """Agent can be instantiated without API keys."""
        agent = IdentityAgent()
        assert agent.agent is not None

    def test_legitimate_profile_low_risk(self):
        """A 2-year-old verified account with many reviews should have identity_risk < 30."""
        agent = IdentityAgent()
        result = agent.verify({
            "account_age_days": 730,
            "reviews": 50,
            "verified": True,
            "bio": "Experienced graphic designer with 5 years on Fiverr.",
        })
        assert "identity_risk" in result
        assert result["identity_risk"] < 30, (
            f"Expected identity_risk < 30 for legit profile, got {result['identity_risk']}"
        )
        assert result["verified"] is True

    def test_new_suspicious_profile_high_risk(self):
        """2-day-old account, no reviews, not verified → identity_risk ≥ 70."""
        agent = IdentityAgent()
        result = agent.verify({
            "account_age_days": 2,
            "reviews": 0,
            "verified": False,
        })
        assert result["identity_risk"] >= 70, (
            f"Expected identity_risk ≥ 70 for suspicious profile, got {result['identity_risk']}"
        )
        assert len(result["anomalies"]) > 0, "Expected at least one anomaly for suspicious profile"

    def test_unverified_no_bio_moderate_risk(self):
        """Unverified account with no bio but decent age → some risk signal."""
        agent = IdentityAgent()
        result = agent.verify({
            "account_age_days": 60,
            "reviews": 0,
            "verified": False,
            "bio": "",
        })
        assert "identity_risk" in result
        assert result["identity_risk"] > 0, "Unverified account with no bio should have some risk"
        assert isinstance(result["anomalies"], list)

    def test_empty_profile_data_moderate_risk(self):
        """An empty dict must not crash and should return moderate risk (≥ 20)."""
        agent = IdentityAgent()
        result = agent.verify({})
        assert "identity_risk" in result
        assert "anomalies" in result
        assert result["identity_risk"] >= 20, (
            f"Expected moderate risk for empty profile, got {result['identity_risk']}"
        )
        assert len(result["anomalies"]) > 0, (
            "Expected at least one anomaly explaining why profile is unassessable"
        )

    # ── Live tests ───────────────────────────────────────────────────────────
    @LIVE
    def test_live_gemini_api(self):
        """Live call to Gemini API — requires valid GEMINI_API_KEY in .env."""
        agent = IdentityAgent()
        if agent.is_mock:
            pytest.skip("No valid Gemini API key configured.")
        result = agent.verify({"account_age_days": 1, "reviews": 0, "verified": False})
        assert result["identity_risk"] >= 50, (
            f"Live Gemini should rate new unverified account as high risk, got {result['identity_risk']}"
        )


# ===========================================================================
# PayloadAgent — 3 tests (all safe-stub because Ollama is not running)
# ===========================================================================

class TestPayloadAgent:
    """Mock-mode tests for PayloadAgent (Ollama not available)."""

    def test_agent_initialization(self):
        """Agent can be instantiated without Ollama running."""
        agent = PayloadAgent()
        assert agent.agent is not None

    def test_empty_payload_returns_safe_stub(self):
        """Empty string payload → safe stub: payload_risk=0, no threats."""
        agent = PayloadAgent()
        result = agent.analyze("")
        assert "payload_risk" in result
        assert result["payload_risk"] == 0.0, (
            f"Expected 0.0 payload_risk for empty payload, got {result['payload_risk']}"
        )
        assert result["threats"] == []
        assert result["confidence"] > 0.0

    def test_none_payload_does_not_crash(self):
        """None payload must be handled gracefully — returns safe stub."""
        agent = PayloadAgent()
        result = agent.analyze(None)
        assert "payload_risk" in result
        assert "threat_level" in result
        assert "confidence" in result

    def test_suspicious_filename_metadata(self):
        """Suspicious filename passed as string context.

        When Ollama IS available this should flag risk; when not (our case)
        the safe stub is returned — both paths should produce a valid dict.
        """
        agent = PayloadAgent()
        result = agent.analyze("logo_brief.exe")
        # Must always return a valid result dict regardless of Ollama state
        assert "payload_risk" in result
        assert "threats" in result
        assert isinstance(result["payload_risk"], float)
        assert isinstance(result["threats"], list)


# ===========================================================================
# ShieldAgent — 3 integration-style tests using mock sub-agents
# ===========================================================================

class TestShieldAgent:
    """Mock-mode tests for the full ShieldAgent pipeline."""

    def test_full_pipeline_clear_message(self):
        """Safe message + good profile → trust_score ≥ 70 (CLEAR level)."""
        agent = ShieldAgent()
        result = agent.defend({
            "text": "Hi, looking forward to working with you on this website project!",
            "sender": "verified_client",
            "context": {
                "account_age_days": 365,
                "reviews": 30,
                "verified": True,
            },
        })
        trust = result["trust_score"]["score"]
        assert trust >= 70, f"Expected CLEAR (≥70) for benign context, got trust_score={trust}"
        assert result["trust_score"]["level"] == "CLEAR"
        assert isinstance(result["reasons"], list)
        assert isinstance(result["suggested_responses"], list)

    def test_full_pipeline_high_risk_message(self):
        """Scam message + new account → trust_score ≤ 39 (ADVISORY or HIGH_RISK).

        Week 4 threshold: HIGH_RISK is now 0–29, ADVISORY is 30–69.
        A scam message + new account should at minimum be ADVISORY (≤69).
        """
        agent = ShieldAgent()
        result = agent.defend({
            "text": (
                "I need this DONE in 30 minutes or I will cancel! "
                "Contact me outside Fiverr on Telegram @scammerXYZ"
            ),
            "sender": "unknown_new",
            "context": {
                "account_age_days": 1,
                "reviews": 0,
                "verified": False,
            },
        })
        trust = result["trust_score"]["score"]
        assert trust <= 69, (
            f"Expected ADVISORY or HIGH_RISK (≤69) for scam context, got trust_score={trust}"
        )
        assert result["trust_score"]["level"] in ("HIGH_RISK", "ADVISORY")
        assert len(result["reasons"]) > 0

    def test_graceful_degradation_empty_context(self):
        """Empty context dict must not raise — returns a valid partial Trust Score."""
        agent = ShieldAgent()
        result = agent.defend({
            "text": "Hello",
            "sender": None,
            "context": {},
        })
        # Must return a valid response, not raise
        assert "trust_score" in result
        assert 0 <= result["trust_score"]["score"] <= 100
        assert result["trust_score"]["level"] in ("CLEAR", "ADVISORY", "HIGH_RISK")
        assert isinstance(result["reasons"], list)

    def test_trust_score_advisory_new_threshold(self):
        """Verify new ADVISORY boundary: score=30 → ADVISORY (not HIGH_RISK).

        This test encodes the Week 4 threshold change explicitly.
        Shield._classify(30) must return ADVISORY.
        """
        assert ShieldAgent._classify(30)[0] == "ADVISORY", (
            "score=30 should map to ADVISORY after Week 4 threshold shift"
        )
        assert ShieldAgent._classify(29)[0] == "HIGH_RISK", (
            "score=29 should still be HIGH_RISK"
        )
        assert ShieldAgent._classify(70)[0] == "CLEAR"
        assert ShieldAgent._classify(69)[0] == "ADVISORY"
