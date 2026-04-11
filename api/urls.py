from django.urls import path

from .views import YieldEstimateView, HealthCheckView, VisualizerPageView
from .viewsets import (
    UserViewSet,
    OrchardViewSet,
    EstimationRecordViewSet,
    TaskRuleViewSet,
    TaskViewSet,
    DashboardViewSet,
    OrchardAnalyticsViewSet,
)

urlpatterns = [
    path('health/', HealthCheckView.as_view(), name='health-check'),
    path('predict/yield/', YieldEstimateView.as_view(), name='yield-predict'),
    path('visualizer/', VisualizerPageView, name='visualizer'),

    path('users/register/', UserViewSet.as_view({'post': 'register'}), name='user-register'),
    path('users/profile/', UserViewSet.as_view({'get': 'profile', 'patch': 'update_profile'}), name='user-profile'),

    path('orchards/', OrchardViewSet.as_view({'get': 'list', 'post': 'create'}), name='orchard-list'),
    path('orchards/<int:pk>/', OrchardViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}), name='orchard-detail'),

    path('estimations/', EstimationRecordViewSet.as_view({'get': 'list'}), name='estimation-list'),
    path('estimations/<int:pk>/', EstimationRecordViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}), name='estimation-detail'),

    path('task-rules/', TaskRuleViewSet.as_view({'get': 'list', 'post': 'create'}), name='taskrule-list'),
    path('task-rules/<int:pk>/', TaskRuleViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}), name='taskrule-detail'),

    path('tasks/', TaskViewSet.as_view({'get': 'list', 'post': 'create'}), name='task-list'),
    path('tasks/summary/', TaskViewSet.as_view({'get': 'summary'}), name='task-summary'),
    path('tasks/<int:pk>/', TaskViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}), name='task-detail'),

    path('analytics/dashboard/', DashboardViewSet.as_view({'get': 'dashboard'}), name='dashboard'),
    path('analytics/orchard/<int:pk>/', OrchardAnalyticsViewSet.as_view({'get': 'orchard_analytics'}), name='orchard-analytics'),
]