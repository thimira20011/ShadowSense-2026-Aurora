"""Ollama client wrapper for DeepSeek-R1 model."""
import os
import requests
from typing import Optional


class OllamaClient:
    """Wrapper for Ollama API with DeepSeek-R1."""
    
    def __init__(self, host: str = "http://localhost:11434"):
        self.host = host
        self.model = os.getenv("DEEPSEEK_MODEL", "deepseek-r1")
    
    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 1000,
    ) -> str:
        """Generate response using DeepSeek-R1."""
        payload = {
            "model": self.model,
            "prompt": prompt,
            "temperature": temperature,
            "stream": False,
        }
        
        if system_prompt:
            payload["system"] = system_prompt
        
        response = requests.post(
            f"{self.host}/api/generate",
            json=payload,
            timeout=60
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
