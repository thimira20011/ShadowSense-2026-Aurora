"""Text embeddings generation for scam pattern vectorization."""
import os
import requests
from typing import List


class EmbeddingsGenerator:
    """Generates embeddings using Ollama."""
    
    def __init__(self, ollama_host: str = "http://localhost:11434"):
        self.ollama_host = ollama_host
        self.model = os.getenv("DEEPSEEK_MODEL", "deepseek-r1")
    
    def embed_text(self, text: str) -> List[float]:
        """Generate embedding for a single text."""
        response = requests.post(
            f"{self.ollama_host}/api/embed",
            json={"model": self.model, "input": text},
            timeout=30
        )
        response.raise_for_status()
        return response.json()["embeddings"][0]
    
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts."""
        return [self.embed_text(text) for text in texts]


if __name__ == "__main__":
    gen = EmbeddingsGenerator()
    test_embedding = gen.embed_text("This is a test scam message")
    print(f"Generated embedding of length: {len(test_embedding)}")
