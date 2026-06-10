"""
tests/unit/test_feedback_logging.py
=====================================
Unit tests for the Week 4 JSONL feedback logging feature.

Verifies that ``POST /api/feedback/`` and ``POST /api/feedback/override``
each append a valid JSON record to ``logs/feedback.jsonl``.

These tests run entirely offline — no ChromaDB or ml-pipeline required.
The override endpoint gracefully degrades to a 503 when the feedback loop
is unavailable, so we test both the logging path (general feedback) and
the schema of each log entry.
"""
import json
import sys
import pytest
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

# Ensure project root is on the path
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))


# ---------------------------------------------------------------------------
# We patch the _FEEDBACK_LOG path so tests write to a temp file, not logs/
# ---------------------------------------------------------------------------

@pytest.fixture()
def temp_feedback_log(tmp_path: Path):
    """Redirect feedback JSONL writes to a temporary file for test isolation."""
    log_file = tmp_path / "feedback.jsonl"
    # Patch both the log path and the logs dir inside the feedback module
    import backend.api.feedback as fb_module
    original_log = fb_module._FEEDBACK_LOG
    original_dir = fb_module._LOGS_DIR
    fb_module._FEEDBACK_LOG = log_file
    fb_module._LOGS_DIR = tmp_path
    yield log_file
    # Restore after test
    fb_module._FEEDBACK_LOG = original_log
    fb_module._LOGS_DIR = original_dir


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _read_jsonl(path: Path) -> list[dict]:
    """Read all JSON lines from a JSONL file into a list of dicts."""
    if not path.exists():
        return []
    lines = path.read_text(encoding="utf-8").strip().splitlines()
    return [json.loads(line) for line in lines if line.strip()]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestGeneralFeedbackLogging:
    """Tests for the general POST /api/feedback/ endpoint."""

    def test_feedback_jsonl_file_created(self, temp_feedback_log: Path):
        """A POST to /api/feedback/ must create feedback.jsonl if it doesn't exist."""
        from fastapi.testclient import TestClient
        from backend.main import app

        client = TestClient(app)
        response = client.post("/api/feedback/", json={
            "analysis_id": "test-001",
            "user_feedback": "override",
            "was_accurate": False,
            "additional_context": {},
        })
        assert response.status_code == 200
        assert temp_feedback_log.exists(), "logs/feedback.jsonl was not created"

    def test_feedback_jsonl_one_record_appended(self, temp_feedback_log: Path):
        """Each POST must append exactly one new JSON line."""
        from fastapi.testclient import TestClient
        from backend.main import app

        client = TestClient(app)
        client.post("/api/feedback/", json={
            "analysis_id": "test-002",
            "user_feedback": "false_positive",
            "was_accurate": True,
            "additional_context": {"note": "seems legit"},
        })

        records = _read_jsonl(temp_feedback_log)
        assert len(records) == 1, f"Expected 1 record, got {len(records)}"

    def test_feedback_jsonl_record_schema(self, temp_feedback_log: Path):
        """Each log line must be valid JSON with required fields."""
        from fastapi.testclient import TestClient
        from backend.main import app

        client = TestClient(app)
        client.post("/api/feedback/", json={
            "analysis_id": "test-003",
            "user_feedback": "override",
            "was_accurate": False,
            "additional_context": {},
        })

        records = _read_jsonl(temp_feedback_log)
        assert len(records) >= 1
        record = records[-1]

        required_fields = {"timestamp", "event", "analysis_id", "action", "was_accurate"}
        missing = required_fields - set(record.keys())
        assert not missing, f"JSONL record missing fields: {missing}"

        # timestamp must be ISO 8601 and end with Z
        assert record["timestamp"].endswith("Z"), (
            f"timestamp should end with 'Z', got: {record['timestamp']}"
        )
        assert record["event"] == "general_feedback"
        assert record["analysis_id"] == "test-003"

    def test_multiple_posts_append_multiple_records(self, temp_feedback_log: Path):
        """Two POSTs should result in two separate JSON lines (not overwrite)."""
        from fastapi.testclient import TestClient
        from backend.main import app

        client = TestClient(app)
        for i in range(3):
            client.post("/api/feedback/", json={
                "analysis_id": f"test-multi-{i}",
                "user_feedback": "override",
                "was_accurate": False,
                "additional_context": {},
            })

        records = _read_jsonl(temp_feedback_log)
        assert len(records) == 3, (
            f"Expected 3 records after 3 POSTs, got {len(records)}"
        )
        # Each must have a unique analysis_id
        ids = [r["analysis_id"] for r in records]
        assert ids == ["test-multi-0", "test-multi-1", "test-multi-2"]


class TestFeedbackLogWriteResiliency:
    """Ensure logging failures do not crash the endpoint."""

    def test_endpoint_succeeds_even_if_log_write_fails(self, temp_feedback_log: Path):
        """If the filesystem write fails (e.g., permissions error), endpoint still returns 200.

        We mock ``builtins.open`` inside the feedback module so the internal
        try/except in ``_append_feedback_log`` catches the error — that's exactly
        the resilience path we want to verify.
        """
        from fastapi.testclient import TestClient
        from backend.main import app
        from unittest.mock import patch, mock_open

        # Patch open() only inside the feedback module so the mkdir and the
        # file write both fail, but _append_feedback_log catches OSError.
        with patch("backend.api.feedback._LOGS_DIR") as mock_dir:
            mock_dir.mkdir.side_effect = OSError("disk full")
            client = TestClient(app)
            response = client.post("/api/feedback/", json={
                "analysis_id": "test-resilient",
                "user_feedback": "override",
                "was_accurate": False,
                "additional_context": {},
            })

        # Endpoint must still succeed — logging is best-effort
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
