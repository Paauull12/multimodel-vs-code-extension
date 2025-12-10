from django.urls import path
from .views import check_compliance

urlpatterns = [
    path('check-compliance/', check_compliance, name="check_compliance"),
]
