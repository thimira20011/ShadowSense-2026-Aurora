"""Unit tests for ShadowSense Week 4 pre-engagement analysis enhancements."""
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.agents.job_risk import analyze_job_listing


def test_analyze_job_listing_function():
    """Verify that the standalone analyze_job_listing function works correctly.

    It should score the job listing and return a dictionary matching PreEngageResponse structure.
    """
    # Test with standard/safe text
    safe_text = "Website Redesign\nI need someone to redesign my portfolio website. Standard HTML/CSS/JS only."
    res = analyze_job_listing(safe_text, client_profile={"reviews": 10, "verified": True})
    
    assert "pre_engage_score" in res
    assert "verdict" in res
    assert "confidence" in res
    assert "red_flags" in res
    assert "platform" in res
    assert "job_url" in res
    
    # Safe listing should score high (>= 70)
    assert res["pre_engage_score"] >= 70
    assert res["verdict"] == "VERIFIED_SAFE"

    # Test with malicious/scam indicators (telegram redirection + pay offline)
    scam_text = "Urgent Help Needed\nContact me on Telegram @scammer immediately. We pay outside the platform via Western Union."
    res_scam = analyze_job_listing(scam_text, client_profile={"reviews": 0, "verified": False})
    
    assert res_scam["pre_engage_score"] < 70
    assert res_scam["verdict"] in ("MODERATE_RISK", "HIGH_RISK")
    assert len(res_scam["red_flags"]) > 0


def test_quick_endpoint():
    """Verify that the /api/pre-engage/quick POST endpoint functions correctly and returns PreEngageResponse."""
    client = TestClient(app)
    
    payload = {
        "job_text": "Need WordPress developer.\nWe need help setting up our blog site.",
        "client_profile": {
            "reviews": 5,
            "verified": True
        }
    }
    
    response = client.post("/api/pre-engage/quick", json=payload)
    assert response.status_code == 200
    
    json_data = response.json()
    assert "pre_engage_score" in json_data
    assert json_data["verdict"] == "VERIFIED_SAFE"
    assert json_data["pre_engage_score"] >= 70

    # Test bad request validation
    invalid_payload = {
        "job_text": "   ",
        "client_profile": {}
    }
    response_invalid = client.post("/api/pre-engage/quick", json=invalid_payload)
    assert response_invalid.status_code == 422


def test_new_scenarios_validation():
    """Verify that scenarios 28, 29, and 30 are correctly structured and exist."""
    import json
    import pathlib
    
    repo_root = pathlib.Path(__file__).resolve().parent.parent.parent
    scenarios_dir = repo_root / "tests" / "test_scenarios"
    
    new_scenarios = [
        "scenario_28_job_board_crypto.json",
        "scenario_29_fake_contractor.json",
        "scenario_30_legitimate_question.json"
    ]
    
    for filename in new_scenarios:
        filepath = scenarios_dir / filename
        assert filepath.exists(), f"{filename} does not exist!"
        
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        assert "scenario_id" in data
        assert "name" in data
        assert "description" in data
        assert "expected_threat_level" in data
        assert "expected_trust_score_range" in data
        assert "expected_intervention" in data
        
        # Check expected score range logic
        score_range = data["expected_trust_score_range"]
        assert "min" in score_range
        assert "max" in score_range
        assert 0 <= score_range["min"] <= score_range["max"] <= 100

