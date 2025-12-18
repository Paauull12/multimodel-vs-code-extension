import os
import json
import requests
import matplotlib.pyplot as plt
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL_NAME = "openai/gpt-4o-mini"

def _get_prompt(current_context):
    return f"""
You are an expert evaluator of AI agent logs. 
Your task is to analyze the following execution step of an agent and the current context history. For context
these steps are from a multi-agent system that is made to build applications and help delevopers. For each run
we have more bots that communicate with each other. You have to grade them. 
There are two bots:
main - which communicated with the VS-Code
architecture - which will communicate to the following bots what are the best ways to build the system
builder - this should output the code
reviewer - this should review the code of the build to look for error or mistakes 

You have to be critic of eachs bots works.

Current Context:
{current_context}

You must return a valid JSON object (no markdown, no extra text) with exactly these keys:
1. "grade": A integer from 0 to 10 evaluating the quality/success of this step.
2. "observations": A short string summary of what went well or wrong.
3. "futureContext": A string summarizing the accumulated knowledge or context that should be passed to the next step.

Example format:
{{
    "grade": <number>,
    "observations": "The agent correctly identified the missing file.",
    "futureContext": "User requested auth service; Agent checked files; Found missing serializers."
}}

Current Agent Step Data:
"""

def analyze_step(entry, current_context):
    if not OPENROUTER_API_KEY:
        print("[Error] OPENROUTER_API_KEY environment variable is not set.")
        return None

    prompt = _get_prompt(current_context)

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }
    
    entry_str = json.dumps(entry, indent=2)

    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": prompt},
            {"role": "user", "content": entry_str}
        ],
        "response_format": {"type": "json_object"}
    }

    try:
        response = requests.post(OPENROUTER_URL, headers=headers, json=payload)
        response.raise_for_status()
        
        result = response.json()
        content_str = result['choices'][0]['message']['content']
        
        return json.loads(content_str)
    except Exception as e:
        print(f"[API Error] Failed to analyze step: {e}")
        return {
            "grade": 0, 
            "observations": f"Error calling API: {str(e)}", 
            "futureContext": current_context
        }

def save_results(filename, analysis_history):
    base_name = os.path.splitext(filename)[0]
    output_dir = os.path.join("results", base_name)
    os.makedirs(output_dir, exist_ok=True)

    json_output_path = os.path.join(output_dir, "analysis_data.json")
    with open(json_output_path, 'w') as f:
        json.dump(analysis_history, f, indent=2)

    grades = []
    steps = []
    
    for idx, item in enumerate(analysis_history):
        analysis_data = item.get("analysis")
        if analysis_data and "grade" in analysis_data:
            grades.append(analysis_data["grade"])
            steps.append(idx + 1)

    if grades:
        plt.figure(figsize=(10, 6))
        plt.plot(steps, grades, marker='o', linestyle='-', color='b')
        plt.title(f'Agent Performance: {filename}')
        plt.xlabel('Step Number')
        plt.ylabel('Grade (0-10)')
        plt.ylim(0, 10.5)
        plt.grid(True)
        
        plot_path = os.path.join(output_dir, "grades_plot.png")
        plt.savefig(plot_path)
        plt.close()
        print(f"Saved results to {output_dir}")
    else:
        print("No grades available to plot.")

def load_processed_files(processed_path):
    processed_map = set()
    if os.path.exists(processed_path):
        with open(processed_path, 'r') as f:
            for line in f:
                filename = line.strip()
                if filename:
                    processed_map.add(filename)
    return processed_map

def save_processed_files(processed_path, processed_map):
    try:
        sorted_files = sorted(list(processed_map))
        with open(processed_path, 'w') as f:
            for filename in sorted_files:
                f.write(f"{filename}\n")
    except Exception as e:
        print(f"[Error] Failed to save processed list: {e}")

def process_runs(runs_dir, processed_map):
    if not os.path.exists(runs_dir):
        print(f"Directory not found: {runs_dir}")
        return False

    files_processed_in_this_run = 0

    for filename in os.listdir(runs_dir):
        file_path = os.path.join(runs_dir, filename)
        
        if not os.path.isfile(file_path):
            continue

        if filename not in processed_map:
            print(f"\n>>> Processing new file: {filename}")
            
            try:
                with open(file_path, 'r') as f:
                    content = f.read().strip()
                
                if not content:
                    print("File is empty.")
                    processed_map.add(filename)
                    files_processed_in_this_run += 1
                    continue

                if content.endswith(','):
                    content = content[:-1]

                if not content.startswith('['):
                    json_payload = f"[{content}]"
                else:
                    json_payload = content

                data = json.loads(json_payload)
                
                context_variable = "this is the first message"
                analysis_history = []

                for entry in data:
                    if "agent" in entry:
                        print(f"Analyzing step for agent: {entry.get('agent')}...")
                        
                        analysis_result = analyze_step(entry, context_variable)
                        
                        if analysis_result and "futureContext" in analysis_result:
                            context_variable = analysis_result["futureContext"]

                        record = {
                            "original_entry": entry,
                            "analysis": analysis_result
                        }
                        analysis_history.append(record)
                    else:
                        analysis_history.append({"original_entry": entry, "analysis": None})

                save_results(filename, analysis_history)
                
                processed_map.add(filename)
                files_processed_in_this_run += 1

            except json.JSONDecodeError as e:
                print(f"Error parsing JSON in {filename}: {e}")
            except Exception as e:
                print(f"An unexpected error occurred with {filename}: {e}")
                import traceback
                traceback.print_exc()
        
    return files_processed_in_this_run > 0

if __name__ == "__main__":
    PROCESSED_FILE = 'processed.txt'
    RUNS_DIRECTORY = '/home/paaull/project-ai/multimodel-agent-extension/server/backend/runs'

    os.makedirs("results", exist_ok=True)

    processed_files = load_processed_files(PROCESSED_FILE)
    changes_made = process_runs(RUNS_DIRECTORY, processed_files)

    if changes_made:
        save_processed_files(PROCESSED_FILE, processed_files)
    else:
        print("\n[Info] No new files found.")