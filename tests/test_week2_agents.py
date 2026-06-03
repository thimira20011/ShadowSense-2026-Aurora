#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys, io
# Reconfigure stdout/stderr to UTF-8 so box-drawing chars render on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
"""
Week 2 Test Script — Member 1: AI Backend Lead
================================================
Tests the Linguistic Analyst (Groq/llama-4-scout) and Identity Profiler
(Gemini Flash-Lite) against 5 representative messages drawn from the
research scenarios.  Also exercises the Shield's weighted Trust Score.

Run from repo root:
    python -m tests.test_week2_agents

Requirements:
    - GROQ_API_KEY and GEMINI_API_KEY must be set in backend/.env
    - Backend venv active (cd backend && .\\venv\\Scripts\\activate)
"""

import sys
import time
import json
import logging
from typing import Dict, Any

# Ensure the repo root is on the path when running as a module
import pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("week2_test")


# ──────────────────────────────────────────────────────────────────────────────
# 5 Representative test messages (from research doc scenarios)
# ──────────────────────────────────────────────────────────────────────────────

TEST_CASES = [
    # 1. Clear scam — gift-card payment lure
    {
        "id":          "T01_gift_card_scam",
        "description": "Off-platform payment via gift card",
        "text": (
            "Hi, I can offer you the gig but I need payment via gift card first. "
            "The platform fees are too high. Only gift card — PayPal and bank transfers "
            "are not available currently."
        ),
        "profile": {
            "account_age_days": 3,
            "reviews": 0,
            "verified": False,
            "bio": "",
        },
        "expected_level": "HIGH_RISK",
    },
    # 2. Urgency manipulation
    {
        "id":          "T02_urgency_pressure",
        "description": "Artificial urgency / high-pressure deadline",
        "text": (
            "I need this done in 30 minutes or the deal is off. "
            "HURRY UP — my client is waiting RIGHT NOW and there is NO time to waste. "
            "If you can't deliver in 30 minutes just say it."
        ),
        "profile": {
            "account_age_days": 5,
            "reviews": 0,
            "verified": False,
        },
        "expected_level": "HIGH_RISK",
    },
    # 3. Impersonation (Fiverr support)
    {
        "id":          "T03_fiverr_impersonation",
        "description": "Claims to be Fiverr support, requests credentials",
        "text": (
            "This is Fiverr Security Support. Your account has been flagged for "
            "suspicious activity and may be deactivated unless you verify your billing "
            "information at fiverr-payment-verify.com within 24 hours."
        ),
        "profile": {
            "account_age_days": 2,
            "reviews": 0,
            "verified": False,
            "bio": "Official Fiverr Support Team",
        },
        "expected_level": "HIGH_RISK",
    },
    # 4. Borderline / unpaid trial trap
    {
        "id":          "T04_unpaid_trial",
        "description": "Requests unpaid test task before hiring",
        "text": (
            "Before I hire you, I need a test of your skills. "
            "Please write a 1,500-word SEO article on 'best AI tools 2025' — "
            "this will be used only internally for evaluation purposes."
        ),
        "profile": {
            "account_age_days": 14,
            "reviews": 1,
            "verified": False,
        },
        "expected_level": "ADVISORY",
    },
    # 5. Legitimate conversation (control — should score CLEAR)
    {
        "id":          "T05_legitimate",
        "description": "Genuine project enquiry — control case",
        "text": (
            "Hi! I came across your profile and I'm impressed by your portfolio. "
            "I'm looking for a logo redesign for my small bakery business. "
            "My budget is around $150–$200. Would you be interested? "
            "Happy to share the brand brief through the platform."
        ),
        "profile": {
            "account_age_days": 365,
            "reviews": 48,
            "verified": True,
            "bio": "Small business owner, passionate about artisan bread and pastries.",
        },
        "expected_level": "CLEAR",
    },
]


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

PASS  = "[PASS]"
FAIL  = "[FAIL]"
WARN  = "[WARN]"
SEP   = "-" * 70


def _fmt_json(obj: Any) -> str:
    return json.dumps(obj, indent=2, ensure_ascii=False)


