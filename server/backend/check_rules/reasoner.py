from transformers import AutoModelForCausalLM, AutoTokenizer
from pathlib import Path
from check_rules.documentLoader import DocumentLoader
from check_rules.semanticChunker import SemanticChunker
from check_rules.documentRetriever import DocumentRetriever
from huggingface_hub import InferenceClient

import os
os.environ['HF_TOKEN'] = 'your HF token'

class Reasoner:
    @staticmethod
    def load_text_file(path: str) -> str:
        p = Path(path)
        if not p.is_file():
            raise FileNotFoundError(f"File not found: {path}")
        return p.read_text(encoding="utf-8")

    @staticmethod
    def build_user_prompt(retrieved_chunks: str, code_text: str) -> str:
        chunks_text = "\n\n".join([chunk["text"] for chunk in retrieved_chunks])
        """
        Build the user message that will be sent to the model.
        The system prompt is already loaded separately from reasonerPrompt.txt.
        """
        return f"""Policy / Design / Specification document:
    ----------------------------------------
    {chunks_text}

    ----------------------------------------
    Developer's work (code or design artifact):
    ----------------------------------------
    {code_text}

    ----------------------------------------
    Task:
    Evaluate whether the developer's work fully complies with the above policy/design/spec.
    Follow the system prompt instructions strictly and output ONLY the required JSON.
    """

    @classmethod
    def evaluate_compliance(cls,
        reasoner_prompt_path: str,
        policy_path: str,
        code_path: str,
        retriever: DocumentRetriever,
        chunker: SemanticChunker,
        top_k: int = 6
    ):

        system_prompt = cls.load_text_file(reasoner_prompt_path)
        raw_policy_text = DocumentLoader.load(policy_path)
        code_text = cls.load_text_file(code_path)

        if len(raw_policy_text) < 500:     
            chunks = [{"text": raw_policy_text}]
        else:
            chunks = chunker.chunk_by_semantic_similarity(raw_policy_text, max_chunk_size=500)
        retriever.index_document("policy_doc", chunks)
        retrieved_chunks = retriever.search(code_text, top_k=top_k)

        user_prompt = cls.build_user_prompt(retrieved_chunks, code_text)

        model_name = "meta-llama/Llama-3.1-70B-Instruct"

        client = InferenceClient(
            model_name,
            token=os.environ['HF_TOKEN']
        )

        response = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=1600,
                temperature=0.4,
            )

        answer = response.choices[0].message["content"]
        return answer.strip()

