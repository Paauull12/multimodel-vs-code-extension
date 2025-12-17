from django.urls import path
from . import views
from . import api_view
from django.contrib.auth.views import LogoutView

urlpatterns = [
    path('', views.dashboard, name='dashboard'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('upload/', views.upload_document, name='upload_document'),
    path('delete/<int:doc_id>/', views.delete_document, name='delete_document'),
    path('search/', views.search_documents, name='search_documents'),
    path('api/search/', api_view.SearchDocumentsAPI.as_view(), name='api_search_documents'),
]