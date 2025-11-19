import yaml
from transformers import pipeline
import threading


class ModelManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, 'initialized'):
            self.models = {}
            self.config = {}
            self.initialized = True
            self.load_config()

    def load_config(self, config_path='model_config.yml'):
        with open(config_path, 'r') as f:
            self.config = yaml.safe_load(f)

    def load_model(self, model_id):
        if model_id in self.models:
            return self.models[model_id]

        if model_id not in self.config['models']:
            raise ValueError(f"Model {model_id} not in config")

        model_config = self.config['models'][model_id]

        if model_config['type'] == 'huggingface':
            model = pipeline(
                task=model_config['task'],
                model=model_config['name'],
                device=0 if model_config['device'] == 'cuda' else -1
            )
            self.models[model_id] = model
            return model

        # TODO: Add local model loading
        raise NotImplementedError(f"Type {model_config['type']} not implemented")

    def predict(self, model_id, text):
        model = self.load_model(model_id)
        result = model(text)
        return result