from rest_framework import serializers
from .models import Document


class DocumentSerializer(serializers.ModelSerializer):
    uploaded_by = serializers.CharField(source='uploaded_by.username')

    class Meta:
        model = Document
        fields = ['id', 'name', 'uploaded_by', 'created_at', 'file']