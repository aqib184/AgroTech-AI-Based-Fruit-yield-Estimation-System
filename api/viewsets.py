"""
Django REST Framework ViewSets for Fruit Yield Estimator

Follows Phase 1-5 implementation order.
Build these progressively, one phase at a time.
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Avg, Count, Max, Min, Q, Sum
from datetime import timedelta
from django.utils import timezone

from api.models import (
    User, FarmProfile, Orchard, EstimationRecord,
    TaskRule, Task
)
from api.serializers import (
    UserSerializer, RegisterSerializer, FarmProfileSerializer,
    OrchardListSerializer, OrchardDetailSerializer,
    EstimationListSerializer, EstimationDetailSerializer,
    TaskRuleSerializer, TaskListSerializer, TaskDetailSerializer, TaskUpdateSerializer,
    DashboardSerializer, OrchardAnalyticsSerializer
)


# ============================================================================
# PHASE 1: USER & AUTH VIEWSETS (optional - can use SimpleJWT defaults)
# ============================================================================

class UserViewSet(viewsets.ViewSet):
    """
    User registration and profile management.
    
    POST /api/users/register/ - Register new farmer
    GET /api/users/profile/ - Get current user profile
    PATCH /api/users/profile/ - Update profile
    """
    
    permission_classes = [AllowAny]
    
    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def register(self, request):
        """
        Register new farmer account.
        
        Request: {username, email, password, password2, first_name, last_name}
        Response: {id, username, email, first_name, last_name}
        """
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def profile(self, request):
        """Get current user's farm profile."""
        try:
            farm_profile = request.user.farm_profile
            serializer = FarmProfileSerializer(farm_profile)
            return Response(serializer.data)
        except FarmProfile.DoesNotExist:
            return Response(
                {"detail": "Farm profile not found"},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=False, methods=['patch'], permission_classes=[IsAuthenticated])
    def update_profile(self, request):
        """Update user farm profile."""
        try:
            farm_profile = request.user.farm_profile
            serializer = FarmProfileSerializer(farm_profile, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except FarmProfile.DoesNotExist:
            return Response(
                {"detail": "Farm profile not found"},
                status=status.HTTP_404_NOT_FOUND
            )


# ============================================================================
# PHASE 2: ORCHARD VIEWSET
# ============================================================================

class OrchardViewSet(viewsets.ModelViewSet):
    """
    Manage orchards under user's farm.
    
    GET /api/orchards/ - List all orchards
    POST /api/orchards/ - Create new orchard
    GET /api/orchards/{id}/ - Detail view
    PATCH /api/orchards/{id}/ - Partial update
    DELETE /api/orchards/{id}/ - Delete orchard
    """
    
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['variety', 'tree_maturity', 'planting_density']
    ordering_fields = ['created_at', 'name']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        """Use detail serializer for retrieve, list serializer otherwise."""
        if self.action == 'retrieve':
            return OrchardDetailSerializer
        return OrchardListSerializer
    
    def get_queryset(self):
        """Filter to user's orchards."""
        return Orchard.objects.filter(farm_profile=self.request.user.farm_profile)
    
    def perform_create(self, serializer):
        """Auto-assign farm_profile on create."""
        serializer.save(farm_profile=self.request.user.farm_profile)
    
    @action(detail=True, methods=['get'])
    def estimations_summary(self, request, pk=None):
        """Get summary stats for this orchard's estimations."""
        orchard = self.get_object()
        estimations = orchard.estimations.all()
        
        return Response({
            'orchard_id': orchard.id,
            'orchard_name': orchard.name,
            'total_estimations': estimations.count(),
            'avg_yield_kg': estimations.aggregate(avg=Avg('orchard_yield_kg'))['avg'],
            'latest_estimation': {
                'date': estimations.latest('estimation_date').estimation_date if estimations.exists() else None,
                'yield_kg': estimations.latest('estimation_date').orchard_yield_kg if estimations.exists() else None,
            }
        })


# ============================================================================
# PHASE 3: ESTIMATION RECORD VIEWSET
# ============================================================================

class EstimationRecordViewSet(viewsets.ModelViewSet):
    """
    Estimation history and analytics.
    
    GET /api/estimations/ - List all estimations (filtered by user)
    GET /api/estimations/{id}/ - Full details
    PATCH /api/estimations/{id}/ - Update notes only
    DELETE /api/estimations/{id}/ - Delete (cascades to tasks)
    
    Query Params:
    - ?orchard_id=1
    - ?days=7 or ?days=30
    - ?ordering=-estimation_date
    """
    
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['orchard_id']
    ordering_fields = ['estimation_date', 'orchard_yield_kg']
    ordering = ['-estimation_date']
    http_method_names = ['get', 'patch', 'delete', 'head', 'options']
    
    def get_serializer_class(self):
        """Use detail serializer for retrieve."""
        if self.action == 'retrieve':
            return EstimationDetailSerializer
        return EstimationListSerializer
    
    def get_queryset(self):
        """Filter to user's orchards' estimations and apply time filters."""
        user_orchards = Orchard.objects.filter(farm_profile=self.request.user.farm_profile)
        queryset = EstimationRecord.objects.filter(orchard__in=user_orchards)
        
        # Optional time filtering
        days_param = self.request.query_params.get('days', None)
        if days_param:
            try:
                days = int(days_param)
                cutoff = timezone.now() - timedelta(days=days)
                queryset = queryset.filter(estimation_date__gte=cutoff)
            except (ValueError, TypeError):
                pass
        
        return queryset
    
    def perform_destroy(self, instance):
        """Delete estimation and cascade-delete generated tasks."""
        instance.generated_tasks.all().delete()
        instance.delete()
    
    @action(detail=True, methods=['patch'])
    def update_notes(self, request, pk=None):
        """Update notes field only."""
        estimation = self.get_object()
        estimation.notes = request.data.get('notes', estimation.notes)
        estimation.save()
        serializer = EstimationDetailSerializer(estimation)
        return Response(serializer.data)


# ============================================================================
# PHASE 4: TASK VIEWSETS
# ============================================================================

class TaskRuleViewSet(viewsets.ModelViewSet):
    """
    Task auto-generation rules.
    
    GET /api/task-rules/ - List rules
    POST /api/task-rules/ - Create rule
    PATCH /api/task-rules/{id}/ - Update rule
    DELETE /api/task-rules/{id}/ - Delete rule
    """
    
    permission_classes = [IsAuthenticated]
    serializer_class = TaskRuleSerializer
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Filter to user's rules."""
        return TaskRule.objects.filter(farm_profile=self.request.user.farm_profile)
    
    def perform_create(self, serializer):
        """Auto-assign farm_profile on create."""
        serializer.save(farm_profile=self.request.user.farm_profile)


class TaskViewSet(viewsets.ModelViewSet):
    """
    Task management for orchards.
    
    GET /api/tasks/ - List tasks (filtered by user)
    POST /api/tasks/ - Create task manually
    PATCH /api/tasks/{id}/ - Update task (status, etc.)
    DELETE /api/tasks/{id}/ - Delete task
    
    Query Params:
    - ?status=pending
    - ?priority=high
    - ?orchard_id=1
    - ?due_date_before=2026-04-20 (for overdue)
    - ?ordering=-created_at
    """
    
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status', 'priority', 'orchard_id']
    ordering_fields = ['created_at', 'due_date', 'priority']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        """Use update serializer for PATCH, detail otherwise."""
        if self.action in ['partial_update', 'update']:
            return TaskUpdateSerializer
        if self.action == 'retrieve':
            return TaskDetailSerializer
        return TaskListSerializer
    
    def get_queryset(self):
        """Filter to user's tasks."""
        user_orchards = Orchard.objects.filter(farm_profile=self.request.user.farm_profile)
        queryset = Task.objects.filter(
            Q(orchard__in=user_orchards) | Q(farm_profile=self.request.user.farm_profile)
        )
        
        # Handle overdue filter
        if self.request.query_params.get('due_date_before'):
            due_before = self.request.query_params.get('due_date_before')
            queryset = queryset.filter(due_date__lt=due_before, status__in=['pending', 'in_progress'])
        
        return queryset
    
    def perform_create(self, serializer):
        """Auto-assign farm_profile on create."""
        serializer.save(farm_profile=self.request.user.farm_profile)
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get task status summary."""
        tasks = self.get_queryset()
        today = timezone.now().date()
        return Response({
            'pending': tasks.filter(status='pending').count(),
            'in_progress': tasks.filter(status='in_progress').count(),
            'completed': tasks.filter(status='completed').count(),
            'overdue': tasks.filter(due_date__lt=today).filter(status__in=['pending', 'in_progress']).count(),
        })


# ============================================================================
# PHASE 5: ANALYTICS VIEWSETS
# ============================================================================

class DashboardViewSet(viewsets.ViewSet):
    """
    Dashboard analytics for user's farm.
    
    GET /api/analytics/dashboard/ - Overall stats
    GET /api/analytics/dashboard/?days=7 - Last 7 days
    GET /api/analytics/dashboard/?days=30 - Last 30 days
    """
    
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """Get dashboard summary and trends."""
        # Determine time window
        days_param = request.query_params.get('days', 30)
        try:
            days = int(days_param)
        except (ValueError, TypeError):
            days = 30
        
        cutoff = timezone.now() - timedelta(days=days)
        period = f"last_{days}_days"
        
        # Filter to user's data
        user_orchards = Orchard.objects.filter(farm_profile=request.user.farm_profile)
        estimations = EstimationRecord.objects.filter(
            orchard__in=user_orchards,
            estimation_date__gte=cutoff
        )
        tasks = Task.objects.filter(
            farm_profile=request.user.farm_profile,
            created_at__gte=cutoff
        )
        
        # Calculate summary
        total_estimations_kg = estimations.aggregate(
            total=Sum('orchard_yield_kg')
        )['total'] or 0
        
        avg_yield = estimations.aggregate(
            avg=Avg('orchard_yield_kg')
        )['avg'] or 0
        
        orchards_with_est = estimations.values('orchard_id').distinct().count()
        avg_ripeness = estimations.aggregate(
            avg=Avg('ripe_percentage')
        )['avg'] or 0
        
        # Build time series
        from django.db.models.functions import TruncDate
        time_series = (
            estimations
            .annotate(date=TruncDate('estimation_date'))
            .values('date')
            .annotate(
                estimations=Count('id'),
                total_yield_kg=Sum('orchard_yield_kg'),
                avg_ripe_pct=Avg('ripe_percentage'),
            )
            .order_by('date')
        )
        
        # Build variety breakdown
        by_variety = (
            estimations
            .values('orchard__variety')
            .annotate(
                estimations=Count('id'),
                avg_yield_kg=Avg('orchard_yield_kg'),
                max_yield_kg=Max('orchard_yield_kg'),
            )
            .order_by('orchard__variety')
        )
        
        # Task summary
        task_summary = {
            'pending': tasks.filter(status='pending').count(),
            'in_progress': tasks.filter(status='in_progress').count(),
            'completed': tasks.filter(status='completed').count(),
            'overdue': tasks.filter(due_date__lt=timezone.now()).filter(status__in=['pending', 'in_progress']).count(),
        }
        
        data = {
            'period': period,
            'summary': {
                'period': period,
                'total_estimations': estimations.count(),
                'total_estimations_kg': total_estimations_kg,
                'avg_yield_per_estimation_kg': avg_yield,
                'orchards_with_estimations': orchards_with_est,
                'ripe_average_pct': avg_ripeness,
            },
            'time_series': [
                {
                    'date': item['date'],
                    'estimations': item['estimations'],
                    'total_yield_kg': item['total_yield_kg'] or 0,
                    'avg_ripe_pct': item['avg_ripe_pct'] or 0,
                }
                for item in time_series
            ],
            'by_variety': [
                {
                    'variety': item['orchard__variety'],
                    'estimations': item['estimations'],
                    'avg_yield_kg': item['avg_yield_kg'] or 0,
                    'max_yield_kg': item['max_yield_kg'] or 0,
                }
                for item in by_variety
            ],
            'task_summary': task_summary,
        }
        
        return Response(data)


class OrchardAnalyticsViewSet(viewsets.ViewSet):
    """
    Detailed analytics for a specific orchard.
    
    GET /api/analytics/orchard/{orchard_id}/ - Detailed stats
    GET /api/analytics/orchard/{orchard_id}/?days=30 - Last 30 days
    """
    
    permission_classes = [IsAuthenticated]
    
    @action(detail=True, methods=['get'])
    def orchard_analytics(self, request, pk=None):
        """Get detailed analytics for single orchard."""
        # Get orchard (verify ownership)
        try:
            orchard = Orchard.objects.get(
                id=pk,
                farm_profile=request.user.farm_profile
            )
        except Orchard.DoesNotExist:
            return Response(
                {"detail": "Orchard not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Time window
        days_param = request.query_params.get('days', 30)
        try:
            days = int(days_param)
        except (ValueError, TypeError):
            days = 30
        
        cutoff = timezone.now() - timedelta(days=days)
        period = f"last_{days}_days"
        
        estimations = orchard.estimations.filter(estimation_date__gte=cutoff)
        
        # Summary
        summary = {
            'estimations': estimations.count(),
            'avg_yield_kg': estimations.aggregate(avg=Avg('orchard_yield_kg'))['avg'],
            'max_yield_kg': estimations.aggregate(max=Max('orchard_yield_kg'))['max'],
            'min_yield_kg': estimations.aggregate(Min('orchard_yield_kg'))['min'],
            'avg_ripeness_pct': estimations.aggregate(avg=Avg('ripe_percentage'))['avg'],
            'avg_canopy_score': estimations.aggregate(avg=Avg('canopy_completeness_score'))['avg'],
            'avg_vvi_score': estimations.aggregate(avg=Avg('rgb_vvi_score'))['avg'],
        }
        
        # Trend data
        estimations_trend = estimations.values(
            'estimation_date', 'adjusted_fruit_count',
            'orchard_yield_kg', 'ripe_percentage',
            'canopy_completeness_score'
        ).order_by('estimation_date')
        
        # Average factors
        factors = {}
        for est in estimations:
            if est.full_response_json and 'yield_estimate' in est.full_response_json:
                est_factors = est.full_response_json['yield_estimate'].get('factors', {})
                for key, val in est_factors.items():
                    factors[key] = factors.get(key, []) + [val]
        
        yield_factors_avg = {
            k: sum(v) / len(v) for k, v in factors.items()
        }
        
        data = {
            'orchard_id': orchard.id,
            'orchard_name': orchard.name,
            'variety': orchard.variety,
            'period': period,
            'summary': summary,
            'estimations_trend': [
                {
                    'date': item['estimation_date'].date() if hasattr(item['estimation_date'], 'date') else item['estimation_date'],
                    'fruit_count': item['adjusted_fruit_count'],
                    'yield_kg': item['orchard_yield_kg'],
                    'ripe_pct': item['ripe_percentage'],
                    'canopy_score': item['canopy_completeness_score'],
                }
                for item in estimations_trend
            ],
            'yield_factors_avg': yield_factors_avg,
        }
        
        return Response(data)
