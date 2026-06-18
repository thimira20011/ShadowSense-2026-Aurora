import sys
from pathlib import Path

# Ensure backend and root are in path
root = Path(__file__).resolve().parent.parent
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

_ML_PIPELINE_DIR = root / "ml-pipeline"
if str(_ML_PIPELINE_DIR) not in sys.path:
    sys.path.insert(0, str(_ML_PIPELINE_DIR))

from backend.agents.linguistic import LinguisticAgent
from backend.agents.identity import IdentityAgent

print("=== Testing LinguisticAgent (Groq / Gemini fallback) ===")
lang_agent = LinguisticAgent()
print(f"LinguisticAgent is_mock: {lang_agent.is_mock}")
try:
    # Test real API connection
    result = lang_agent.analyze("Please add me on Telegram at @scammerXYZ immediately for payment.")
    print("LinguisticAgent result:")
    print(result)
except Exception as e:
    print(f"LinguisticAgent analysis failed: {e}")

print("\n=== Testing IdentityAgent (Gemini / Ollama fallback) ===")
ident_agent = IdentityAgent()
print(f"IdentityAgent is_mock: {ident_agent.is_mock}")
try:
    # Test real API connection
    result = ident_agent.verify({
        "account_age_days": 2,
        "reviews": 0,
        "verified": False,
        "bio": "New user"
    }, message_text="Hello, please pay me via Paypal friends and family.")
    print("IdentityAgent result:")
    print(result)
except Exception as e:
    print(f"IdentityAgent verification failed: {e}")
