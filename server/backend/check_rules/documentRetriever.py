from typing import Dict, List
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

class DocumentRetriever:
    """Retrieval system for semantic search over document chunks"""
    
    def __init__(self, model_name: str = 'all-MiniLM-L6-v2'):
        self.model = SentenceTransformer(model_name)
        self.chunks = []
        self.embeddings = None
        self.doc_metadata = {}
    
    def index_document(self, doc_id: str, chunks: List[Dict], metadata: Dict = None):
        """
        Index document chunks for retrieval
        
        Args:
            doc_id: Unique document identifier
            chunks: List of chunks from SemanticChunker
            metadata: Optional document metadata
        """
        # Add doc_id to each chunk
        for chunk in chunks:
            chunk['doc_id'] = doc_id
            self.chunks.append(chunk)
        
        # Store metadata
        self.doc_metadata[doc_id] = metadata or {}
        
        # Generate embeddings for all chunks
        chunk_texts = [chunk['text'] for chunk in self.chunks]
        self.embeddings = self.model.encode(chunk_texts)
        
        print(f"Indexed document '{doc_id}' with {len(chunks)} chunks")
    
    def search(self, query: str, top_k: int = 5) -> List[Dict]:
        """
        Search for most relevant chunks
        
        Args:
            query: Search query
            top_k: Number of results to return
            
        Returns:
            List of relevant chunks with scores
        """
        if not self.chunks:
            return []
        
        # Encode query
        query_embedding = self.model.encode([query])
        
        # Calculate similarities
        similarities = cosine_similarity(query_embedding, self.embeddings)[0]
        
        # Get top-k indices
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        # Build results
        results = []
        for idx in top_indices:
            chunk = self.chunks[idx].copy()
            chunk['score'] = float(similarities[idx])
            chunk['doc_metadata'] = self.doc_metadata.get(chunk['doc_id'], {})
            results.append(chunk)
        
        return results
    
    def get_stats(self) -> Dict:
        """Get indexing statistics"""
        return {
            'total_chunks': len(self.chunks),
            'total_documents': len(self.doc_metadata),
            'avg_chunk_size': np.mean([c['word_count'] for c in self.chunks]) if self.chunks else 0,
            'documents': list(self.doc_metadata.keys())
        }

print("DocumentRetriever ready")
