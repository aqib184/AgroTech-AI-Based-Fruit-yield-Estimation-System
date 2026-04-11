"""
Django REST Framework Serializers for Fruit Yield Estimator

Follows Phase 1-5 implementation order.
"""

from rest_framework import serializers
from django.contrib.auth import authenticate
from django.utils import timezone
from api.models import (
    User, FarmProfile, Orchard, EstimationRecord,
    TaskRule, Task
)


# ============================================================================
# PHASE 1: USER & AUTH SERIALIZERS
# ============================================================================

class UserSerializer(serializers.ModelSerializer):
    """User model serializer for registration and profile updates."""
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'phone_number', 'role']
        read_only_fields = ['id']
    
    def create(self, validated_data):
        """Create user with hashed password."""
        user = User.objects.create_user(**validated_data)
        return user


class RegisterSerializer(serializers.ModelSerializer):
    """User registration serializer with password field."""
    
    password = serializers.CharField(write_only=True, min_length=8)
    password2 = serializers.CharField(write_only=True, min_length=8)
    
    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password2', 'first_name', 'last_name']
    
    def validate(self, data):
        """Validate that passwords match."""
        if data['password'] != data.pop('password2'):
            raise serializers.ValidationError({"password": "Passwords do not match."})
        return data
    
    def create(self, validated_data):
        """Create new user."""
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email'),
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )
        # Auto-create FarmProfile
        FarmProfile.objects.create(user=user)
        return user


