# views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .chatbot_service import ChatbotService
import time

chatbot_service = ChatbotService()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_message(request):

    user_message = request.data.get('message')
    thread_id = request.data.get('thread_id')

    if not user_message:
        return Response(
            {'error': 'message is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        thread_id = chatbot_service.receive_user_message(
            user=request.user,
            thread_id=thread_id,
            user_message=user_message
        )

        return Response({
            'thread_id': str(thread_id),
            'status': 'processing'
        })
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def poll_thread(request, thread_id):

    timeout = int(request.GET.get('timeout', 30))  # Max 30 seconds
    start_time = time.time()

    while time.time() - start_time < timeout:
        try:
            thread_status = chatbot_service.get_thread_status(
                user=request.user,
                thread_id=thread_id
            )

            # Return immediately if completed or failed
            if thread_status['status'] in ['completed', 'failed']:
                return Response(thread_status)

            time.sleep(1)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_404_NOT_FOUND
            )

    # Timeout reached, return current status
    try:
        thread_status = chatbot_service.get_thread_status(
            user=request.user,
            thread_id=thread_id
        )
        return Response(thread_status)
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_files(request, thread_id):

    files_content = request.data.get('files')

    if not files_content:
        return Response(
            {'error': 'files content is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        chatbot_service.receive_user_files(
            user=request.user,
            thread_id=thread_id,
            files_content=files_content
        )

        return Response({
            'thread_id': str(thread_id),
            'status': 'processing'
        })
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_thread_messages(request, thread_id):

    from .models import Thread, Message

    try:
        thread = Thread.objects.get(id=thread_id, user=request.user)
        messages = Message.objects.filter(thread=thread).order_by('timestamp')

        messages_data = [{
            'id': str(msg.id),
            'type': msg.message_type,
            'content': msg.content,
            'sender': msg.sender_agent.name if msg.sender_agent else 'user',
            'timestamp': msg.timestamp.isoformat(),
            'metadata': msg.metadata
        } for msg in messages]

        return Response({
            'thread_id': str(thread.id),
            'status': thread.status,
            'messages': messages_data
        })
    except Thread.DoesNotExist:
        return Response(
            {'error': 'Thread not found'},
            status=status.HTTP_404_NOT_FOUND
        )