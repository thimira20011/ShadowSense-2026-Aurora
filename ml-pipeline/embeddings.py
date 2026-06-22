"""
ml-pipeline/embeddings.py
=========================
Text-embedding generation and semantic similarity search for ShadowSense Aurora.

Primary model : sentence-transformers  all-MiniLM-L6-v2  (fast, local, no server needed)
Fallback model: Ollama /api/embed      (deepseek-r1 or configurable via DEEPSEEK_MODEL)

Public API
----------
  query_similar_scams(message_text: str, top_k: int = 3) -> list[dict]
      Embed *message_text*, query the ChromaDB ``scam_patterns`` collection,
      and return the top-k most similar scam patterns as:

          [
            {"text": "...", "similarity": 0.87, "type": "phishing"},
            ...
          ]

  EmbeddingsGenerator
      Low-level class for embedding generation.  Exposed for use by
      feedback_loop.py and other pipeline modules.
"""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Dependency guards
# ---------------------------------------------------------------------------
try:
    from sentence_transformers import SentenceTransformer
    _ST_AVAILABLE = True
except ImportError:
    _ST_AVAILABLE = False
    log.warning(
        "sentence-transformers not installed. "
        "Run: pip install sentence-transformers"
    )

try:
    import requests as _requests
    _REQUESTS_AVAILABLE = True
except ImportError:
    _requests = None          # type: ignore[assignment]
    _REQUESTS_AVAILABLE = False

try:
    import chromadb
    from chromadb.config import Settings as _ChromaSettings
    _CHROMA_AVAILABLE = True
except ImportError:
    chromadb = None            # type: ignore[assignment]
    _CHROMA_AVAILABLE = False
    log.warning(
        "chromadb not installed. "
        "Run: pip install chromadb"
    )

# ---------------------------------------------------------------------------
# Configuration defaults (overridable via env-vars)
# ---------------------------------------------------------------------------
_DEFAULT_ST_MODEL  = "all-MiniLM-L6-v2"          # 384-dim, ~23 MB, very fast
_DEFAULT_OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
_DEFAULT_OLLAMA_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-r1")

# ChromaDB: persistent store lives in  <repo-root>/data/chromadb
_REPO_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_DB_DIR = _REPO_ROOT / "data" / "chromadb"
_COLLECTION_NAME     = "scam_patterns"       # Chat message scam patterns
JOB_SCAM_COLLECTION  = "job_scam_patterns"   # Job listing / gig scam patterns (pre-engagement)

# Query audit log: <repo-root>/logs/chromadb_queries.jsonl
_LOG_DIR  = _REPO_ROOT / "logs"
_LOG_FILE = _LOG_DIR / "chromadb_queries.jsonl"


# ===========================================================================
# EmbeddingsGenerator
# ===========================================================================

