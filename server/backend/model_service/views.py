from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .celery_tasks import predict, load_model, preload_models


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def predict_view(request):
    model_id = request.data.get('model_id')
    text = request.data.get('text')

    if not model_id or not text:
        return Response(
            {'error': 'model_id and text required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    task = predict.delay(model_id, text)
    return Response({
        'task_id': task.id,
        'status': 'processing'
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def task_status(request, task_id):
    from celery.result import AsyncResult
    result = AsyncResult(task_id)

    if result.ready():
        return Response({
            'task_id': task_id,
            'status': 'completed',
            'result': result.get()
        })
    else:
        return Response({
            'task_id': task_id,
            'status': 'processing'
        })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def load_model_view(request):
    model_id = request.data.get('model_id')

    if not model_id:
        return Response(
            {'error': 'model_id required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    task = load_model.delay(model_id)
    return Response({
        'task_id': task.id,
        'message': f'Loading model {model_id}'
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def preload_all_models(request):
    task = preload_models.delay()
    return Response({
        'task_id': task.id,
        'message': 'Preloading all models'
    })