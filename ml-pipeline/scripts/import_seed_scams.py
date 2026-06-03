"""
Batch import seed scam examples into ChromaDB.

Usage:
    python ml-pipeline/scripts/import_seed_scams.py [--seed-file PATH] [--db-dir PATH] [--dry-run]

This script:
  1. Reads seed_scams.json
  2. Generates embeddings via Ollama (DeepSeek-R1) or falls back to sentence-transformers
  3. Batch-imports documents into the ChromaDB 'scam_patterns' collection
"""

import json
import os
import sys
import argparse
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional

# ---------------------------------------------------------------------------
# Dependency imports (graceful fallback for embeddings)
# ---------------------------------------------------------------------------
try:
    import chromadb
    from chromadb.config import Settings
except ImportError as e:
    print(f"[ERROR] chromadb not installed: {e}")
    print("  Run: pip install chromadb")
    sys.exit(1)

try:
    import requests
    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants / Defaults
# ---------------------------------------------------------------------------
DEFAULT_SEED_FILE = Path(__file__).parent.parent / "data" / "seed_scams.json"
DEFAULT_DB_DIR    = Path(__file__).parent.parent.parent / "data" / "chromadb"
COLLECTION_NAME   = "scam_patterns"
OLLAMA_HOST       = os.getenv("OLLAMA_HOST", "http://localhost:11434")
DEEPSEEK_MODEL    = os.getenv("DEEPSEEK_MODEL", "deepseek-r1")
FALLBACK_MODEL    = "all-MiniLM-L6-v2"
BATCH_SIZE        = 50  # ChromaDB performs best with batches ≤ 100


# ---------------------------------------------------------------------------
# Embedding helpers
# ---------------------------------------------------------------------------

def _ollama_embed(texts: List[str], model: str, host: str) -> Optional[List[List[float]]]:
    """Generate embeddings using Ollama's /api/embed endpoint."""
    try:
        resp = requests.post(
            f"{host}/api/embed",
            json={"model": model, "input": texts},
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("embeddings")
    except Exception as exc:
        log.warning("Ollama embedding failed: %s", exc)
        return None


def _sentence_transformer_embed(texts: List[str], model_name: str) -> List[List[float]]:
    """Fallback: use sentence-transformers locally."""
    log.info("Using sentence-transformers model '%s' for embeddings", model_name)
    model = SentenceTransformer(model_name)
    vectors = model.encode(texts, show_progress_bar=True, convert_to_numpy=True)
    return vectors.tolist()


def generate_embeddings(texts: List[str]) -> List[List[float]]:
    """
    Try Ollama first; fall back to sentence-transformers; raise if neither available.
    """
    if OLLAMA_AVAILABLE:
        log.info("Attempting Ollama embeddings via model '%s' at %s", DEEPSEEK_MODEL, OLLAMA_HOST)
        vectors = _ollama_embed(texts, DEEPSEEK_MODEL, OLLAMA_HOST)
        if vectors is not None:
            log.info("Ollama embeddings generated successfully (dim=%d)", len(vectors[0]))
            return vectors
        log.warning("Falling back to sentence-transformers...")

    if SENTENCE_TRANSFORMERS_AVAILABLE:
        return _sentence_transformer_embed(texts, FALLBACK_MODEL)

    raise RuntimeError(
        "No embedding backend available. "
        "Install Ollama with DeepSeek-R1 OR run: pip install sentence-transformers"
    )


# ---------------------------------------------------------------------------
# ChromaDB helpers
# ---------------------------------------------------------------------------

def get_or_create_collection(db_dir: Path) -> "chromadb.Collection":
    """Initialise a persistent ChromaDB client and return the scam_patterns collection."""
    db_dir.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(
        path=str(db_dir),
        settings=Settings(anonymized_telemetry=False),
    )
    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine", "description": "Seed scam pattern embeddings"},
    )
    log.info(
        "Collection '%s' ready (existing docs: %d)",
        COLLECTION_NAME,
        collection.count(),
    )
    return collection


# ---------------------------------------------------------------------------
# Core import logic
# ---------------------------------------------------------------------------

