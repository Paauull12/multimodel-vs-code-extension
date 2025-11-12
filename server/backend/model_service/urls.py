from django.urls import path
from . import views

urlpatterns = [
    path('api/ml/predict/', views.predict_view, name='predict'),
    path('api/ml/task/<str:task_id>/', views.task_status, name='task_status'),
    path('api/ml/load/', views.load_model_view, name='load_model'),
    path('api/ml/preload/', views.preload_all_models, name='preload_models'),
]