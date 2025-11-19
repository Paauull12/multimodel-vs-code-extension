from django.core.management.base import BaseCommand
from main_chatbot.models import Agent

from models.main.system_instruction import getMainSystemInstruction
from models.architecture.system_instruction import getArchitectureSystemInstruction
from models.builder.system_instruction import getBuilderSystemInstruction
from models.review.system_instruction import getReviewSystemInstruction


class Command(BaseCommand):
    help = 'Seed the database with AI agents'

    def handle(self, *args, **kwargs):
        agents_data = [
            {
                'name': 'main',
                'prompt': getMainSystemInstruction(),
                'is_active': True
            },
            {
                'name': 'architecture',
                'prompt': getArchitectureSystemInstruction(),
                'is_active': True
            },
            {
                'name': 'builder',
                'prompt': getBuilderSystemInstruction(),
                'is_active': True
            },
            {
                'name': 'review',
                'prompt': getReviewSystemInstruction(),
                'is_active': True
            }
        ]

        for agent_data in agents_data:
            agent, created = Agent.objects.update_or_create(
                name=agent_data['name'],
                defaults=agent_data
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'✓ Created agent: {agent.name}'))
            else:
                self.stdout.write(self.style.WARNING(f'↻ Updated agent: {agent.name}'))

        self.stdout.write(
            self.style.SUCCESS(f'\n✓ Successfully seeded {len(agents_data)} agents!')
        )
