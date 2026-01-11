from django.urls import path
from .views import check_company_rules_auto, check_compliance

urlpatterns = [
    path('check-compliance/', check_compliance, name="check_compliance"),
    path('check-company-compliance/', check_company_rules_auto, name="check_company_compliance"),
]
