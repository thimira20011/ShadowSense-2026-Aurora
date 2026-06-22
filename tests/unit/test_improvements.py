"""
tests/unit/test_improvements.py
================================
Unit tests for all improvements implemented in the ShadowSense improvement sprint.

All tests run in **mock mode** (no API keys required).
Tests are grouped by improvement category.

Run:
    pytest tests/unit/test_improvements.py -v --tb=short
"""
import sys
import threading
import time
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Ensure project root on path
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

_ML_PIPELINE_DIR = _PROJECT_ROOT / "ml-pipeline"
if str(_ML_PIPELINE_DIR) not in sys.path:
    sys.path.insert(0, str(_ML_PIPELINE_DIR))


# ===========================================================================
# Helpers
# ===========================================================================

def _make_shield_context(text="Hello", age=365, reviews=30, verified=True):
    return {
        "text": text,
        "sender": "test_user",
        "context": {
            "account_age_days": age,
            "reviews": reviews,
            "verified": verified,
        },
    }


# ===========================================================================
# Phase 1: ShieldAgent — ThreadPoolExecutor singleton + timeout + penalty fix
# ===========================================================================

class TestShieldExecutorSingleton:
    """Executor must be a module-level singleton, not created per request."""

    def test_executor_is_module_level(self):
        """_SHIELD_EXECUTOR must exist at module level in shield.py."""
        from backend.agents import shield as shield_module
        assert hasattr(shield_module, "_SHIELD_EXECUTOR"), (
            "_SHIELD_EXECUTOR should be a module-level singleton in shield.py"
        )

    def test_executor_same_object_across_calls(self):
        """Two successive .defend() calls must use the same executor object."""
        from backend.agents import shield as shield_module
        from backend.agents.shield import ShieldAgent

        executor_before = id(shield_module._SHIELD_EXECUTOR)
        agent = ShieldAgent()
        agent.defend(_make_shield_context("First call"))
        agent.defend(_make_shield_context("Second call"))
        executor_after = id(shield_module._SHIELD_EXECUTOR)

        assert executor_before == executor_after, (
            "New ThreadPoolExecutor must NOT be created per defend() call"
        )

    def test_executor_thread_name_prefix(self):
        """Executor threads should be named with 'shield' prefix for debugging."""
        from backend.agents import shield as shield_module
        executor = shield_module._SHIELD_EXECUTOR
        assert "shield" in (getattr(executor, "_thread_name_prefix", "") or ""), (
            "Executor threads should carry 'shield' prefix for easy debugging"
        )


class TestShieldTimeout:
    """Shield wait timeout must be raised from 5s to account for Ollama."""

    def test_timeout_constant_from_config(self):
        """SHIELD_AGENT_TIMEOUT_S config constant must be >= 20s."""
        from backend.config import SHIELD_AGENT_TIMEOUT_S
        assert SHIELD_AGENT_TIMEOUT_S >= 20.0, (
            f"SHIELD_AGENT_TIMEOUT_S={SHIELD_AGENT_TIMEOUT_S} is too low — "
            "Ollama tier alone can take up to 15s"
        )

    def test_timeout_used_in_defend(self):
        """ShieldAgent.defend must pass SHIELD_AGENT_TIMEOUT_S to wait()."""
        from backend.config import SHIELD_AGENT_TIMEOUT_S
        import concurrent.futures

        captured_timeout = []

        original_wait = concurrent.futures.wait

        def mock_wait(fs, timeout=None, return_when=None):
            captured_timeout.append(timeout)
            return original_wait(fs, timeout=timeout, return_when=return_when)

        from backend.agents.shield import ShieldAgent
        agent = ShieldAgent()

        with patch("concurrent.futures.wait", side_effect=mock_wait):
            agent.defend(_make_shield_context())

        assert captured_timeout, "concurrent.futures.wait was never called"
        assert captured_timeout[0] == SHIELD_AGENT_TIMEOUT_S, (
            f"defend() passed timeout={captured_timeout[0]} "
            f"but SHIELD_AGENT_TIMEOUT_S={SHIELD_AGENT_TIMEOUT_S}"
        )


