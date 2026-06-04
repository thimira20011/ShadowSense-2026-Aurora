"""
ml-pipeline/stats_dashboard.py
===============================
Week 3 Checkpoint - Feedback-Loop Stats Dashboard & Exporter

Responsibilities
----------------
1. Stats collection - pulls live numbers from ChromaDB + audit logs:
     - Total scam patterns stored (scam_patterns collection)
     - Most commonly detected patterns (chromadb_queries.jsonl)
     - Total override events (feedback_overrides collection)
     - Benign patterns promoted (benign_pattern_votes collection)
     - False-positive rate  =  overrides / total_detections

2. CLI dashboard - pretty-prints a full stats report to stdout.

3. JSON export - writes ml-pipeline/stats.json for M4's pitch deck.

4. 10-override simulation test - runs 10 override events across 3
   distinct patterns, verifies ChromaDB is updated correctly, and prints
   a full pass/fail report.

Usage
-----
    # Show dashboard + export stats.json
    python ml-pipeline/stats_dashboard.py

    # Run the 10-override simulation test only
    python ml-pipeline/stats_dashboard.py --test

    # Export stats.json only (no terminal output)
    python ml-pipeline/stats_dashboard.py --export-only
"""

from __future__ import annotations

import argparse
import io
import json
import logging
import os
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Force UTF-8 stdout on Windows (cp1252 cannot encode box-drawing / emoji)
# ---------------------------------------------------------------------------
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except Exception:
        pass

# ---------------------------------------------------------------------------
# Bootstrap: make ml-pipeline importable regardless of CWD
# ---------------------------------------------------------------------------
_HERE      = Path(__file__).resolve().parent
_REPO_ROOT = _HERE.parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

# ---------------------------------------------------------------------------
# Dependency guards
# ---------------------------------------------------------------------------
try:
    import chromadb
    from chromadb.config import Settings as _ChromaSettings
    _CHROMA_AVAILABLE = True
except ImportError:
    chromadb = None  # type: ignore[assignment]
    _CHROMA_AVAILABLE = False

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
_DB_DIR       = _REPO_ROOT / "data"  / "chromadb"
_QUERY_LOG    = _REPO_ROOT / "logs"  / "chromadb_queries.jsonl"
_OVERRIDE_LOG = _REPO_ROOT / "logs"  / "override_events.jsonl"
_STATS_OUT    = _HERE / "stats.json"

_COL_SCAM      = "scam_patterns"
_COL_OVERRIDES = "feedback_overrides"
_COL_BENIGN    = "benign_pattern_votes"

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# ANSI colours - always enabled; stdout is now UTF-8
# ---------------------------------------------------------------------------
_C = {
    "reset":  "\033[0m",
    "bold":   "\033[1m",
    "cyan":   "\033[96m",
    "green":  "\033[92m",
    "yellow": "\033[93m",
    "red":    "\033[91m",
    "dim":    "\033[2m",
}


# ===========================================================================
# ChromaDB helpers
# ===========================================================================

def _get_client():
    if not _CHROMA_AVAILABLE:
        raise RuntimeError("chromadb not installed. Run: pip install chromadb")
    _DB_DIR.mkdir(parents=True, exist_ok=True)
    return chromadb.PersistentClient(
        path=str(_DB_DIR),
        settings=_ChromaSettings(anonymized_telemetry=False),
    )


def _collection_count(client, name: str) -> int:
    try:
        col = client.get_or_create_collection(name=name)
        return col.count()
    except Exception as exc:
        log.warning("Could not count collection '%s': %s", name, exc)
        return 0


def _get_collection_meta(client, name: str) -> List[Dict[str, Any]]:
    try:
        col = client.get_or_create_collection(name=name)
        if col.count() == 0:
            return []
        result = col.get(include=["metadatas", "documents"])
        metas = result.get("metadatas") or []
        docs  = result.get("documents") or []
        ids   = result.get("ids") or []
        return [
            {"id": i, "document": d, "metadata": m}
            for i, d, m in zip(ids, docs, metas)
        ]
    except Exception as exc:
        log.warning("Could not fetch collection '%s': %s", name, exc)
        return []


# ===========================================================================
# Log parsers
# ===========================================================================

