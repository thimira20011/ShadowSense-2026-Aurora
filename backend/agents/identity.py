"""Identity verification agent — three-tier fallback implementation.

Fallback chain (fastest first when primary is unavailable):
    Tier 1 → Google Gemini Flash  (primary, best quality, ~1.6 s)
    Tier 2 → Ollama / deepseek-r1 (secondary, local, 15 s hard timeout)
    Tier 3 → Enriched rule-based  (tertiary, < 1 ms, always available)

Why three tiers?
  - Gemini free-tier quotas can be exhausted (daily cap).
  - Ollama is already running for the main analysis pipeline so we reuse it,
    but we cap it at 15 s so it never blocks the overall 90 s orchestrator
    timeout, and we use a dedicated thread so it doesn't compete with the
    deepseek-r1 main call at the socket level.
  - The enriched rule-based tier now analyses BOTH profile metadata AND the
    message text for scam signals, so it's much stronger than the old version.
"""
import time
import json
import logging
import threading
import re
import requests
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from typing import Any

from google import genai
from google.genai import types as genai_types

from backend.config import (
    GEMINI_API_KEYS, OLLAMA_HOST, DEEPSEEK_MODEL,
    OLLAMA_IDENTITY_TIMEOUT_S, OLLAMA_IDENTITY_MAX_TOKENS,
)
from ._crewai_stub import Agent

_ML_PIPELINE_DIR = Path(__file__).resolve().parent.parent.parent / "ml-pipeline"
if str(_ML_PIPELINE_DIR) not in sys.path:
    sys.path.insert(0, str(_ML_PIPELINE_DIR))

try:
    from ollama_client import OllamaClient
    _OLLAMA_AVAILABLE = True
except ImportError:
    _OLLAMA_AVAILABLE = False

logger = logging.getLogger(__name__)

# ── Model constants ───────────────────────────────────────────────────────────
GEMINI_MODEL  = "models/gemini-2.0-flash"
# Ollama timeout/token settings now live in config.py (OLLAMA_IDENTITY_TIMEOUT_S / OLLAMA_IDENTITY_MAX_TOKENS)

# Shared executor for Ollama calls — 1 worker so we don't pile up requests
# when Gemini quota is chronically exhausted.
_ollama_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="identity-ollama")


def _clamp_score(identity_risk: float, confidence: float) -> tuple[float, float]:
    """Clamp identity_risk to [0, 100] and confidence to [0.0, 1.0].

    LLMs occasionally return out-of-range values (e.g. 110 or -5 for risk,
    1.2 for confidence). Clamping prevents those values from propagating into
    the weighted Trust Score calculation and inflating/deflating the result.
    """
    return max(0.0, min(100.0, float(identity_risk))), max(0.0, min(1.0, float(confidence)))