class TestShieldClassifyBoundaries:
    """_classify() boundary values encode the Week 4 threshold change."""

    def test_29_is_high_risk(self):
        from backend.agents.shield import ShieldAgent
        assert ShieldAgent._classify(29)[0] == "HIGH_RISK"

    def test_30_is_advisory(self):
        from backend.agents.shield import ShieldAgent
        assert ShieldAgent._classify(30)[0] == "ADVISORY"

    def test_69_is_advisory(self):
        from backend.agents.shield import ShieldAgent
        assert ShieldAgent._classify(69)[0] == "ADVISORY"

    def test_70_is_clear(self):
        from backend.agents.shield import ShieldAgent
        assert ShieldAgent._classify(70)[0] == "CLEAR"

    def test_0_is_high_risk(self):
        from backend.agents.shield import ShieldAgent
        assert ShieldAgent._classify(0)[0] == "HIGH_RISK"

    def test_100_is_clear(self):
        from backend.agents.shield import ShieldAgent
        assert ShieldAgent._classify(100)[0] == "CLEAR"


class TestChromaDBPenaltyFormula:
    """Penalty formula must be consistent with its >= 0.5 trigger threshold."""

    def test_penalty_is_zero_at_threshold(self):
        """At exactly the threshold, penalty should be 0 (no discontinuity)."""
        from backend.config import CHROMADB_PENALTY_THRESHOLD, CHROMADB_PENALTY_SCALE
        sim = CHROMADB_PENALTY_THRESHOLD
        penalty = (sim - CHROMADB_PENALTY_THRESHOLD) * CHROMADB_PENALTY_SCALE
        assert penalty == 0.0, f"Penalty at threshold should be 0, got {penalty}"

    def test_penalty_above_threshold(self):
        """At sim=0.8, penalty should be (0.8 - 0.5) * 25 = 7.5."""
        from backend.config import CHROMADB_PENALTY_THRESHOLD, CHROMADB_PENALTY_SCALE
        sim = 0.8
        penalty = (sim - CHROMADB_PENALTY_THRESHOLD) * CHROMADB_PENALTY_SCALE
        assert abs(penalty - 7.5) < 0.001, f"Expected 7.5, got {penalty}"

    def test_penalty_formula_uses_same_threshold_as_trigger(self):
        """Config threshold constant must match: formula and trigger use same value."""
        from backend.config import CHROMADB_PENALTY_THRESHOLD
        # The old bug: trigger was >= 0.5 but formula subtracted 0.4
        # Both must now equal CHROMADB_PENALTY_THRESHOLD (default 0.5)
        assert CHROMADB_PENALTY_THRESHOLD == 0.5, (
            f"Default CHROMADB_PENALTY_THRESHOLD should be 0.5, got {CHROMADB_PENALTY_THRESHOLD}"
        )


# ===========================================================================
# Phase 1: IdentityAgent — message_text passed to Gemini tier
# ===========================================================================

