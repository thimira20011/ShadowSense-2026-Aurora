import sys
import logging
from pathlib import Path

# Add project root to path so 'backend.config' imports work
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from backend.agents.shield import ShieldAgent

logging.basicConfig(level=logging.INFO)

def run_tests():
    agent = ShieldAgent()

    # Test 1: Normal context
    ctx1 = {
        "text": "Hello, I have a project for you. I will pay through Upwork.",
        "sender": "JohnDoe",
        "context": {
            "account_age_days": 300,
            "reviews": 50,
            "verified": True,
            "filename": "specs.txt"
        }
    }
    print("\n--- Test 1: Benign ---")
    res1 = agent.defend(ctx1)
    print("Test 1 Result:", res1["trust_score"])

    # Test 2: Scam context
    ctx2 = {
        "text": "Hurry up and contact me on Telegram or WhatsApp to avoid fees. We need you to write a 1,500-word free test right now.",
        "sender": "Scammer123",
        "context": {
            "account_age_days": 1,
            "reviews": 0,
            "verified": False,
            "filename": "malware.exe"
        }
    }
    print("\n--- Test 2: Scam Context ---")
    res2 = agent.defend(ctx2)
    print("Test 2 Result:", res2["trust_score"])

if __name__ == "__main__":
    run_tests()
