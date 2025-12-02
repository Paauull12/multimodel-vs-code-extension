from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import tempfile
import json
import os

from check_rules.reasoner import Reasoner
from check_rules.documentRetriever import DocumentRetriever
from check_rules.semanticChunker import SemanticChunker

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

        clean = (result_json or "").strip()

        # If model returned nothing
        if not clean:
            return JsonResponse({
                "error": "Model returned empty output.",
                "raw_output": clean
            }, status=500)

        # Remove markdown fences
        if clean.startswith("```"):
            clean = clean.split("```")[1]   # remove first fence
            clean = clean.replace("json", "", 1).strip()

        # Try parsing JSON
        try:
            parsed = json.loads(clean)
        except Exception as e:
            print("DEBUG BAD JSON:", clean)
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
