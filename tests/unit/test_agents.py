"""Unit tests for individual components."""
import pytest
from backend.agents.linguistic import LinguisticAgent
from backend.agents.identity import IdentityAgent
from backend.agents.payload import PayloadAgent


class TestLinguisticAgent:
    """Tests for linguistic analysis agent."""
    
    def test_agent_initialization(self):
        """Test agent can be initialized."""
        agent = LinguisticAgent()
        assert agent.agent is not None
    
    def test_text_analysis(self):
        """Test text analysis function."""
        agent = LinguisticAgent()
        result = agent.analyze("suspicious text")
        assert "patterns" in result
        assert "confidence" in result


class TestIdentityAgent:
    """Tests for identity verification agent."""
    
    def test_agent_initialization(self):
        """Test agent can be initialized."""
        agent = IdentityAgent()
        assert agent.agent is not None
    
    def test_identity_verification(self):
        """Test identity verification function."""
        agent = IdentityAgent()
        result = agent.verify({"name": "test", "email": "test@example.com"})
        assert "verified" in result
        assert "confidence" in result


class TestPayloadAgent:
    """Tests for payload analysis agent."""
    
    def test_agent_initialization(self):
        """Test agent can be initialized."""
        agent = PayloadAgent()
        assert agent.agent is not None
    
    def test_payload_analysis(self):
        """Test payload analysis function."""
        agent = PayloadAgent()
        test_payload = b"test payload content"
        result = agent.analyze(test_payload)
        assert "threat_level" in result
        assert "confidence" in result
