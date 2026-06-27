"""
ml-pipeline/feedback_loop.py
============================
Handles "Override + Report" events from the ShadowSense extension (M1).

Workflow
--------
1. User clicks "Override + Report" on a flagged message.
2. ``process_override()`` is called with pattern text + analysis_id.
3. The message is stored in ChromaDB collection ``feedback_overrides`` with
   metadata: ``{false_positive: true, trust_score: 22}``.
4. A per-pattern override counter is maintained in the persistent
   ``benign_pattern_votes`` collection.
5. When a pattern accumulates ≥ ``BENIGN_THRESHOLD`` (default: 3) overrides,
   ``mark_benign_pattern()`` is called automatically.
6. ShieldAgent (M1) reads ``get_trust_score_boost()`` before returning the
   final Trust Score; benign patterns receive a ``+BENIGN_SCORE_BOOST``
   (default: +20) uplift, clamped to 100.

Public API
----------
  FeedbackLoop
      .process_override(feedback_data)          → OverrideResult
      .get_trust_score_boost(pattern_text)       → int  (0 or +20)
      .get_override_count(pattern_key)           → int
      .is_benign_pattern(pattern_key)            → bool
      .list_benign_patterns()                    → list[dict]
      .retrieve_similar_overrides(text, n)       → list

  process_override(feedback_data)                → OverrideResult  (module-level)
  get_trust_score_boost(pattern_text)            → int             (module-level)
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import sys
import threading
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Bootstrap: make sure the ml-pipeline directory is importable
# ---------------------------------------------------------------------------
_HERE = Path(__file__).resolve().parent
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

try:
    from embeddings import EmbeddingsGenerator  # type: ignore
    _EMBEDDINGS_AVAILABLE = True
except Exception:
    EmbeddingsGenerator = None  # type: ignore[assignment,misc]
    _EMBEDDINGS_AVAILABLE = False

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BENIGN_THRESHOLD: int = 3          # overrides needed to mark a pattern benign
BENIGN_SCORE_BOOST: int = 20       # trust-score points awarded for benign patterns
INITIAL_TRUST_SCORE: int = 22      # default trust_score stored in override metadata

_REPO_ROOT   = Path(__file__).resolve().parent.parent
_DEFAULT_DB  = _REPO_ROOT / "data" / "chromadb"

_OVERRIDES_COLLECTION = "feedback_overrides"
_BENIGN_COLLECTION    = "benign_pattern_votes"

# Audit log for override events
_LOG_DIR  = _REPO_ROOT / "logs"
_LOG_FILE = _LOG_DIR / "override_events.jsonl"


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class OverrideResult:
    """Return value from ``process_override``."""
    success: bool
    analysis_id: str
    pattern_key: str
    override_count: int
    marked_benign: bool
    trust_score_boost: int
    message: str
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _pattern_key(text: str) -> str:
    """
    Stable, collision-resistant key for a pattern text string.

    Hashing normalises whitespace differences while staying deterministic
    across runs (unlike Python's built-in ``hash()`` which is salted).
    """
    normalised = " ".join(text.lower().split())
    return hashlib.sha256(normalised.encode("utf-8")).hexdigest()[:16]


def _log_override_event(event: Dict[str, Any]) -> None:
    """Append one JSONL line to the override audit log (best-effort)."""
    try:
        _LOG_DIR.mkdir(parents=True, exist_ok=True)
        with open(_LOG_FILE, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(event, ensure_ascii=False) + "\n")
    except Exception as exc:
        log.warning("_log_override_event: could not write audit log: %s", exc)


# ---------------------------------------------------------------------------
# FeedbackLoop
# ---------------------------------------------------------------------------

class FeedbackLoop:
    """
    Processes "Override + Report" events and maintains benign-pattern state.

    Parameters
    ----------
    db_dir : Path | str
        Persistent ChromaDB directory.  Defaults to ``<repo>/data/chromadb``.
    benign_threshold : int
        Number of unique user overrides required to mark a pattern benign.
    benign_score_boost : int
        Trust-score points added when a benign pattern is detected.
    """

    def __init__(
        self,
        db_dir: Path | str = _DEFAULT_DB,
        benign_threshold: int = BENIGN_THRESHOLD,
        benign_score_boost: int = BENIGN_SCORE_BOOST,
    ) -> None:
        self.db_dir          = Path(db_dir)
        self.benign_threshold = benign_threshold
        self.benign_boost    = benign_score_boost

        # Lazy-initialised clients
        self._client: Optional[Any]           = None
        self._overrides_col: Optional[Any]    = None
        self._benign_col: Optional[Any]       = None
        self._embeddings: Optional[Any]       = None

        # Per-pattern locks for thread-safe read-modify-write on override counter
        self._pattern_locks: dict[str, threading.Lock] = {}

        log.info(
            "FeedbackLoop ready. db=%s  threshold=%d  boost=+%d",
            self.db_dir, self.benign_threshold, self.benign_boost,
        )

    # ------------------------------------------------------------------
    # Lazy DB / embedding initialisation
    # ------------------------------------------------------------------

    def _get_client(self):
        if self._client is None:
            if not _CHROMA_AVAILABLE:
                raise RuntimeError(
                    "chromadb is not installed. Run: pip install chromadb"
                )
            self.db_dir.mkdir(parents=True, exist_ok=True)
            self._client = chromadb.PersistentClient(
                path=str(self.db_dir),
                settings=_ChromaSettings(anonymized_telemetry=False),
            )
        return self._client

    def _get_overrides_collection(self):
        if self._overrides_col is None:
            client = self._get_client()
            self._overrides_col = client.get_or_create_collection(
                name=_OVERRIDES_COLLECTION,
                metadata={
                    "hnsw:space": "cosine",
                    "description": "User override / false-positive reports",
                },
            )
        return self._overrides_col

    def _get_benign_collection(self):
        if self._benign_col is None:
            client = self._get_client()
            self._benign_col = client.get_or_create_collection(
                name=_BENIGN_COLLECTION,
                metadata={
                    "hnsw:space": "cosine",
                    "description": "Benign pattern vote counters and status",
                },
            )
        return self._benign_col

    def _get_embeddings(self) -> Any:
        if self._embeddings is None:
            if not _EMBEDDINGS_AVAILABLE:
                raise RuntimeError(
                    "EmbeddingsGenerator unavailable — cannot create embeddings."
                )
            self._embeddings = EmbeddingsGenerator()
        return self._embeddings

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def process_override(self, feedback_data: Dict[str, Any]) -> OverrideResult:
        """
        Handle an "Override + Report" event from the extension.

        Parameters
        ----------
        feedback_data : dict
            Expected keys:
              - ``analysis_id``   (str)  — unique ID of the analysis event
              - ``pattern_text``  (str)  — the message/pattern the user overrode
              - ``user_id``       (str, optional)  — anonymised user identifier
              - ``trust_score``   (int, optional)  — original trust score (default 22)

        Returns
        -------
        OverrideResult
            Contains override count, benign status, and trust-score boost.
        """
        t_start = time.perf_counter()

        analysis_id  = str(feedback_data.get("analysis_id", ""))
        pattern_text = str(feedback_data.get("pattern_text", "")).strip()
        user_id      = str(feedback_data.get("user_id", "anonymous"))
        trust_score  = int(feedback_data.get("trust_score", INITIAL_TRUST_SCORE))

        if not analysis_id:
            raise ValueError("feedback_data must contain a non-empty 'analysis_id'.")
        if not pattern_text:
            raise ValueError("feedback_data must contain a non-empty 'pattern_text'.")

        key = _pattern_key(pattern_text)
        ts  = datetime.now(timezone.utc).isoformat()

        log.info(
            "process_override: analysis_id=%s  key=%s  user=%s  trust_score=%d",
            analysis_id, key, user_id, trust_score,
        )

        # ── 1. Store override in ChromaDB feedback_overrides ──────────────
        self._store_override(
            analysis_id  = analysis_id,
            pattern_key  = key,
            pattern_text = pattern_text,
            user_id      = user_id,
            trust_score  = trust_score,
            ts           = ts,
        )

        # ── 2. Increment the per-pattern override counter ─────────────────
        override_count = self._increment_override_count(
            pattern_key  = key,
            pattern_text = pattern_text,
            ts           = ts,
        )

        # ── 3. Check benign threshold → auto-mark if reached ─────────────
        already_benign = self._is_benign(key)
        newly_benign   = False
        if not already_benign and override_count >= self.benign_threshold:
            self.mark_benign_pattern(key, pattern_text, override_count, ts)
            newly_benign = True
            log.info(
                "Pattern '%s...' promoted to BENIGN after %d overrides.",
                pattern_text[:60], override_count,
            )

        is_benign        = already_benign or newly_benign
        trust_boost      = self.benign_boost if is_benign else 0
        elapsed_ms       = round((time.perf_counter() - t_start) * 1000, 2)

        # ── 4. Audit log ──────────────────────────────────────────────────
        _log_override_event({
            "ts":             ts,
            "event":          "override_reported",
            "analysis_id":    analysis_id,
            "pattern_key":    key,
            "pattern_text":   pattern_text[:200],
            "user_id":        user_id,
            "trust_score":    trust_score,
            "override_count": override_count,
            "is_benign":      is_benign,
            "newly_benign":   newly_benign,
            "trust_boost":    trust_boost,
            "elapsed_ms":     elapsed_ms,
        })

        result = OverrideResult(
            success          = True,
            analysis_id      = analysis_id,
            pattern_key      = key,
            override_count   = override_count,
            marked_benign    = is_benign,
            trust_score_boost= trust_boost,
            message          = (
                f"Override recorded. Pattern marked BENIGN (+{self.benign_boost} trust boost)."
                if is_benign else
                f"Override recorded. {self.benign_threshold - override_count} more override(s) needed to mark benign."
            ),
            details          = {
                "newly_promoted": newly_benign,
                "elapsed_ms":     elapsed_ms,
            },
        )

        log.info(
            "Override processed in %.1fms. count=%d  benign=%s  boost=%d",
            elapsed_ms, override_count, is_benign, trust_boost,
        )
        return result

    def get_trust_score_boost(self, pattern_text: str) -> int:
        """
        Return the trust-score boost for a given pattern text.

        Called by ShieldAgent (M1) before returning the final Trust Score.
        Returns ``+BENIGN_SCORE_BOOST`` if the pattern is benign, else 0.

        Parameters
        ----------
        pattern_text : str
            Raw message/pattern text from the current analysis.

        Returns
        -------
        int
            Trust-score boost to *add* to the ShieldAgent's raw score.
        """
        if not pattern_text or not pattern_text.strip():
            return 0
        key = _pattern_key(pattern_text)
        is_b = self._is_benign(key)
        if is_b:
            log.info(
                "get_trust_score_boost: pattern '%s...' is BENIGN → +%d",
                pattern_text[:60], self.benign_boost,
            )
        return self.benign_boost if is_b else 0

    def get_override_count(self, pattern_key: str) -> int:
        """Return how many users have overridden this pattern (by key)."""
        return self._get_current_vote_count(pattern_key)

    def is_benign_pattern(self, pattern_key: str) -> bool:
        """Return True if the pattern has been promoted to benign status."""
        return self._is_benign(pattern_key)

    def list_benign_patterns(self) -> List[Dict[str, Any]]:
        """
        Return all patterns currently marked as benign.

        Returns
        -------
        list of dict, each with keys:
            - ``pattern_key``    : str  — short SHA-256 hex key
            - ``pattern_text``   : str  — original pattern text
            - ``override_count`` : int
            - ``promoted_at``    : str  — ISO-8601 timestamp
        """
        try:
            col = self._get_benign_collection()
            results = col.get(
                where={"benign": True},
                include=["documents", "metadatas"],
            )
            output = []
            ids       = results.get("ids", [])
            documents = results.get("documents", [])
            metas     = results.get("metadatas", [])
            for doc_id, text, meta in zip(ids, documents, metas):
                output.append({
                    "pattern_key":    doc_id,
                    "pattern_text":   text,
                    "override_count": int(meta.get("override_count", 0)),
                    "promoted_at":    meta.get("promoted_at", ""),
                })
            return output
        except Exception as exc:
            log.warning("list_benign_patterns error: %s", exc)
            return []

    def mark_benign_pattern(
        self,
        pattern_key: str,
        pattern_text: str,
        override_count: int,
        ts: str,
    ) -> None:
        """
        Explicitly mark a pattern as benign (idempotent).

        This is called automatically by ``process_override`` when the threshold
        is reached, but can also be called manually for administrative overrides.
        """
        try:
            col = self._get_benign_collection()
            # Use a zero-vector placeholder — HNSW similarity is irrelevant here;
            # we query by metadata filter (where benign=True), not by similarity.
            dim = 384  # all-MiniLM-L6-v2 dimension
            placeholder = [0.0] * dim

            col.upsert(
                ids        = [pattern_key],
                documents  = [pattern_text],
                embeddings = [placeholder],
                metadatas  = [{
                    "benign":         True,
                    "override_count": override_count,
                    "promoted_at":    ts,
                    "threshold":      self.benign_threshold,
                    "boost":          self.benign_boost,
                }],
            )
            log.info("mark_benign_pattern: key=%s stored with count=%d", pattern_key, override_count)

            _log_override_event({
                "ts":             ts,
                "event":          "pattern_marked_benign",
                "pattern_key":    pattern_key,
                "pattern_text":   pattern_text[:200],
                "override_count": override_count,
                "boost":          self.benign_boost,
            })
        except Exception as exc:
            log.error("mark_benign_pattern failed: %s", exc)
            raise

    def retrieve_similar_overrides(
        self,
        text: str,
        n_results: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Semantic search over the feedback_overrides collection.

        Useful for surfacing related false-positive reports during re-training.

        Parameters
        ----------
        text      : Query string
        n_results : Max results to return

        Returns
        -------
        list of dicts with keys ``text``, ``metadata``, ``distance``
        """
        try:
            embedder = self._get_embeddings()
            col      = self._get_overrides_collection()

            if col.count() == 0:
                log.info("retrieve_similar_overrides: collection is empty.")
                return []

            vec = embedder.embed_text(text)
            raw = col.query(
                query_embeddings = [vec],
                n_results        = min(n_results, col.count()),
                include          = ["documents", "metadatas", "distances"],
            )

            results = []
            for doc, meta, dist in zip(
                raw.get("documents", [[]])[0],
                raw.get("metadatas", [[]])[0],
                raw.get("distances", [[]])[0],
            ):
                results.append({
                    "text":     doc,
                    "metadata": meta,
                    "distance": round(float(dist), 4),
                })
            return results

        except Exception as exc:
            log.error("retrieve_similar_overrides error: %s", exc)
            return []

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _store_override(
        self,
        analysis_id: str,
        pattern_key: str,
        pattern_text: str,
        user_id: str,
        trust_score: int,
        ts: str,
    ) -> None:
        """
        Embed the pattern text and upsert it into the feedback_overrides
        collection with required metadata.

        Metadata written (as per spec):
            { false_positive: true, trust_score: 22, … }
        """
        try:
            col = self._get_overrides_collection()

            # Generate embedding (falls back to sentence-transformers)
            try:
                embedder = self._get_embeddings()
                vec = embedder.embed_text(pattern_text)
            except Exception as emb_err:
                log.warning(
                    "_store_override: embedding failed (%s), using zero-vector fallback.",
                    emb_err,
                )
                vec = [0.0] * 384

            col.upsert(
                ids        = [analysis_id],
                documents  = [pattern_text],
                embeddings = [vec],
                metadatas  = [{
                    "false_positive": True,         # spec requirement
                    "trust_score":    trust_score,  # spec: 22
                    "pattern_key":    pattern_key,
                    "user_id":        user_id,
                    "reported_at":    ts,
                }],
            )
            log.debug("_store_override: analysis_id=%s upserted.", analysis_id)
        except Exception as exc:
            log.error("_store_override failed: %s", exc)
            raise

    def _increment_override_count(
        self,
        pattern_key: str,
        pattern_text: str,
        ts: str,
    ) -> int:
        """
        Increment the per-pattern override counter and return the new count.

        The counter is stored in the ``benign_pattern_votes`` collection.
        Existing records are retrieved, count is incremented, and the record
        is upserted (idempotent).

        Thread-safety: a per-pattern lock serialises the read-modify-write so
        concurrent requests for the same pattern cannot corrupt the count.
        """
        # Acquire a per-pattern lock (created on first use, never released)
        lock = self._pattern_locks.setdefault(pattern_key, threading.Lock())
        with lock:
            try:
                col = self._get_benign_collection()

                # Check if a record already exists for this pattern
                existing = col.get(ids=[pattern_key], include=["metadatas", "documents"])
                existing_ids = existing.get("ids", [])

                if existing_ids:
                    # Increment existing count
                    current_meta = existing["metadatas"][0]
                    current_text = existing["documents"][0]
                    new_count    = int(current_meta.get("override_count", 0)) + 1
                    benign       = current_meta.get("benign", False)
                else:
                    # First override for this pattern
                    current_text = pattern_text
                    new_count    = 1
                    benign       = False

                dim = 384
                placeholder = [0.0] * dim

                col.upsert(
                    ids        = [pattern_key],
                    documents  = [current_text],
                    embeddings = [placeholder],
                    metadatas  = [{
                        "override_count": new_count,
                        "benign":         benign,
                        "last_override":  ts,
                        "threshold":      self.benign_threshold,
                        "boost":          self.benign_boost,
                    }],
                )
                log.debug(
                    "_increment_override_count: key=%s  new_count=%d", pattern_key, new_count
                )
                return new_count
            except Exception as exc:
                log.error("_increment_override_count failed: %s", exc)
                return 0


    def _get_current_vote_count(self, pattern_key: str) -> int:
        """Read the override counter without mutating it."""
        try:
            col     = self._get_benign_collection()
            results = col.get(ids=[pattern_key], include=["metadatas"])
            if results.get("ids"):
                return int(results["metadatas"][0].get("override_count", 0))
            return 0
        except Exception as exc:
            log.warning("_get_current_vote_count error: %s", exc)
            return 0

    def _is_benign(self, pattern_key: str) -> bool:
        """Return True if this pattern has already been promoted to benign."""
        try:
            col     = self._get_benign_collection()
            results = col.get(ids=[pattern_key], include=["metadatas"])
            if results.get("ids"):
                return bool(results["metadatas"][0].get("benign", False))
            return False
        except Exception as exc:
            log.warning("_is_benign check error: %s", exc)
            return False


# ===========================================================================
# Module-level singleton + convenience functions (M1 integration surface)
# ===========================================================================

_feedback_loop: Optional[FeedbackLoop] = None


def _get_feedback_loop() -> FeedbackLoop:
    global _feedback_loop
    if _feedback_loop is None:
        _feedback_loop = FeedbackLoop()
    return _feedback_loop


def _reset_feedback_loop() -> None:
    """Reset the module-level singleton — **for unit tests only**.

    Call this in test setUp / tearDown to ensure each test starts with a
    fresh FeedbackLoop instance without having to reload the module.
    """
    global _feedback_loop
    _feedback_loop = None


def process_override(feedback_data: Dict[str, Any]) -> OverrideResult:
    """
    Module-level convenience wrapper for ``FeedbackLoop.process_override``.

    Called by ``backend/api/feedback.py`` when the user clicks
    "Override + Report".

    Parameters
    ----------
    feedback_data : dict
        Keys: ``analysis_id``, ``pattern_text``, ``user_id`` (optional),
        ``trust_score`` (optional, default 22).

    Returns
    -------
    OverrideResult
    """
    return _get_feedback_loop().process_override(feedback_data)


def get_trust_score_boost(pattern_text: str) -> int:
    """
    Module-level convenience wrapper for ``FeedbackLoop.get_trust_score_boost``.

    Imported and called by ShieldAgent (M1) to apply the benign-pattern
    trust-score uplift before returning the final verdict.

    Returns
    -------
    int
        ``+BENIGN_SCORE_BOOST`` if the pattern is benign, otherwise ``0``.
    """
    return _get_feedback_loop().get_trust_score_boost(pattern_text)


# ===========================================================================
# Standalone smoke-test
# ===========================================================================

if __name__ == "__main__":
    import pprint

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
        datefmt="%H:%M:%S",
    )

    print("\n" + "=" * 65)
    print("  ShadowSense — FeedbackLoop smoke-test")
    print("=" * 65)

    loop = FeedbackLoop()

    PATTERN = "Send payment via gift card outside the platform to avoid fees."

    # Simulate 3 users overriding the same pattern
    for i in range(1, 4):
        result = loop.process_override({
            "analysis_id":  f"test-override-{i:03d}",
            "pattern_text": PATTERN,
            "user_id":      f"user_{i:03d}",
            "trust_score":  22,
        })
        print(f"\n  Override #{i}:")
        pprint.pprint(result.to_dict(), indent=4)

    print("\n  ── Trust score boost check ──")
    boost = loop.get_trust_score_boost(PATTERN)
    print(f"  Boost for known pattern : +{boost}")

    boost_unknown = loop.get_trust_score_boost("Hello, how are you today?")
    print(f"  Boost for unknown text  : +{boost_unknown}")

    print("\n  ── Benign patterns list ──")
    pprint.pprint(loop.list_benign_patterns(), indent=4)

    print("\n" + "=" * 65 + "\n")
