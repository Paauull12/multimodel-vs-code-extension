import numpy as np
import pickle
from django.db import models
from django.contrib.auth.models import User


class Company(models.Model):
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    company = models.ForeignKey(Company, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} -> {self.company}"


class Document(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='documents')
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    name = models.CharField(max_length=255)
    file = models.FileField(upload_to='documents/')

    embedding = models.BinaryField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def set_embedding(self, vector):
        vector = np.array(vector, dtype=np.float32)
        self.embedding = pickle.dumps(vector)

    def get_embedding(self):
        print(self.embedding)
        if self.embedding:
            return pickle.loads(self.embedding)
        return None

    def __str__(self):
        return self.name