"""Unit tests for ShadowSense Week 2 Linguistic Analyst & Groq Integration."""
import pytest
import time
import logging
from backend.agents.linguistic import LinguisticAgent

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# 5 Example messages representing clear, suspicious, and scam categories from docs/scam-research.md
TEST_MESSAGES = [
    {
        "id": "clear_01",
        "category": "clear",
        "text": "Hi, I have a project to build a simple portfolio site using HTML/CSS. Here is the brief. Let me know if you can do it.",
        "expect_scam": False
    },
    {
        "id": "suspicious_unpaid_trial",
        "category": "suspicious",
        "text": "As a test of your skills, please write a 1,500-word article on this topic. If it is good, we will hire you.",
        "expect_scam": True
    },
    {
        "id": "suspicious_avoidance",
        "category": "suspicious",
        "text": "Let's skip the official contract for this phase. I will pay you via direct transfer upon completion.",
        "expect_scam": True
    },
    {
        "id": "scam_luring",
        "category": "scam",
        "text": "Please add me on Telegram at @username so we can discuss the project details and get started immediately.",
        "expect_scam": True
    },
    {
        "id": "scam_phishing",
        "category": "scam",
        "text": "Your Fiverr order is ready, but you need to verify your billing information before receiving it. Click here: fiverr-payment-verify.xyz",
        "expect_scam": True
    }
]


def test_linguistic_agent_inference():
    """Verify that LinguisticAgent uses Groq to analyze the 5 test messages,

    returning correct keys and keeping latency under 2.0 seconds.
    """
    agent = LinguisticAgent()
    
    if agent.is_mock:
        logger.warning("LinguisticAgent is running in mock mode for this test (missing GROQ_API_KEY).")
        print("LinguisticAgent is running in mock mode for this test (missing GROQ_API_KEY).")
    
    latencies = []
    for case in TEST_MESSAGES:
        logger.info(f"Testing message {case['id']} ({case['category']})")
        
        start_time = time.perf_counter()
        result = agent.analyze(case["text"])
        latency = time.perf_counter() - start_time
        latencies.append(latency)
        
        # Log latency
        logger.info(f"Inference latency for {case['id']}: {latency:.4f} seconds")
        print(f"Inference latency for {case['id']}: {latency:.4f} seconds")
        
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

    # 1. Assert average latency is under 2.0 seconds and no single request took over 3.5 seconds
    avg_latency = sum(latencies) / len(latencies)
    logger.info(f"Average inference latency: {avg_latency:.4f} seconds")
    print(f"Average inference latency: {avg_latency:.4f} seconds")
    assert avg_latency < 2.0, f"Average latency of {avg_latency:.4f}s exceeded the 2.0 seconds requirement!"
    for idx, lat in enumerate(latencies):
        assert lat < 3.5, f"Request {idx+1} experienced an excessive latency spike of {lat:.4f}s"