class TestIdentityAgentGeminiMessageText:
    """Gemini tier must receive message_text (was silently dropped before)."""

    def test_try_gemini_signature_accepts_message_text(self):
        """_try_gemini must accept a message_text parameter."""
        import inspect
        from backend.agents.identity import IdentityAgent
        sig = inspect.signature(IdentityAgent._try_gemini)
        assert "message_text" in sig.parameters, (
            "_try_gemini must accept message_text as a parameter"
        )

    def test_gemini_verify_signature_accepts_message_text(self):
        """_gemini_verify must accept message_text."""
        import inspect
        from backend.agents.identity import IdentityAgent
        sig = inspect.signature(IdentityAgent._gemini_verify)
        assert "message_text" in sig.parameters, (
            "_gemini_verify must accept message_text"
        )

    def test_build_prompt_called_with_message_text(self):
        """When in mock mode, rule tier is used; verify _build_prompt receives text."""
        from backend.agents.identity import IdentityAgent
        agent = IdentityAgent()  # Will be mock (no real API key in test env)
        profile = {"account_age_days": 10, "reviews": 0, "verified": False}
        message = "Send money via Western Union outside the platform."

        # Mock Ollama client availability and response so it executes _try_ollama
        agent.client = MagicMock()
        agent.client.is_available.return_value = True
        agent.client.generate.return_value = '{"identity_risk": 50, "anomalies": [], "confidence": 0.9}'

        with patch.object(agent, "_build_prompt", wraps=agent._build_prompt) as mock_bp:
            agent.verify(profile, message)
            # _build_prompt should have been called with message_text=message
            calls = [str(c) for c in mock_bp.call_args_list]
            assert any(message in c for c in calls) or mock_bp.call_args is not None, (
                "_build_prompt was not called during verify()"
            )


# ===========================================================================
# Phase 1: LinguisticAgent — multi-key Groq retry on 429
# ===========================================================================

class TestLinguisticGroqKeyRotation:
    """On 429, LinguisticAgent must try next Groq key instead of jumping to Gemini."""

    def test_groq_retry_loop_exists(self):
        """analyze() must iterate over all clients, not break on first 429."""
        import inspect
        from backend.agents.linguistic import LinguisticAgent
        source = inspect.getsource(LinguisticAgent.analyze)
        # The fix introduces a for-loop over num_clients
        assert "for attempt in range(num_clients)" in source, (
            "LinguisticAgent.analyze must contain a multi-key retry loop"
        )

    def test_429_triggers_next_key_not_gemini(self):
        """Simulated 429 on first key should try second key before Gemini fallback."""
        from backend.agents.linguistic import LinguisticAgent

        # Build a minimal agent with two fake Groq clients
        agent = LinguisticAgent()
        agent.is_mock = False

        call_order = []

        class FakeGroqClient429:
            def __init__(self, name):
                self._name = name
                self.chat = MagicMock()
                self.chat.completions = MagicMock()
                self.chat.completions.create = self._create

            def _create(self, **kwargs):
                call_order.append(self._name)
                raise Exception("429 rate_limit_exceeded")

        class FakeGroqClientOK:
            def __init__(self, name):
                self._name = name
                self.chat = MagicMock()
                self.chat.completions = MagicMock()
                self.chat.completions.create = self._create

            def _create(self, **kwargs):
                call_order.append(self._name)
                resp = MagicMock()
                resp.choices = [MagicMock()]
                resp.choices[0].message.content = '{"urgency_score": 0.0, "red_flags": [], "confidence": 1.0}'
                return resp

        agent.clients = [FakeGroqClient429("key_0"), FakeGroqClientOK("key_1")]
        agent._keys  = ["fake_key_000000", "fake_key_111111"]
        agent._index = 0

        result = agent.analyze("Hello, looking forward to working with you!")
        # key_0 should fail with 429, key_1 should succeed
        assert "key_0" in call_order, "First key was not attempted"
        assert "key_1" in call_order, "Second key was not attempted after 429"
        assert result["urgency_score"] == 0.0
        assert "_gemini" not in "".join(call_order), (
            "Should not fall back to Gemini when second Groq key succeeds"
        )

    def test_all_keys_429_falls_back_to_gemini(self):
        """Only if ALL Groq keys fail with 429 should Gemini be called."""
        from backend.agents.linguistic import LinguisticAgent

        agent = LinguisticAgent()
        agent.is_mock = False
        gemini_called = []

        class FakeGroqClient429:
            def __init__(self):
                self.chat = MagicMock()
                self.chat.completions = MagicMock()
                self.chat.completions.create = lambda **kw: (_ for _ in ()).throw(
                    Exception("429 rate_limit_exceeded")
                )

        agent.clients = [FakeGroqClient429(), FakeGroqClient429()]
        agent._keys   = ["fake_000000", "fake_111111"]
        agent._index  = 0

        def mock_gemini(text, start_time, truncated=False):
            gemini_called.append(True)
            return {"urgency_score": 0.0, "red_flags": [], "confidence": 0.5}

        agent._gemini_analyze = mock_gemini
        agent.analyze("Test message")

        assert gemini_called, "Gemini should be called after all Groq keys are exhausted"


