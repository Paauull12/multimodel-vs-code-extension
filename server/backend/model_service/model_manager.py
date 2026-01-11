import asyncio
import json
import os
import re

import httpx
import yaml

from dotenv import load_dotenv

load_dotenv()


class ModelManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, "initialized"):
            self.config = {}
            self.api_key = os.getenv("OPENROUTER_API_KEY")
            self.base_url = os.getenv("MODEL_MANAGER_BASE_URL", "https://openrouter.ai/api/v1/chat/completions")
            self.initialized = True
            self.load_config()

    def load_config(self, config_path="templates/main_chatbot_config.yml"):
        with open(config_path, 'r') as config_file:
            self.config = yaml.safe_load(config_file)

    def get_agent_config(self, agent_name):
        return self.config.get("agents", {}).get(agent_name)

    def extract_json(self, text):
        text = text.strip()

        try:
            return json.loads(text)
        except Exception as e:
            pass

        json_pattern = r'```json\s*(.*?)\s*```'
        match = re.search(json_pattern, text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        code_pattern = r'```\s*(.*?)\s*```'
        match = re.search(code_pattern, text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        json_object_pattern = r'\{.*\}'
        match = re.search(json_object_pattern, text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass

        raise ValueError(f"Could not extract valid JSON from response: {text[:200]}...")

    async def call_agent(self,
                         agent_name,
                         messages,
                         response_type,
                         temperature,
                         **kwargs):
        agent_config = self.get_agent_config(agent_name)

        if not agent_config:
            raise ValueError(f"Agent {agent_name} is not configured")

        print(f"API Key: {self.api_key[:20]}..." if self.api_key else "NO API KEY")
        print(f"Base URL: {self.base_url}")
        print(f"Model: {agent_config['name']}")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:8000",
            "X-Title": "AI-Chatbot-Service",
        }

        payload = {
            'model': agent_config["name"],
            'messages': messages,
            'max_tokens': agent_config.get("max_tokens", 4100),
            'temperature': temperature,
            **kwargs,
        }

        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                self.base_url,
                headers=headers,
                json=payload,
            )

            print(f"Response status: {response.status_code}")

            if response.status_code != 200:
                error_body = response.text
                print(f"ERROR BODY: {error_body}")
                try:
                    error_json = response.json()
                    print(f"ERROR JSON: {json.dumps(error_json, indent=2)}")
                except:
                    pass
                response.raise_for_status()

            result = response.json()
            print(f"SUCCESS - Full response: {json.dumps(result, indent=2)[:1000]}")

        if 'choices' not in result:
            print(f"ERROR: No 'choices' in response. Keys: {result.keys()}")
            raise ValueError(f"Invalid API response: {result}")

        if len(result['choices']) == 0:
            print("ERROR: Empty choices array")
            raise ValueError("API returned empty choices")

        content = result['choices'][0]['message']['content']

        # Extract token usage
        usage = result.get('usage', {})
        total_tokens = usage.get('total_tokens', 0)

        print(f"Content: {content[:500]}")
        print(f"Tokens used: {total_tokens}")

        if response_type == 'json':
            try:
                parsed_json = self.extract_json(content)
                return parsed_json, total_tokens
            except ValueError as e:
                print(f"Failed to parse JSON: {e}")
                print(f"Plain text response: {content}")
                return content, total_tokens

        return content, total_tokens

    def call_agent_sync(self,
                        agent_name,
                        messages,
                        response_type,
                        temperature,
                        **kwargs):

        return asyncio.run(
            self.call_agent(agent_name, messages, response_type, temperature, **kwargs)
        )
