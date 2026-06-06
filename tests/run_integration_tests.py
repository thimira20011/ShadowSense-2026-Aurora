#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tests/run_integration_tests.py
==============================
ShadowSense Aurora — M4 Integration Test Runner
Week 2 Deliverable: feature/m4-integration-runner

Loads every scenario JSON from tests/test_scenarios/, sends the conversation
text to POST /api/analyze/, compares the returned trust_score against the
expected_trust_score_range, and writes results to tests/RESULTS.md.

Usage
-----
    # Dry-run (no HTTP calls — use before M1 backend is live):
    python tests/run_integration_tests.py --dry-run

    # Live run against local backend:
    python tests/run_integration_tests.py

    # Custom base URL:
    python tests/run_integration_tests.py --base-url http://192.168.1.10:8000

    # Single scenario:
    python tests/run_integration_tests.py --scenario phishing_001

Requirements
------------
    pip install requests
    (No other external deps — stdlib only otherwise)
"""

import argparse
import json
import os
import sys
import datetime
import pathlib

try:
    import requests
    _REQUESTS_AVAILABLE = True
except ImportError:
    _REQUESTS_AVAILABLE = False

# ── Paths ─────────────────────────────────────────────────────────────────────
_REPO_ROOT     = pathlib.Path(__file__).resolve().parent.parent
_SCENARIOS_DIR = _REPO_ROOT / "tests" / "test_scenarios"
_RESULTS_FILE  = _REPO_ROOT / "tests" / "RESULTS.md"

# ── Terminal colours (graceful fallback on Windows without ANSI support) ──────
_GREEN  = "\033[92m"
_RED    = "\033[91m"
_YELLOW = "\033[93m"
_CYAN   = "\033[96m"
_RESET  = "\033[0m"

if sys.platform == "win32":
    os.system("")          # enable ANSI codes on Windows 10+


def _col(text: str, colour: str) -> str:
    return f"{colour}{text}{_RESET}"


# ── Helpers ───────────────────────────────────────────────────────────────────

def load_scenarios(scenario_filter: str | None) -> list[dict]:
    """Load all scenario JSON files; optionally filter to one scenario_id."""
    files = sorted(_SCENARIOS_DIR.glob("*.json"))
    if not files:
        print(_col("ERROR: No scenario files found in tests/test_scenarios/", _RED))
        sys.exit(1)

    scenarios = []
    for f in files:
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            data["_source_file"] = f.name
            scenarios.append(data)
        except json.JSONDecodeError as exc:
            print(_col(f"WARN: Could not parse {f.name}: {exc}", _YELLOW))

    if scenario_filter:
        scenarios = [s for s in scenarios if s.get("scenario_id") == scenario_filter]
        if not scenarios:
            print(_col(f"ERROR: No scenario with id '{scenario_filter}' found.", _RED))
            sys.exit(1)

    return scenarios


def extract_text(scenario: dict) -> str:
    """
    Extract a single text payload to send to /api/analyze/.

    Handles two scenario shapes:
      - conversation[] array  → join all messages
      - file_details object   → synthesise a text description
    """
    if "conversation" in scenario and scenario["conversation"]:
        parts = [
            f"{turn.get('speaker', 'user')}: {turn.get('message', '')}"
            for turn in scenario["conversation"]
        ]
        return "\n".join(parts)

    if "file_details" in scenario:
        fd = scenario["file_details"]
        indicators = ", ".join(fd.get("suspicious_indicators", []))
        return (
            f"Client sent a file: {fd.get('filename', 'unknown')} "
            f"({fd.get('size_mb', '?')}MB). "
            f"Suspicious indicators: {indicators}."
        )

    # Fallback — use scenario name + description
    return f"{scenario.get('name', '')}. {scenario.get('description', '')}"


def call_api(text: str, base_url: str, timeout: int = 15) -> dict | None:
    """POST to /api/analyze/ and return the parsed JSON response, or None on error."""
    if not _REQUESTS_AVAILABLE:
        print(_col("ERROR: 'requests' library not installed. Run: pip install requests", _RED))
        sys.exit(1)

    url = f"{base_url.rstrip('/')}/api/analyze/"
    try:
        resp = requests.post(url, json={"text": text}, timeout=timeout)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.ConnectionError:
        return {"_error": f"Connection refused — is the backend running at {base_url}?"}
    except requests.exceptions.Timeout:
        return {"_error": f"Request timed out after {timeout}s"}
    except requests.exceptions.HTTPError as exc:
        return {"_error": f"HTTP {exc.response.status_code}: {exc.response.text[:200]}"}
    except Exception as exc:
        return {"_error": str(exc)}


def evaluate(scenario: dict, actual_score: int | None) -> dict:
    """Compare actual score against expected range. Returns result dict."""
    score_range  = scenario.get("expected_trust_score_range", {})
    intervention = scenario.get("expected_intervention", "any")
    min_score    = score_range.get("min", 0)
    max_score    = score_range.get("max", 100)

    if actual_score is None:
        return {"status": "ERROR", "actual": None, "expected_range": f"{min_score}–{max_score}"}

    if intervention == "any":
        status = "PASS"   # edge-case / stability test — any score is valid
    elif min_score <= actual_score <= max_score:
        status = "PASS"
    else:
        status = "FAIL"

    return {
        "status":         status,
        "actual":         actual_score,
        "expected_range": f"{min_score}–{max_score}",
        "intervention":   intervention,
    }


# ── Main runner ───────────────────────────────────────────────────────────────

def run(args: argparse.Namespace) -> None:
    scenarios = load_scenarios(args.scenario)
    results   = []

    sep = "─" * 70
    print(f"\n{'═' * 70}")
    print("  ShadowSense Aurora — Integration Test Runner (M4)")
    if args.dry_run:
        print(_col("  Mode: DRY-RUN (no HTTP calls)", _YELLOW))
    else:
        print(f"  Mode: LIVE  →  {args.base_url}")
    print(f"  Scenarios loaded: {len(scenarios)}")
    print(f"{'═' * 70}\n")

    for sc in scenarios:
        sid   = sc.get("scenario_id", sc["_source_file"])
        name  = sc.get("name", sid)
        text  = extract_text(sc)

        print(f"{sep}")
        print(f"  {_col(sid, _CYAN)}  {name}")
        print(f"  File  : {sc['_source_file']}")
        print(f"  Text  : {text[:120]}{'…' if len(text) > 120 else ''}")

        if args.dry_run:
            result = {
                "scenario_id": sid,
                "name":        name,
                "source_file": sc["_source_file"],
                "status":      "PENDING",
                "actual":      None,
                "expected_range": f"{sc.get('expected_trust_score_range', {}).get('min', 0)}–"
                                  f"{sc.get('expected_trust_score_range', {}).get('max', 100)}",
                "intervention":   sc.get("expected_intervention", "any"),
                "notes":          "Dry-run — awaiting live backend",
            }
            print(_col("  Status: PENDING (dry-run)", _YELLOW))
        else:
            response = call_api(text, args.base_url, timeout=args.timeout)

            if response and "_error" in response:
                actual_score = None
                notes        = response["_error"]
                ev           = {"status": "ERROR", "actual": None,
                                "expected_range": "n/a"}
            else:
                actual_score = response.get("trust_score") if response else None
                notes        = ""
                ev           = evaluate(sc, actual_score)

            status_col = {
                "PASS":  _GREEN,
                "FAIL":  _RED,
                "ERROR": _RED,
            }.get(ev["status"], _YELLOW)

            print(f"  Score : {actual_score if actual_score is not None else '—'}/100")
            print(f"  Range : {ev['expected_range']}")
            print(f"  Status: {_col(ev['status'], status_col)}"
                  + (f"  ← {notes}" if notes else ""))

            result = {
                "scenario_id":    sid,
                "name":           name,
                "source_file":    sc["_source_file"],
                "status":         ev["status"],
                "actual":         actual_score,
                "expected_range": ev["expected_range"],
                "intervention":   sc.get("expected_intervention", "any"),
                "notes":          notes,
            }

        results.append(result)

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n{'═' * 70}")
    print("  SUMMARY")
    print(f"{'═' * 70}")

    counts = {"PASS": 0, "FAIL": 0, "ERROR": 0, "PENDING": 0}
    for r in results:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
        icon = {"PASS": "✔", "FAIL": "✘", "ERROR": "✘", "PENDING": "⋯"}.get(r["status"], "?")
        col  = {"PASS": _GREEN, "FAIL": _RED, "ERROR": _RED, "PENDING": _YELLOW}.get(r["status"], _RESET)
        score_str = f"{r['actual']}/100" if r["actual"] is not None else "    —"
        print(f"  {_col(icon, col)}  {r['scenario_id']:<40} {score_str:<9} {r['expected_range']}")

    total = len(results)
    print(f"\n  Total   : {total}")
    print(_col(f"  Passed  : {counts['PASS']}/{total}", _GREEN))
    if counts["FAIL"] or counts["ERROR"]:
        print(_col(f"  Failed  : {counts['FAIL'] + counts['ERROR']}/{total}", _RED))
    if counts["PENDING"]:
        print(_col(f"  Pending : {counts['PENDING']}/{total}", _YELLOW))
    print(f"{'═' * 70}\n")

    # ── Write RESULTS.md ──────────────────────────────────────────────────────
    write_results_md(results, args.dry_run)

    if counts["FAIL"] > 0 or counts["ERROR"] > 0:
        sys.exit(1)


def write_results_md(results: list[dict], dry_run: bool) -> None:
    """Write or update tests/RESULTS.md with the latest run results."""
    now       = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    mode_note = "Dry-run — awaiting live backend (M1)" if dry_run else "Live run"

    header = f"""# Test Results