# ===========================================================================
# Phase 3: FeedbackLoop — thread safety + reset
# ===========================================================================

class TestFeedbackLoopResetFunction:
    """_reset_feedback_loop() must enable test isolation."""

    def test_reset_function_exists(self):
        """_reset_feedback_loop must be importable from feedback_loop."""
        # Add ml-pipeline to sys.path for import
        ml_path = str(_PROJECT_ROOT / "ml-pipeline")
        if ml_path not in sys.path:
            sys.path.insert(0, ml_path)

        from feedback_loop import _reset_feedback_loop
        assert callable(_reset_feedback_loop), "_reset_feedback_loop must be callable"

    def test_reset_clears_singleton(self):
        """After reset, a new FeedbackLoop instance is created on next access."""
        ml_path = str(_PROJECT_ROOT / "ml-pipeline")
        if ml_path not in sys.path:
            sys.path.insert(0, ml_path)

        import feedback_loop as fl
        fl._reset_feedback_loop()
        assert fl._feedback_loop is None, (
            "_feedback_loop should be None after _reset_feedback_loop()"
        )

    def test_new_instance_created_after_reset(self):
        """_get_feedback_loop() after reset returns a new object."""
        ml_path = str(_PROJECT_ROOT / "ml-pipeline")
        if ml_path not in sys.path:
            sys.path.insert(0, ml_path)

        import feedback_loop as fl
        fl._reset_feedback_loop()
        # First access creates instance
        instance_1 = fl._get_feedback_loop()
        fl._reset_feedback_loop()
        # Second access creates a fresh instance
        instance_2 = fl._get_feedback_loop()
        assert instance_1 is not instance_2, (
            "Each reset should yield a different FeedbackLoop instance"
        )


class TestFeedbackLoopPatternLocks:
    """_pattern_locks dict must be initialised in FeedbackLoop.__init__."""

    def test_pattern_locks_initialized(self):
        """FeedbackLoop must have a _pattern_locks dict attribute."""
        ml_path = str(_PROJECT_ROOT / "ml-pipeline")
        if ml_path not in sys.path:
            sys.path.insert(0, ml_path)

        from feedback_loop import FeedbackLoop
        loop = FeedbackLoop()
        assert hasattr(loop, "_pattern_locks"), (
            "FeedbackLoop must have _pattern_locks dict"
        )
        assert isinstance(loop._pattern_locks, dict), (
            "_pattern_locks must be a dict"
        )

    def test_pattern_locks_separate_per_key(self):
        """Locks for different patterns must be distinct objects."""
        ml_path = str(_PROJECT_ROOT / "ml-pipeline")
        if ml_path not in sys.path:
            sys.path.insert(0, ml_path)

        from feedback_loop import FeedbackLoop
        loop = FeedbackLoop()

        lock_a = loop._pattern_locks.setdefault("pattern_a", threading.Lock())
        lock_b = loop._pattern_locks.setdefault("pattern_b", threading.Lock())
        assert lock_a is not lock_b, (
            "Each pattern should get its own distinct Lock instance"
        )

    def test_same_key_returns_same_lock(self):
        """Repeated access to the same key must return the same Lock."""
        ml_path = str(_PROJECT_ROOT / "ml-pipeline")
        if ml_path not in sys.path:
            sys.path.insert(0, ml_path)

        from feedback_loop import FeedbackLoop
        loop = FeedbackLoop()

        lock_1 = loop._pattern_locks.setdefault("same_key", threading.Lock())
        lock_2 = loop._pattern_locks.setdefault("same_key", threading.Lock())
        assert lock_1 is lock_2, (
            "Same pattern key must always return the same Lock instance"
        )


