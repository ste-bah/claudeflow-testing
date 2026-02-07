import os
import uuid
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import chromadb

# --- 1. Backend Selection via Environment Variable ---
# EMBEDDING_BACKEND: "local" (default) or "openai"
EMBEDDING_BACKEND = os.getenv("EMBEDDING_BACKEND", "local").lower()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# --- 2. Define Request/Response schemas ---
class EmbedRequest(BaseModel):
    texts: List[str]
    metadata: Optional[List[dict]] = None

class SearchRequest(BaseModel):
    query: str
    n_results: int = 5

app = FastAPI(title="Vector API (1536D) - Dual Backend")

# --- 3. Initialize embedding backend ---
model = None  # Local SentenceTransformer model
openai_client = None  # OpenAI client

if EMBEDDING_BACKEND == "openai":
    print(f"[Embedder] Using OpenAI backend (text-embedding-ada-002)")
    if not OPENAI_API_KEY:
        print("WARNING: OPENAI_API_KEY not set. OpenAI embeddings will fail.")
    else:
        try:
            from openai import OpenAI
            openai_client = OpenAI(api_key=OPENAI_API_KEY)
            print("[Embedder] OpenAI client initialized successfully.")
        except ImportError:
            print("ERROR: openai package not installed. Run: pip install openai")
        except Exception as e:
            print(f"ERROR initializing OpenAI client: {e}")
else:
    print(f"[Embedder] Using LOCAL backend (gte-Qwen2-1.5B-instruct)")
    try:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer('Alibaba-NLP/gte-Qwen2-1.5B-instruct')
        model.max_seq_length = 8192
        print("[Embedder] Local model loaded successfully.")
    except Exception as e:
        print(f"CRITICAL ERROR loading local model: {e}")
        model = None

# --- 4. Connect to ChromaDB ---
try:
    chroma_client = chromadb.HttpClient(host='127.0.0.1', port=8001)
    collection = chroma_client.get_or_create_collection(name="local_vectors_1536")
    print("[Embedder] Connected to ChromaDB successfully.")
except Exception as e:
    print(f"CRITICAL: Could not connect to ChromaDB: {e}")
    collection = None


# --- 5. Embedding generation functions ---
def generate_embeddings_local(texts: List[str], is_query: bool = False) -> List[List[float]]:
    """Generate embeddings using local gte-Qwen2 model."""
    if not model:
        raise ValueError("Local model not loaded")

    # For queries, use the special prompt to improve retrieval quality
    if is_query:
        embeddings = model.encode(
            texts,
            prompt_name="query",
            normalize_embeddings=True
        )
    else:
        embeddings = model.encode(texts, normalize_embeddings=True)

    return embeddings.tolist()


def generate_embeddings_openai(texts: List[str], is_query: bool = False) -> List[List[float]]:
    """Generate embeddings using OpenAI text-embedding-ada-002."""
    if not openai_client:
        raise ValueError("OpenAI client not initialized. Check OPENAI_API_KEY.")

    # OpenAI handles batches automatically, but has a limit
    # We process in batches of 100 for safety
    all_embeddings = []
    batch_size = 100

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        response = openai_client.embeddings.create(
            model="text-embedding-ada-002",
            input=batch
        )
        batch_embeddings = [item.embedding for item in response.data]
        all_embeddings.extend(batch_embeddings)

    return all_embeddings


def generate_embeddings(texts: List[str], is_query: bool = False) -> List[List[float]]:
    """Route to appropriate embedding backend."""
    if EMBEDDING_BACKEND == "openai":
        return generate_embeddings_openai(texts, is_query)
    else:
        return generate_embeddings_local(texts, is_query)


def is_backend_ready() -> bool:
    """Check if the selected backend is ready."""
    if EMBEDDING_BACKEND == "openai":
        return openai_client is not None
    else:
        return model is not None


# --- 6. API Endpoints ---
@app.get("/")
def read_root():
    backend_ready = is_backend_ready()

    if not backend_ready:
        return {
            "status": "error",
            "backend": EMBEDDING_BACKEND,
            "detail": f"{EMBEDDING_BACKEND.upper()} backend failed to initialize. Check logs."
        }

    count = collection.count() if collection else 0

    model_name = "text-embedding-ada-002" if EMBEDDING_BACKEND == "openai" else "gte-Qwen2-1.5B-instruct"

    return {
        "status": "online",
        "backend": EMBEDDING_BACKEND,
        "model": f"{model_name} (1536D)",
        "database_items": count
    }


@app.post("/embed")
async def embed_and_store(request: EmbedRequest):
    if not collection:
        raise HTTPException(status_code=500, detail="Database connection is down.")
    if not is_backend_ready():
        raise HTTPException(status_code=500, detail=f"{EMBEDDING_BACKEND.upper()} backend not ready.")

    try:
        # Generate embeddings using selected backend
        embeddings = generate_embeddings(request.texts, is_query=False)
        ids = [str(uuid.uuid4()) for _ in request.texts]

        add_kwargs = {
            "documents": request.texts,
            "embeddings": embeddings,
            "ids": ids
        }

        if request.metadata and all(m for m in request.metadata):
            add_kwargs["metadatas"] = request.metadata

        collection.add(**add_kwargs)

        return {
            "message": f"Successfully stored {len(ids)} items",
            "ids": ids,
            "dims": len(embeddings[0]),  # Should be 1536
            "backend": EMBEDDING_BACKEND,
            "embeddings": embeddings  # Return embeddings for god-agent compatibility
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/search")
async def search(request: SearchRequest):
    if not collection:
        raise HTTPException(status_code=500, detail="Database connection is down.")
    if not is_backend_ready():
        raise HTTPException(status_code=500, detail=f"{EMBEDDING_BACKEND.upper()} backend not ready.")

    try:
        # Generate query embedding (with query-specific handling for local model)
        query_vector = generate_embeddings([request.query], is_query=True)

        results = collection.query(
            query_embeddings=query_vector,
            n_results=request.n_results,
            include=["metadatas", "documents", "distances"]
        )

        return {"results": results, "backend": EMBEDDING_BACKEND}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/backend")
def get_backend_info():
    """Return current backend configuration."""
    return {
        "backend": EMBEDDING_BACKEND,
        "ready": is_backend_ready(),
        "openai_key_set": bool(OPENAI_API_KEY),
        "dimensions": 1536,
        "supported_backends": ["local", "openai"],
        "switch_command": "export EMBEDDING_BACKEND=openai  # or 'local'"
    }


if __name__ == "__main__":
    import uvicorn
    # Host on 8000 (Chroma is on 8001)
    uvicorn.run(app, host="127.0.0.1", port=8000)
