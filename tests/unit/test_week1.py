"""Unit and integration tests for ShadowSense Week 1 Backend Scaffolding."""
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.agents.linguistic import LinguisticAgent
from backend.agents.identity import IdentityAgent
from backend.agents.payload import PayloadAgent
from backend.agents.shield import ShieldAgent
from backend.models import ChatMessage


client = TestClient(app)


def test_agent_instantiations():
    """Verify that all four agents can be successfully instantiated with CrewAI."""
    linguistic = LinguisticAgent()
    identity = IdentityAgent()
    payload = PayloadAgent()
    shield = ShieldAgent()
    
    assert linguistic.agent is not None
    assert identity.agent is not None
    assert payload.agent is not None
    assert shield.agent is not None


def test_linguistic_agent_stub():
    """Verify LinguisticAgent returns a structured dictionary in stub mode."""
    agent = LinguisticAgent()
    res = agent.analyze("Test message")
    assert "patterns" in res
    assert "urgency_score" in res
    assert "red_flags" in res
    assert "confidence" in res
    assert res["confidence"] == 1.0


def test_identity_agent_stub():
    """Verify IdentityAgent returns a structured dictionary in stub mode."""
    agent = IdentityAgent()
    res = agent.verify({"account_age_days": 10})
    assert "verified" in res
    assert "identity_risk" in res
    assert "anomalies" in res
    assert "confidence" in res


def test_payload_agent_stub():
    """Verify PayloadAgent returns a structured dictionary in stub mode."""
    agent = PayloadAgent()
    res = agent.analyze("test_file.zip")
    assert "threat_level" in res
    assert "payload_risk" in res
    assert "threats" in res
    assert "confidence" in res


def test_shield_agent_stub():
    """Verify ShieldAgent returns trust score 50 and explainable narrative in stub mode."""
    agent = ShieldAgent()
    res = agent.defend({"text": "Hello"})
    assert "trust_score" in res
    assert res["trust_score"]["score"] == 50
    assert "reasons" in res
    assert "suggested_responses" in res


def test_api_analyze_endpoint():
    """Verify that the FastAPI /api/analyze/ endpoint works and returns a trust score of 50."""
    # Test curl-compatible format
    response = client.post("/api/analyze/", json={"text": "Hello"})
    assert response.status_code == 200
    
    data = response.json()
    assert "trust_score" in data
    assert data["trust_score"] == 50
    
    # Verify the rich explainable narrative fields
    assert "verdict" in data
    assert "reasons" in data["verdict"]
    assert "suggested_responses" in data["verdict"]
    assert data["verdict"]["trust_score"]["score"] == 50