def run_tests() -> None:
    from backend.agents.linguistic import LinguisticAgent
    from backend.agents.identity   import IdentityAgent
    from backend.agents.shield     import ShieldAgent

    print("\n" + "=" * 70)
    print("  ShadowSense Aurora -- Week 2 Agent Integration Tests")
    print("=" * 70)

    linguistic_agent = LinguisticAgent()
    identity_agent   = IdentityAgent()
    shield_agent     = ShieldAgent()

    results = []

    for case in TEST_CASES:
        print(f"\n{SEP}")
        print(f"  [{case['id']}] {case['description']}")
        print(SEP)

        # ── Linguistic analysis ──────────────────────────────────────
        t0 = time.perf_counter()
        ling = linguistic_agent.analyze(case["text"])
        ling_latency = time.perf_counter() - t0

        print(f"\n  [Linguistic Analysis]  (latency: {ling_latency:.3f}s)")
        print(f"      urgency_score : {ling['urgency_score']}")
        print(f"      red_flags     : {ling['red_flags']}")
        print(f"      confidence    : {ling['confidence']}")

        ling_ok = ling_latency < 2.0
        print(f"      Latency < 2s  : {PASS if ling_ok else WARN + f' ({ling_latency:.2f}s)'}")

        # ── Identity profiling ───────────────────────────────────────
        t0 = time.perf_counter()
        ident = identity_agent.verify(case.get("profile", {}))
        ident_latency = time.perf_counter() - t0

        print(f"\n  [Identity Profiling]   (latency: {ident_latency:.3f}s)")
        print(f"      identity_risk : {ident['identity_risk']}")
        print(f"      anomalies     : {ident['anomalies']}")
        print(f"      confidence    : {ident['confidence']}")
        print(f"      verified      : {ident['verified']}")

        # ── Shield / Trust Score ─────────────────────────────────────
        t0 = time.perf_counter()
        ctx = {
            "text":    case["text"],
            "context": case.get("profile", {}),
        }
        verdict = shield_agent.defend(ctx)
        shield_latency = time.perf_counter() - t0

        ts     = verdict["trust_score"]
        level  = ts["level"]
        score  = ts["score"]
        expected = case["expected_level"]

        level_ok  = (level == expected)
        status    = PASS if level_ok else FAIL

        print(f"\n  [Shield Trust Score]  (latency: {shield_latency:.3f}s)")
        print(f"      score         : {score}/100")
        print(f"      level         : {level}  (expected: {expected})  {status}")
        print(f"      explanation   : {ts['explanation']}")
        print(f"\n  Reasons:")
        for r in verdict["reasons"]:
            print(f"    • {r}")

        total_latency = ling_latency + ident_latency + shield_latency
        print(f"\n  Total pipeline latency: {total_latency:.3f}s")

        results.append({
            "id":            case["id"],
            "passed":        level_ok,
            "score":         score,
            "level":         level,
            "expected":      expected,
            "ling_latency":  round(ling_latency,  3),
            "ident_latency": round(ident_latency, 3),
            "total_latency": round(total_latency, 3),
        })

    # ── Summary ──────────────────────────────────────────────────────
    print(f"\n{'=' * 70}")
    print("  RESULTS SUMMARY")
    print("=" * 70)

    passed = sum(1 for r in results if r["passed"])
    total  = len(results)

    for r in results:
        icon = "[PASS]" if r["passed"] else "[FAIL]"
        print(
            f"  {icon} {r['id']:<35} score={r['score']:>3}  "
            f"level={r['level']:<10} latency={r['total_latency']:.3f}s"
        )

    print(f"\n  Passed: {passed}/{total}")
    avg_latency = sum(r["total_latency"] for r in results) / total
    print(f"  Average pipeline latency: {avg_latency:.3f}s  (target: <3.0s)")

    perf_ok = avg_latency < 3.0
    print(f"  Performance target met  : {PASS if perf_ok else WARN}")
    print("=" * 70 + "\n")

    # Non-zero exit if any test failed
    if passed < total:
        sys.exit(1)


if __name__ == "__main__":
    run_tests()
