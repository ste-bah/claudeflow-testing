#!/usr/bin/env python3
"""
Migrate ChromaDB backup (SQLite) → Zilliz Cloud.

Reads documents + metadata from corrupted ChromaDB SQLite backup,
re-embeds via OpenAI ada-002, and inserts into Zilliz.

Usage:
    export OPENAI_API_KEY="sk-..."
    export ZILLIZ_URI="https://..."
    export ZILLIZ_TOKEN="..."
    python3 migrate_chroma_to_zilliz.py
"""

import json
import os
import sqlite3
import sys
import time
from collections import defaultdict

# --- Config ---
BACKUP_PATH = os.getenv(
    "CHROMA_BACKUP",
    os.path.join(os.path.dirname(__file__), "..", "vector_db_1536.bak.20260210", "chroma.sqlite3"),
)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
ZILLIZ_URI = os.getenv("ZILLIZ_URI", "")
ZILLIZ_TOKEN = os.getenv("ZILLIZ_TOKEN", "")
COLLECTION_NAME = "god_agent_vectors_1536"
EMBED_BATCH_SIZE = 100  # OpenAI batch limit
INSERT_BATCH_SIZE = 500  # Zilliz insert batch
DIM = 1536


def extract_from_sqlite(db_path: str):
    """Extract documents and metadata from ChromaDB SQLite backup."""
    print(f"[Extract] Opening {db_path}")
    db = sqlite3.connect(db_path)
    cursor = db.cursor()

    # Get all embedding IDs in order
    cursor.execute("SELECT id, embedding_id FROM embeddings ORDER BY id")
    embeddings = cursor.fetchall()
    print(f"[Extract] Found {len(embeddings):,} embeddings")

    # Build metadata lookup: internal_id -> {key: value}
    cursor.execute("SELECT id, key, string_value, int_value, float_value FROM embedding_metadata")
    meta_rows = cursor.fetchall()
    print(f"[Extract] Found {len(meta_rows):,} metadata rows")

    # Group metadata by internal ID
    meta_by_id = defaultdict(dict)
    docs_by_id = {}
    for row in meta_rows:
        internal_id, key, str_val, int_val, float_val = row
        if key == "chroma:document":
            docs_by_id[internal_id] = str_val or ""
        else:
            # Pick whichever value is non-null
            val = str_val if str_val is not None else (int_val if int_val is not None else float_val)
            if val is not None:
                meta_by_id[internal_id][key] = val

    db.close()

    # Build output records
    records = []
    skipped = 0
    for internal_id, embedding_id in embeddings:
        doc = docs_by_id.get(internal_id, "")
        if not doc or not doc.strip():
            skipped += 1
            continue
        meta = meta_by_id.get(internal_id, {})
        records.append({
            "id": embedding_id,
            "text": doc,
            "metadata": meta,
        })

    print(f"[Extract] {len(records):,} records with text, {skipped:,} skipped (empty)")
    return records


def embed_texts(texts: list, openai_client) -> list:
    """Embed a batch of texts via OpenAI ada-002."""
    response = openai_client.embeddings.create(model="text-embedding-ada-002", input=texts)
    return [item.embedding for item in response.data]


def ensure_collection(zilliz_client):
    """Create Zilliz collection if it doesn't exist."""
    if not zilliz_client.has_collection(COLLECTION_NAME):
        from pymilvus import CollectionSchema, FieldSchema, DataType

        fields = [
            FieldSchema(name="id", dtype=DataType.VARCHAR, is_primary=True, max_length=64),
            FieldSchema(name="text", dtype=DataType.VARCHAR, max_length=65535),
            FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=DIM),
            FieldSchema(name="metadata_json", dtype=DataType.VARCHAR, max_length=65535),
        ]
        schema = CollectionSchema(fields=fields, enable_dynamic_field=True)
        index_params = zilliz_client.prepare_index_params()
        index_params.add_index(field_name="embedding", index_type="AUTOINDEX", metric_type="COSINE")
        zilliz_client.create_collection(
            collection_name=COLLECTION_NAME, schema=schema, index_params=index_params
        )
        print(f"[Zilliz] Created collection: {COLLECTION_NAME}")
    else:
        print(f"[Zilliz] Collection exists: {COLLECTION_NAME}")


