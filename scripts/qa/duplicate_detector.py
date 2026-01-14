#!/usr/bin/env python3
"""
Semantic Duplicate Detector

Finds near-duplicate chunks in the corpus using embedding similarity.
Uses locality-sensitive hashing (LSH) for efficient O(n) detection.

Usage:
  god qa duplicates                     # Find duplicates (default threshold 0.95)
  god qa duplicates --threshold 0.90    # Custom similarity threshold
  god qa duplicates --json              # Output as JSON
  god qa duplicates --fix               # Mark duplicates for removal

Features:
  - Vector similarity comparison using cosine distance
  - LSH for efficient large-scale detection
  - Configurable similarity threshold
  - JSON output for programmatic use
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
import hashlib

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Paths
VECTOR_DB_DIR = PROJECT_ROOT / "vector_db_1536"
MANIFEST_FILE = PROJECT_ROOT / "scripts" / "ingest" / "manifest.jsonl"
DUPLICATES_FILE = PROJECT_ROOT / "god-learn" / "qa" / "duplicates.json"


@dataclass
class DuplicatePair:
    """A pair of duplicate chunks."""
    chunk_id_1: str
    chunk_id_2: str
    similarity: float
    text_1_preview: str
    text_2_preview: str
    source_1: str
    source_2: str


@dataclass
class DuplicateReport:
    """Report of duplicate detection."""
    timestamp: str
    threshold: float
    total_chunks: int
    duplicate_pairs: int
    unique_duplicates: int  # Number of unique chunks involved
    pairs: List[DuplicatePair]


def load_chunk_metadata() -> Dict[str, Dict[str, Any]]:
    """Load chunk metadata from manifest."""
    metadata = {}

    if not MANIFEST_FILE.exists():
        return metadata

    try:
        with MANIFEST_FILE.open("r") as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    rec = json.loads(line)
                    # Each manifest entry may have chunk info
                    path_rel = rec.get("path_rel", "")
                    chunk_count = rec.get("chunk_count", 0)

                    # Store document-level info
                    if path_rel:
                        metadata[path_rel] = {
                            "source": path_rel,
                            "chunks": chunk_count,
                        }
                except Exception:
                    continue
    except Exception:
        pass

    return metadata


def get_embeddings_from_chroma() -> List[Tuple[str, List[float], str]]:
    """Get embeddings directly from ChromaDB."""
    try:
        import chromadb
        from chromadb.config import Settings

        client = chromadb.PersistentClient(
            path=str(VECTOR_DB_DIR),
            settings=Settings(anonymized_telemetry=False)
        )

        # Try to get the collection
        try:
            collection = client.get_collection("corpus_chunks")
        except Exception:
            # Try alternative name
            collections = client.list_collections()
            if not collections:
                return []
            collection = collections[0]

        # Get all items
        results = collection.get(
            include=["embeddings", "documents", "metadatas"]
        )

        embeddings = []
        ids = results.get("ids", [])
        embs = results.get("embeddings", [])
        docs = results.get("documents", [])
        metas = results.get("metadatas", [])

        for i, (chunk_id, emb) in enumerate(zip(ids, embs)):
            if emb is not None:
                text = docs[i] if docs and i < len(docs) else ""
                meta = metas[i] if metas and i < len(metas) else {}
                source = meta.get("source", meta.get("path_rel", "unknown"))
                embeddings.append((chunk_id, list(emb), text, source))

        return embeddings

    except Exception as e:
        print(f"Error loading from ChromaDB: {e}", file=sys.stderr)
        return []


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Compute cosine similarity between two vectors."""
    import math

    dot = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = math.sqrt(sum(a * a for a in vec1))
    norm2 = math.sqrt(sum(b * b for b in vec2))

    if norm1 == 0 or norm2 == 0:
        return 0.0

    return dot / (norm1 * norm2)


