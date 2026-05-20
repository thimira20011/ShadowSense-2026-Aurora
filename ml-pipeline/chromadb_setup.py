"""ChromaDB vector database initialization and setup."""
import chromadb
import os


class ChromaDBManager:
    """Manages ChromaDB initialization and collections."""
    
    def __init__(self, persist_dir: str = "./chromadb"):
        self.persist_dir = persist_dir
        os.makedirs(persist_dir, exist_ok=True)
        self.client = chromadb.Client()
    
    def initialize_collections(self):
        """Create default collections for scam patterns."""
        # Scam patterns collection
        self.client.get_or_create_collection(
            name="scam_patterns",
            metadata={"hnsw:space": "cosine"}
        )
        
        # User feedback overrides collection
        self.client.get_or_create_collection(
            name="feedback_overrides",
            metadata={"hnsw:space": "cosine"}
        )
        
        # Linguistic patterns collection
        self.client.get_or_create_collection(
            name="linguistic_patterns",
            metadata={"hnsw:space": "cosine"}
        )
    
    def get_collection(self, name: str):
        """Get a specific collection."""
        return self.client.get_collection(name=name)


if __name__ == "__main__":
    db = ChromaDBManager()
    db.initialize_collections()
    print("ChromaDB initialized successfully")