class IdentityAgent:
    """Analyses account profile metadata for identity anomalies and fraud signals.

    Accepts a profile metadata dict (and optional raw message text) and returns
    a structured risk assessment.

    Fallback chain:
        Gemini → Ollama (15 s timeout) → Enriched rule-based
    """

    def __init__(self) -> None:
        self.agent = Agent(
            role="Identity Profiler",
            goal=(
                "Detect fraudulent or suspicious account profiles by analysing account age, "
                "review counts, verification status, and behavioural inconsistencies."
            ),
            backstory=(
                "Specialist in online identity verification, social engineering detection, "
                "and fraud pattern analysis across freelance platforms."
            ),
            verbose=True,
            allow_delegation=False,
        )

        self.client = OllamaClient(host=OLLAMA_HOST) if _OLLAMA_AVAILABLE else None

        self._lock   = threading.Lock()
        self._index  = 0
        self._clients: list[genai.Client] = []
        self._keys:   list[str] = []

        for key in GEMINI_API_KEYS:
            if key and "placeholder" not in str(key).lower():
                self._clients.append(genai.Client(api_key=key))
                self._keys.append(key)

        self.api_key = self._keys[0] if self._keys else None

        if self._clients:
            self.is_mock = False
            logger.info(
                "IdentityAgent initialised with %d Gemini client(s), model: %s",
                len(self._clients), GEMINI_MODEL,
            )
        else:
            self.is_mock = True
            logger.warning("No valid GEMINI_API_KEYS configured. IdentityAgent will use Ollama/rule fallback.")

    # ─────────────────────────────────────────────────────────────────────────
    # Public API
    # ─────────────────────────────────────────────────────────────────────────

    def verify(
        self,
        identity_data: dict[str, Any],
        message_text: str = "",
    ) -> dict[str, Any]:
        """Verify a profile's identity and return a risk assessment.

        Args:
            identity_data: Dict with any of:
                - account_age_days  (int)
                - reviews           (int)
                - verified          (bool)
                - username          (str)
                - country           (str)
                - bio               (str)
            message_text: The raw chat message (used by the enriched rule tier
                          to cross-check profile risk against message content).

        Returns:
            Dict with:
                - verified        (bool)
                - identity_risk   (float, 0–100)
                - anomalies       (list[str])
                - confidence      (float, 0.0–1.0)
                - tier_used       (str)  — which tier produced the result
        """
        start = time.perf_counter()

        if not identity_data:
            logger.info("IdentityAgent: empty identity_data — returning moderate risk.")
            return {
                "verified":      False,
                "identity_risk": 30.0,
                "anomalies":     ["No profile data provided — identity could not be assessed"],
                "confidence":    0.5,
                "tier_used":     "guard",
            }

        # ── Tier 1: Gemini ────────────────────────────────────────────────────
        if not self.is_mock:
            result = self._try_gemini(identity_data, message_text, start)
            if result is not None:
                return result

        # ── Tier 2: Ollama ───────────────────────────────────────────────────
        result = self._try_ollama(identity_data, message_text, start)
        if result is not None:
            return result

        # ── Tier 3: Enriched rule-based ───────────────────────────────────────
        return self._enriched_rules(identity_data, message_text, start)

    # ─────────────────────────────────────────────────────────────────────────
    # Tier 1 — Gemini
    # ─────────────────────────────────────────────────────────────────────────

    def _try_gemini(
        self, identity_data: dict[str, Any], message_text: str, start: float
    ) -> dict[str, Any] | None:
        """Try all Gemini keys in round-robin. Returns None if all are quota-limited.

        Includes message_text in the prompt so Gemini has the same context
        as the Ollama and rule-based tiers.
        """
        num_clients = len(self._clients)
        last_exc: Exception | None = None

        for attempt in range(num_clients):
            with self._lock:
                idx    = self._index
                client = self._clients[idx]
                key    = self._keys[idx]
                self._index = (self._index + 1) % num_clients

            masked = f"...{key[-6:]}" if len(key) > 6 else key
            logger.info(
                "IdentityAgent[Gemini]: key index %d (%s), attempt %d/%d",
                idx, masked, attempt + 1, num_clients,
            )

            try:
                result = self._gemini_verify(client, identity_data, message_text)
                result["tier_used"] = "gemini"
                latency = time.perf_counter() - start
                logger.info("IdentityAgent[Gemini] latency: %.4fs", latency)
                return result

            except Exception as exc:
                last_exc = exc
                exc_str  = str(exc)

                if "429" in exc_str or "RESOURCE_EXHAUSTED" in exc_str:
                    logger.warning(
                        "IdentityAgent[Gemini]: key %d quota-limited (429). "
                        "Trying next key… [%d/%d remaining]",
                        idx, num_clients - attempt - 1, num_clients,
                    )
                    continue

                # Non-quota error — skip straight to Ollama
                logger.error(
                    "IdentityAgent[Gemini]: non-quota error: %s. "
                    "Falling through to Ollama tier.", exc,
                )
                return None

        logger.error(
            "IdentityAgent[Gemini]: all %d key(s) exhausted. "
            "Last error: %s. Trying Ollama tier.",
            num_clients, last_exc,
        )
        return None

    def _gemini_verify(
        self, client: genai.Client, identity_data: dict[str, Any], message_text: str = ""
    ) -> dict[str, Any]:
        prompt = self._build_prompt(identity_data, message_text=message_text)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                temperature=0.0,
                response_mime_type="application/json",
            ),
        )
        raw = response.text.strip() if response.text else "{}"
        return self._parse_llm_response(raw)

    # ─────────────────────────────────────────────────────────────────────────
    # Tier 2 — Ollama (deepseek-r1, 15 s hard timeout, non-blocking)
    # ─────────────────────────────────────────────────────────────────────────

    def _try_ollama(
        self,
        identity_data: dict[str, Any],
        message_text: str,
        start: float,
    ) -> dict[str, Any] | None:
        """Call Ollama in a thread-pool worker with a configurable timeout.

        Uses the resolved model from OllamaClient, but with a tiny max_tokens cap
        so it completes quickly and doesn't starve the main call.
        """
        if not self.client or not self.client.is_available():
            logger.warning("IdentityAgent[Ollama]: Ollama not available or not installed locally.")
            return None

        logger.info("IdentityAgent[Ollama]: attempting identity analysis via %s…", self.client.model)

        def _call() -> dict[str, Any]:
            prompt = self._build_prompt(identity_data, message_text=message_text)
            raw = self.client.generate(
                prompt=prompt,
                temperature=0.0,
                max_tokens=OLLAMA_IDENTITY_MAX_TOKENS,
                timeout=OLLAMA_IDENTITY_TIMEOUT_S,
            )
            return self._parse_llm_response(raw)

        future = _ollama_executor.submit(_call)
        try:
            result = future.result(timeout=OLLAMA_IDENTITY_TIMEOUT_S)
            result["tier_used"] = "ollama"
            latency = time.perf_counter() - start
            logger.info("IdentityAgent[Ollama] latency: %.4fs", latency)
            return result

        except FuturesTimeoutError:
            future.cancel()
            logger.warning(
                "IdentityAgent[Ollama]: timed out after %ds. "
                "Falling through to enriched rule tier.", OLLAMA_IDENTITY_TIMEOUT_S,
            )
            return None

        except Exception as exc:
            logger.warning(
                "IdentityAgent[Ollama]: error: %s. "
                "Falling through to enriched rule tier.", exc,
            )
            return None

    # ─────────────────────────────────────────────────────────────────────────
    # Tier 3 — Enriched rule-based
    # ─────────────────────────────────────────────────────────────────────────

    def _enriched_rules(
        self,
        identity_data: dict[str, Any],
        message_text: str,
        start: float,
    ) -> dict[str, Any]:
        """Rule-based fallback using BOTH profile metadata AND message content.

        Significantly stronger than the old mock_verify because it cross-checks
        the message for scam signals that correlate with weak profiles.
        """
        identity_risk = 0.0
        anomalies: list[str] = []
        confidence = 0.90

        age      = identity_data.get("account_age_days")
        reviews  = identity_data.get("reviews")
        verified = identity_data.get("verified", True)
        bio: str = identity_data.get("bio", "") or ""
        msg      = message_text.lower()

        # ── Profile rules ─────────────────────────────────────────────────────
        if age is not None:
            if age < 3:
                anomalies.append("Account is less than 3 days old")
                identity_risk = max(identity_risk, 85.0)
            elif age < 7:
                anomalies.append("Account is less than 7 days old")
                identity_risk = max(identity_risk, 70.0)
            elif age < 30:
                anomalies.append("Account is less than 30 days old")
                identity_risk = max(identity_risk, 40.0)

        if reviews is not None and reviews == 0:
            anomalies.append("No completed reviews on profile")
            identity_risk = max(identity_risk, 35.0)

        if not verified:
            anomalies.append("Account is not platform-verified")
            identity_risk = max(identity_risk, 25.0)

        if not bio.strip():
            anomalies.append("Empty profile bio")
            identity_risk = max(identity_risk, 15.0)

        # Compound penalty: new + no reviews + unverified
        if age is not None and age < 14 and reviews == 0 and not verified:
            identity_risk = min(100.0, identity_risk + 20.0)
            anomalies.append("Compound risk: new account, no reviews, no verification")

        # ── Message content signals (new in enriched tier) ────────────────────
        # These raise identity risk when the message content matches patterns
        # that are highly correlated with fake / scam accounts.

        _TOO_GOOD = [
            "extremely high pay", "very high pay", "big budget", "huge project",
            "highest pay", "willing to pay more", "pay you extra",
            "long term work", "ongoing project", "i have lots of work",
            "i can offer", "generous payment",
        ]
        if any(p in msg for p in _TOO_GOOD):
            anomalies.append("Message contains 'too good to be true' payment lure")
            identity_risk = min(100.0, identity_risk + 15.0)

        _OFF_PLATFORM = [
            "telegram", "whatsapp", "signal", "discord",
            "outside the platform", "outside fiverr", "outside upwork",
            "contact me directly", "reach me on", "email me at",
            "my personal email",
        ]
        if any(p in msg for p in _OFF_PLATFORM):
            anomalies.append("Message requests off-platform communication")
            identity_risk = min(100.0, identity_risk + 20.0)

        _PAYMENT_BYPASS = [
            "paypal", "crypto", "bitcoin", "western union", "gift card",
            "wire transfer", "bank transfer", "avoid fees", "skip the contract",
            "direct payment", "outside escrow",
        ]
        if any(p in msg for p in _PAYMENT_BYPASS):
            anomalies.append("Message contains off-platform payment bypass attempt")
            identity_risk = min(100.0, identity_risk + 25.0)

        _URGENCY = [
            "respond immediately", "reply asap", "urgent", "right now",
            "time sensitive", "expires soon", "last chance", "only today",
            "respond within", "must start today",
        ]
        if any(p in msg for p in _URGENCY):
            anomalies.append("Message uses artificial urgency pressure")
            identity_risk = min(100.0, identity_risk + 10.0)

        _CREDENTIAL = [
            "verify your account", "your account is suspended",
            "login to confirm", "send your credentials", "share your password",
            "billing verification", "fiverr support", "upwork support",
        ]
        if any(p in msg for p in _CREDENTIAL):
            anomalies.append("Message contains credential/phishing attempt")
            identity_risk = min(100.0, identity_risk + 35.0)

        if not anomalies:
            confidence = 1.0

        identity_risk, confidence = _clamp_score(identity_risk, confidence)

        latency = time.perf_counter() - start
        logger.info(
            "IdentityAgent[Rules]: identity_risk=%.1f, anomalies=%d, latency=%.4fs",
            identity_risk, len(anomalies), latency,
        )

        return {
            "verified":      identity_risk < 40,
            "identity_risk": identity_risk,
            "anomalies":     anomalies,
            "confidence":    confidence,
            "tier_used":     "rules",
        }

    # ─────────────────────────────────────────────────────────────────────────
    # Shared helpers
    # ─────────────────────────────────────────────────────────────────────────

    def _build_prompt(
        self,
        identity_data: dict[str, Any],
        message_text: str = "",
    ) -> str:
        profile_str = json.dumps(identity_data, indent=2)
        msg_section = (
            f"\n\nThe client sent this message (use it as additional context):\n{message_text[:800]}"
            if message_text.strip()
            else ""
        )
        return (
            "You are an identity fraud analyst for freelance platforms (Fiverr, Upwork).\n\n"
            "Analyse the following client profile metadata and assess its legitimacy:"
            f"\n\n{profile_str}{msg_section}\n\n"
            "Respond with ONLY a valid JSON object — no markdown, no explanation:\n"
            "{\n"
            '  "identity_risk": <integer 0-100>,\n'
            '  "anomalies": [<concise strings for each red flag>],\n'
            '  "confidence": <float 0.0-1.0>\n'
            "}\n\n"
            "Scoring: 0–29 legitimate, 30–59 moderate risk, 60–79 high risk, 80–100 extremely suspicious.\n"
            "Key signals: account_age_days < 7 → high risk; reviews == 0 AND age < 30 → medium risk; "
            "unverified + new + no reviews → compound penalty; "
            "message contains payment lures or off-platform requests → raise risk."
        )

    def _parse_llm_response(self, raw: str) -> dict[str, Any]:
        """Robustly extract JSON from an LLM response, stripping markdown fences."""
        # Strip <think>...</think> blocks from DeepSeek-R1 responses
        raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()

        # Strip markdown fences (```json ... ```)
        if raw.startswith("```"):
            raw = re.sub(r"^```[a-z]*\n?", "", raw, flags=re.MULTILINE)
            raw = re.sub(r"\n?```$", "", raw.strip())
        raw = raw.strip()

        # Extract first { ... } block if extra prose is present
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            raw = match.group(0)

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            logger.warning("IdentityAgent: JSON parse failed (%s). Raw: %.200s", exc, raw)
            raise

        identity_risk = float(parsed.get("identity_risk", 0.0))
        anomalies     = parsed.get("anomalies", [])
        confidence    = float(parsed.get("confidence", 1.0))

        # Clamp to valid ranges — LLMs occasionally return out-of-range values
        identity_risk, confidence = _clamp_score(identity_risk, confidence)

        return {
            "verified":      identity_risk < 40,
            "identity_risk": identity_risk,
            "anomalies":     anomalies,
            "confidence":    confidence,
        }
