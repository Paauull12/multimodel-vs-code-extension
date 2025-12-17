from django.urls import path
from . import views

urlpatterns = [
    path('', views.review_index, name='review_index'),
    path('api/fetch/', views.fetch_pr_data, name='fetch_pr_data'),
    path('api/submit/', views.submit_review_to_github, name='submit_review'),
    path('api/analyze/', views.analyze_pr_code, name='analyze_pr_code'),
]