from django.db import models
from django.contrib.auth.models import User
import uuid


class Agent(models.Model):
    TASK_CHOICES = [
        ('orchestration_model', 'Orchestration Model'),
        ('architecture-planner', 'Architecture Planner'),
        ('builder', 'Builder'),
        ('review_model', 'Review Model'),
    ]

    name = models.CharField(max_length=100, unique=True, help_text="e.g., 'main', 'architecture', 'builder', 'review'")
    prompt = models.TextField(help_text="System prompt for this agent")
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agents'
        ordering = ['name']

    def __str__(self):
        return f"{self.name}"


class Thread(models.Model):
    STATUS_CHOICES = [
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='conversations')
    title = models.CharField(max_length=255, blank=True, null=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='completed')

    # Track which agent is currently handling this thread
    current_agent = models.ForeignKey(
        Agent,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='active_threads'
    )

    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'threads'

    def __str__(self):
        return f"Thread {self.id} - self.title: {self.title}"


class Message(models.Model):
    MESSAGE_TYPE_CHOICES = [
        ('user_input', 'User Input'),
        ('agent_response', 'Agent Response'),
        ('agent_internal', 'Agent Internal'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Track token usage for this message
    tokens_used = models.IntegerField(default=0, help_text="Number of tokens used for this generation")

    thread = models.ForeignKey(
        Thread,
        on_delete=models.CASCADE,
        related_name='messages'
    )

    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPE_CHOICES)

    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='messages'
    )

    sender_agent = models.ForeignKey(
        Agent,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sent_messages'
    )

    recipient_agent = models.ForeignKey(
        Agent,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='received_messages'
    )

    content = models.TextField()

    metadata = models.JSONField(default=dict, blank=True)

    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'messages'
        ordering = ['timestamp']
        indexes = [
            models.Index(fields=['thread', 'timestamp']),
            models.Index(fields=['message_type']),
        ]

    def __str__(self):
        if self.message_type == 'user_input':
            return f"User: {self.content[:50]}"
        elif self.sender_agent:
            target = f" → {self.recipient_agent.name}" if self.recipient_agent else ""
            return f"{self.sender_agent.name}{target}: {self.content[:50]}"
        return f"Message {self.id}"
