import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Dict
import re

class SemanticChunker:
    """Semantic-based document chunking with paragraph-level coherence"""
    
    def __init__(self, model_name: str = 'all-MiniLM-L6-v2', similarity_threshold: float = 0.5):
        """
        Args:
            model_name: Sentence transformer model
            similarity_threshold: Threshold for semantic similarity (0-1)
        """
        self.model = SentenceTransformer(model_name)
        self.similarity_threshold = similarity_threshold
    
    def split_into_sentences(self, text: str) -> List[str]:
        """Split text into sentences while preserving structure"""
        # Handle common abbreviations
        text = re.sub(r'\b(Dr|Mr|Mrs|Ms|Prof|Sr|Jr|vs|etc|e\.g|i\.e)\.', r'\1<PERIOD>', text)
        
        # Split on sentence boundaries
        sentences = re.split(r'(?<=[.!?])\s+', text)
        
        # Restore periods
        sentences = [s.replace('<PERIOD>', '.') for s in sentences]
        
        # Filter empty sentences
        return [s.strip() for s in sentences if s.strip()]
    
    def chunk_by_semantic_similarity(self, text: str, max_chunk_size: int = 500) -> List[Dict]:
        """
        Chunk document based on semantic similarity between sentences
        
        Args:
            text: Input document text
            max_chunk_size: Maximum words per chunk
            
        Returns:
            List of chunks with metadata
        """
        sentences = self.split_into_sentences(text)
        
        if not sentences:
            return []
        
        # Generate embeddings for all sentences
        embeddings = self.model.encode(sentences)
        
        chunks = []
        current_chunk = [sentences[0]]
        current_embedding = embeddings[0].reshape(1, -1)
        
        for i in range(1, len(sentences)):
            sentence = sentences[i]
            sentence_embedding = embeddings[i].reshape(1, -1)
            
            # Calculate similarity with current chunk
            similarity = cosine_similarity(current_embedding, sentence_embedding)[0][0]
            
            # Check if adding sentence exceeds max size
            current_word_count = sum(len(s.split()) for s in current_chunk)
            sentence_word_count = len(sentence.split())
            
            # Add to current chunk if similar enough and within size limit
            if (similarity >= self.similarity_threshold and 
                current_word_count + sentence_word_count <= max_chunk_size):
                current_chunk.append(sentence)
                # Update chunk embedding (average)
                current_embedding = np.mean(
                    [embeddings[j] for j in range(i - len(current_chunk) + 1, i + 1)],
                    axis=0
                ).reshape(1, -1)
            else:
                # Save current chunk and start new one
                chunks.append({
                    'text': ' '.join(current_chunk),
                    'start_idx': i - len(current_chunk),
                    'end_idx': i - 1,
                    'word_count': current_word_count
                })
                current_chunk = [sentence]
                current_embedding = sentence_embedding
        
        # Add final chunk
        if current_chunk:
            chunks.append({
                'text': ' '.join(current_chunk),
                'start_idx': len(sentences) - len(current_chunk),
                'end_idx': len(sentences) - 1,
                'word_count': sum(len(s.split()) for s in current_chunk)
            })
        
        return chunks

print("SemanticChunker ready")
