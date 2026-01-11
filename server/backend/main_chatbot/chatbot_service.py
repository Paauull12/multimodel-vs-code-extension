from main_chatbot.models import Thread, Message, Agent
from model_service.model_manager import ModelManager
from django.contrib.auth.models import User
from django.conf import settings
import os
import uuid
import json
from datetime import datetime


class ChatbotService:
    _instance = None
    PROMPT_REINJECT_INTERVAL = 10

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, "initialized"):
            self.initialized = True
            self.model_manager = ModelManager()
            # Initialize runs directory
            self.runs_dir = os.path.join(settings.BASE_DIR, 'runs')
            if not os.path.exists(self.runs_dir):
                os.makedirs(self.runs_dir)

    def _log_to_run_file(self, run_token, log_data):
        file_name = f"run_{run_token}.log"
        file_path = os.path.join(self.runs_dir, file_name)

        timestamp = datetime.now().isoformat()

        # Format the log entry
        entry = {
            "timestamp": timestamp,
            **log_data
        }

        try:
            with open(file_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, indent=2, default=str))
                f.write("\n,\n")
        except Exception as e:
            print(f"Error writing to log file: {e}")

            # Initialize runs directory
            self.runs_dir = os.path.join(settings.BASE_DIR, 'runs')
            if not os.path.exists(self.runs_dir):
                os.makedirs(self.runs_dir)

    def _log_to_run_file(self, run_token, log_data):
        file_name = f"run_{run_token}.log"
        file_path = os.path.join(self.runs_dir, file_name)

        timestamp = datetime.now().isoformat()

        # Format the log entry
        entry = {
            "timestamp": timestamp,
            **log_data
        }

        try:
            with open(file_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, indent=2, default=str))
                f.write("\n,\n")
        except Exception as e:
            print(f"Error writing to log file: {e}")

    def receive_user_message(self, user, thread_id, user_message):
        # Generate a unique token for this walkthrough
        run_token = str(uuid.uuid4())

        self._log_to_run_file(run_token, {
            "event": "run_start",
            "trigger": "user_message",
            "user": user.username,
            "thread_id": thread_id,
            "content": user_message
        })

        if thread_id:
            try:
                thread = Thread.objects.get(id=thread_id, user=user)
                if thread.status == 'completed':
                    thread.status = 'running'
                    thread.save()
            except Thread.DoesNotExist:
                return None
        else:
            thread = Thread.objects.create(
                user=user,
                status='running',
                title=user_message[:20]
            )

        main_agent = Agent.objects.get(name="main")
        thread.current_agent = main_agent
        thread.save()

        Message.objects.create(
            thread=thread,
            message_type='user_input',
            user=user,
            recipient_agent=main_agent,
            content=user_message,
            tokens_used=0
        )

        self._run_agent_loop(thread, run_token)

        return thread.id

    def _run_agent_loop(self, thread, run_token=None):
        # If run_token wasn't passed, generate one
        if not run_token:
            run_token = str(uuid.uuid4())

        max_iterations = 15
        iteration = 0

        while iteration < max_iterations:
            iteration += 1

            current_agent = thread.current_agent
            messages = self._build_agent_messages(thread, current_agent)

            self._log_to_run_file(run_token, {
                "event": "agent_execution_start",
                "iteration": iteration,
                "agent": current_agent.name,
                "messages_context_length": len(messages)
            })

            try:
                # Unpack response and token count
                response, tokens_used = self.model_manager.call_agent_sync(
                    agent_name=current_agent.name,
                    messages=messages,
                    response_type='json',
                    temperature=0.7
                )
            except Exception as e:
                thread.status = 'failed'
                thread.save()
                error_msg = str(e)

                self._log_to_run_file(run_token, {
                    "event": "agent_execution_error",
                    "agent": current_agent.name,
                    "error": error_msg
                })
                
                Message.objects.create(
                    thread=thread,
                    message_type='agent_response',
                    sender_agent=current_agent,
                    content=f"Error occurred: {error_msg}",
                    metadata={'error': True, 'error_message': error_msg}
                )
                return
            
            self._log_to_run_file(run_token, {
                "event": "agent_execution_success",
                "agent": current_agent.name,
                "response": response,
                "tokens_used": tokens_used
            })

            # Ensure response is a dictionary
            if not isinstance(response, dict):
                # Fallback if parsing failed but content returned
                response = {'target': 'unknown', 'response': str(response)}

            target = response.get('target')

            if target == 'user':
                files = response.get('files', [])
                code_data = response.get('code', {})

                if code_data and 'files' in code_data:
                    files = [
                        {
                            'name': f['path'].split('/')[-1],
                            'path': f['path'],
                            'content': f['content']
                        }
                        for f in code_data['files']
                    ]

                Message.objects.create(
                    thread=thread,
                    message_type='agent_response',
                    sender_agent=current_agent,
                    content=response.get('response', ''),
                    tokens_used=tokens_used,
                    metadata={
                        **response,
                        'files': files,
                        'summary': response.get('summary', {}),
                        'dependencies': code_data.get('dependencies', []),
                        'setup_instructions': code_data.get('setup_instructions', '')
                    }
                )
                thread.status = 'completed'
                thread.save()

                self._log_to_run_file(run_token, {
                    "event": "flow_complete",
                    "reason": "target_user"
                })

                break

            elif target in ['architecture', 'builder', 'review']:
                try:
                    next_agent = Agent.objects.get(name=target)
                except Agent.DoesNotExist:
                    thread.status = 'failed'
                    thread.save()
                    error_msg = f"Error: Agent '{target}' not found"

                    self._log_to_run_file(run_token, {
                        "event": "agent_transition_error",
                        "error": error_msg
                    })

                    Message.objects.create(
                        thread=thread,
                        message_type='agent_response',
                        sender_agent=current_agent,
                        content=error_msg,
                        tokens_used=tokens_used,
                        metadata={'error': True}
                    )

                    return

                revision_count = 0
                if target == 'builder' and current_agent.name == 'review':
                    review_messages = Message.objects.filter(
                        thread=thread,
                        sender_agent__name='review',
                        recipient_agent__name='builder'
                    ).count()
                    revision_count = review_messages

                Message.objects.create(
                    thread=thread,
                    message_type='agent_internal',
                    sender_agent=current_agent,
                    recipient_agent=next_agent,
                    content=response.get('context', ''),
                    tokens_used=tokens_used,
                    metadata={**response, 'revision_count': revision_count}
                )

                self._log_to_run_file(run_token, {
                    "event": "agent_transition",
                    "from": current_agent.name,
                    "to": next_agent.name
                })

                thread.current_agent = next_agent
                thread.save()

            elif target == 'request_files':
                Message.objects.create(
                    thread=thread,
                    message_type='agent_internal',
                    sender_agent=current_agent,
                    recipient_agent=current_agent,
                    content=f"[FILES REQUESTED]: {response.get('files_requested', [])}",
                    metadata={**response, 'awaiting_files': True}
                )

                Message.objects.create(
                    thread=thread,
                    message_type='agent_response',
                    sender_agent=current_agent,
                    content=response.get('response', 'Please provide the requested files.'),
                    tokens_used=tokens_used,
                    metadata={**response, 'requires_user_action': True}
                )

                thread.status = 'awaiting_files'
                thread.save()

                self._log_to_run_file(run_token, {
                    "event": "flow_pause",
                    "reason": "request_files"
                })

                break

            elif target == 'request_workspace_tree':
                from main_chatbot.utils import get_file_structure
                import os

                # Note: This uses os.getcwd() which might be the server dir, not user workspace.
                # Assuming this behavior is intended as per original code.
                workspace_path = os.getcwd()
                tree = get_file_structure(workspace_path)

                self._log_to_run_file(run_token, {
                    "event": "tool_execution",
                    "tool": "request_workspace_tree"
                })

                Message.objects.create(
                    thread=thread,
                    message_type='agent_internal',
                    sender_agent=current_agent,
                    recipient_agent=current_agent,
                    content=response.get('message', '[REQUESTED WORKSPACE TREE]'),
                    metadata={**response, 'tree_request': True}
                )

                # Then provide the tree as a system response (user role in context)
                Message.objects.create(
                    thread=thread,
                    message_type='user_input',
                    sender_agent=None,
                    recipient_agent=current_agent,
                    content=f"[WORKSPACE TREE]\n{tree}",
                    metadata={'system_generated': True, 'tree_provided': True}
                )

                # Continue to next iteration so agent can process the tree
                continue

            else:
                Message.objects.create(
                    thread=thread,
                    message_type='agent_response',
                    sender_agent=current_agent,
                    content=response.get('response', 'Task completed.'),
                    tokens_used=tokens_used,
                    metadata=response
                )
                thread.status = 'completed'
                thread.save()

                self._log_to_run_file(run_token, {
                    "event": "flow_complete",
                    "reason": "default_completion"
                })
                
                break

        if iteration >= max_iterations:
            thread.status = 'failed'
            thread.save()

            Message.objects.create(
                thread=thread,
                message_type='agent_response',
                sender_agent=current_agent,
                content="Maximum iterations reached. Please start a new conversation.",
                metadata={'error': True, 'reason': 'max_iterations'}
            )
            self._log_to_run_file(run_token, {
                "event": "flow_failed",
                "reason": "max_iterations_reached"
            })

            self._log_to_run_file(run_token, {
                "event": "flow_failed",
                "reason": "max_iterations_reached"
            })

    def _build_agent_messages(self, thread, current_agent):
        system_prompt = current_agent.prompt

        messages = [
            {'role': 'system', 'content': system_prompt}
        ]

        thread_messages = Message.objects.filter(thread=thread).order_by('timestamp')

        message_count = 0

        for msg in thread_messages:
            if msg.message_type == 'user_input':
                messages.append({
                    'role': 'user',
                    'content': msg.content
                })
                message_count += 1

            elif msg.message_type == 'agent_response':
                if msg.sender_agent:
                    if not msg.metadata.get('requires_user_action'):
                        messages.append({
                            'role': 'assistant',
                            'content': msg.content
                        })
                        message_count += 1

            elif msg.message_type == 'agent_internal':
                # Agent's own internal messages
                if msg.sender_agent == current_agent and msg.recipient_agent == current_agent:
                    messages.append({
                        'role': 'assistant',
                        'content': msg.content
                    })
                    message_count += 1
                # Messages TO this agent from other agents
                elif msg.recipient_agent == current_agent and msg.sender_agent != current_agent:
                    messages.append({
                        'role': 'user',
                        'content': f"[From {msg.sender_agent.name}]: {msg.content}"
                    })
                    message_count += 1
                # Messages FROM this agent to other agents
                elif msg.sender_agent == current_agent and msg.recipient_agent != current_agent:
                    messages.append({
                        'role': 'assistant',
                        'content': msg.content
                    })
                    message_count += 1
            elif msg.message_type == 'system_response':
                # System responses (like workspace tree) appear as user messages
                if msg.recipient_agent == current_agent:
                    messages.append({
                        'role': 'user',
                        'content': msg.content
                    })
                    message_count += 1

            if message_count > 0 and message_count % self.PROMPT_REINJECT_INTERVAL == 0:
                messages.append({
                    'role': 'system',
                    'content': f"REMINDER - Your core instructions:\n{system_prompt}"
                })

        return messages

    def receive_user_files(self, user, thread_id, files_content):
        # Generate a unique token for this walkthrough/run
        run_token = str(uuid.uuid4())

        self._log_to_run_file(run_token, {
            "event": "run_start",
            "trigger": "user_files",
            "user": user.username,
            "thread_id": thread_id
        })

        try:
            thread = Thread.objects.get(id=thread_id, user=user)
        except Thread.DoesNotExist:
            return None
        
        files_str = ""
        if isinstance(files_content, list):
            for file_data in files_content:
                name = file_data.get('name', 'Unknown')
                path = file_data.get('path', 'Unknown')
                content = file_data.get('content', '')
                files_str += f"\n--- File: {path} ---\n{content}\n"
        else:
            files_str = str(files_content)

        formatted_content = "[USER PROVIDED FILES]\n" + files_str

        Message.objects.create(
            thread=thread,
            message_type='user_input',
            user=user,
            content=formatted_content,
            metadata={'type': 'files'}
        )

        thread.status = 'running'
        thread.save()

        self._run_agent_loop(thread, run_token)

        return thread.id

    def get_thread_status(self, user, thread_id):

        try:
            thread = Thread.objects.get(id=thread_id, user=user)
        except Thread.DoesNotExist:
            return None

        latest_message = Message.objects.filter(
            thread=thread
        ).order_by('-timestamp').first()

        return {
            'thread_id': str(thread.id),
            'status': thread.status,
            'title': thread.title,
            'current_agent': thread.current_agent.name if thread.current_agent else None,
            'latest_message': {
                'content': latest_message.content if latest_message else None,
                'type': latest_message.message_type if latest_message else None,
                'sender': latest_message.sender_agent.name if latest_message and latest_message.sender_agent else 'user',
                'timestamp': latest_message.timestamp.isoformat() if latest_message else None,
                'metadata': latest_message.metadata if latest_message else {},
                'files': latest_message.metadata.get('files', []) if latest_message else [],
                'summary': latest_message.metadata.get('summary', {}) if latest_message else {}
            } if latest_message else None
        }