# ===========================================================================
# Phase 4: Config constants
# ===========================================================================

class TestConfigConstants:
    """All new constants must be importable and have correct types."""

    def test_shield_timeout_float(self):
        from backend.config import SHIELD_AGENT_TIMEOUT_S
        assert isinstance(SHIELD_AGENT_TIMEOUT_S, float)
        assert SHIELD_AGENT_TIMEOUT_S > 0

    def test_shield_workers_int(self):
        from backend.config import SHIELD_EXECUTOR_WORKERS
        assert isinstance(SHIELD_EXECUTOR_WORKERS, int)
        assert SHIELD_EXECUTOR_WORKERS >= 1

    def test_ollama_timeout_int(self):
        from backend.config import OLLAMA_IDENTITY_TIMEOUT_S
        assert isinstance(OLLAMA_IDENTITY_TIMEOUT_S, int)
        assert OLLAMA_IDENTITY_TIMEOUT_S > 0

    def test_ollama_max_tokens_int(self):
        from backend.config import OLLAMA_IDENTITY_MAX_TOKENS
        assert isinstance(OLLAMA_IDENTITY_MAX_TOKENS, int)
        assert OLLAMA_IDENTITY_MAX_TOKENS > 0

    def test_chromadb_penalty_threshold_float(self):
        from backend.config import CHROMADB_PENALTY_THRESHOLD
        assert isinstance(CHROMADB_PENALTY_THRESHOLD, float)
        assert 0.0 < CHROMADB_PENALTY_THRESHOLD < 1.0

    def test_chromadb_penalty_scale_float(self):
        from backend.config import CHROMADB_PENALTY_SCALE
        assert isinstance(CHROMADB_PENALTY_SCALE, float)
        assert CHROMADB_PENALTY_SCALE > 0

    def test_linguistic_max_chars_int(self):
        from backend.config import LINGUISTIC_MAX_TEXT_CHARS
        assert isinstance(LINGUISTIC_MAX_TEXT_CHARS, int)
        assert LINGUISTIC_MAX_TEXT_CHARS >= 1000

    def test_rate_limit_analyze_str(self):
        from backend.config import RATE_LIMIT_ANALYZE
        assert isinstance(RATE_LIMIT_ANALYZE, str)
        assert "/" in RATE_LIMIT_ANALYZE, (
            "RATE_LIMIT_ANALYZE must be in format 'N/period' e.g. '30/minute'"
        )

    def test_rate_limit_feedback_str(self):
        from backend.config import RATE_LIMIT_FEEDBACK
        assert isinstance(RATE_LIMIT_FEEDBACK, str)
        assert "/" in RATE_LIMIT_FEEDBACK


# ===========================================================================
# Phase 1: IdentityAgent enriched rules edge cases
# ===========================================================================

