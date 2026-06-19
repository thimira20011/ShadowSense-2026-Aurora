"""
Score consistency verification — sends the same payload 3 times and
checks that all scores are within ±3 of each other.

Run with:  .venv\Scripts\python.exe scripts\verify_score_consistency.py
(requires backend to be running at localhost:8000)
"""
import json
import sys
import time
import urllib.request
import urllib.error

API_URL = "http://127.0.0.1:8000/api/analyze/"

TEST_PAYLOAD = {
    "text": "Hi, I need you to contact me on Telegram @fastcash_jobs immediately. "
            "We pay $50/hr but you need to respond in the next 30 minutes or we give the project to someone else.",
    "sender": "ClientXYZ",
    "timestamp": "2026-06-18T10:00:00Z",
    "context": {"account_age_days": 3, "reviews": 0, "verified": False},
}


def call_api() -> dict:
    data = json.dumps(TEST_PAYLOAD).encode()
    req = urllib.request.Request(
        API_URL,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read())


def main():
    scores = []
    tiers = []
    print("=" * 60)
    print("Score Consistency Verification — 3 runs, same payload")
    print("=" * 60)

    for i in range(3):
        print(f"\n▶ Run {i + 1}/3 …", flush=True)
        try:
            t0 = time.perf_counter()
            result = call_api()
            elapsed = time.perf_counter() - t0
            score = result["trust_score"]
            tiers_used = result.get("agent_details", {}).get("tiers_used", {})
            scores.append(score)
            tiers.append(tiers_used)
            print(f"  score={score}  tiers={tiers_used}  ({elapsed:.1f}s)")
        except urllib.error.URLError as e:
            print(f"  ❌ Connection failed: {e.reason}")
            print("     Is the backend running? (uvicorn backend.main:app)")
            sys.exit(1)
        except Exception as e:
            print(f"  ❌ Error: {e}")
            sys.exit(1)

    print("\n" + "=" * 60)
    print(f"Scores: {scores}")
    variance = max(scores) - min(scores)
    print(f"Variance: {variance} (max - min)")
    if variance <= 3:
        print("✅ PASS — score variance ≤ 3 points across all runs")
    elif variance <= 10:
        print("⚠️  ACCEPTABLE — variance ≤ 10 (likely different API tier fallback)")
        tier_sets = [frozenset(t.items()) for t in tiers]
        if len(set(tier_sets)) > 1:
            print("   Cause: different model tiers were used across runs:")
            for i, t in enumerate(tiers):
                print(f"     Run {i+1}: {t}")
    else:
        print("❌ FAIL — variance > 10, further investigation needed")
    print("=" * 60)


if __name__ == "__main__":
    main()