class EmbeddingsGenerator:
    """
    Generates text embeddings for arbitrary strings.

    Backend priority
    ----------------
    1. sentence-transformers  (all-MiniLM-L6-v2 by default) — local, no server
    2. Ollama /api/embed      (deepseek-r1 by default)       — requires Ollama
    3. Raises RuntimeError if neither is available.

    Parameters
    ----------
    model_name : str
        sentence-transformers model name (default: ``all-MiniLM-L6-v2``).
    ollama_host : str
        Base URL of a running Ollama instance.
    ollama_model : str
        Ollama model to use for embeddings (must support /api/embed).
    prefer_ollama : bool
        If True, try Ollama *before* sentence-transformers.
    """

    def __init__(
        self,
        model_name: str = _DEFAULT_ST_MODEL,
        ollama_host: str = _DEFAULT_OLLAMA_HOST,
        ollama_model: str = _DEFAULT_OLLAMA_MODEL,
        prefer_ollama: bool = False,
    ) -> None:
        self.model_name   = model_name
        self.ollama_host  = ollama_host
        self.ollama_model = ollama_model
        self.prefer_ollama = prefer_ollama

        self._st_model: Optional[SentenceTransformer] = None  # lazy-loaded

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def embed_text(self, text: str) -> List[float]:
        """Embed a single string and return a flat float vector."""
        return self.embed_batch([text])[0]

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Embed a list of strings.

        Returns a list of float vectors (one per input text).
        Raises RuntimeError if no backend is available.
        """
        if not texts:
            return []

        if self.prefer_ollama:
            vectors = self._try_ollama(texts)
            if vectors is not None:
                return vectors
            log.info("Ollama unavailable — falling back to sentence-transformers.")
            return self._st_embed(texts)
        else:
            # Default: sentence-transformers first
            if _ST_AVAILABLE:
                return self._st_embed(texts)
            log.info("sentence-transformers not available — trying Ollama.")
            vectors = self._try_ollama(texts)
            if vectors is not None:
                return vectors

        raise RuntimeError(
            "No embedding backend is available.\n"
            "  Option A: pip install sentence-transformers\n"
            "  Option B: Start Ollama with a model that supports /api/embed"
        )

    # ------------------------------------------------------------------
    # Backend: sentence-transformers
    # ------------------------------------------------------------------

    def _load_st_model(self) -> "SentenceTransformer":
        """Lazy-load the sentence-transformer model (thread-safe enough for CPython)."""
        if self._st_model is None:
            log.info("Loading sentence-transformers model '%s' ...", self.model_name)
            self._st_model = SentenceTransformer(self.model_name)
            # get_embedding_dimension() is the new API name; fall back for older installs
            dim_fn = getattr(
                self._st_model,
                "get_embedding_dimension",
                self._st_model.get_sentence_embedding_dimension,
            )
            log.info("Model loaded. Embedding dimension: %d", dim_fn())
        return self._st_model

    def _st_embed(self, texts: List[str]) -> List[List[float]]:
        model = self._load_st_model()
        vectors = model.encode(
            texts,
            show_progress_bar=len(texts) > 10,
            convert_to_numpy=True,
            normalize_embeddings=True,  # unit-length → cosine ≡ dot product
        )
        return vectors.tolist()

    # ------------------------------------------------------------------
    # Backend: Ollama
    # ------------------------------------------------------------------

    def _try_ollama(self, texts: List[str]) -> Optional[List[List[float]]]:
        """Return embeddings from Ollama, or None on any failure."""
        if not _REQUESTS_AVAILABLE:
            return None
        try:
            resp = _requests.post(
                f"{self.ollama_host}/api/embed",
                json={"model": self.ollama_model, "input": texts},
                timeout=60,
            )
            resp.raise_for_status()
            data = resp.json()
            vectors = data.get("embeddings")
            if vectors and len(vectors) == len(texts):
                log.info(
                    "Ollama embeddings OK (model=%s, dim=%d)",
                    self.ollama_model, len(vectors[0]),
                )
                return vectors
            log.warning("Ollama returned unexpected payload: %s", list(data.keys()))
        except Exception as exc:
            log.warning("Ollama /api/embed failed: %s", exc)
        return None

    # ------------------------------------------------------------------
    # Convenience properties
    # ------------------------------------------------------------------

    @property
    def embedding_dim(self) -> int:
        """Return embedding dimension (requires sentence-transformers to be available)."""
        if _ST_AVAILABLE:
            model = self._load_st_model()
            dim_fn = getattr(
                model,
                "get_embedding_dimension",
                model.get_sentence_embedding_dimension,
            )
            return dim_fn()
        return -1  # unknown without running a query


# ===========================================================================
# ChromaDB helper
# ===========================================================================

def _get_chroma_collection(
    db_dir: Path = _DEFAULT_DB_DIR,
    collection_name: str = _COLLECTION_NAME,
):
    """
    Return a persistent ChromaDB collection for scam patterns.

    Raises RuntimeError if chromadb is not installed.
    """
    if not _CHROMA_AVAILABLE:
        raise RuntimeError(
            "chromadb is not installed. Run: pip install chromadb"
        )
    db_dir.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(
        path=str(db_dir),
        settings=_ChromaSettings(anonymized_telemetry=False),
    )
    collection = client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"},
    )
    return collection


# ===========================================================================
# Public API — M1 integration point
# ===========================================================================

# Module-level singleton (created on first call to query_similar_scams)
_generator: Optional[EmbeddingsGenerator] = None


def _get_generator() -> EmbeddingsGenerator:
    global _generator
    if _generator is None:
        _generator = EmbeddingsGenerator()
    return _generator


def _log_query(
    message_text: str,
    top_k: int,
    results: List[Dict[str, Any]],
    embed_ms: float,
    query_ms: float,
    total_ms: float,
    log_file: Path = _LOG_FILE,
) -> None:
    """
    Append one JSONL line to *log_file* recording a ChromaDB query.

    Each line has the structure::

        {
          "ts":         "2026-06-04T07:12:34.567890+00:00",
          "query":      "Pay me via gift card...",
          "top_k":      3,
          "embed_ms":   12.4,
          "query_ms":   3.1,
          "total_ms":   15.5,
          "n_results":  3,
          "results": [
            {"id": "scam_001", "type": "phishing", "category": "...",
             "similarity": 0.87, "severity": 9}
          ]
        }
    """
    try:
        log_file.parent.mkdir(parents=True, exist_ok=True)
        entry = {
            "ts":       datetime.now(timezone.utc).isoformat(),
            "query":    message_text[:200],          # cap at 200 chars for PII safety
            "top_k":    top_k,
            "embed_ms": round(embed_ms, 3),
            "query_ms": round(query_ms, 3),
            "total_ms": round(total_ms, 3),
            "n_results": len(results),
            "results": [
                {
                    "id":         r["id"],
                    "type":       r["type"],
                    "category":   r["category"],
                    "similarity": r["similarity"],
                    "severity":   r["severity"],
                }
                for r in results
            ],
        }
        with open(log_file, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception as exc:  # never let logging crash the main path
        log.warning("_log_query: could not write to %s: %s", log_file, exc)


def query_similar_scams(
    message_text: str,
    top_k: int = 3,
    db_dir: Path = _DEFAULT_DB_DIR,
    collection_name: str = _COLLECTION_NAME,
    min_similarity: float = 0.0,
) -> List[Dict[str, Any]]:
    """
    Embed *message_text* and retrieve the top-k most similar scam patterns
    from ChromaDB.

    Parameters
    ----------
    message_text : str
        The incoming message to analyse.
    top_k : int
        Number of nearest neighbours to return (default: 3).
    db_dir : Path
        Path to the ChromaDB persistent directory.
    collection_name : str
        Name of the ChromaDB collection to query.
    min_similarity : float
        Minimum cosine similarity (0–1) to include in results.

    Returns
    -------
    list of dict, each with keys:
        - ``text``       : matched scam pattern text (str)
        - ``similarity`` : cosine similarity score 0–1 (float, rounded to 4 dp)
        - ``type``       : scam type label, e.g. "phishing" (str)
        - ``category``   : fine-grained category (str)
        - ``severity``   : severity score 1–10 (int)
        - ``id``         : ChromaDB document ID (str)
        - ``red_flags``  : list of red-flag strings (list[str])

    Raises
    ------
    RuntimeError
        If no embedding backend is available or ChromaDB is not installed.
    ValueError
        If *message_text* is empty.

    Examples
    --------
    >>> results = query_similar_scams("Pay me via gift card outside the platform")
    >>> for r in results:
    ...     print(f"{r['similarity']:.2f}  [{r['type']}]  {r['text'][:60]}")
    """
    if not message_text or not message_text.strip():
        raise ValueError("message_text must be a non-empty string.")

    generator  = _get_generator()
    collection = _get_chroma_collection(db_dir, collection_name)

    if collection.count() == 0:
        log.warning(
            "Collection '%s' is empty. "
            "Run: python ml-pipeline/scripts/import_seed_scams.py",
            collection_name,
        )
        return []

    # ── Step A: Generate query embedding (timed) ──────────────────────────
    t0_embed = time.perf_counter()
    query_vector = generator.embed_text(message_text.strip())
    embed_ms = (time.perf_counter() - t0_embed) * 1000

    # ── Step B: Query ChromaDB (timed) ────────────────────────────────────
    t0_query = time.perf_counter()
    raw = collection.query(
        query_embeddings=[query_vector],
        n_results=min(top_k, collection.count()),
        include=["documents", "metadatas", "distances"],
    )
    query_ms = (time.perf_counter() - t0_query) * 1000
    total_ms = embed_ms + query_ms

    results: List[Dict[str, Any]] = []

    ids        = raw.get("ids",       [[]])[0]
    documents  = raw.get("documents", [[]])[0]
    metadatas  = raw.get("metadatas", [[]])[0]
    distances  = raw.get("distances", [[]])[0]

    for doc_id, text, meta, dist in zip(ids, documents, metadatas, distances):
        # ChromaDB cosine distance = 1 − cosine_similarity  (range 0–2 when
        # vectors are NOT unit-normalised; 0–1 when they are).
        # sentence-transformers encodes with normalize_embeddings=True, so:
        similarity = round(max(0.0, 1.0 - float(dist)), 4)

        if similarity < min_similarity:
            continue

        # red_flags stored as a JSON string in ChromaDB metadata
        raw_flags = meta.get("red_flags", "[]")
        try:
            red_flags: List[str] = json.loads(raw_flags) if isinstance(raw_flags, str) else raw_flags
        except (json.JSONDecodeError, TypeError):
            red_flags = []

        results.append(
            {
                "text":       text,
                "similarity": similarity,
                "type":       meta.get("type", "unknown"),
                "category":   meta.get("category", "unknown"),
                "severity":   int(meta.get("severity", 0)),
                "id":         doc_id,
                "red_flags":  red_flags,
            }
        )

    log.info(
        "query_similar_scams: '%s...' -> %d result(s) | embed=%.1fms query=%.1fms total=%.1fms",
        message_text[:60],
        len(results),
        embed_ms,
        query_ms,
        total_ms,
    )

    # ── Audit log to JSONL ────────────────────────────────────────────────
    _log_query(
        message_text=message_text,
        top_k=top_k,
        results=results,
        embed_ms=embed_ms,
        query_ms=query_ms,
        total_ms=total_ms,
    )

    return results


# ===========================================================================
# Standalone test / demo
# ===========================================================================

def _run_demo() -> None:
    """
    Quick smoke-test:
      1. Embed a sample scam message.
      2. Query ChromaDB for top-3 similar patterns.
      3. Pretty-print the structured results.
    """
    import pprint

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    # --- Test 1: basic embedding generation ---
    print("\n" + "=" * 65)
    print("  TEST 1 - Embedding generation (sentence-transformers)")
    print("=" * 65)
    gen = EmbeddingsGenerator()
    sample = "Please pay me outside the platform using gift cards or Bitcoin."
    vec = gen.embed_text(sample)
    print(f"  Input    : {sample!r}")
    print(f"  Vec dim  : {len(vec)}")
    print(f"  Vec[:5]  : {[round(v, 6) for v in vec[:5]]}")

    # --- Test 2: semantic similarity search against ChromaDB ---
    print("\n" + "=" * 65)
    print("  TEST 2 - query_similar_scams() -> top-3 results")
    print("=" * 65)

    test_messages = [
        "Pay me via PayPal Friends and Family or gift card, avoid platform fees.",
        "Click this link to verify your Fiverr account or it will be suspended.",
        "Run this setup.exe file to preview the delivered project demo.",
    ]

    for msg in test_messages:
        print(f"\n  Query: {msg!r}")
        try:
            results = query_similar_scams(msg, top_k=3)
            if not results:
                print("  [!] No results — ChromaDB may be empty. Run import_seed_scams.py first.")
            for rank, r in enumerate(results, 1):
                print(
                    f"  #{rank}  similarity={r['similarity']:.4f}"
                    f"  type={r['type']:<14}"
                    f"  id={r['id']}"
                )
                print(f"       text: {r['text'][:90]}...")
                print(f"       flags: {r['red_flags'][:2]}")
        except Exception as exc:
            print(f"  [ERROR] {exc}")

    # --- Test 3: exact return schema ---
    print("\n" + "=" * 65)
    print("  TEST 3 - Return schema validation")
    print("=" * 65)
    try:
        results = query_similar_scams(
            "I need your bank account number and routing details for direct deposit.",
            top_k=3,
        )
        expected_keys = {"text", "similarity", "type", "category", "severity", "id", "red_flags"}
        for r in results:
            missing = expected_keys - r.keys()
            assert not missing, f"Missing keys in result: {missing}"
        print(f"  [OK]  Schema validated for {len(results)} result(s).")
        if results:
            print("  Sample result:")
            pprint.pprint(results[0], indent=4)
    except Exception as exc:
        print(f"  [ERROR] {exc}")

    print("\n" + "=" * 65 + "\n")


if __name__ == "__main__":
    _run_demo()
