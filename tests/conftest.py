"""pytest configuration and fixtures."""
import pytest
import asyncio
import requests


@pytest.fixture
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(autouse=True)
def mock_ollama_offline(monkeypatch):
    """Automatically mock Ollama requests to fail by default in unit tests.

    This prevents tests from hitting a live local Ollama service, ensuring
    consistent mock behavior and preventing test slowness from socket timeouts.
    """
    original_get = requests.get
    original_post = requests.post

    def mocked_get(url, *args, **kwargs):
        if "11434" in str(url):
            raise requests.exceptions.ConnectionError("Ollama mocked offline")
        return original_get(url, *args, **kwargs)

    def mocked_post(url, *args, **kwargs):
        if "11434" in str(url):
            raise requests.exceptions.ConnectionError("Ollama mocked offline")
        return original_post(url, *args, **kwargs)

    monkeypatch.setattr(requests, "get", mocked_get)
    monkeypatch.setattr(requests, "post", mocked_post)

