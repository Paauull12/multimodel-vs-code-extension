from celery import Celery
from .model_manager import ModelManager

app = Celery('ml_tasks', broker='redis://localhost:6379', backend='redis://localhost:6379')

app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
)

manager = ModelManager()

@app.task(name='load_model')
def load_model(model_id):
    try:
        manager.load_model(model_id)
        return {'status': 'success', 'message': f'Model {model_id} loaded'}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}

@app.task(name='predict')
def predict(model_id, text):
    try:
        result = manager.predict(model_id, text)
        return {'status': 'success', 'result': result}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}

@app.task(name='preload_models')
def preload_models():
    results = {}
    for model_id in manager.config.get('models', {}).keys():
        try:
            manager.load_model(model_id)
            results[model_id] = 'loaded'
        except Exception as e:
            results[model_id] = f'failed: {str(e)}'
    return results