from django.contrib import admin

from doc_management.models import Document, Company, UserProfile

# Register your models here.
admin.site.register(Document)
admin.site.register(Company)
admin.site.register(UserProfile)