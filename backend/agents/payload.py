"""Payload analysis agent for detecting malicious files and links.

This agent uses a locally-running Ollama instance (DeepSeek-R1) to inspect
file metadata, names, and hashes for signs of malicious content.  All
inference is performed locally — no file content is sent to a cloud API,
preserving user privacy.

Graceful degradation
--------------------
If Ollama is not installed or the service is offline, :meth:`PayloadAgent.analyze`
returns a zero-risk stub rather than failing the request.  The ShieldAgent
logs a warning and continues with the partial Trust Score from the Linguistic
and Identity agents.

Ollama setup (one-time)
-----------------------
::

    # Install Ollama: https://ollama.com
    ollama pull deepseek-r1:8b   # ~5 GB — use :14b if you have ≥ 16 GB VRAM
    ollama serve                  # starts the local inference server on :11434
"""
import sys
import json
import logging
from pathlib import Path
from typing import Any

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
    """Analyses file metadata and links for malicious content via local DeepSeek-R1.

    The agent accepts a filename, file hash, or URL string and asks
    DeepSeek-R1 to assess whether it exhibits known threat patterns:

    * Suspicious extensions (``.exe``, ``.scr``, ``.bat``) — especially
      when disguised inside a ``.zip`` or ``.rar`` archive.
    * Obfuscated code or shell-download patterns in script names.
    * Known malware filename conventions.

    Threat levels returned
    ----------------------
    ``LOW``      — No threat indicators (payload_risk: 0–25)
    ``MEDIUM``   — Mildly suspicious (payload_risk: 26–50)
    ``HIGH``     — Likely malicious (payload_risk: 51–75)
    ``CRITICAL`` — Strong malware signals (payload_risk: 76–100)
    """

    def __init__(self) -> None:
        self.agent = Agent(
            role="Payload Analyst",
            goal="Detect malicious payloads, suspicious attachments, and dangerous links",
            backstory=(
                "Expert in reverse engineering, sandbox analysis, malware detection, "
                "and file-signature matching for freelance platform threat intelligence."
            ),
            verbose=True,
            allow_delegation=False,
        )
        self.client = OllamaClient() if _OLLAMA_AVAILABLE else None
        if not self.client:
            logger.info(
                "PayloadAgent: Ollama not installed — running in safe-stub mode "
                "(payload analysis will be skipped, payload_risk=0)."
            )

    def analyze(self, payload_context: bytes | dict[str, Any] | str) -> dict[str, Any]:
        """Analyse a payload descriptor for malicious content.

        Args:
            payload_context: A filename string (e.g. ``"invoice.exe"``), a dict
                with keys such as ``filename``, ``hash``, ``size``, or raw bytes.
                An empty / falsy value triggers an immediate safe stub return.

        Returns:
            A dict with the following keys:

            * ``threat_level``  (str)   — ``"LOW"``, ``"MEDIUM"``, ``"HIGH"``, or ``"CRITICAL"``
            * ``payload_risk``  (float) — 0–100 composite risk score
            * ``threats``       (list)  — Human-readable threat descriptions
            * ``confidence``    (float) — Model confidence 0.0–1.0

        Note:
            If Ollama is not available or the inference call fails, this method
            returns :meth:`_safe_stub` (zero risk) and logs a warning.  The
            ShieldAgent's graceful-degradation logic will still produce a partial
            Trust Score from the remaining two agents.
        """
        if not payload_context:
            return self._safe_stub()

        payload_str = str(payload_context)

        # If Ollama is not installed or service is down, skip payload analysis safely
        if not self.client or not self.client.is_available():
            logger.warning(
                "PayloadAgent: Ollama not available or not installed locally. "
                "Skpping payload analysis (payload_risk=0)."
            )
            return self._safe_stub()

        system_prompt = (
            "You are a cybersecurity expert analyzing file payloads and metadata for malicious intent.\n"
            "Analyze the provided file name, hash, or metadata to detect:\n"
            "1. Suspicious file extensions (.exe, .scr, .bat, especially if inside a .zip or .rar).\n"
            "2. Signs of obfuscated code or known malware patterns.\n"
            "Return ONLY a raw JSON object matching exactly this schema:\n"
            "{\n"
            "  \"threat_level\": <string: LOW, MEDIUM, HIGH, CRITICAL>,\n"
            "  \"payload_risk\": <int 0-100>,\n"
            "  \"threats\": [<list of strings describing detected threats>],\n"
            "  \"confidence\": <float 0.0-1.0>\n"
            "}"
        )

        try:
            # DeepSeek-R1 local inference — ShieldAgent wraps this in a 5-second timeout
            response_text = self.client.generate(
                prompt=f"Payload to analyze:\n{payload_str}",
                system_prompt=system_prompt,
                temperature=0.0,
            )

            # Strip markdown fences if model returns them
            response_text = response_text.strip()
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()

            parsed = json.loads(response_text)

            return {
                "threat_level": parsed.get("threat_level", "UNKNOWN"),
                "payload_risk": float(parsed.get("payload_risk", 0.0)),
                "threats":      parsed.get("threats", []),
                "confidence":   float(parsed.get("confidence", 1.0)),
            }

        except Exception as exc:
            logger.error("PayloadAgent Ollama inference failed: %s", exc)
            return self._safe_stub()

    def _safe_stub(self) -> dict[str, Any]:
        """Return a zero-risk stub when Ollama is unavailable or payload is empty.

        The stub preserves the ShieldAgent's weighted scoring: a missing
        payload analysis contributes 0 risk rather than inflating the score.
        """
        return {
            "threat_level": "LOW",
            "payload_risk": 0.0,
            "threats":      [],
            "confidence":   1.0,
        }
