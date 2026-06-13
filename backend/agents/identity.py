"""Identity verification agent — Google Gemini Flash-Lite implementation."""
import time
import json
import logging
from typing import Any

import threading
from google import genai
from google.genai import types as genai_types

from backend.config import GEMINI_API_KEYS
from ._crewai_stub import Agent  # TODO: replace with `from crewai import Agent` once crewai-core is on PyPI

logger = logging.getLogger(__name__)

# Model: Gemini 2.0 Flash (stable free tier, full model name for google-genai SDK)
_GEMINI_MODEL = "models/gemini-2.0-flash"


class IdentityAgent:
    """Analyses account profile metadata for identity anomalies and fraud signals.

    Accepts a profile metadata dict and returns a structured risk assessment.
    Runs real inference via Google Gemini Flash-Lite; falls back to rule-based
    mock mode when the API key is absent or invalid.
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

        self._lock = threading.Lock()
        self._index = 0
        self._clients = []
        self._keys = []

        for key in GEMINI_API_KEYS:
            if key and "placeholder" not in str(key).lower():
                self._clients.append(genai.Client(api_key=key))
                self._keys.append(key)

        # Expose a default api_key for backward compatibility
        self.api_key = self._keys[0] if self._keys else None

        if self._clients:
            self.is_mock = False
            logger.info("IdentityAgent initialised with %d Gemini clients, model: %s", len(self._clients), _GEMINI_MODEL)
        else:
            self.is_mock = True
            logger.warning(
                "No valid GEMINI_API_KEYS configured. Running IdentityAgent in mock mode."
            )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def verify(self, identity_data: dict[str, Any]) -> dict[str, Any]:
        """Verify a profile's identity and return a risk assessment.

        Args:
            identity_data: A dict with any combination of:
                - account_age_days  (int)   — days since account creation
                - reviews           (int)   — number of completed reviews
                - verified          (bool)  — platform-verified badge
                - username          (str)   — display name / handle
                - country           (str)   — stated country
                - bio               (str)   — profile bio text

        Returns:
            Dict with keys:
                - verified        (bool)    — True if profile looks legitimate
                - identity_risk   (float)   — 0–100 risk score
                - anomalies       (list)    — detected red-flag descriptions
                - confidence      (float)   — model confidence 0.0–1.0

        Edge-case handling (Week 4):
            - Empty dict / None  → moderate risk (30) returned immediately.
              An absent profile is itself a mild signal, never zero-risk.
        """
        start = time.perf_counter()

        # ── Guard: no profile data at all ───────────────────────────────────
        if not identity_data:
            logger.info("IdentityAgent: empty identity_data received — returning moderate risk.")
            return {
                "verified":      False,
                "identity_risk": 30.0,
                "anomalies":     ["No profile data provided — identity could not be assessed"],
                "confidence":    0.5,
            }

        if self.is_mock:
            result = self._mock_verify(identity_data)
            latency = time.perf_counter() - start
            logger.info("IdentityAgent latency (mock): %.4fs", latency)
            return result

        try:
            result = self._gemini_verify(identity_data)
            latency = time.perf_counter() - start
            logger.info(
                "IdentityAgent latency (Gemini %s): %.4fs", _GEMINI_MODEL, latency
            )
            logger.debug(
                "IdentityAgent latency: %.4fs (Model: %s)", latency, _GEMINI_MODEL
            )
        except Exception as exc:
            latency = time.perf_counter() - start
            logger.error(
                "Gemini API error: %s. Falling back to rule-based mock. Latency: %.4fs",
                exc, latency,
            )
            result = self._mock_verify(identity_data)

        return result

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _build_prompt(self, identity_data: dict[str, Any]) -> str:
        profile_str = json.dumps(identity_data, indent=2)
        return f"""You are an identity fraud analyst for freelance platforms (Fiverr, Upwork, etc.).

Analyse the following client profile metadata and assess its legitimacy:

{profile_str}

Respond with ONLY a valid JSON object — no markdown, no explanation — matching this schema exactly:
{{
  "identity_risk": <integer 0-100>,
  "anomalies": [<list of concise strings describing each detected red flag>],
  "confidence": <float 0.0-1.0>
}}

Scoring guide:
- 0–29   : Profile looks legitimate
- 30–59  : Moderate risk (e.g. very new account, no reviews)
- 60–79  : High risk (multiple red flags)
- 80–100 : Extremely suspicious (consistent with fake / bot account)

Key signals to evaluate:
- account_age_days < 7  → high risk
- reviews == 0 AND account_age_days < 30 → medium risk
- verified == false alongside other flags → raises risk
- Bio that is generic / copied / empty → small risk boost"""

    def _gemini_verify(self, identity_data: dict[str, Any]) -> dict[str, Any]:
        prompt = self._build_prompt(identity_data)

        # Select next client and log details
        with self._lock:
            current_idx = self._index
            client = self._clients[current_idx]
            key_info = self._keys[current_idx]
            self._index = (self._index + 1) % len(self._clients)

        masked_key = f"...{key_info[-6:]}" if len(key_info) > 6 else key_info
        logger.info(f"IdentityAgent: Using Gemini API Key index {current_idx} (masked: {masked_key})")

        response = client.models.generate_content(
            model=_GEMINI_MODEL,
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                temperature=0.0,
                response_mime_type="application/json",
            ),
        )

        raw = response.text.strip() if response.text else "{}"
        # Strip accidental markdown fences
        if raw.startswith("```"):
            lines = raw.splitlines()
            raw = "\n".join(
                line for line in lines if not line.strip().startswith("```")
            ).strip()

        parsed = json.loads(raw)

        identity_risk = float(parsed.get("identity_risk", 0.0))
        anomalies = parsed.get("anomalies", [])
        confidence = float(parsed.get("confidence", 1.0))

        return {
            "verified":      identity_risk < 40,
            "identity_risk": identity_risk,
            "anomalies":     anomalies,
            "confidence":    confidence,
        }

    def _mock_verify(self, identity_data: dict[str, Any]) -> dict[str, Any]:
        """Rule-based fallback that mirrors the Gemini response schema."""
        identity_risk = 0.0
        anomalies: list = []
        confidence = 0.90

        age      = identity_data.get("account_age_days")
        reviews  = identity_data.get("reviews")
        verified = identity_data.get("verified", True)
        bio: str = identity_data.get("bio", "") or ""

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

        # Compound penalty: new + no reviews + not verified
        if age is not None and age < 14 and reviews == 0 and not verified:
            identity_risk = min(100.0, identity_risk + 20.0)
            anomalies.append("Compound risk: new account, no reviews, no verification")

        if not anomalies:
            confidence = 1.0

        return {
            "verified":      identity_risk < 40,
            "identity_risk": identity_risk,
            "anomalies":     anomalies,
            "confidence":    confidence,
        }
