"""
Django Models for Fruit Yield Estimator App

Implementation Phases:
1. Authentication (User, FarmProfile)
2. Orchards (Orchard)
3. Estimation History (EstimationRecord)
4. Tasks (Task, TaskRule)
5. Analytics (aggregated via queryset methods)
"""

from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
import json


PRIORITY_CHOICES = [
    ("low", "Low"),
    ("medium", "Medium"),
    ("high", "High"),
]


# ============================================================================
# PHASE 1: AUTHENTICATION & USER PROFILES
# ============================================================================

class User(AbstractUser):
    """
    Extended Django User model for farmer accounts.
    """
    FARMER = "farmer"
    AGRONOMIST = "agronomist"
    ADMIN = "admin"
    
    USER_ROLE_CHOICES = [
        (FARMER, "Farmer"),
        (AGRONOMIST, "Agronomist / Advisor"),
        (ADMIN, "Admin"),
    ]
    
    role = models.CharField(
        max_length=20,
        choices=USER_ROLE_CHOICES,
        default=FARMER,
        help_text="User role in the system"
    )
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["role", "created_at"]),
        ]

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.role})"


class FarmProfile(models.Model):
    """
    Link user to farm details. One-to-one relationship.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="farm_profile")
    
    farm_name = models.CharField(max_length=255, blank=True)
    region = models.CharField(max_length=100, blank=True, null=True)
    total_area_hectares = models.FloatField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0.1)]
    )
    
    # Contact & location
    address = models.TextField(blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    
    # Preferences
    preferred_unit = models.CharField(
        max_length=10,
        choices=[("kg", "Kilogram"), ("tonnes", "Tonnes")],
        default="kg"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name_plural = "Farm Profiles"
    
    def __str__(self):
        return f"Farm: {self.farm_name or self.user.username}"


# ============================================================================
# PHASE 2: ORCHARDS
# ============================================================================

class Orchard(models.Model):
    """
    Individual orchard under a farm.
    Stores metadata needed for yield estimation.
    """
    VARIETY_CHOICES = [
        ("gala", "Gala"),
        ("fuji", "Fuji"),
        ("granny_smith", "Granny Smith"),
        ("honeycrisp", "Honeycrisp"),
        ("pink_lady", "Pink Lady"),
        ("other", "Other"),
    ]
    
    DENSITY_CHOICES = [
        ("dwarf", "Dwarf (>400 trees/ha)"),
        ("semi_dwarf", "Semi-dwarf (200-400 trees/ha)"),
        ("standard", "Standard (50-200 trees/ha)"),
    ]
    
    MATURITY_CHOICES = [
        ("young", "Young (1-3 years)"),
        ("mature", "Mature (4-15 years)"),
        ("old", "Old (>15 years)"),
    ]
    
    farm_profile = models.ForeignKey(
        FarmProfile,
        on_delete=models.CASCADE,
        related_name="orchards"
    )
    
    # Basic info
    name = models.CharField(max_length=255)
    variety = models.CharField(max_length=50, choices=VARIETY_CHOICES)
    
    # Physical specs
    area_hectares = models.FloatField(validators=[MinValueValidator(0.01)])
    total_trees = models.IntegerField(validators=[MinValueValidator(1)])
    planting_density = models.CharField(max_length=20, choices=DENSITY_CHOICES)
    tree_maturity = models.CharField(max_length=20, choices=MATURITY_CHOICES)
    
    # Location within farm
    section = models.CharField(max_length=100, blank=True, help_text="e.g., 'North Block A'")
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["farm_profile", "variety"]),
            models.Index(fields=["created_at"]),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.variety}) - {self.area_hectares}ha"
    
    @property
    def trees_per_hectare(self):
        """Derived metric: trees per hectare."""
        return self.total_trees / self.area_hectares if self.area_hectares > 0 else 0


# ============================================================================
# PHASE 3: ESTIMATION HISTORY
# ============================================================================

class EstimationRecord(models.Model):
    """
    One estimation run (single API call to /api/predict/yield/).
    Stores full response + summary metrics.
    """
    orchard = models.ForeignKey(
        Orchard,
        on_delete=models.CASCADE,
        related_name="estimations"
    )
    
    # Estimation metadata
    num_images = models.IntegerField(validators=[MinValueValidator(1)])
    estimation_date = models.DateTimeField(default=timezone.now)
    
    # Fruit detection summary
    raw_fruit_count = models.IntegerField(validators=[MinValueValidator(0)])
    adjusted_fruit_count = models.IntegerField(validators=[MinValueValidator(0)])
    overlap_ratio = models.FloatField(
        validators=[MinValueValidator(0), MaxValueValidator(1)],
        help_text="Front/back overlap estimate [0.0-1.0]"
    )
    
    # Ripeness breakdown (percentages) - summary
    ripe_percentage = models.FloatField(
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Percentage of fruits in ripe class"
    )
    midripe_percentage = models.FloatField(
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Percentage in midripe class"
    )
    unripe_percentage = models.FloatField(
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Percentage in unripe class"
    )
    
    # Canopy metrics
    canopy_density_score = models.FloatField(
        validators=[MinValueValidator(0), MaxValueValidator(1)],
        help_text="Leaf coverage density [0.0-1.0]"
    )
    canopy_completeness_score = models.FloatField(
        validators=[MinValueValidator(0), MaxValueValidator(1)],
        help_text="Canopy structure completeness [0.0-1.0]"
    )
    
    # Vegetation vigor (VVI)
    rgb_vvi_score = models.FloatField(
        validators=[MinValueValidator(0), MaxValueValidator(1)],
        help_text="Normalized RGB-VVI index [0.0-1.0]"
    )
    vvi_reliability = models.FloatField(
        validators=[MinValueValidator(0), MaxValueValidator(1)],
        help_text="Confidence in VVI signal [0.0-1.0]"
    )
    
    # Yield estimates
    orchard_yield_kg = models.FloatField(
        validators=[MinValueValidator(0)],
        help_text="Predicted yield in kilograms"
    )
    orchard_yield_tonnes = models.FloatField(
        validators=[MinValueValidator(0)],
        help_text="Predicted yield in tonnes"
    )
    
    yield_uncertainty_kg = models.FloatField(
        validators=[MinValueValidator(0)],
        help_text="Uncertainty band in kg (std dev)"
    )
    
    # Full response payload (for audit trail & debugging)
    full_response_json = models.JSONField(
        default=dict,
        help_text="Complete API response as JSON"
    )
    
    # Metadata
    notes = models.TextField(blank=True, help_text="User notes on this estimation")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ["-estimation_date"]
        indexes = [
            models.Index(fields=["orchard", "estimation_date"]),
            models.Index(fields=["estimation_date"]),
        ]
        verbose_name_plural = "Estimation Records"
    
    def __str__(self):
        return f"Est {self.orchard.name} on {self.estimation_date.date()}: {self.orchard_yield_kg:.1f}kg"
    
    def to_dict(self):
        """Export as dict for API responses."""
        return {
            "id": self.id,
            "orchard_id": self.orchard.id,
            "orchard_name": self.orchard.name,
            "estimation_date": self.estimation_date.isoformat(),
            "fruit_count": self.adjusted_fruit_count,
            "ripe_pct": self.ripe_percentage,
            "yield_kg": self.orchard_yield_kg,
            "yield_tonnes": self.orchard_yield_tonnes,
            "yield_uncertainty_kg": self.yield_uncertainty_kg,
            "vvi_score": self.rgb_vvi_score,
            "canopy_score": self.canopy_completeness_score,
        }


# ============================================================================
# PHASE 4: TASK MANAGEMENT
# ============================================================================

class TaskRule(models.Model):
    """
    Auto-generation rules for tasks.
    Define thresholds that trigger task creation.
    
    Example:
    - If ripeness >= 70%, create "Harvest" task
    - If canopy_completeness < 0.65, create "Prune" task
    """
    TRIGGER_CHOICES = [
        ("ripeness_high", "High Ripeness (ready to harvest)"),
        ("ripeness_low", "Low Ripeness (check health)"),
        ("canopy_weak", "Weak Canopy (pruning recommended)"),
        ("vvi_low", "Low Vigor (nutrition check)"),
        ("routine", "Routine Maintenance"),
    ]
    
    farm_profile = models.ForeignKey(
        FarmProfile,
        on_delete=models.CASCADE,
        related_name="task_rules"
    )
    
    name = models.CharField(max_length=255)
    trigger_type = models.CharField(max_length=50, choices=TRIGGER_CHOICES)
    
    # Thresholds
    ripeness_threshold = models.FloatField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Trigger if ripeness % >= this value"
    )
    canopy_completeness_threshold = models.FloatField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(1)],
        help_text="Trigger if canopy_completeness < this value"
    )
    vvi_threshold = models.FloatField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(1)],
        help_text="Trigger if vvi < this value"
    )
    
    # Task template
    task_title = models.CharField(max_length=255)
    task_description = models.TextField()
    priority = models.CharField(
        max_length=10,
        choices=PRIORITY_CHOICES,
        default="medium"
    )
    
    # Auto-generation control
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ["priority", "-created_at"]
    
    def __str__(self):
        return f"{self.name} ({self.trigger_type})"


class Task(models.Model):
    """
    Individual task for user (orchard-level actions).
    Auto-created by TaskRule matching, or manually created.
    """
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("in_progress", "In Progress"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ]
    
    farm_profile = models.ForeignKey(
        FarmProfile,
        on_delete=models.CASCADE,
        related_name="tasks"
    )
    orchard = models.ForeignKey(
        Orchard,
        on_delete=models.CASCADE,
        related_name="tasks",
        null=True,
        blank=True
    )
    
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    priority = models.CharField(
        max_length=10,
        choices=PRIORITY_CHOICES,
        default="medium"
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending"
    )
    
    # Trigger info
    triggered_by_rule = models.ForeignKey(
        TaskRule,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_tasks",
        help_text="Rule that auto-generated this task"
    )
    triggered_by_estimation = models.ForeignKey(
        EstimationRecord,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_tasks",
        help_text="Estimation that triggered this task"
    )
    
    # Dates
    created_at = models.DateTimeField(auto_now_add=True)
    due_date = models.DateField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["farm_profile", "status"]),
            models.Index(fields=["orchard", "status"]),
            models.Index(fields=["due_date"]),
        ]
    
    def __str__(self):
        return f"[{self.status.upper()}] {self.title}"


# ============================================================================
# QUERYSET SHORTCUTS (for dashboard analytics)
# ============================================================================

class EstimationQuerySet(models.QuerySet):
    """Helper methods for common dashboard queries."""
    
    def last_7_days(self):
        """Filter to estimations in last 7 days."""
        from datetime import timedelta
        cutoff = timezone.now() - timedelta(days=7)
        return self.filter(estimation_date__gte=cutoff)
    
    def last_30_days(self):
        """Filter to estimations in last 30 days."""
        from datetime import timedelta
        cutoff = timezone.now() - timedelta(days=30)
        return self.filter(estimation_date__gte=cutoff)
    
    def by_variety(self):
        """Group by orchard variety."""
        return self.values("orchard__variety").annotate(
            count=models.Count("id"),
            avg_yield_kg=models.Avg("orchard_yield_kg"),
            max_yield_kg=models.Max("orchard_yield_kg"),
        )


class EstimationRecordManager(models.Manager):
    """Custom manager for EstimationRecord."""
    
    def get_queryset(self):
        return EstimationQuerySet(self.model, using=self._db)
    
    def last_7_days(self):
        return self.get_queryset().last_7_days()
    
    def last_30_days(self):
        return self.get_queryset().last_30_days()


EstimationRecord.add_to_class("objects", EstimationRecordManager())
