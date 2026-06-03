"""Unit tests for ShadowSense Week 2 Linguistic Analyst & Groq Integration."""
import pytest
import time
import logging
from backend.agents.linguistic import LinguisticAgent

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# 5 Example messages representing clear, suspicious, and scam categories
TEST_MESSAGES = [
    {
        "id": "clear_01",
        "category": "clear",
        "text": "Hi, I am looking for a React developer to help build a clean dashboard. I have the designs in Figma and a detailed project brief. Please let me know your availability and estimated rate.",
        "expect_scam": False
    },
    {
        "id": "suspicious_01",
        "category": "suspicious",
        "text": "Hi, I saw your profile. I want to discuss a project but I prefer talking on Telegram since I don't check this platform often. Message me at @freelance_test_99.",
        "expect_scam": True
    },
    {
        "id": "scam_phishing",
        "category": "scam",
        "text": "Hello, I can offer you the gig but I need you to purchase an Amazon gift card and send me the code first. I will reimburse you with the first milestone payment.",
        "expect_scam": True
    },
    {
        "id": "scam_urgency",
        "category": "scam",
        "text": "URGENT! You must click this link and verify your account in the next 15 minutes or your profile will be permanently deactivated. Act now: http://fiverr-secure-verify.com/login",
        "expect_scam": True
    },
    {
        "id": "scam_impersonation",
        "category": "scam",
        "text": "This is Fiverr Official Support. We have detected a violation of our terms of service on your account. To prevent immediate suspension, please send us your credentials and payment verification details.",
        "expect_scam": True
    }
]


def test_linguistic_agent_inference():
    """Verify that LinguisticAgent uses Groq to analyze the 5 test messages,

    returning correct keys and keeping latency under 2.0 seconds.
    """
    agent = LinguisticAgent()
    
    # Ensure Groq is initialized (not running in mock mode)
    assert not agent.is_mock, "LinguisticAgent is running in mock mode. Groq API must be live for this test."
    
    for case in TEST_MESSAGES:
        logger.info(f"Testing message {case['id']} ({case['category']})")
        
        start_time = time.perf_counter()
        result = agent.analyze(case["text"])
        latency = time.perf_counter() - start_time
        
        # Log latency
        logger.info(f"Inference latency for {case['id']}: {latency:.4f} seconds")
        print(f"Inference latency for {case['id']}: {latency:.4f} seconds")
        
        # 1. Assert latency is under 2 seconds
        assert latency < 2.0, f"Latency of {latency:.4f}s exceeded the 2.0 seconds requirement!"
        
        # 2. Assert correct structured JSON keys are present (compat format)
        assert "urgency_score" in result
        assert "red_flags" in result
        assert "confidence" in result
        assert "patterns" in result
        
        # 3. Assert values are within proper ranges
        assert 0.0 <= result["urgency_score"] <= 100.0
        assert isinstance(result["red_flags"], list)
        assert 0.0 <= result["confidence"] <= 1.0
        
        # 4. Assert logical correctness of analysis
        if case["expect_scam"]:
            assert result["urgency_score"] >= 40.0, f"Expected higher urgency score for scam/suspicious: {result['urgency_score']}"
            assert len(result["red_flags"]) > 0, "Expected at least one red flag for scam/suspicious message"
        else:
            assert result["urgency_score"] < 40.0, f"Expected lower urgency score for safe message: {result['urgency_score']}"