def _parse_jsonl(path: Path) -> List[Dict[str, Any]]:
    """Read a JSONL file and return valid lines as dicts. Never raises."""
    records: List[Dict[str, Any]] = []
    if not path.exists():
        return records
    try:
        with open(path, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line:
                    try:
                        records.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass
    except Exception as exc:
        log.warning("Could not read %s: %s", path, exc)
    return records


# ===========================================================================
# Stats computation
# ===========================================================================

def compute_stats() -> Dict[str, Any]:
    """
    Collect all stats from ChromaDB collections + JSONL audit logs.
    Returns a dict ready to be serialised to stats.json.
    """
    client = _get_client()

    # -- 1. Scam pattern counts -------------------------------------------
    total_scam_patterns = _collection_count(client, _COL_SCAM)
    total_overrides_db  = _collection_count(client, _COL_OVERRIDES)

    benign_records  = _get_collection_meta(client, _COL_BENIGN)
    benign_patterns = [
        r for r in benign_records
        if r.get("metadata", {}).get("benign", False)
    ]
    total_benign_db = len(benign_patterns)

    # -- 2. Query log analysis (most-detected patterns) -------------------
    query_log = _parse_jsonl(_QUERY_LOG)

    type_counter:    Counter = Counter()
    pattern_counter: Counter = Counter()
    query_count      = len(query_log)
    similarity_scores: List[float] = []

    for entry in query_log:
        results = entry.get("results", [])
        if results:
            top       = results[0]
            scam_type = top.get("type", "unknown")
            scam_id   = top.get("id",   "unknown")
            sim       = float(top.get("similarity", 0.0))
            type_counter[scam_type]  += 1
            pattern_counter[scam_id] += 1
            similarity_scores.append(sim)

    avg_similarity = (
        round(sum(similarity_scores) / len(similarity_scores), 4)
        if similarity_scores else 0.0
    )

    top_patterns: List[Dict[str, Any]] = [
        {"pattern_id": pid, "detection_count": cnt}
        for pid, cnt in pattern_counter.most_common(10)
    ]

    top_scam_types: List[Dict[str, Any]] = [
        {"type": t, "detection_count": cnt}
        for t, cnt in type_counter.most_common(10)
    ]

    # -- 3. Override / false-positive analysis ----------------------------
    override_log    = _parse_jsonl(_OVERRIDE_LOG)
    override_events = [e for e in override_log if e.get("event") == "override_reported"]
    benign_promoted = [e for e in override_log if e.get("event") == "pattern_marked_benign"]

    total_override_events = len(override_events)
    total_detections      = query_count

    false_positive_rate = (
        round(total_override_events / total_detections, 4)
        if total_detections > 0 else 0.0
    )
    false_positive_pct = round(false_positive_rate * 100, 2)

    pattern_overrides: Dict[str, int] = defaultdict(int)
    for evt in override_events:
        key = evt.get("pattern_key", "unknown")
        pattern_overrides[key] += 1

    top_overridden: List[Dict[str, Any]] = [
        {
            "pattern_key":    k,
            "pattern_text":   next(
                (e.get("pattern_text", "")[:120]
                 for e in override_events if e.get("pattern_key") == k),
                "",
            ),
            "override_count": v,
        }
        for k, v in sorted(pattern_overrides.items(), key=lambda x: -x[1])[:5]
    ]

    benign_summary: List[Dict[str, Any]] = [
        {
            "pattern_key":    r["id"],
            "pattern_text":   r["document"][:120],
            "override_count": int(r["metadata"].get("override_count", 0)),
            "promoted_at":    r["metadata"].get("promoted_at", ""),
            "trust_boost":    int(r["metadata"].get("boost", 20)),
        }
        for r in benign_patterns
    ]

    # -- 4. Assemble output -----------------------------------------------
    generated_at = datetime.now(timezone.utc).isoformat()

    stats = {
        "meta": {
            "generated_at": generated_at,
            "version":      "week3-checkpoint",
            "project":      "ShadowSense 2026 Aurora",
        },
        "scam_patterns": {
            "total_stored":           total_scam_patterns,
            "total_override_reports": total_overrides_db,
            "total_benign_promoted":  total_benign_db,
        },
        "detection_activity": {
            "total_queries":         total_detections,
            "avg_top_similarity":    avg_similarity,
            "top_detected_patterns": top_patterns,
            "top_scam_types":        top_scam_types,
        },
        "false_positive_analysis": {
            "total_override_events":   total_override_events,
            "total_detections":        total_detections,
            "false_positive_rate":     false_positive_rate,
            "false_positive_pct":      false_positive_pct,
            "top_overridden_patterns": top_overridden,
        },
        "benign_patterns": {
            "total_promoted":    total_benign_db,
            "benign_threshold":  3,
            "trust_score_boost": 20,
            "patterns":          benign_summary,
        },
        "feedback_loop": {
            "total_benign_events_in_log": len(benign_promoted),
            "feedback_loop_status":       "operational",
            "chromadb_status":            "connected" if _CHROMA_AVAILABLE else "unavailable",
        },
    }

    return stats


# ===========================================================================
# Export
# ===========================================================================

def export_stats(stats: Dict[str, Any], output_path: Path = _STATS_OUT) -> Path:
    """Write stats dict to JSON file. Returns the path written."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as fh:
        json.dump(stats, fh, indent=2, ensure_ascii=False)
    return output_path


# ===========================================================================
# Dashboard display (pure ASCII - safe on all Windows/Linux/Mac terminals)
# ===========================================================================

def _bar(value: float, max_value: float, width: int = 28) -> str:
    if max_value == 0:
        return "[" + " " * width + "]"
    filled = int(round((value / max_value) * width))
    filled = max(0, min(filled, width))
    return "[" + "#" * filled + "." * (width - filled) + "]"


def print_dashboard(stats: Dict[str, Any]) -> None:
    B   = _C["bold"]
    CY  = _C["cyan"]
    GR  = _C["green"]
    YL  = _C["yellow"]
    RD  = _C["red"]
    DIM = _C["dim"]
    RST = _C["reset"]

    sep  = f"{DIM}" + "-" * 65 + RST
    sep2 = f"{DIM}" + "=" * 65 + RST

    print()
    print(sep2)
    print(f"  {B}{CY}ShadowSense 2026 Aurora -- Feedback Loop Dashboard{RST}")
    print(f"  {DIM}Week 3 Checkpoint | {stats['meta']['generated_at']}{RST}")
    print(sep2)

    # -- Scam Patterns --------------------------------------------------------
    sp = stats["scam_patterns"]
    print(f"\n  {B}[DB] SCAM PATTERNS (ChromaDB){RST}")
    print(sep)
    print(f"  {'Total stored':<35} {GR}{sp['total_stored']:>6}{RST}")
    print(f"  {'Override reports stored':<35} {YL}{sp['total_override_reports']:>6}{RST}")
    print(f"  {'Benign patterns promoted':<35} {GR}{sp['total_benign_promoted']:>6}{RST}")

    # -- Detection Activity ---------------------------------------------------
    da = stats["detection_activity"]
    print(f"\n  {B}[>>] DETECTION ACTIVITY{RST}")
    print(sep)
    print(f"  {'Total queries / detections':<35} {CY}{da['total_queries']:>6}{RST}")
    print(f"  {'Avg top-result similarity':<35} {da['avg_top_similarity']:>6.4f}")

    if da["top_scam_types"]:
        max_count = da["top_scam_types"][0]["detection_count"]
        print(f"\n  {B}Most Commonly Detected Scam Types:{RST}")
        for entry in da["top_scam_types"][:7]:
            bar   = _bar(entry["detection_count"], max_count, width=25)
            label = entry["type"][:22]
            print(f"    {label:<23} {bar}  {entry['detection_count']:>4}")

    if da["top_detected_patterns"]:
        print(f"\n  {B}Top Flagged Pattern IDs:{RST}")
        for i, entry in enumerate(da["top_detected_patterns"][:5], 1):
            print(f"    #{i}  {entry['pattern_id']:<18}  hit {entry['detection_count']}x")

    # -- False Positive Rate --------------------------------------------------
    fpa      = stats["false_positive_analysis"]
    fp_rate  = fpa["false_positive_pct"]
    fp_col   = GR if fp_rate < 5 else (YL if fp_rate < 15 else RD)

    print(f"\n  {B}[FP] FALSE POSITIVE ANALYSIS{RST}")
    print(sep)
    print(f"  {'Total detections':<35} {fpa['total_detections']:>6}")
    print(f"  {'Total override events':<35} {fpa['total_override_events']:>6}")
    print(f"  {'False positive rate':<35} {fp_col}{fp_rate:>5.2f}%{RST}")

    if fpa["top_overridden_patterns"]:
        print(f"\n  {B}Most Overridden Patterns:{RST}")
        for entry in fpa["top_overridden_patterns"]:
            snippet = (entry["pattern_text"] or entry["pattern_key"])[:55]
            print(f"    [{entry['override_count']}x]  {snippet}...")

    # -- Benign Patterns ------------------------------------------------------
    bp = stats["benign_patterns"]
    print(f"\n  {B}[OK] BENIGN PATTERNS (community-verified){RST}")
    print(sep)
    print(f"  {'Total promoted':<35} {GR}{bp['total_promoted']:>6}{RST}")
    print(f"  {'Promotion threshold':<35} {bp['benign_threshold']:>6} overrides")
    print(f"  {'Trust score boost applied':<35} {GR}+{bp['trust_score_boost']:>5}{RST}")

    if bp["patterns"]:
        print(f"\n  {B}Promoted Patterns:{RST}")
        for p in bp["patterns"]:
            snippet = (p["pattern_text"] or p["pattern_key"])[:55]
            print(f"    [{p['override_count']}x]  {snippet}...")
            print(f"           promoted: {p['promoted_at']}  boost: +{p['trust_boost']}")
    else:
        print(f"  {DIM}  None yet -- 3 overrides per pattern required.{RST}")

    # -- System Status --------------------------------------------------------
    fl         = stats["feedback_loop"]
    status_col = GR if fl["feedback_loop_status"] == "operational" else RD
    db_col     = GR if fl["chromadb_status"] == "connected" else RD

    print(f"\n  {B}[SYS] SYSTEM STATUS{RST}")
    print(sep)
    print(f"  {'Feedback loop':<35} {status_col}{fl['feedback_loop_status']}{RST}")
    print(f"  {'ChromaDB':<35} {db_col}{fl['chromadb_status']}{RST}")
    print()
    print(sep2)
    print(f"  {DIM}Stats exported --> {_STATS_OUT}{RST}")
    print(sep2)
    print()


# ===========================================================================
# 10-Override Simulation Test  (Week 3 Checkpoint)
# ===========================================================================

_TEST_OVERRIDES = [
    # Pattern A -- 4 overrides -> BENIGN
    {
        "id":    "sim-001",
        "text":  "Please send payment via gift card or PayPal Friends and Family outside the platform.",
        "users": ["user_alice", "user_bob", "user_carol", "user_dave"],
    },
    # Pattern B -- 3 overrides -> BENIGN (exactly at threshold)
    {
        "id":    "sim-002",
        "text":  "Your Fiverr account will be suspended. Verify by clicking this link immediately.",
        "users": ["user_eve", "user_frank", "user_grace"],
    },
    # Pattern C -- 2 overrides -> NOT benign (below threshold)
    {
        "id":    "sim-003",
        "text":  "Run setup.exe to preview the deliverable demo files we've sent you.",
        "users": ["user_harry", "user_iris"],
    },
    # 10th override -- extra hit on Pattern A (already benign, idempotent)
    {
        "id":    "sim-004",
        "text":  "Please send payment via gift card or PayPal Friends and Family outside the platform.",
        "users": ["user_jack"],
    },
]


class _TestResult:
    def __init__(self, name: str):
        self.name    = name
        self.passed  = False
        self.message = ""

    def ok(self, msg: str = "") -> "_TestResult":
        self.passed  = True
        self.message = msg
        return self

    def fail(self, msg: str) -> "_TestResult":
        self.passed  = False
        self.message = msg
        return self


def run_simulation_test(verbose: bool = True) -> bool:
    """
    Simulate 10 override events across 3 distinct patterns.

    Assertions verified:
      1. All 10 overrides stored without error
      2. Pattern A (4 overrides) -> marked benign
      3. Pattern B (3 overrides) -> marked benign
      4. Pattern C (2 overrides) -> NOT marked benign
      5. Benign patterns get +20 trust-score boost
      6. Non-benign patterns get 0 boost
      7. Override counter increments correctly per pattern
      8. stats.json exported successfully
      9. stats.json contains all required top-level keys
     10. False positive rate > 0 after simulation

    Returns True if all 10 assertions pass.
    """
    try:
        from feedback_loop import FeedbackLoop  # type: ignore
    except ImportError as e:
        print(f"\n  [ERROR] Cannot import FeedbackLoop: {e}")
        return False

    B   = _C["bold"]
    GR  = _C["green"]
    RD  = _C["red"]
    YL  = _C["yellow"]
    CY  = _C["cyan"]
    DIM = _C["dim"]
    RST = _C["reset"]
    sep = DIM + "-" * 65 + RST

    print()
    print(f"  {B}{CY}===  Week 3 Checkpoint -- 10 Override Simulation Test  ==={RST}")
    print()

    loop  = FeedbackLoop()
    results: List[_TestResult]   = []
    total_override_calls         = 0
    override_records: Dict[str, Any] = {}

    # -- Fire override events -------------------------------------------------
    print(f"  {B}Firing override events...{RST}")

    for scenario in _TEST_OVERRIDES:
        pattern_text = scenario["text"]
        for i, user_id in enumerate(scenario["users"]):
            total_override_calls += 1
            analysis_id = f"{scenario['id']}-u{i+1:02d}"
            result = loop.process_override({
                "analysis_id":  analysis_id,
                "pattern_text": pattern_text,
                "user_id":      user_id,
                "trust_score":  22,
            })
            override_records[analysis_id] = result
            marker = f"{GR}OK{RST}" if result.success else f"{RD}ERR{RST}"
            if verbose:
                print(
                    f"  [{marker}]  [{analysis_id}]  "
                    f"count={result.override_count}  "
                    f"benign={result.marked_benign}  "
                    f"boost=+{result.trust_score_boost}"
                )

    print(f"\n  {DIM}Total override calls fired: {total_override_calls}{RST}")

    # -- Assertions -----------------------------------------------------------
    print(f"\n{sep}")
    print(f"  {B}Assertion Results:{RST}")
    print(sep)

    # 1. All 10 overrides succeeded
    t      = _TestResult("All 10 overrides stored without error")
    all_ok = all(r.success for r in override_records.values())
    t.ok(f"All {total_override_calls} calls returned success=True") if all_ok \
        else t.fail("Some calls failed")
    results.append(t)

    # 2. Pattern A (4 overrides) -> benign
    a_results = [v for k, v in override_records.items() if k.startswith("sim-001")]
    t = _TestResult("Pattern A (4 overrides) marked benign")
    if a_results and a_results[-1].marked_benign:
        t.ok(f"benign=True after {a_results[-1].override_count} overrides")
    else:
        t.fail("Not marked benign")
    results.append(t)

    # 3. Pattern B (3 overrides) -> benign
    b_results = [v for k, v in override_records.items() if k.startswith("sim-002")]
    t = _TestResult("Pattern B (3 overrides) marked benign")
    if b_results and b_results[-1].marked_benign:
        t.ok(f"benign=True after {b_results[-1].override_count} overrides")
    else:
        t.fail("Not marked benign -- should hit threshold at exactly 3")
    results.append(t)

    # 4. Pattern C (2 overrides) -> NOT benign
    c_results = [v for k, v in override_records.items() if k.startswith("sim-003")]
    t = _TestResult("Pattern C (2 overrides) NOT marked benign")
    if c_results and not c_results[-1].marked_benign:
        t.ok(f"Correctly withheld (count={c_results[-1].override_count})")
    else:
        t.fail("Incorrectly promoted to benign with only 2 overrides")
    results.append(t)

    # 5. Benign pattern -> +20 boost
    t       = _TestResult("Benign pattern returns +20 trust-score boost")
    boost_a = loop.get_trust_score_boost(
        "Please send payment via gift card or PayPal Friends and Family outside the platform."
    )
    if boost_a == 20:
        t.ok(f"+{boost_a} confirmed for Pattern A")
    else:
        t.fail(f"Expected +20, got +{boost_a}")
    results.append(t)

    # 6. Non-benign pattern -> 0 boost
    t       = _TestResult("Non-benign pattern (C) returns 0 boost")
    boost_c = loop.get_trust_score_boost(
        "Run setup.exe to preview the deliverable demo files we've sent you."
    )
    if boost_c == 0:
        t.ok("Confirmed 0 boost for pattern below threshold")
    else:
        t.fail(f"Expected 0, got {boost_c}")
    results.append(t)

    # 7. Counter increments correctly
    # Pattern A: 4 users (sim-001) + 1 user (sim-004, same text) = 5
    from feedback_loop import _pattern_key  # type: ignore
    key_a   = _pattern_key(
        "Please send payment via gift card or PayPal Friends and Family outside the platform."
    )
    count_a = loop.get_override_count(key_a)
    t = _TestResult("Override counter correct for Pattern A (expect 5)")
    if count_a == 5:
        t.ok(f"Count={count_a}")
    else:
        t.fail(f"Expected 5, got {count_a}")
    results.append(t)

    # 8. stats.json exported
    t = _TestResult("stats.json exported successfully")
    try:
        stats_data = compute_stats()
        out        = export_stats(stats_data)
        t.ok(f"Written to {out}")
    except Exception as exc:
        t.fail(str(exc))
    results.append(t)

    # 9. stats.json has required keys
    t = _TestResult("stats.json contains all required top-level keys")
    required_keys = {
        "meta", "scam_patterns", "detection_activity",
        "false_positive_analysis", "benign_patterns", "feedback_loop",
    }
    with open(_STATS_OUT, "r", encoding="utf-8") as fh:
        loaded = json.load(fh)
    missing = required_keys - set(loaded.keys())
    if not missing:
        t.ok("All keys present: " + ", ".join(sorted(required_keys)))
    else:
        t.fail(f"Missing keys: {missing}")
    results.append(t)

    # 10. False-positive rate > 0
    t       = _TestResult("False positive rate > 0 after simulation")
    fp_rate = loaded["false_positive_analysis"]["false_positive_rate"]
    if fp_rate > 0:
        t.ok(f"Rate = {fp_rate:.4f}  ({loaded['false_positive_analysis']['false_positive_pct']}%)")
    else:
        t.fail("Still 0 -- override events may not be reflected in the query log yet")
    results.append(t)

    # -- Summary --------------------------------------------------------------
    print()
    passed = 0
    for i, r in enumerate(results, 1):
        icon = f"{GR}PASS{RST}" if r.passed else f"{RD}FAIL{RST}"
        print(f"  [{icon}]  #{i:02d}  {r.name}")
        if r.message:
            print(f"          {DIM}{r.message}{RST}")
        if r.passed:
            passed += 1

    total    = len(results)
    all_pass = passed == total
    colour   = GR if all_pass else (YL if passed > total // 2 else RD)

    print()
    print(sep)
    verdict = "Week 3 Checkpoint COMPLETE" if all_pass else "Some checks failed"
    print(f"  {B}Result: {colour}{passed}/{total} assertions passed -- {verdict}{RST}")
    print(sep)
    print()

    return all_pass


# ===========================================================================
# CLI entry-point
# ===========================================================================

def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="ShadowSense feedback-loop stats dashboard & Week 3 test",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument(
        "--test",
        action="store_true",
        help="Run the 10-override simulation test then exit",
    )
    p.add_argument(
        "--export-only",
        action="store_true",
        help="Export stats.json without printing the dashboard",
    )
    p.add_argument(
        "--stats-out",
        type=Path,
        default=_STATS_OUT,
        help=f"Output path for stats.json (default: {_STATS_OUT})",
    )
    return p.parse_args()


def main() -> None:
    args = _parse_args()

    if args.test:
        ok = run_simulation_test(verbose=True)
        # Always export fresh stats after test
        stats = compute_stats()
        export_stats(stats, args.stats_out)
        sys.exit(0 if ok else 1)

    stats = compute_stats()
    export_stats(stats, args.stats_out)

    if not args.export_only:
        print_dashboard(stats)


if __name__ == "__main__":
    main()
