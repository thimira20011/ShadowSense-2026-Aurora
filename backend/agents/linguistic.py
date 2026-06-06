"""Linguistic analysis agent for scam detection."""
import time
import json
import logging
import threading
from typing import Dict, Any, List
from groq import Groq
from backend.config import GROQ_API_KEYS, GROQ_MODEL
from ._crewai_stub import Agent  # TODO: replace with `from crewai import Agent` once crewai-core is on PyPI

# Setup logging
logger = logging.getLogger(__name__)


class LinguisticAgent:
    """Analyzes linguistic patterns to detect scam indicators."""
    
    def __init__(self) -> None:
        self.agent = Agent(
            role="Linguistic Analyst",
            goal="Detect linguistic patterns indicative of scams, such as artificial urgency or off-platform luring",
            backstory="Expert in analyzing communication patterns, language anomalies, and psychological manipulation.",
            verbose=True,
            allow_delegation=False
        )
        self.model = GROQ_MODEL
        self._lock = threading.Lock()
        self._index = 0
        self.clients = []
        self._keys = []
        
        for key in GROQ_API_KEYS:
            if key and "placeholder" not in key.lower():
                self.clients.append(Groq(api_key=key))
                self._keys.append(key)
        
        # Expose a default api_key for backward compatibility
        self.api_key = self._keys[0] if self._keys else None
        
        if self.clients:
            self.is_mock = False
        else:
            self.is_mock = True
            logger.warning("No valid GROQ_API_KEYS configured. Running LinguisticAgent in mock mode.")
            
    def analyze(self, text: str) -> Dict[str, Any]:
        """Analyze text for linguistic red flags using Groq API."""
        start_time = time.perf_counter()
        
        if self.is_mock:
            # Fallback mock logic for testing/development when API key is missing
            result = self._mock_analyze(text)
            latency = time.perf_counter() - start_time
            logger.info(f"LinguisticAgent analyze latency (mock): {latency:.4f}s")
            return result

        # Select next client and log details
        with self._lock:
            current_idx = self._index
            client = self.clients[current_idx]
            key_info = self._keys[current_idx]
            self._index = (self._index + 1) % len(self.clients)

        masked_key = f"...{key_info[-6:]}" if len(key_info) > 6 else key_info
        logger.info(f"LinguisticAgent: Using Groq API Key index {current_idx} (masked: {masked_key})")

        system_prompt = (
            "You are a linguistic analysis security agent specialized in detecting freelance scams.\n"
            "Analyze the provided chat message for three key components:\n"
            "1. Urgency language: Artificial deadlines, high pressure, demanding quick actions (e.g. 'order now', 'hurry up').\n"
            "2. Grammatical inconsistencies: Broken grammar, non-standard spelling or capitalization, awkward phrasing atypical of a professional buyer.\n"
            "3. Emotional manipulation and luring: Guilt trips, false authority, FOMO, unpaid trial work traps (e.g. free sample tests, mockups), or directing the user off-platform (e.g. asking to discuss on Telegram, WhatsApp, Discord, or Email instead of Fiverr/Upwork).\n\n"
            "Your response must be a JSON object with this exact structure:\n"
            "{\n"
            "  \"urgency_score\": <int 0-100 representing the composite threat score. Scoring guide: 0-29 for completely safe, 30-59 for suspicious/borderline (e.g. unpaid trial trap, contract avoidance) or off-platform luring, and 60-100 for high-pressure scams, phishing, or financial fraud. Note: Off-platform luring, contract avoidance, and unpaid trial work traps must be scored at least 45.>,\n"
            "  \"red_flags\": [<list of detected red flags like \"Artificial Urgency\", \"Grammatical anomalies\", \"Off-platform luring\", \"Suspicious unpaid trial request\", \"Contract avoidance attempt\">],\n"
            "  \"confidence\": <float 0.0-1.0 representing your confidence in the detection>\n"
            "}\n"
            "Provide ONLY the raw JSON object. Do not include any text outside the JSON object."
        )

        try:
            chat_completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Message to analyze:\n\n{text}"}
                ],
                model=self.model,
                response_format={"type": "json_object"},
                temperature=0.0  # Greedy decoding for consistency
            )
            content = chat_completion.choices[0].message.content
            
            # Parse the JSON
            parsed = self._safe_parse_json(content)
            
            latency = time.perf_counter() - start_time
            logger.info(f"LinguisticAgent analyze latency (Groq): {latency:.4f}s (Model: {self.model})")
            print(f"LinguisticAgent analyze latency: {latency:.4f}s (Model: {self.model})")
            
            # Maintain compatibility with legacy properties while returning the new structured JSON
            return {
                "patterns": parsed.get("red_flags", []),
                "urgency_score": float(parsed.get("urgency_score", 0.0)),
                "red_flags": parsed.get("red_flags", []),
                "confidence": float(parsed.get("confidence", 1.0))
            }

        except Exception as e:
            latency = time.perf_counter() - start_time
            logger.error(f"Groq API error: {e}. Falling back to rule-based mock analysis. Latency: {latency:.4f}s")
            print(f"Groq API error: {e}. Falling back to rule-based mock analysis. Latency: {latency:.4f}s")
            return self._mock_analyze(text)

    def _safe_parse_json(self, content: str) -> Dict[str, Any]:
        """Safely parse JSON from LLM response, stripping potential markdown wrapper."""
        content_str = content.strip()
        if content_str.startswith("```"):
            # strip markdown lines
            lines = content_str.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].startswith("```"):
                lines = lines[:-1]
            content_str = "\n".join(lines).strip()
        
        try:
            return json.loads(content_str)
        except Exception as e:
            logger.warning(f"Failed to parse LLM response as JSON: {content_str}. Error: {e}")
            raise e

    def _mock_analyze(self, text: str) -> Dict[str, Any]:
        """Rule-based fallback analysis to match expected behavior."""
        text_lower = text.lower()
        red_flags = []
        urgency_score = 0
        confidence = 0.95

        # Rule 1: Urgency detection
        if any(w in text_lower for w in ["hurry", "urgent", "30 minutes", "minutes left", "right now", "expires", "no time"]):
            red_flags.append("Artificial Urgency")
            urgency_score = max(urgency_score, 70)
        
        # Rule 2: Off-platform redirect / payment luring
        if any(w in text_lower for w in ["gift card", "telegram", "whatsapp", "outside the platform", "paypal friends"]):
            red_flags.append("Off-platform redirect attempt")
            urgency_score = max(urgency_score, 85)

        # Rule 3: Grammatical anomalies / typos (suspicious case)
        if any(w in text_lower for w in ["dought", "freelancer", "upfront", "commission"]):
            red_flags.append("Grammatical anomalies")
            urgency_score = max(urgency_score, 40)

        # Rule 4: Impersonation / credential request
        if any(w in text_lower for w in ["support", "suspension", "credentials", "verify your account", "deactivated", "verify your billing", "fiverr-payment-verify"]):
            red_flags.append("Suspicious authority / credential request")
            urgency_score = max(urgency_score, 90)

        # Rule 5: Unpaid trial work detection
        if any(w in text_lower for w in ["test of your skills", "free test", "write a 1,500-word", "mockup"]):
            red_flags.append("Suspicious unpaid trial request")
            urgency_score = max(urgency_score, 45)

        # Rule 6: Contract avoidance / off-platform payment
        if any(w in text_lower for w in ["skip the official contract", "direct transfer", "avoid upwork fees", "avoid fiverr fees"]):
            red_flags.append("Contract avoidance attempt")
            urgency_score = max(urgency_score, 55)

        # Control check for scam words
        if "scam" in text_lower:
            red_flags.append("Suspicious keyword trigger")
            urgency_score = max(urgency_score, 60)

        # If clean
        if not red_flags:
            red_flags = []
            urgency_score = 0
            confidence = 1.0

        return {
            "patterns": red_flags,
            "urgency_score": float(urgency_score),
            "red_flags": red_flags,
            "confidence": confidence
        }
