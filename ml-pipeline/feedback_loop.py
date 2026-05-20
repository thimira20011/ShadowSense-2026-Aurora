"""Feedback loop implementation for continuous model improvement."""
from typing import Dict, Any
from chromadb_setup import ChromaDBManager
from embeddings import EmbeddingsGenerator


class FeedbackLoop:
    """Processes user feedback and updates ChromaDB with overrides."""
    
    def __init__(self):
        self.db = ChromaDBManager()
        self.embeddings = EmbeddingsGenerator()
        self.db.initialize_collections()
    
    def process_override(self, feedback_data: Dict[str, Any]) -> bool:
        """Process user feedback override and store in ChromaDB."""
        analysis_id = feedback_data.get("analysis_id")
        was_false_positive = feedback_data.get("was_false_positive")
        correct_assessment = feedback_data.get("correct_assessment")
        
        # Generate embedding for the content
        embedding = self.embeddings.embed_text(correct_assessment)
        
        # Store in feedback_overrides collection
        collection = self.db.get_collection("feedback_overrides")
        collection.add(
            ids=[analysis_id],
            embeddings=[embedding],
            documents=[correct_assessment],
            metadatas=[{
                "was_false_positive": was_false_positive,
                "correct_assessment": correct_assessment
            }]
        )
        
        return True
    
    def retrieve_similar_overrides(
        self,
        text: str,
        n_results: int = 5
    ) -> list:
        """Retrieve similar feedback overrides for model refinement."""
        embedding = self.embeddings.embed_text(text)
        collection = self.db.get_collection("feedback_overrides")
        
        results = collection.query(
            query_embeddings=[embedding],
            n_results=n_results
        )
        
        return results


if __name__ == "__main__":
    loop = FeedbackLoop()
    print("Feedback loop initialized")
