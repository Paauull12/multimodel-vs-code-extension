import requests
import json
from django.conf import settings


def get_ai_review(filename, numbered_diff_content):
    system_prompt = """
    You are a strict Senior Software Engineer. Review the code changes provided.
    The input format is: "LineNumber | Code".

    Rules:
    1. Only comment on lines starting with '+' (added/modified lines).
    2. Be critical but constructive (look for bugs, security issues, bad naming, optimization).
    3. Return valid JSON ONLY. No markdown formatting.
    4. The output must be a JSON object with a single key "reviews" containing a list of objects: {"reviews": [{"line": <int>, "comment": "<string>"}]}
    5. If the code looks good, return {"reviews": []}.
    Do not add more than 2 comments at most where you find it most relevant. 
    """

    user_prompt = f"File: {filename}\n\nDiff:\n{numbered_diff_content}"

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }

    data = {
        "model": "openai/gpt-4o-mini",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "response_format": {"type": "json_object"}
    }

    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=data
        )

        response.raise_for_status()
        result = response.json()

        content = result['choices'][0]['message']['content']

        response_from_agent = json.loads(content)

        print(f"AI Response for {filename}: {response_from_agent}")

        return response_from_agent

    except Exception as e:
        print(f"AI Error for {filename}: {e}")
        return []