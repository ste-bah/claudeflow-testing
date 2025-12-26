#!/usr/bin/env python3
"""
Local Vector Embedding API Server
Provides embedding and semantic search capabilities using sentence-transformers and ChromaDB.

This is a packaged version with configurable paths for deployment.
"""
import os
import uuid
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import chromadb

# Configuration from environment variables with defaults
CHROMA_HOST = os.environ.get('CHROMA_HOST', '127.0.0.1')
CHROMA_PORT = int(os.environ.get('CHROMA_PORT', '8001'))
API_HOST = os.environ.get('API_HOST', '127.0.0.1')
API_PORT = int(os.environ.get('API_PORT', '8000'))
COLLECTION_NAME = os.environ.get('COLLECTION_NAME', 'god_agent_vectors')

# Request/Response schemas
class EmbedRequest(BaseModel):
    texts: List[str]
    metadata: Optional[List[dict]] = None

class SearchRequest(BaseModel):
    query: str
    n_results: int = 5

class EmbedOnlyRequest(BaseModel):
    """Request to get embeddings without storing"""
    texts: List[str]

app = FastAPI(
    title="God Agent Vector API",
    description="Local embedding and semantic search server for God Agent",
    version="1.0.0"
)

# Global instances (Loaded once on startup)
print("Loading Embedding Model (all-mpnet-base-v2 ~420MB)...")
model = SentenceTransformer('sentence-transformers/all-mpnet-base-v2')
print("Model loaded successfully.")

# Connect to ChromaDB
collection = None
try:
    print(f"Connecting to ChromaDB at {CHROMA_HOST}:{CHROMA_PORT}...")
    chroma_client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
    collection = chroma_client.get_or_create_collection(name=COLLECTION_NAME)
    print(f"Connected to ChromaDB. Collection '{COLLECTION_NAME}' ready.")
except Exception as e:
    print(f"WARNING: Could not connect to ChromaDB: {e}")
    print("Storage operations will fail. Search/embed-only operations may still work.")

@app.get("/")
def read_root():
    """Health check and status endpoint"""
    count = collection.count() if collection else 0
    return {
        "status": "online",
        "model": "all-mpnet-base-v2",
        "embedding_dim": 768,
        "database_items": count,
        "chroma_host": f"{CHROMA_HOST}:{CHROMA_PORT}",
        "collection": COLLECTION_NAME
    }

@app.get("/health")
def health_check():
    """Simple health check for load balancers"""
    return {"status": "healthy"}

@app.post("/embed")
async def embed_and_store(request: EmbedRequest):
    """
    Generate embeddings for texts and store them in ChromaDB.
    Returns the embeddings and generated IDs.
    """
    if not collection:
        raise HTTPException(status_code=500, detail="Database connection is down.")

    try:
        embeddings = model.encode(request.texts).tolist()
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
            "embeddings": embeddings
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/embed-only")
async def embed_only(request: EmbedOnlyRequest):
    """
    Generate embeddings without storing. Used by God Agent for real-time embedding.
    """
    try:
        embeddings = model.encode(request.texts).tolist()
        return {
            "embeddings": embeddings,
            "model": "all-mpnet-base-v2",
            "dimension": 768
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/search")
async def search(request: SearchRequest):
    """
    Semantic search: find most similar items to query text.
    """
    if not collection:
        raise HTTPException(status_code=500, detail="Database connection is down.")

    try:
        query_vector = model.encode([request.query]).tolist()
        results = collection.query(
            query_embeddings=query_vector,
            n_results=request.n_results
        )
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/collection")
async def clear_collection():
    """Clear all items from the collection (use with caution)"""
    if not collection:
        raise HTTPException(status_code=500, detail="Database connection is down.")

    try:
        # Get all IDs and delete them
        all_items = collection.get()
        if all_items['ids']:
            collection.delete(ids=all_items['ids'])
        return {"message": f"Deleted {len(all_items['ids'])} items"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    print(f"Starting API server on {API_HOST}:{API_PORT}")
    uvicorn.run(app, host=API_HOST, port=API_PORT)