def lsh_hash(embedding: List[float], num_planes: int = 10, seed: int = 42) -> str:
    """
    Locality-Sensitive Hash for approximate nearest neighbor.
    Uses random hyperplanes to create a hash signature.
    """
    import random
    random.seed(seed)

    dim = len(embedding)
    hash_bits = []

    for _ in range(num_planes):
        # Random hyperplane
        plane = [random.gauss(0, 1) for _ in range(dim)]

        # Check which side of the plane
        dot = sum(e * p for e, p in zip(embedding, plane))
        hash_bits.append("1" if dot >= 0 else "0")

    return "".join(hash_bits)


def find_duplicates_lsh(
    embeddings: List[Tuple[str, List[float], str, str]],
    threshold: float = 0.95,
    num_planes: int = 12
) -> List[DuplicatePair]:
    """
    Find duplicate chunks using LSH for efficiency.

    First groups candidates by LSH bucket, then verifies with exact similarity.
    """
    if len(embeddings) < 2:
        return []

    # Group by LSH hash
    buckets = defaultdict(list)
    for chunk_id, emb, text, source in embeddings:
        h = lsh_hash(emb, num_planes=num_planes)
        buckets[h].append((chunk_id, emb, text, source))

    # Find duplicates within buckets
    duplicates = []
    seen_pairs: Set[Tuple[str, str]] = set()

    for bucket in buckets.values():
        if len(bucket) < 2:
            continue

        # Compare all pairs in bucket
        for i in range(len(bucket)):
            for j in range(i + 1, len(bucket)):
                id1, emb1, text1, src1 = bucket[i]
                id2, emb2, text2, src2 = bucket[j]

                # Skip if already seen
                pair_key = tuple(sorted([id1, id2]))
                if pair_key in seen_pairs:
                    continue
                seen_pairs.add(pair_key)

                # Compute exact similarity
                sim = cosine_similarity(emb1, emb2)

                if sim >= threshold:
                    duplicates.append(DuplicatePair(
                        chunk_id_1=id1,
                        chunk_id_2=id2,
                        similarity=sim,
                        text_1_preview=text1[:100] if text1 else "",
                        text_2_preview=text2[:100] if text2 else "",
                        source_1=src1,
                        source_2=src2
                    ))

    # Sort by similarity descending
    duplicates.sort(key=lambda x: x.similarity, reverse=True)
    return duplicates


def find_duplicates_brute(
    embeddings: List[Tuple[str, List[float], str, str]],
    threshold: float = 0.95
) -> List[DuplicatePair]:
    """
    Brute-force O(n^2) duplicate detection.
    Used for small datasets or verification.
    """
    if len(embeddings) < 2:
        return []

    duplicates = []

    for i in range(len(embeddings)):
        for j in range(i + 1, len(embeddings)):
            id1, emb1, text1, src1 = embeddings[i]
            id2, emb2, text2, src2 = embeddings[j]

            sim = cosine_similarity(emb1, emb2)

            if sim >= threshold:
                duplicates.append(DuplicatePair(
                    chunk_id_1=id1,
                    chunk_id_2=id2,
                    similarity=sim,
                    text_1_preview=text1[:100] if text1 else "",
                    text_2_preview=text2[:100] if text2 else "",
                    source_1=src1,
                    source_2=src2
                ))

    duplicates.sort(key=lambda x: x.similarity, reverse=True)
    return duplicates


