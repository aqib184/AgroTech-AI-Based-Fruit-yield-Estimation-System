from django.urls import path
from .views import YieldEstimateView, HealthCheckView

urlpatterns = [
    path('health/', HealthCheckView.as_view(), name='health-check'),
    path('predict/yield/', YieldEstimateView.as_view(), name='yield-predict'),
    path('debug/', DebugView.as_view(), name='debug'),
]