> **Last updated**: {now}  
> **Mode**: {mode_note}  
> **Scenarios**: {len(results)}

| # | Scenario ID | Name | Expected Range | Actual Score | Status | Notes |
|---|---|---|---|---|---|---|
"""
    rows = []
    for i, r in enumerate(results, 1):
        score = str(r["actual"]) if r["actual"] is not None else "—"
        rows.append(
            f"| {i} | `{r['scenario_id']}` | {r['name']} "
            f"| {r['expected_range']} | {score} | **{r['status']}** | {r['notes']} |"
        )

    footer = f"""
---

## Intervention Tier Reference

| Trust Score | Level | Action |
|---|---|---|
| 70 – 100 | `CLEAR` | No warning — conversation appears safe |
| 40 – 69 | `ADVISORY` | Soft warning overlay displayed |
| 0 – 39 | `HIGH_RISK` | Hard block — chat input disabled |

---

*Generated by `tests/run_integration_tests.py` — ShadowSense Aurora M4*
"""

    _RESULTS_FILE.write_text(header + "\n".join(rows) + footer, encoding="utf-8")
    print(f"  Results written to: {_RESULTS_FILE}")


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="ShadowSense Aurora — M4 Integration Test Runner"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Skip HTTP calls; mark all results as PENDING",
    )
    parser.add_argument(
        "--base-url",
        default="http://localhost:8000",
        metavar="URL",
        help="Base URL of the ShadowSense backend (default: http://localhost:8000)",
    )
    parser.add_argument(
        "--scenario",
        default=None,
        metavar="SCENARIO_ID",
        help="Run a single scenario by its scenario_id",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=15,
        metavar="SECONDS",
        help="HTTP request timeout in seconds (default: 15)",
    )
    args = parser.parse_args()
    run(args)


if __name__ == "__main__":
    main()