class FarmProfileSerializer(serializers.ModelSerializer):
    """Farm profile details."""
    
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    
    class Meta:
        model = FarmProfile
        fields = [
            'id', 'user_name', 'email', 'farm_name', 'region', 'total_area_hectares',
            'address', 'latitude', 'longitude', 'preferred_unit',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


# ============================================================================
# PHASE 2: ORCHARD SERIALIZERS
# ============================================================================

class OrchardListSerializer(serializers.ModelSerializer):
    """Lightweight orchard serializer for list views."""
    
    last_estimation_date = serializers.SerializerMethodField()
    last_estimation_yield_kg = serializers.SerializerMethodField()
    estimations_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Orchard
        fields = [
            'id', 'name', 'variety', 'area_hectares', 'total_trees',
            'trees_per_hectare', 'last_estimation_date', 'last_estimation_yield_kg',
            'estimations_count', 'created_at'
        ]
    
    def get_last_estimation_date(self, obj):
        """Get most recent estimation date."""
        latest = obj.estimations.order_by('-estimation_date').first()
        return latest.estimation_date if latest else None
    
    def get_last_estimation_yield_kg(self, obj):
        """Get yield from most recent estimation."""
        latest = obj.estimations.order_by('-estimation_date').first()
        return latest.orchard_yield_kg if latest else None
    
    def get_estimations_count(self, obj):
        """Count total estimations for this orchard."""
        return obj.estimations.count()


class OrchardDetailSerializer(serializers.ModelSerializer):
    """Full orchard details including recent estimations."""
    
    estimation_count = serializers.SerializerMethodField()
    avg_yield_kg = serializers.SerializerMethodField()
    latest_estimation = serializers.SerializerMethodField()
    
    class Meta:
        model = Orchard
        fields = [
            'id', 'name', 'variety', 'area_hectares', 'total_trees',
            'planting_density', 'tree_maturity', 'section', 'trees_per_hectare',
            'estimation_count', 'avg_yield_kg', 'latest_estimation',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_estimation_count(self, obj):
        """Count estimations."""
        return obj.estimations.count()
    
    def get_avg_yield_kg(self, obj):
        """Calculate average yield."""
        from django.db.models import Avg
        result = obj.estimations.aggregate(avg=Avg('orchard_yield_kg'))
        return round(result['avg'], 1) if result['avg'] else None
    
    def get_latest_estimation(self, obj):
        """Return summary of most recent estimation."""
        latest = obj.estimations.order_by('-estimation_date').first()
        if not latest:
            return None
        return {
            'id': latest.id,
            'estimation_date': latest.estimation_date,
            'orchard_yield_kg': latest.orchard_yield_kg,
            'ripe_percentage': latest.ripe_percentage,
            'canopy_score': latest.canopy_completeness_score,
        }


# ============================================================================
# PHASE 3: ESTIMATION HISTORY SERIALIZERS
# ============================================================================

class EstimationListSerializer(serializers.ModelSerializer):
    """Lightweight estimation serializer for list/dashboard views."""
    
    orchard_name = serializers.CharField(source='orchard.name', read_only=True)
    
    class Meta:
        model = EstimationRecord
        fields = [
            'id', 'orchard_id', 'orchard_name', 'estimation_date',
            'num_images', 'adjusted_fruit_count', 'ripe_percentage',
            'canopy_completeness_score', 'rgb_vvi_score',
            'orchard_yield_kg', 'orchard_yield_tonnes', 'yield_uncertainty_kg'
        ]
        read_only_fields = [
            'id', 'estimation_date', 'adjusted_fruit_count', 'ripe_percentage',
            'canopy_completeness_score', 'rgb_vvi_score', 'orchard_yield_kg',
            'orchard_yield_tonnes', 'yield_uncertainty_kg'
        ]


class EstimationDetailSerializer(serializers.ModelSerializer):
    """Full estimation details with all factors and components."""
    
    orchard = OrchardListSerializer(read_only=True)
    ripeness = serializers.SerializerMethodField()
    canopy = serializers.SerializerMethodField()
    vegetation_vigor = serializers.SerializerMethodField()
    yield_estimate = serializers.SerializerMethodField()
    
    class Meta:
        model = EstimationRecord
        fields = [
            'id', 'orchard', 'estimation_date', 'num_images',
            'raw_fruit_count', 'adjusted_fruit_count', 'overlap_ratio',
            'ripeness', 'canopy', 'vegetation_vigor', 'yield_estimate',
            'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'estimation_date', 'raw_fruit_count', 'adjusted_fruit_count',
            'overlap_ratio', 'ripeness', 'canopy', 'vegetation_vigor',
            'yield_estimate', 'created_at', 'updated_at'
        ]
    
    def get_ripeness(self, obj):
        """Extract ripeness data."""
        data = {}
        if obj.full_response_json and 'ripeness_distribution' in obj.full_response_json:
            data.update(obj.full_response_json['ripeness_distribution'])
        return {
            'ripe_pct': obj.ripe_percentage,
            'midripe_pct': obj.midripe_percentage,
            'unripe_pct': obj.unripe_percentage,
            'flower_filtered': data.get('flower_filtered', 0),
        }
    
    def get_canopy(self, obj):
        """Extract canopy metrics."""
        data = {}
        if obj.full_response_json and 'leaf_area' in obj.full_response_json:
            data = obj.full_response_json['leaf_area']
        return {
            'canopy_density': obj.canopy_density_score,
            'canopy_completeness': obj.canopy_completeness_score,
            'canopy_coverage_bbox': data.get('bbox_coverage_ratio', None),
        }
    
    def get_vegetation_vigor(self, obj):
        """Extract VVI data."""
        data = {}
        if obj.full_response_json and 'vegetation_vigor' in obj.full_response_json:
            data = obj.full_response_json['vegetation_vigor']
        return {
            'rgb_vvi_score': obj.rgb_vvi_score,
            'vvi_reliability': obj.vvi_reliability,
            'vvi_components': {
                'vari': data.get('vari', None),
                'exg': data.get('exg', None),
                'ngrdi': data.get('ngrdi', None),
            }
        }
    
    def get_yield_estimate(self, obj):
        """Extract yield calculation details."""
        data = {}
        if obj.full_response_json and 'yield_estimate' in obj.full_response_json:
            data = obj.full_response_json['yield_estimate']
        return {
            'orchard_yield_kg': obj.orchard_yield_kg,
            'orchard_yield_tonnes': obj.orchard_yield_tonnes,
            'yield_uncertainty_kg': obj.yield_uncertainty_kg,
            'uncertainty_pct': round(100 * obj.yield_uncertainty_kg / obj.orchard_yield_kg, 1) if obj.orchard_yield_kg > 0 else None,
            'factors': data.get('factors', {}),
        }


# ============================================================================
# PHASE 4: TASK SERIALIZERS
# ============================================================================

class TaskRuleSerializer(serializers.ModelSerializer):
    """Task rule for auto-generation."""
    
    class Meta:
        model = TaskRule
        fields = [
            'id', 'name', 'trigger_type', 'ripeness_threshold',
            'canopy_completeness_threshold', 'vvi_threshold',
            'task_title', 'task_description', 'priority', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class TaskListSerializer(serializers.ModelSerializer):
    """Lightweight task serializer for list views."""
    
    orchard_name = serializers.CharField(source='orchard.name', read_only=True, allow_null=True)
    triggered_by_rule_name = serializers.CharField(
        source='triggered_by_rule.name',
        read_only=True,
        allow_null=True
    )
    
    class Meta:
        model = Task
        fields = [
            'id', 'orchard_id', 'orchard_name', 'title', 'priority',
            'status', 'due_date', 'triggered_by_rule_id', 'triggered_by_rule_name',
            'triggered_by_estimation_id', 'created_at'
        ]
        read_only_fields = [
            'id', 'triggered_by_rule_id', 'triggered_by_estimation_id',
            'created_at'
        ]


class TaskDetailSerializer(serializers.ModelSerializer):
    """Full task details."""
    
    class Meta:
        model = Task
        fields = [
            'id', 'farm_profile', 'orchard_id', 'title', 'description',
            'priority', 'status', 'triggered_by_rule_id', 'triggered_by_estimation_id',
            'due_date', 'created_at', 'completed_at'
        ]
        read_only_fields = [
            'id', 'farm_profile', 'triggered_by_rule_id', 'triggered_by_estimation_id',
            'created_at'
        ]
    
    def validate_priority(self, value):
        """Validate priority field."""
        if value not in ['low', 'medium', 'high']:
            raise serializers.ValidationError("Invalid priority.")
        return value


class TaskUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating task status only."""
    
    class Meta:
        model = Task
        fields = ['status']
    
    def validate_status(self, value):
        """Validate status transitions."""
        instance = self.instance
        current_status = instance.status if instance else 'pending'
        
        valid_transitions = {
            'pending': ['in_progress', 'completed', 'cancelled'],
            'in_progress': ['completed', 'cancelled'],
            'completed': [],
            'cancelled': [],
        }
        
        if value not in valid_transitions.get(current_status, []):
            raise serializers.ValidationError(
                f"Cannot transition from {current_status} to {value}"
            )
        
        return value
    
    def update(self, instance, validated_data):
        """Update status and set completed_at if needed."""
        if validated_data.get('status') == 'completed':
            validated_data['completed_at'] = timezone.now()
        return super().update(instance, validated_data)


# ============================================================================
# ANALYTICS SERIALIZERS (PHASE 5)
# ============================================================================

class DashboardSummarySerializer(serializers.Serializer):
    """Dashboard summary statistics."""
    
    period = serializers.CharField()
    total_estimations = serializers.IntegerField()
    total_estimations_kg = serializers.FloatField()
    avg_yield_per_estimation_kg = serializers.FloatField()
    orchards_with_estimations = serializers.IntegerField()
    ripe_average_pct = serializers.FloatField()
    
    class Meta:
        fields = [
            'period', 'total_estimations', 'total_estimations_kg',
            'avg_yield_per_estimation_kg', 'orchards_with_estimations',
            'ripe_average_pct'
        ]


class TimeSeriesPointSerializer(serializers.Serializer):
    """Time series data point."""
    
    date = serializers.DateField()
    estimations = serializers.IntegerField()
    total_yield_kg = serializers.FloatField()
    avg_ripe_pct = serializers.FloatField()


class VarietyBreakdownSerializer(serializers.Serializer):
    """Yield breakdown by variety."""
    
    variety = serializers.CharField()
    estimations = serializers.IntegerField()
    avg_yield_kg = serializers.FloatField()
    max_yield_kg = serializers.FloatField()


class TaskSummarySerializer(serializers.Serializer):
    """Task status summary."""
    
    pending = serializers.IntegerField()
    in_progress = serializers.IntegerField()
    completed = serializers.IntegerField()
    overdue = serializers.IntegerField()


class DashboardSerializer(serializers.Serializer):
    """Full dashboard response."""
    
    period = serializers.CharField()
    summary = DashboardSummarySerializer()
    time_series = TimeSeriesPointSerializer(many=True)
    by_variety = VarietyBreakdownSerializer(many=True)
    task_summary = TaskSummarySerializer()


class OrchardAnalyticsSerializer(serializers.Serializer):
    """Detailed analytics for a single orchard."""
    
    orchard_id = serializers.IntegerField()
    orchard_name = serializers.CharField()
    variety = serializers.CharField()
    period = serializers.CharField()
    summary = serializers.DictField()
    estimations_trend = serializers.ListField()
    yield_factors_avg = serializers.DictField()


# ============================================================================
# PREDICTION REQUEST SERIALIZER (Keep existing for /predict/yield/)
# ============================================================================

class YieldEstimateSerializer(serializers.Serializer):
    """Validate POST request data for yield estimation."""
    
    variety = serializers.ChoiceField(
        choices=["golden_delicious", "fuji", "gala", "granny_smith", "honeycrisp", "other"],
        required=True
    )
    orchard_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    tree_maturity = serializers.ChoiceField(
        choices=["young", "mature", "old"],
        required=True
    )
    planting_density = serializers.ChoiceField(
        choices=["traditional", "semi_dwarf", "high_density"],
        required=True
    )
    
    total_trees = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    orchard_area = serializers.FloatField(required=False, allow_null=True, min_value=0.1)
    area_unit = serializers.ChoiceField(
        choices=["acres", "hectares"],
        required=False,
        default="acres"
    )

    def validate(self, data):
        """Ensure either total_trees OR (orchard_area + planting_density) is provided."""
        total_trees = data.get('total_trees')
        orchard_area = data.get('orchard_area')
        planting_density = data.get('planting_density')

        # If total_trees is provided, use it
        if total_trees:
            return data

        # Otherwise, require both orchard_area and planting_density
        if not orchard_area or not planting_density:
            raise serializers.ValidationError(
                "Either total_trees OR (orchard_area + planting_density) must be provided."
            )
        
        return data