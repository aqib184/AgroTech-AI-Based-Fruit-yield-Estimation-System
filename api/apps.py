from django.apps import AppConfig

class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        import sys
        print("=== ApiConfig.ready() called ===", flush=True)
        sys.stdout.flush()
        from .views import load_models
        load_models()