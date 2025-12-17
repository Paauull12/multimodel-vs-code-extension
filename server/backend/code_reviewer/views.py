from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
from .github_utils import fetch_pr_files, post_review_to_github
from .diff_utils import parse_patch_to_numbered_lines
from .ai_agent import get_ai_review


def review_index(request):
    return render(request, 'code_reviewer/index.html')


@csrf_exempt
def fetch_pr_data(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            pr_url = data.get('pr_link')

            if not pr_url:
                return JsonResponse({'error': 'No URL provided'}, status=400)

            changes = fetch_pr_files(pr_url)

            return JsonResponse({
                'success': True,
                'files': changes,
                'count': len(changes)
            })

        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=500)

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def analyze_pr_code(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            pr_url = data.get('pr_link')

            # Fetch files again to ensure fresh data
            raw_files = fetch_pr_files(pr_url)

            ai_comments = []

            for file in raw_files:
                # Skip if no patch or empty
                if not file.get('patch') or "No textual changes" in file['patch']:
                    continue

                # 1. Get Text AND Valid Lines
                numbered_diff, valid_lines = parse_patch_to_numbered_lines(file['patch'])

                # 2. Call AI
                raw_response = get_ai_review(file['filename'], numbered_diff)

                # 3. Robust Extraction
                reviews = []
                if isinstance(raw_response, dict):
                    reviews = raw_response.get('reviews') or raw_response.get('comments') or []
                elif isinstance(raw_response, list):
                    reviews = raw_response

                if not isinstance(reviews, list):
                    reviews = []

                # 4. FILTERING: Only keep comments on lines that exist in the patch
                valid_reviews = []
                for rev in reviews:
                    try:
                        line_num = int(rev['line'])
                        if line_num in valid_lines:
                            valid_reviews.append(rev)
                        else:
                            print(f"Skipping comment on invalid line {line_num} in {file['filename']}")
                    except (ValueError, KeyError):
                        continue

                if valid_reviews:
                    ai_comments.append({
                        "filename": file['filename'],
                        "reviews": valid_reviews
                    })

            return JsonResponse({'success': True, 'analysis': ai_comments})

        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=500)

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def submit_review_to_github(request):
    if request.method == 'POST':
        try:
            payload = json.loads(request.body)
            pr_link = payload.get('pr_link')
            comments = payload.get('comments')

            if not pr_link or not comments:
                return JsonResponse({'success': False, 'error': 'Missing data'})

            review_url = post_review_to_github(pr_link, comments)

            return JsonResponse({'success': True, 'review_url': review_url})

        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=500)

    return JsonResponse({'error': 'Method not allowed'}, status=405)