def detect_duplicates(threshold: float = 0.95, use_lsh: bool = True) -> DuplicateReport:
    """
    Main duplicate detection function.

    Args:
        threshold: Similarity threshold (0-1). Higher = more strict.
        use_lsh: Use LSH for efficiency (recommended for >1000 chunks)

    Returns:
        DuplicateReport with found duplicates
    """
    print(f"Loading embeddings from ChromaDB...")
    embeddings = get_embeddings_from_chroma()

    if not embeddings:
        print("No embeddings found in vector database.")
        return DuplicateReport(
            timestamp=datetime.now().isoformat(),
            threshold=threshold,
            total_chunks=0,
            duplicate_pairs=0,
            unique_duplicates=0,
            pairs=[]
        )

    print(f"Found {len(embeddings)} chunks")
    print(f"Searching for duplicates with threshold {threshold}...")

    # Choose algorithm based on dataset size
    if use_lsh and len(embeddings) > 100:
        print("Using LSH for efficient detection...")
        pairs = find_duplicates_lsh(embeddings, threshold)
    else:
        print("Using brute-force detection...")
        pairs = find_duplicates_brute(embeddings, threshold)

    # Count unique chunks involved
    unique_ids = set()
    for p in pairs:
        unique_ids.add(p.chunk_id_1)
        unique_ids.add(p.chunk_id_2)

    return DuplicateReport(
        timestamp=datetime.now().isoformat(),
        threshold=threshold,
        total_chunks=len(embeddings),
        duplicate_pairs=len(pairs),
        unique_duplicates=len(unique_ids),
        pairs=pairs
    )


def format_report_text(report: DuplicateReport) -> str:
    """Format report as human-readable text."""
    lines = []

    lines.append("=" * 60)
    lines.append("DUPLICATE DETECTION REPORT")
    lines.append("=" * 60)
    lines.append(f"  Timestamp:        {report.timestamp}")
    lines.append(f"  Threshold:        {report.threshold:.2f}")
    lines.append(f"  Total chunks:     {report.total_chunks}")
    lines.append(f"  Duplicate pairs:  {report.duplicate_pairs}")
    lines.append(f"  Unique affected:  {report.unique_duplicates}")
    lines.append("")

    if not report.pairs:
        lines.append("No duplicates found.")
    else:
        lines.append("Duplicate Pairs:")
        lines.append("-" * 60)

        for i, pair in enumerate(report.pairs[:20]):  # Limit display
            lines.append(f"\n[{i+1}] Similarity: {pair.similarity:.4f}")
            lines.append(f"  Chunk 1: {pair.chunk_id_1}")
            lines.append(f"    Source: {pair.source_1}")
            lines.append(f"    Text:   {pair.text_1_preview[:60]}...")
            lines.append(f"  Chunk 2: {pair.chunk_id_2}")
            lines.append(f"    Source: {pair.source_2}")
            lines.append(f"    Text:   {pair.text_2_preview[:60]}...")

        if len(report.pairs) > 20:
            lines.append(f"\n  ... and {len(report.pairs) - 20} more pairs")

    return "\n".join(lines)


def format_report_json(report: DuplicateReport) -> str:
    """Format report as JSON."""
    data = {
        "timestamp": report.timestamp,
        "threshold": report.threshold,
        "total_chunks": report.total_chunks,
        "duplicate_pairs": report.duplicate_pairs,
        "unique_duplicates": report.unique_duplicates,
        "pairs": [asdict(p) for p in report.pairs]
    }
    return json.dumps(data, indent=2)


def save_report(report: DuplicateReport):
    """Save report to file."""
    DUPLICATES_FILE.parent.mkdir(parents=True, exist_ok=True)
    DUPLICATES_FILE.write_text(format_report_json(report))


def main() -> int:
    ap = argparse.ArgumentParser(description="Semantic duplicate detection")
    ap.add_argument("--threshold", "-t", type=float, default=0.95,
                    help="Similarity threshold (0-1, default: 0.95)")
    ap.add_argument("--json", action="store_true",
                    help="Output as JSON")
    ap.add_argument("--brute", action="store_true",
                    help="Use brute-force instead of LSH")
    ap.add_argument("--save", action="store_true",
                    help="Save report to file")
    args = ap.parse_args()

    if args.threshold < 0 or args.threshold > 1:
        print("Error: threshold must be between 0 and 1")
        return 1

    report = detect_duplicates(
        threshold=args.threshold,
        use_lsh=not args.brute
    )

    if args.json:
        print(format_report_json(report))
    else:
        print(format_report_text(report))

    if args.save:
        save_report(report)
        print(f"\nReport saved to: {DUPLICATES_FILE}")

    return 0 if report.duplicate_pairs == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
