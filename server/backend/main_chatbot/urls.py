# urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('chat/send/', views.send_message, name='send_message'),
    path('chat/poll/<uuid:thread_id>/', views.poll_thread, name='poll_thread'),
    path('chat/upload/<uuid:thread_id>/', views.upload_files, name='upload_files'),
    path('chat/messages/<uuid:thread_id>/', views.get_thread_messages, name='get_messages'),
]