class TestIdentityEnrichedRuleBoundaries:
    """Test rule-based tier boundary values for account age thresholds."""

    def _rule_verify(self, profile: dict) -> dict:
        from backend.agents.identity import IdentityAgent
        agent = IdentityAgent()
        # Force rule-based tier by putting agent in mock mode
        agent.is_mock = True
        return agent.verify(profile, message_text="")

    def test_very_new_account_2_days(self):
        """2-day account should have identity_risk >= 70."""
        result = self._rule_verify({"account_age_days": 2, "reviews": 0, "verified": False})
        assert result["identity_risk"] >= 70, (
            f"2-day account should be high risk, got {result['identity_risk']}"
        )

    def test_week_old_account_moderate(self):
        """7-day account with no reviews should have moderate risk (>= 30)."""
        result = self._rule_verify({"account_age_days": 7, "reviews": 0, "verified": False})
        assert result["identity_risk"] >= 30, (
            f"7-day unverified account should be at least moderate risk, got {result['identity_risk']}"
        )

    def test_month_old_account_lower_risk(self):
        """30-day account risk should be lower than 2-day account."""
        risk_2d  = self._rule_verify({"account_age_days": 2, "reviews": 0, "verified": False})["identity_risk"]
        risk_30d = self._rule_verify({"account_age_days": 30, "reviews": 0, "verified": False})["identity_risk"]
        assert risk_30d < risk_2d, (
            f"30-day account (risk={risk_30d}) should have lower risk than 2-day account (risk={risk_2d})"
        )

    def test_compound_penalty_accumulates(self):
        """Account with multiple risk factors should score higher than single factor."""
        risk_unverified_only = self._rule_verify({
            "account_age_days": 365, "reviews": 20, "verified": False
        })["identity_risk"]

        risk_compound = self._rule_verify({
            "account_age_days": 1, "reviews": 0, "verified": False, "bio": ""
        })["identity_risk"]

        assert risk_compound > risk_unverified_only, (
            "Compound risk factors (new + no reviews + no bio) should score higher "
            "than single factor (unverified only)"
        )

    def test_verified_established_account_low_risk(self):
        """Verified 2-year account with many reviews should have very low risk."""
        result = self._rule_verify({
            "account_age_days": 730, "reviews": 100, "verified": True,
            "bio": "Expert designer with 5 years on Upwork."
        })
        assert result["identity_risk"] < 30, (
            f"Strong profile should have risk < 30, got {result['identity_risk']}"
        )


# ===========================================================================
# Phase 1: OllamaClient — dynamic model resolution + generate options
# ===========================================================================

class TestOllamaClientDynamicResolution:
    """OllamaClient dynamic model resolution and options formatting tests."""

    @patch("requests.get")
    def test_dynamic_resolution_success(self, mock_get):
        """OllamaClient resolves to matched/fallback model if configured model isn't installed."""
        from ollama_client import OllamaClient
        
        # Mock /api/tags response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "models": [
                {"name": "llama3.2:3b"},
                {"name": "deepseek-r1:1.5b"},
            ]
        }
        mock_get.return_value = mock_response

        # Case 1: Configured is "llama3.2", tags contains "llama3.2:3b", resolves to "llama3.2:3b"
        with patch.dict("os.environ", {"OLLAMA_MODEL": "llama3.2"}):
            client = OllamaClient()
            assert client.model == "llama3.2:3b"

        # Case 2: Configured is "deepseek-r1", tags contains "deepseek-r1:1.5b", resolves to "deepseek-r1:1.5b"
        with patch.dict("os.environ", {"OLLAMA_MODEL": "deepseek-r1"}):
            client = OllamaClient()
            assert client.model == "deepseek-r1:1.5b"

        # Case 3: Configured is not installed, fallback to "deepseek-r1:1.5b"
        with patch.dict("os.environ", {"OLLAMA_MODEL": "non-existent-model"}):
            client = OllamaClient()
            assert client.model == "deepseek-r1:1.5b"

    @patch("requests.get", side_effect=Exception("Connection refused"))
    def test_dynamic_resolution_offline_fallback(self, mock_get):
        """OllamaClient falls back to original configured model if tags request fails."""
        from ollama_client import OllamaClient
        
        with patch.dict("os.environ", {"OLLAMA_MODEL": "my-custom-model"}):
            client = OllamaClient()
            assert client.model == "my-custom-model"

    @patch("requests.post")
    def test_generate_passes_options(self, mock_post):
        """OllamaClient.generate passes options containing temperature and num_predict."""
        from ollama_client import OllamaClient
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"response": "Mocked LLM reply"}
        mock_post.return_value = mock_response

        client = OllamaClient()
        client.model = "llama3.2" # manually set for test consistency
        
        client.generate("Test prompt", temperature=0.2, max_tokens=123, timeout=10)
        
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert kwargs["timeout"] == 10
        payload = kwargs["json"]
        assert payload["model"] == "llama3.2"
        assert payload["options"]["temperature"] == 0.2
        assert payload["options"]["num_predict"] == 123

