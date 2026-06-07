"""Payload analysis agent for detecting malicious content."""
import sys
import json
import logging
from pathlib import Path
from typing import Dict, Any, Union

from ._crewai_stub import Agent  # TODO: replace with `from crewai import Agent` once crewai-core is on PyPI

_ML_PIPELINE_DIR = Path(__file__).resolve().parent.parent.parent / "ml-pipeline"
if str(_ML_PIPELINE_DIR) not in sys.path:
    sys.path.insert(0, str(_ML_PIPELINE_DIR))

try:
    from ollama_client import OllamaClient
    _OLLAMA_AVAILABLE = True
except ImportError:
    _OLLAMA_AVAILABLE = False

logger = logging.getLogger(__name__)


class PayloadAgent:
    """Analyzes payloads for malicious content."""
    
    def __init__(self) -> None:
        self.agent = Agent(
            role="Payload Analyst",
            goal="Detect malicious payloads, suspicious attachments, and dangerous links",
            backstory="Expert in reverse engineering, sandbox analysis, malware detection, and signature matching.",
            verbose=True,
            allow_delegation=False
        )
        self.client = OllamaClient() if _OLLAMA_AVAILABLE else None

    def analyze(self, payload_context: Union[bytes, Dict[str, Any], str]) -> Dict[str, Any]:
        """Analyze payload for malicious content using local DeepSeek-R1."""
        if not payload_context:
            return self._safe_stub()

        payload_str = str(payload_context)

        # If Ollama is not installed or service is down, skip payload analysis safely
        if not self.client or not self.client.is_available():
            logger.warning("Ollama not available or not installed locally. Skipping payload analysis.")
            return self._safe_stub()

        system_prompt = (
            "You are a cybersecurity expert analyzing file payloads and metadata for malicious intent.\n"
            "Analyze the provided file name, hash, or metadata to detect:\n"
            "1. Suspicious file extensions (.exe, .scr, .bat, especially if inside a .zip or .rar).\n"
            "2. Signs of obfuscated code or known malware patterns.\n"
            "Return ONLY a raw JSON object matching exactly this schema:\n"
            "{\n"
            "  \"payload_risk\": <int 0-100>,\n"
            "  \"threats\": [<list of strings describing detected threats>],\n"
            "  \"confidence\": <float 0.0-1.0>\n"
            "}"
        )

        try:
            # DeepSeek-R1 inference with a 5-second effective timeout in the orchestrator, 
            # though OllamaClient might take longer if not bounded. We assume the orchestrator wraps this.
            response_text = self.client.generate(
                prompt=f"Payload to analyze:\n{payload_str}",
                system_prompt=system_prompt,
                temperature=0.0
            )

            # Strip markdown if model returns it
            response_text = response_text.strip()
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()

            parsed = json.loads(response_text)
            
            return {
                "payload_risk": float(parsed.get("payload_risk", 0.0)),
                "threats": parsed.get("threats", []),
                "confidence": float(parsed.get("confidence", 1.0))
            }

        except Exception as e:
            logger.error(f"PayloadAgent Ollama inference failed: {e}")
            return self._safe_stub()

    def _safe_stub(self) -> Dict[str, Any]:
        return {
            "payload_risk": 0.0,
            "threats": [],
            "confidence": 1.0
        }


