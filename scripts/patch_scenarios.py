"""
patch_scenarios.py — adds expected_trust_score_range and expected_intervention
to any scenario JSON that is missing them.

Mapping rules (consistent with ShadowSense Trust Score tiers):
  critical / high  → range 0-39,  intervention: block
  medium           → range 40-69, intervention: advisory
  low              → range 70-100, intervention: clear

Run from repo root:
  python scripts/patch_scenarios.py
"""

import json
import pathlib

SCENARIOS_DIR = pathlib.Path(__file__).resolve().parent.parent / "tests" / "test_scenarios"

THREAT_MAP = {
    "critical": {"expected_trust_score_range": {"min": 0,  "max": 39},  "expected_intervention": "block"},
    "high":     {"expected_trust_score_range": {"min": 0,  "max": 39},  "expected_intervention": "block"},
    "medium":   {"expected_trust_score_range": {"min": 40, "max": 69},  "expected_intervention": "advisory"},
    "low":      {"expected_trust_score_range": {"min": 70, "max": 100}, "expected_intervention": "clear"},
}

def patch_file(path: pathlib.Path) -> bool:
    data = json.loads(path.read_text(encoding="utf-8"))

    if "expected_trust_score_range" in data and "expected_intervention" in data:
        return False  # already patched

    threat = data.get("expected_threat_level", "").lower()
    patch = THREAT_MAP.get(threat)

    if patch is None:
        print(f"  SKIP  {path.name}  — unknown threat level: '{threat}'")
        return False

    data["expected_trust_score_range"] = patch["expected_trust_score_range"]
    data["expected_intervention"]      = patch["expected_intervention"]

    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  PATCH {path.name}  ({threat} -> {patch['expected_intervention']})")
    return True


def main():
    files = sorted(SCENARIOS_DIR.glob("*.json"))
    patched = sum(patch_file(f) for f in files)
    print(f"\nDone — {patched}/{len(files)} files patched.")


if __name__ == "__main__":
    main()
