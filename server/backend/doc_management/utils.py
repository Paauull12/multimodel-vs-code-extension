from sentence_transformers import SentenceTransformer
import numpy as np

embedding_model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')

def get_embedding(text):
    return embedding_model.encode(text)

def compute_cosine_similarity(vec_a, vec_b):
    """ (Keep your existing function) """
    a = np.array(vec_a)
    b = np.array(vec_b)
    dot_product = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot_product / (norm_a * norm_b)


def extract_text_from_file(file_obj):
    try:
        file_obj.seek(0)
        content = file_obj.read()

        if isinstance(content, bytes):
            return content.decode('utf-8', errors='ignore')
        return content

    except Exception as e:
        print(f"File read error: {e}")
        return ""


def get_best_snippet(text_content, query_vector, context_lines=14):
    lines = text_content.splitlines()
    if not lines:
        return ""

    if len(lines) < 20:
        return text_content

    window_size = 3
    best_score = -1
    best_window_start = 0

    for i in range(0, len(lines) - window_size + 1, 1):
        chunk = " ".join(lines[i: i + window_size])

        chunk_vector = get_embedding(chunk)

        score = compute_cosine_similarity(query_vector, chunk_vector)

        if score > best_score:
            best_score = score
            best_window_start = i

    start_index = max(0, best_window_start - context_lines)
    end_index = min(len(lines), best_window_start + window_size + context_lines)

    snippet_lines = lines[start_index:end_index]
    return "\n".join(snippet_lines)