def migrate(records: list, openai_client, zilliz_client):
    """Re-embed and insert records into Zilliz in batches."""
    total = len(records)
    inserted = 0
    failed = 0
    start_time = time.time()

    # Process in embedding batches
    for batch_start in range(0, total, EMBED_BATCH_SIZE):
        batch_end = min(batch_start + EMBED_BATCH_SIZE, total)
        batch = records[batch_start:batch_end]
        texts = [r["text"] for r in batch]

        # Truncate texts that are too long for ada-002 (8191 tokens ≈ 32K chars)
        texts = [t[:32000] if len(t) > 32000 else t for t in texts]

        try:
            embeddings = embed_texts(texts, openai_client)
        except Exception as e:
            print(f"[ERROR] Embedding batch {batch_start}-{batch_end}: {e}")
            failed += len(batch)
            continue

        # Build Zilliz rows
        rows = []
        for i, rec in enumerate(batch):
            meta_json = json.dumps(rec["metadata"]) if rec["metadata"] else "{}"
            # Truncate text and metadata to fit Zilliz VARCHAR(65535)
            text = rec["text"][:65000] if len(rec["text"]) > 65000 else rec["text"]
            meta_json = meta_json[:65000] if len(meta_json) > 65000 else meta_json
            rows.append({
                "id": rec["id"][:64],
                "text": text,
                "embedding": embeddings[i],
                "metadata_json": meta_json,
            })

        # Insert into Zilliz in sub-batches
        for ins_start in range(0, len(rows), INSERT_BATCH_SIZE):
            ins_batch = rows[ins_start : ins_start + INSERT_BATCH_SIZE]
            try:
                zilliz_client.insert(collection_name=COLLECTION_NAME, data=ins_batch)
                inserted += len(ins_batch)
            except Exception as e:
                print(f"[ERROR] Zilliz insert at {batch_start + ins_start}: {e}")
                failed += len(ins_batch)

        # Progress
        elapsed = time.time() - start_time
        rate = (batch_end) / elapsed if elapsed > 0 else 0
        eta = (total - batch_end) / rate if rate > 0 else 0
        print(
            f"[Progress] {batch_end:,}/{total:,} "
            f"({batch_end * 100 / total:.1f}%) | "
            f"Inserted: {inserted:,} | Failed: {failed:,} | "
            f"Rate: {rate:.0f}/s | ETA: {eta:.0f}s"
        )

    elapsed = time.time() - start_time
    print(f"\n[Done] Migrated {inserted:,} records in {elapsed:.1f}s ({failed:,} failed)")
    return inserted, failed


def main():
    if not OPENAI_API_KEY:
        print("ERROR: OPENAI_API_KEY not set")
        sys.exit(1)
    if not ZILLIZ_URI or not ZILLIZ_TOKEN:
        print("ERROR: ZILLIZ_URI and ZILLIZ_TOKEN required")
        sys.exit(1)
    if not os.path.exists(BACKUP_PATH):
        print(f"ERROR: Backup not found at {BACKUP_PATH}")
        sys.exit(1)

    # 1. Extract from SQLite
    records = extract_from_sqlite(BACKUP_PATH)
    if not records:
        print("No records to migrate")
        sys.exit(0)

    # 2. Initialize OpenAI
    from openai import OpenAI

    openai_client = OpenAI(api_key=OPENAI_API_KEY)
    print(f"[OpenAI] Client ready (ada-002)")

    # 3. Initialize Zilliz
    from pymilvus import MilvusClient

    zilliz_client = MilvusClient(uri=ZILLIZ_URI, token=ZILLIZ_TOKEN)
    ensure_collection(zilliz_client)

    # Check existing count
    stats = zilliz_client.get_collection_stats(COLLECTION_NAME)
    existing = stats.get("row_count", 0)
    print(f"[Zilliz] Existing records: {existing:,}")

    # 4. Migrate
    print(f"\n{'='*60}")
    print(f"Migration: {len(records):,} records → Zilliz ({COLLECTION_NAME})")
    print(f"Estimated cost: ~${len(records) * 297 / 4 / 1_000_000 * 0.10:.2f} (ada-002)")
    print(f"{'='*60}\n")

    inserted, failed = migrate(records, openai_client, zilliz_client)

    # 5. Verify
    stats = zilliz_client.get_collection_stats(COLLECTION_NAME)
    final_count = stats.get("row_count", 0)
    print(f"\n[Verify] Zilliz collection now has {final_count:,} records")


if __name__ == "__main__":
    main()
