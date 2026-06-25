"""Ollama client wrapper — model-agnostic, defaults to llama3.2."""
import os
import requests
from typing import Optional


class OllamaClient:
    """Wrapper for the Ollama HTTP API.

    The model is resolved from environment variables in priority order:
    1. ``OLLAMA_MODEL``    — preferred new env var
    2. ``DEEPSEEK_MODEL`` — legacy env var (backward compat)
    3. ``"llama3.2"``      — built-in default (installed model)
    """

    def __init__(self, host: str = "http://localhost:11434"):
        self.host = host
        self.configured_model = os.getenv("OLLAMA_MODEL") or os.getenv("DEEPSEEK_MODEL") or "deepseek-r1"
        self.model = self.configured_model
        self._resolve_model()

    def _resolve_model(self) -> None:
        """Resolve the model dynamically based on what's installed in Ollama.

        If the configured model is not in the list of installed models returned by
        /api/tags, we try to fall back to:
        1. "llama3.2" (if installed)
        2. "deepseek-r1" (if installed)
        3. any model name containing "llama" or "deepseek"
        4. the first installed model
        5. original configured_model (fallback if tags query fails or list is empty)
        """
        try:
            response = requests.get(f"{self.host}/api/tags", timeout=2)
            if response.status_code == 200:
                data = response.json()
                models = [m.get("name") for m in data.get("models", []) if m.get("name")]
                if not models:
                    return

                # Check for exact match or base match without tag
                for m in models:
                    base_m = m.split(":")[0]
                    if m == self.configured_model or base_m == self.configured_model:
                        self.model = m
                        return

                # Common fallbacks in order of preference
                fallbacks = ["deepseek-r1", "deepseek"]
                for f in fallbacks:
                    for m in models:
                        base_m = m.split(":")[0]
                        if f in base_m or f in m:
                            self.model = m
                            return

                # If no matches, fallback to configured_model
                self.model = self.configured_model
        except Exception:
            pass

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.0,
        max_tokens: int = 1000,
        timeout: int = 60,
        seed: Optional[int] = None,
    ) -> str:
        """Generate a response from the configured Ollama model.

        Defaults:
            temperature=0.0  — deterministic output for security analysis.
            seed             — derived from prompt content hash when not provided,
                               so different inputs produce different deterministic
                               outputs. Pass an explicit seed to force a fixed result.
        """
        # Derive a stable, input-specific seed from the prompt content.
        # Using a constant seed=42 caused near-identical JSON outputs for different
        # inputs because DeepSeek-R1 can get "stuck" in the same generation path.
        if seed is None:
            h = 0x811c9dc5
            for ch in (prompt + (system_prompt or "")):
                h ^= ord(ch)
                h = (h * 0x01000193) & 0xFFFFFFFF
            seed = h & 0x7FFFFFFF  # keep positive, within int32

        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
                "seed": seed,
            },
        }

        if system_prompt:
            payload["system"] = system_prompt

        response = requests.post(
            f"{self.host}/api/generate",
            json=payload,
            timeout=timeout,
        )
        response.raise_for_status()
        return response.json()["response"]
    
    def is_available(self) -> bool:
        """Check if Ollama service is available."""
        try:
            response = requests.get(f"{self.host}/api/tags", timeout=5)
            return response.status_code == 200
        except:
            return False


if __name__ == "__main__":
    client = OllamaClient()
    if client.is_available():
        result = client.generate("What are common scam tactics?")
        print("Generated response:", result[:200])
    else:
        print("Ollama service not available")
