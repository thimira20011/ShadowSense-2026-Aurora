#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_chromadb_integration.py
============================
Week-2 Checkpoint — M1 Backend Lead
ChromaDB Semantic Similarity Integration Tests

Verifies:
  1. ChromaDB collection is seeded and accessible
  2. query_similar_scams() returns correctly typed results for known scam messages
  3. Embed + query latency is < 1 000 ms (target: sub-second per query)
  4. ShieldAgent.defend() calls ChromaDB and exposes similar_patterns
  5. JSONL query log is written to logs/chromadb_queries.jsonl

Run from repo root (with backend venv active):
    python -m tests.test_chromadb_integration

Or with pytest:
    pytest tests/test_chromadb_integration.py -v
"""

import sys
import time
import json
import logging
import pathlib

# ---------------------------------------------------------------------------
# Path setup — repo root must be on sys.path before any local imports
# ---------------------------------------------------------------------------
_REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

# ml-pipeline directory (hyphen in name — import via sys.path manipulation)
_ML_DIR = _REPO_ROOT / "ml-pipeline"
if str(_ML_DIR) not in sys.path:
    sys.path.insert(0, str(_ML_DIR))

# Reconfigure stdout/stderr to UTF-8 so non-ASCII chars render on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

logging.basicConfig(
    level=logging.WARNING,          # suppress INFO noise during tests
    format="%(levelname)s | %(name)s | %(message)s",
)
log = logging.getLogger("chromadb_integration_test")

# ---------------------------------------------------------------------------
# Test cases: (message, expected_top_type, min_similarity)
# Derived from seed_scams.json patterns in the persisted ChromaDB
# ---------------------------------------------------------------------------
RETRIEVAL_CASES = [
    {
        "id":             "R01_phishing_fiverr_verify",
        "message":        (
            "Your Fiverr account has been flagged. Click this link to verify "
            "or your account will be suspended within 24 hours."
        ),
        "expected_types": ["phishing", "impersonation"],
        "min_similarity": 0.50,
        "description":    "Account suspension phishing lure",
    },
    {
        "id":             "R02_off_platform_payment",
        "message":        (
            "I can complete this gig but please pay me via PayPal Friends and "
            "Family or gift card. Fiverr takes too much commission."
        ),
        # ChromaDB seed variant may label this differently; accept any payment-related type
        "expected_types": ["phishing", "payment_scam", "low_ball_bait", "off_platform_payment"],
        "min_similarity": 0.35,
        "description":    "Off-platform payment request",
    },
    {
        "id":             "R03_malware_executable",
        "message":        (
            "The deliverables are in the ZIP archive. Please run setup.exe "
            "to activate the demo licence and preview the project."
        ),
        "expected_types": ["malware"],
        "min_similarity": 0.30,
        "description":    "Malicious executable disguised as deliverable",
    },
    {
        "id":             "R04_impersonation_support",
        "message":        (
            "This is Fiverr Trust and Safety. We detected a security issue. "
            "Send us your login credentials through this form immediately."
        ),
        "expected_types": ["impersonation", "phishing"],
        "min_similarity": 0.40,
        "description":    "Support team impersonation",
    },
    {
        "id":             "R05_legitimate_control",
        "message":        (
            "Hi! I loved your portfolio. I need a logo for my bakery. "
            "Budget is $150-$200. Can we discuss through the platform?"
        ),
        "expected_types": None,   # no type assertion -- just check it runs
        "min_similarity": 0.0,
        "description":    "Legitimate enquiry -- control case",
    },
]

# Latency target (milliseconds) — embedding + ChromaDB query
_LATENCY_TARGET_MS = 1000.0

PASS = "[PASS]"
FAIL = "[FAIL]"
WARN = "[WARN]"
SKIP = "[SKIP]"
SEP  = "-" * 72


# ===========================================================================
# Helpers
# ===========================================================================

def _import_query() -> object:
    """Import query_similar_scams from ml-pipeline; skip tests if unavailable."""
    try:
        from embeddings import query_similar_scams
        return query_similar_scams
    except ImportError as exc:
        log.error("Cannot import query_similar_scams: %s", exc)
        return None


def _check_db_seeded(query_fn) -> int:
    """Return document count from ChromaDB scam_patterns collection."""
    try:
        import chromadb
        from chromadb.config import Settings
        db_path = _REPO_ROOT / "data" / "chromadb"
        client = chromadb.PersistentClient(
            path=str(db_path),
            settings=Settings(anonymized_telemetry=False),
        )
        col = client.get_or_create_collection("scam_patterns")
        return col.count()
    except Exception as exc:
        log.warning("Could not connect to ChromaDB: %s", exc)
        return 0


# ===========================================================================
# Test runner
# ===========================================================================

def run_tests() -> None:
    print("\n" + "=" * 72)
    print("  ShadowSense Aurora -- ChromaDB Integration Tests (Week-2 M1)")
    print("=" * 72)

    query_fn = _import_query()
    if query_fn is None:
        print(f"\n  {SKIP} sentence-transformers or chromadb not installed.")
        print("  Run: pip install sentence-transformers chromadb")
        print("=" * 72 + "\n")
        return

    # ── Pre-flight: check DB is seeded ─────────────────────────────────────
    doc_count = _check_db_seeded(query_fn)
    print(f"\n  ChromaDB scam_patterns collection: {doc_count} document(s)")
    if doc_count == 0:
        print(
            f"  {WARN} Collection is empty. "
            "Run: python ml-pipeline/scripts/import_seed_scams.py"
        )
        print("  Retrieval tests will be skipped (empty collection).")

    # ── Pre-flight warm-up: load the sentence-transformers model now
    # so it does not skew the first retrieval test's latency measurement.
    # ────────────────────────────────────────────────────────────────────
    if doc_count > 0:
        print("  Warming up embedding model (avoids cold-start in timed tests)...")
        _warmup_t0 = time.perf_counter()
        query_fn("warm-up query", top_k=1)
        print(f"  Warm-up complete ({(time.perf_counter()-_warmup_t0)*1000:.0f}ms — excluded from results)")

    results = []
    latencies_ms: list = []

    # ── Section 1: Retrieval correctness ────────────────────────────────────
    print(f"\n  {'SECTION 1':=<60}")
    print("  Retrieval Correctness Tests")
    print("=" * 72)

    for case in RETRIEVAL_CASES:
        print(f"\n{SEP}")
        print(f"  [{case['id']}] {case['description']}")
        print(f"  Query: {case['message'][:80]}...")
        print(SEP)

        if doc_count == 0:
            print(f"  {SKIP} Skipped — collection empty.")
            results.append({"id": case["id"], "status": "SKIP", "latency_ms": 0})
            continue

        t0 = time.perf_counter()
        try:
            matches = query_fn(case["message"], top_k=3)
            latency_ms = (time.perf_counter() - t0) * 1000
            latencies_ms.append(latency_ms)
        except Exception as exc:
            latency_ms = (time.perf_counter() - t0) * 1000
            print(f"  {FAIL} Exception: {exc}")
            results.append({"id": case["id"], "status": "ERROR", "latency_ms": latency_ms})
            continue

        print(f"  Latency      : {latency_ms:.1f} ms")
        lat_status = PASS if latency_ms < _LATENCY_TARGET_MS else WARN
        print(f"  Latency < 1s : {lat_status} ({latency_ms:.0f}ms / target {_LATENCY_TARGET_MS:.0f}ms)")

        if not matches:
            print(f"  {WARN} No results returned.")
            results.append({"id": case["id"], "status": "WARN_EMPTY", "latency_ms": latency_ms})
            continue

        top = matches[0]
        print(f"  Top-1 result :")
        print(f"    id         : {top['id']}")
        print(f"    type       : {top['type']}")
        print(f"    category   : {top['category']}")
        print(f"    similarity : {top['similarity']:.4f}  (min required: {case['min_similarity']})")
        print(f"    text       : {top['text'][:80]}...")

        # Show all top-3
        print(f"\n  All {len(matches)} match(es):")
        for rank, m in enumerate(matches, 1):
            print(
                f"    #{rank}  sim={m['similarity']:.4f}  "
                f"type={m['type']:<14}  id={m['id']}"
            )

        # Type assertion (skip for control case)
        if case["expected_types"] is not None:
            accepted = case["expected_types"]   # list of acceptable labels
            type_ok = top["type"] in accepted
            type_status = PASS if type_ok else FAIL
            print(
                f"\n  Type check   : {type_status}"
                f"  top type={top['type']}  accepted={accepted}"
            )
        else:
            type_ok = True  # control -- no assertion
            print(f"\n  Type check   : {SKIP} (control case -- no assertion)")

        # Similarity threshold check
        sim_ok = top["similarity"] >= case["min_similarity"]
        sim_status = PASS if sim_ok else WARN
        print(
            f"  Similarity   : {sim_status}"
            f"  {top['similarity']:.4f} >= {case['min_similarity']}"
        )

        # Schema validation
        expected_keys = {"text", "similarity", "type", "category", "severity", "id", "red_flags"}
        schema_ok = all(expected_keys.issubset(m.keys()) for m in matches)
        print(f"  Schema check : {PASS if schema_ok else FAIL}  (keys: {sorted(expected_keys)})")

        passed = type_ok and sim_ok and schema_ok and latency_ms < _LATENCY_TARGET_MS
        results.append({
            "id":          case["id"],
            "status":      "PASS" if passed else "FAIL",
            "latency_ms":  round(latency_ms, 1),
            "top_type":    top["type"],
            "top_sim":     top["similarity"],
            "type_ok":     type_ok,
            "sim_ok":      sim_ok,
            "schema_ok":   schema_ok,
        })

    # ── Section 2: Latency benchmark ────────────────────────────────────────
    print(f"\n\n  {'SECTION 2':=<60}")
    print("  Latency Benchmark: Embedding + ChromaDB Query < 1 000 ms")
    print("=" * 72)

    latency_msg = (
        "Give me your bank account details and routing number. "
        "I will pay you double outside the platform."
    )

    if doc_count > 0:
        print(f"\n  Running 3 warm-up queries then 5 timed queries...")

        # Warm-up (model may lazy-load on first call)
        for _ in range(3):
            query_fn(latency_msg, top_k=3)

        timed = []
        for i in range(5):
            t0 = time.perf_counter()
            query_fn(latency_msg, top_k=3)
            elapsed_ms = (time.perf_counter() - t0) * 1000
            timed.append(elapsed_ms)
            print(f"    Run {i+1}: {elapsed_ms:.1f} ms  {PASS if elapsed_ms < _LATENCY_TARGET_MS else FAIL}")

        avg_ms  = sum(timed) / len(timed)
        min_ms  = min(timed)
        max_ms  = max(timed)
        lat_all_ok = all(t < _LATENCY_TARGET_MS for t in timed)

        print(f"\n  avg={avg_ms:.1f}ms  min={min_ms:.1f}ms  max={max_ms:.1f}ms  target=<{_LATENCY_TARGET_MS:.0f}ms")
        print(f"  All runs < 1s: {PASS if lat_all_ok else WARN}")

        results.append({
            "id":         "LATENCY_BENCH",
            "status":     "PASS" if lat_all_ok else "WARN",
            "avg_ms":     round(avg_ms, 1),
            "min_ms":     round(min_ms, 1),
            "max_ms":     round(max_ms, 1),
        })
    else:
        print(f"  {SKIP} Skipped — collection empty.")

    # ── Section 3: Shield agent integration ─────────────────────────────────
    print(f"\n\n  {'SECTION 3':=<60}")
    print("  ShieldAgent.defend() Integration (ChromaDB step)")
    print("=" * 72)

    try:
        from backend.agents.shield import ShieldAgent, _CHROMADB_ENABLED  # type: ignore
    except ImportError as _shield_import_err:
        print(f"\n  {SKIP} ShieldAgent import skipped: {_shield_import_err}")
        print("  (Run this section from the backend venv with all deps installed.)")
        results.append({"id": "SHIELD_INTEGRATION", "status": "SKIP"})
    else:
        try:
            print(f"\n  ChromaDB enabled in ShieldAgent: {_CHROMADB_ENABLED}")
            shield = ShieldAgent()

            test_ctx = {
                "text": (
                    "Please verify your Fiverr account by clicking "
                    "http://fiverr-secure-verify.xyz and entering your credentials. "
                    "Account will be suspended in 24 hours."
                ),
                "context": {
                    "account_age_days": 2,
                    "reviews":          0,
                    "verified":         False,
                },
            }

            print(f"  Running shield.defend() with a phishing message...")
            t0 = time.perf_counter()
            verdict = shield.defend(test_ctx)
            shield_ms = (time.perf_counter() - t0) * 1000

            ts           = verdict["trust_score"]
            details      = verdict["agent_details"]
            sim_patterns = details.get("similar_patterns", [])
            reasons      = verdict.get("reasons", [])

            print(f"\n  Trust Score  : {ts['score']}/100  ({ts['level']})")
            print(f"  Shield ms    : {shield_ms:.0f}ms")
            print(f"  Reasons      : {len(reasons)}")
            for r in reasons:
                print(f"    - {r}")

            print(f"\n  Similar Patterns from ChromaDB: {len(sim_patterns)}")
            for rank, p in enumerate(sim_patterns, 1):
                print(
                    f"    #{rank}  sim={p['similarity']:.4f}  "
                    f"type={p['type']:<14}  id={p['id']}"
                )

            has_patterns_key = "similar_patterns" in details
            patterns_ok      = isinstance(sim_patterns, list)
            print(f"\n  'similar_patterns' key in agent_details: {PASS if has_patterns_key else FAIL}")
            print(f"  similar_patterns is a list              : {PASS if patterns_ok else FAIL}")

            results.append({
                "id":          "SHIELD_INTEGRATION",
                "status":      "PASS" if (has_patterns_key and patterns_ok) else "FAIL",
                "trust_score": ts["score"],
                "level":       ts["level"],
                "n_patterns":  len(sim_patterns),
                "shield_ms":   round(shield_ms, 1),
            })

        except Exception as exc:
            print(f"  {FAIL} ShieldAgent integration error: {exc}")
            import traceback
            traceback.print_exc()
            results.append({"id": "SHIELD_INTEGRATION", "status": "ERROR", "error": str(exc)})

    # ── Section 4: JSONL log check ───────────────────────────────────────────
    print(f"\n\n  {'SECTION 4':=<60}")
    print("  JSONL Query Log Verification")
    print("=" * 72)

    log_file = _REPO_ROOT / "logs" / "chromadb_queries.jsonl"
    if log_file.exists():
        with open(log_file, encoding="utf-8") as fh:
            lines = [l.strip() for l in fh if l.strip()]
        print(f"\n  Log file     : {log_file}")
        print(f"  Total entries: {len(lines)}")
        if lines:
            last = json.loads(lines[-1])
            print(f"  Last entry   :")
            print(f"    ts         : {last['ts']}")
            print(f"    query      : {last['query'][:60]}...")
            print(f"    embed_ms   : {last['embed_ms']}")
            print(f"    query_ms   : {last['query_ms']}")
            print(f"    total_ms   : {last['total_ms']}")
            print(f"    n_results  : {last['n_results']}")

        schema_keys = {"ts", "query", "top_k", "embed_ms", "query_ms", "total_ms", "n_results", "results"}
        log_schema_ok = all(schema_keys.issubset(json.loads(l).keys()) for l in lines[-5:])
        print(f"  Schema valid : {PASS if log_schema_ok else FAIL}")
        results.append({"id": "JSONL_LOG", "status": "PASS" if log_schema_ok else "FAIL"})
    else:
        print(f"\n  {WARN} Log file not found at {log_file}")
        print("  (This is expected if no queries ran due to an empty collection.)")
        results.append({"id": "JSONL_LOG", "status": "WARN_MISSING"})

    # ── Summary ──────────────────────────────────────────────────────────────
    print(f"\n{'=' * 72}")
    print("  RESULTS SUMMARY")
    print("=" * 72)

    passed = sum(1 for r in results if r.get("status") == "PASS")
    warned = sum(1 for r in results if r.get("status", "").startswith("WARN"))
    failed = sum(1 for r in results if r.get("status") == "FAIL")
    errored = sum(1 for r in results if r.get("status") == "ERROR")
    skipped = sum(1 for r in results if r.get("status") == "SKIP")
    total  = len(results)

    for r in results:
        s = r.get("status", "?")
        icon = PASS if s == "PASS" else (WARN if s.startswith("WARN") else (SKIP if s == "SKIP" else FAIL))
        ms_str = f"  {r['latency_ms']:.0f}ms" if "latency_ms" in r else ""
        print(f"  {icon} {r['id']:<40}{ms_str}")

    print(f"\n  Passed  : {passed}/{total}")
    print(f"  Warned  : {warned}/{total}")
    print(f"  Failed  : {failed}/{total}")
    print(f"  Skipped : {skipped}/{total}")
    if latencies_ms:
        avg_all = sum(latencies_ms) / len(latencies_ms)
        print(f"\n  Average query latency (all retrieval tests): {avg_all:.1f}ms")
        target_met = avg_all < _LATENCY_TARGET_MS
        print(f"  Target < {_LATENCY_TARGET_MS:.0f}ms              : {PASS if target_met else WARN}")

    print("=" * 72 + "\n")

    if failed > 0 or errored > 0:
        sys.exit(1)


# ===========================================================================
# pytest-compatible test functions (thin wrappers)
# ===========================================================================

def test_chromadb_import():
    """sentence-transformers and chromadb must be importable."""
    from embeddings import query_similar_scams, EmbeddingsGenerator
    assert callable(query_similar_scams)
    assert EmbeddingsGenerator is not None


def test_embed_and_query_latency():
    """Embed + query round-trip must complete in < 1 second (post warm-up)."""
    from embeddings import query_similar_scams
    db_path = _REPO_ROOT / "data" / "chromadb"
    if not db_path.exists():
        import pytest
        pytest.skip("ChromaDB not seeded — run import_seed_scams.py first")

    msg = "Please pay me via gift card to avoid platform fees."
    # warm-up
    query_similar_scams(msg, top_k=1)
    # timed run
    t0 = time.perf_counter()
    query_similar_scams(msg, top_k=3)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    assert elapsed_ms < _LATENCY_TARGET_MS, (
        f"query took {elapsed_ms:.1f}ms, target < {_LATENCY_TARGET_MS:.0f}ms"
    )


def test_result_schema():
    """Each result must contain all required keys with correct types."""
    from embeddings import query_similar_scams
    db_path = _REPO_ROOT / "data" / "chromadb"
    if not db_path.exists():
        import pytest
        pytest.skip("ChromaDB not seeded")

    results = query_similar_scams("Verify your account or it will be suspended.", top_k=3)
    assert isinstance(results, list)
    if results:  # may be empty if collection is empty
        for r in results:
            assert "text"       in r and isinstance(r["text"], str)
            assert "similarity" in r and isinstance(r["similarity"], float)
            assert "type"       in r and isinstance(r["type"], str)
            assert "category"   in r and isinstance(r["category"], str)
            assert "severity"   in r and isinstance(r["severity"], int)
            assert "id"         in r and isinstance(r["id"], str)
            assert "red_flags"  in r and isinstance(r["red_flags"], list)
            assert 0.0 <= r["similarity"] <= 1.0, "Similarity must be in [0, 1]"


def test_phishing_query_top_type():
    """A Fiverr account-suspension phishing message must match a phishing pattern."""
    from embeddings import query_similar_scams
    db_path = _REPO_ROOT / "data" / "chromadb"
    if not db_path.exists():
        import pytest
        pytest.skip("ChromaDB not seeded")

    results = query_similar_scams(
        "Your Fiverr account will be suspended. Click here to verify your credentials.",
        top_k=3,
    )
    if not results:
        import pytest
        pytest.skip("Empty collection")

    types = [r["type"] for r in results]
    assert "phishing" in types or "impersonation" in types, (
        f"Expected phishing/impersonation in top-3 types, got: {types}"
    )


def test_jsonl_log_created():
    """After at least one query, chromadb_queries.jsonl must exist and be valid."""
    from embeddings import query_similar_scams
    log_file = _REPO_ROOT / "logs" / "chromadb_queries.jsonl"

    query_similar_scams("test message for log verification", top_k=1)

    assert log_file.exists(), f"Log file not created at {log_file}"
    with open(log_file, encoding="utf-8") as fh:
        lines = [l.strip() for l in fh if l.strip()]
    assert len(lines) >= 1
    last = json.loads(lines[-1])
    required_keys = {"ts", "query", "top_k", "embed_ms", "query_ms", "total_ms", "n_results", "results"}
    assert required_keys.issubset(last.keys()), f"Missing keys: {required_keys - last.keys()}"


def test_shield_agent_has_similar_patterns():
    """ShieldAgent.defend() must include 'similar_patterns' in agent_details."""
    from backend.agents.shield import ShieldAgent
    shield = ShieldAgent()
    verdict = shield.defend({
        "text": "Send me payment via gift card to my email outside Fiverr.",
        "context": {"account_age_days": 3, "reviews": 0, "verified": False},
    })
    details = verdict.get("agent_details", {})
    assert "similar_patterns" in details, (
        "'similar_patterns' key missing from agent_details"
    )
    assert isinstance(details["similar_patterns"], list)


if __name__ == "__main__":
    run_tests()
