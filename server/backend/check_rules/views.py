from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from doc_management.models import Document
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404
from doc_management.models import Document
from doc_management.utils import get_embedding, compute_cosine_similarity
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated

import tempfile
import json
import os

from check_rules.reasoner import Reasoner
from check_rules.documentRetriever import DocumentRetriever
from check_rules.semanticChunker import SemanticChunker
from check_rules.documentLoader import DocumentLoader

@csrf_exempt
def check_compliance(request):
    """
    POST endpoint that receives:
        - policy_file (PDF, DOCX, TXT)
        - code_file (TXT, JS, PY, etc.)

    Returns:
        JSON output from the Reasoner
    """

    print("DEBUG FILES:", request.FILES)
    print("DEBUG POST:", request.POST)

    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    # Validate the files
    if "policy_file" not in request.FILES:
        return JsonResponse({"error": "policy_file missing"}, status=400)

    if "code_file" not in request.FILES:
        return JsonResponse({"error": "code_file missing"}, status=400)

    policy_file = request.FILES["policy_file"]
    code_file = request.FILES["code_file"]

    # Save uploaded files temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=policy_file.name) as tmp_policy:
        for chunk in policy_file.chunks():
            tmp_policy.write(chunk)
        tmp_policy_path = tmp_policy.name

    with tempfile.NamedTemporaryFile(delete=False, suffix=code_file.name) as tmp_code:
        for chunk in code_file.chunks():
            tmp_code.write(chunk)
        tmp_code_path = tmp_code.name

    # Load system prompt from your project folder
    project_base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    reasoner_prompt_path = os.path.join(project_base, "check_rules", "reasonerPrompt.txt")

    print("PROJECT_BASE:" + project_base)
    print("REASONER_PROMPT_PATH:" + reasoner_prompt_path)
    
    # Create retrieval components
    retriever = DocumentRetriever()
    chunker = SemanticChunker()

    try:
        # Inject your Reasoner code
        result_json = Reasoner.evaluate_compliance(
            reasoner_prompt_path=reasoner_prompt_path,
            policy_path=tmp_policy_path,
            code_path=tmp_code_path,
            retriever=retriever,
            chunker=chunker,
            top_k=6
        )
        
        print("DEBUG RAW RESULT:", result_json)

        if isinstance(result_json, (dict, list)):
            return JsonResponse(result_json, safe=False)
        
        clean = (result_json or "").strip()

        # If model returned nothing
        if not clean:
            return JsonResponse({
                "error": "Model returned empty output.",
                "raw_output": clean
            }, status=500)

        # Remove markdown fences
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            clean = clean.replace("json", "", 1).strip()

        # Try parsing JSON
        try:
            parsed = json.loads(clean)
        except Exception as e:
            print("DEBUG RAW (unparsed) JSON:", repr(result_json))
            print("DEBUG CLEANED JSON:", clean)
            print("JSON PARSE ERROR:", e)
            return JsonResponse({
                "error": "Model returned invalid JSON.",
                "raw_output": clean,
                "exception": str(e)
            }, status=500)

        return JsonResponse(parsed, safe=False)


    except Exception as e:
        print("EROAREA: ", e)
        return JsonResponse({"error": str(e)}, status=500)

    finally:
        # Clean up temp files
        os.remove(tmp_policy_path)
        os.remove(tmp_code_path)
        
@csrf_exempt
@api_view(['POST']) 
@authentication_classes([TokenAuthentication]) 
@permission_classes([IsAuthenticated])
def check_company_rules_auto(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    try:
        data = request.data
        code_text = data.get("code", "")
        company = request.user.profile.company

        docs = Document.objects.filter(company=company)
        print(f"--- DEBUG: Verificare pentru compania: {company.name} ---")
        print(f"--- DEBUG: Documente găsite în DB: {docs.count()} ---")
        query_vector = get_embedding(code_text)
        
        relevant_chunks = []
        relevant_content = ""
        for doc in docs:
            doc_vector = doc.get_embedding()
            if doc_vector is not None:
                score = compute_cosine_similarity(query_vector, doc_vector)
                print(f"DEBUG: Document '{doc.name}' | Scor: {score:.4f}")
                if score > 0.3:
                    content = DocumentLoader.load(doc.file.path)
                    relevant_chunks.append({"text": content, "score": score})
                    relevant_content += f"\n--- Source: {doc.name} ---\n{content}\n"

        if not relevant_content.strip():
            return JsonResponse({
                "compliant": False,
                "summary": "Nu am găsit documente de design relevante pentru acest cod în baza de date a companiei."
            })
        relevant_chunks.sort(key=lambda x: x["score"], reverse=True)
        context_text = "\n\n".join([c["text"] for c in relevant_chunks[:3]])

        with tempfile.NamedTemporaryFile(delete=False, suffix=".txt") as tmp_policy:
            tmp_policy.write(context_text.encode('utf-8'))
            tmp_policy_path = tmp_policy.name
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".py") as tmp_code:
            tmp_code.write(code_text.encode('utf-8'))
            tmp_code_path = tmp_code.name

        project_base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        reasoner_prompt_path = os.path.join(project_base, "check_rules", "reasonerPrompt.txt")

        result_json = Reasoner.evaluate_compliance(
            reasoner_prompt_path=reasoner_prompt_path,
            policy_path=tmp_policy_path,
            code_path=tmp_code_path,
            retriever=DocumentRetriever(),
            chunker=SemanticChunker(),
            top_k=5
        )

        if isinstance(result_json, (dict, list)):
            return JsonResponse(result_json, safe=False)
        
        clean = (result_json or "").strip()

        if not clean:
            return JsonResponse({
                "error": "Model returned empty output.",
                "raw_output": clean
            }, status=500)

        if clean.startswith("```"):
            clean = clean.split("```")[1]
            clean = clean.replace("json", "", 1).strip()
       
        parsed = json.loads(clean)
        return JsonResponse(parsed, safe=False)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
