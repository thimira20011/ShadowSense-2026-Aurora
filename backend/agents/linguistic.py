"""Linguistic analysis agent for scam detection."""
import time
import json
import logging
from typing import Dict, Any, List
from groq import Groq
from backend.config import GROQ_API_KEY, GROQ_MODEL
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
        # Initialize Groq client
        # If API key is empty/placeholder, we run in mock mode
        self.api_key = GROQ_API_KEY
        self.model = GROQ_MODEL
        
        if self.api_key and "placeholder" not in self.api_key.lower():
            self.client = Groq(api_key=self.api_key)
            self.is_mock = False
        else:
            self.client = None
            self.is_mock = True
            logger.warning("GROQ_API_KEY is not configured. Running LinguisticAgent in mock mode.")
            
    def analyze(self, text: str) -> Dict[str, Any]:
        """Analyze text for linguistic red flags using Groq API."""
        start_time = time.perf_counter()
        
        if self.is_mock:
            # Fallback mock logic for testing/development when API key is missing
            result = self._mock_analyze(text)
            latency = time.perf_counter() - start_time
            logger.info(f"LinguisticAgent analyze latency (mock): {latency:.4f}s")
            return result

        system_prompt = (
            "You are a linguistic analysis security agent specialized in detecting freelance scams.\n"
            "Analyze the provided chat message for three key components:\n"
            "1. Urgency language: Artificial deadlines, high pressure, demanding quick actions (e.g. 'order now', 'hurry up').\n"
            "2. Grammatical inconsistencies: Broken grammar, non-standard spelling or capitalization, awkward phrasing atypical of a professional buyer.\n"
            "3. Emotional manipulation and luring: Guilt trips, false authority, FOMO, or directing the user off-platform (e.g. asking to discuss on Telegram, WhatsApp, Discord, or Email instead of Fiverr/Upwork).\n\n"
            "Your response must be a JSON object with this exact structure:\n"
            "{\n"
            "  \"urgency_score\": <int 0-100 representing the composite threat score. Scoring guide: 0-29 for completely safe, 30-59 for suspicious/borderline or off-platform luring, and 60-100 for high-pressure scams, phishing, or financial fraud. Note: Off-platform luring to Telegram/WhatsApp/etc. must be scored at least 50.>,\n"
            "  \"red_flags\": [<list of detected red flags like \"Artificial Urgency\", \"Grammatical anomalies\", \"Off-platform luring\", \"Emotional manipulation\">],\n"
            "  \"confidence\": <float 0.0-1.0 representing your confidence in the detection>\n"
            "}\n"
            "Provide ONLY the raw JSON object. Do not include any text outside the JSON object."
        )

        try:
            chat_completion = self.client.chat.completions.create(
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
        if any(w in text_lower for w in ["support", "suspension", "credentials", "verify your account", "deactivated"]):
            red_flags.append("Suspicious authority / credential request")
            urgency_score = max(urgency_score, 90)

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
