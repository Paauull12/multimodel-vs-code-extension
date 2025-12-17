import requests
import re
from django.conf import settings


def parse_pr_url(url):
    pattern = r"github\.com/([^/]+)/([^/]+)/pull/(\d+)"
    match = re.search(pattern, url)

    if not match:
        raise ValueError("Invalid GitHub Pull Request URL")

    return {
        "owner": match.group(1),
        "repo": match.group(2),
        "pull_number": match.group(3)
    }


def fetch_pr_files(pr_url):
    data = parse_pr_url(pr_url)
    owner, repo, pull = data['owner'], data['repo'], data['pull_number']

    api_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pull}/files"

    headers = {
        "Accept": "application/vnd.github.v3+json",
    }

    if hasattr(settings, 'GITHUB_TOKEN') and settings.GITHUB_TOKEN:
        headers["Authorization"] = f"token {settings.GITHUB_TOKEN}"

    response = requests.get(api_url, headers=headers)

    if response.status_code != 200:
        raise Exception(f"GitHub API Error: {response.status_code} - {response.text}")

    files = response.json()

    IGNORED_EXTENSIONS = (
        '.pdf', '.tex', '.DS_Store', '.js.map',
        '.png', '.aux', '.fdb_latexmk', '.fls',
        '.log', '.out', '-lock.json', '.css', '.pyc'
    )

    code_changes = []
    for file in files:
        filename = file['filename']

        if filename.lower().endswith(IGNORED_EXTENSIONS):
            continue

        if file['status'] == 'removed':
            continue

        code_changes.append({
            "filename": filename,
            "status": file['status'],
            "patch": file.get('patch', "No textual changes (binary or large file)."),
            "raw_url": file.get('raw_url')
        })

    return code_changes


def post_review_to_github(pr_url, comments_data):
    data = parse_pr_url(pr_url)
    owner, repo, pull = data['owner'], data['repo'], data['pull_number']

    headers = {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": f"token {settings.GITHUB_TOKEN}"
    }

    pr_api_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pull}"
    resp = requests.get(pr_api_url, headers=headers)
    resp.raise_for_status()
    commit_id = resp.json()['head']['sha']

    review_comments = []

    for file_data in comments_data:
        path = file_data['filename']
        for review in file_data['reviews']:
            review_comments.append({
                "path": path,
                "line": int(review['line']),
                "side": "RIGHT",
                "body": f" **AI Review:** {review['comment']}"
            })

    if not review_comments:
        return "No comments to post."

    payload = {
        "commit_id": commit_id,
        "body": "This code review was generated automatically by an AI Agent.",
        "event": "COMMENT",
        "comments": review_comments
    }

    post_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pull}/reviews"
    response = requests.post(post_url, headers=headers, json=payload)

    if response.status_code != 200:
        raise Exception(f"GitHub Error: {response.text}")

    return response.json()['html_url']