def load_seed_scams(seed_file: Path) -> List[Dict[str, Any]]:
    """Load and validate seed_scams.json."""
    if not seed_file.exists():
        raise FileNotFoundError(f"Seed file not found: {seed_file}")

    with open(seed_file, "r", encoding="utf-8") as fh:
        scams = json.load(fh)

    required_keys = {"id", "text", "type", "severity"}
    for i, scam in enumerate(scams):
        missing = required_keys - set(scam.keys())
        if missing:
            raise ValueError(f"Scam entry [{i}] missing required keys: {missing}")

    log.info("Loaded %d scam entries from %s", len(scams), seed_file)
    return scams


def build_chroma_payloads(scams: List[Dict[str, Any]]):
    """Transform scam dicts into ChromaDB-compatible lists."""
    ids        = [s["id"]   for s in scams]
    documents  = [s["text"] for s in scams]
    metadatas  = [
        {
            "type":     s["type"],
            "severity": int(s["severity"]),
            "category": s.get("category", "unknown"),
            "source":   s.get("source", "unknown"),
            "red_flags": json.dumps(s.get("red_flags", [])),  # ChromaDB metadata must be str/int/float
        }
        for s in scams
    ]
    return ids, documents, metadatas


def batch_import(
    collection: "chromadb.Collection",
    ids: List[str],
    documents: List[str],
    metadatas: List[Dict],
    embeddings: List[List[float]],
    dry_run: bool = False,
) -> int:
    """Import records in batches; return number of records upserted."""
    total   = len(ids)
    upserted = 0

    for start in range(0, total, BATCH_SIZE):
        end = min(start + BATCH_SIZE, total)
        batch_ids   = ids[start:end]
        batch_docs  = documents[start:end]
        batch_meta  = metadatas[start:end]
        batch_embs  = embeddings[start:end]

        log.info(
            "Batch %d–%d / %d  (%s)",
            start + 1, end, total,
            "DRY-RUN – skipping upsert" if dry_run else "upserting",
        )

        if not dry_run:
            collection.upsert(
                ids=batch_ids,
                documents=batch_docs,
                metadatas=batch_meta,
                embeddings=batch_embs,
            )
        upserted += len(batch_ids)

    return upserted


def print_summary(collection: "chromadb.Collection", upserted: int, dry_run: bool) -> None:
    """Print post-import statistics broken down by scam type."""
    print("\n" + "=" * 60)
    print("  IMPORT SUMMARY")
    print("=" * 60)
    print(f"  Records processed : {upserted}")
    print(f"  Dry run           : {dry_run}")
    if not dry_run:
        total_in_db = collection.count()
        print(f"  Total in DB now   : {total_in_db}")

        for scam_type in ("phishing", "malware", "impersonation"):
            results = collection.get(
                where={"type": scam_type},
                include=["metadatas"],
            )
            count = len(results["ids"])
            print(f"  [{scam_type:<14}] : {count} records")
    print("=" * 60 + "\n")


# ---------------------------------------------------------------------------
# CLI entry-point
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Batch-import seed scam examples into ChromaDB.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--seed-file",
        type=Path,
        default=DEFAULT_SEED_FILE,
        help="Path to seed_scams.json",
    )
    parser.add_argument(
        "--db-dir",
        type=Path,
        default=DEFAULT_DB_DIR,
        help="Directory for ChromaDB persistent storage",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Generate embeddings but skip writing to ChromaDB",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        default=True,
        help="Use upsert (update if ID exists) — always enabled",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    log.info("=== ShadowSense Aurora — Seed Scam Import ===")
    log.info("Seed file : %s", args.seed_file)
    log.info("DB dir    : %s", args.db_dir)
    log.info("Dry run   : %s", args.dry_run)

    # 1. Load data
    scams = load_seed_scams(args.seed_file)

    # 2. Build payloads
    ids, documents, metadatas = build_chroma_payloads(scams)

    # 3. Generate embeddings
    log.info("Generating embeddings for %d documents...", len(documents))
    embeddings = generate_embeddings(documents)
    log.info("Embeddings ready (vector dim=%d)", len(embeddings[0]) if embeddings else 0)

    # 4. Connect to ChromaDB
    collection = get_or_create_collection(args.db_dir)

    # 5. Batch import
    upserted = batch_import(
        collection, ids, documents, metadatas, embeddings, dry_run=args.dry_run
    )

    # 6. Summary
    print_summary(collection, upserted, args.dry_run)
    log.info("Done. ✓")


if __name__ == "__main__":
    main()
