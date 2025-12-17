from main_chatbot.models import Thread, Message, Agent
from model_service.model_manager import ModelManager
from django.contrib.auth.models import User


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

    def receive_user_message(self, user, thread_id, user_message):

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
            tokens_used=0  # User input doesn't consume generation tokens directly in this model
        )

        self._run_agent_loop(thread)

        return thread.id

    def _run_agent_loop(self, thread):

        max_iterations = 15
        iteration = 0

        while iteration < max_iterations:
            iteration += 1

            current_agent = thread.current_agent
            messages = self._build_agent_messages(thread, current_agent)

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
                Message.objects.create(
                    thread=thread,
                    message_type='agent_response',
                    sender_agent=current_agent,
                    content=f"Error occurred: {str(e)}",
                    metadata={'error': True, 'error_message': str(e)}
                )
                return

            # Ensure response is a dictionary (it should be if response_type='json' succeeded)
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
                break

            elif target in ['architecture', 'builder', 'review']:
                try:
                    next_agent = Agent.objects.get(name=target)
                except Agent.DoesNotExist:
                    thread.status = 'failed'
                    thread.save()
                    Message.objects.create(
                        thread=thread,
                        message_type='agent_response',
                        sender_agent=current_agent,
                        content=f"Error: Agent '{target}' not found",
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

                thread.current_agent = next_agent
                thread.save()

            elif target == 'request_files':
                Message.objects.create(
                    thread=thread,
                    message_type='agent_response',
                    sender_agent=current_agent,
                    content=response.get('response', 'Please provide the requested files.'),
                    tokens_used=tokens_used,
                    metadata=response
                )
                thread.status = 'running'
                thread.save()
                break

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
                    messages.append({
                        'role': 'assistant',
                        'content': msg.content
                    })
                    message_count += 1

            elif msg.message_type == 'agent_internal':
                if msg.recipient_agent == current_agent:
                    messages.append({
                        'role': 'user',
                        'content': f"[From {msg.sender_agent.name}]: {msg.content}"
                    })
                    message_count += 1
                elif msg.sender_agent == current_agent:
                    messages.append({
                        'role': 'assistant',
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

        try:
            thread = Thread.objects.get(id=thread_id, user=user)
        except Thread.DoesNotExist:
            return None

        Message.objects.create(
            thread=thread,
            message_type='user_input',
            user=user,
            content=files_content,
            metadata={'type': 'files'}
        )

        self._run_agent_loop(thread)

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
