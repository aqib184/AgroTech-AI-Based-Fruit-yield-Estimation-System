# Fast Implementation Roadmap - Django Backend

## Overview
- **Models:** [api/models.py](api/models.py) ✅ Created
- **Contracts:** [api/API_CONTRACTS.md](api/API_CONTRACTS.md) ✅ Created
- **Serializers:** [api/serializers.py](api/serializers.py) ✅ Updated
- **ViewSets:** [api/viewsets.py](api/viewsets.py) ✅ Created

This roadmap follows a strict phase order to minimize rework and conflicts.

---

## PHASE 1: Authentication Setup (~2 hours)

**Goal:** Implement user registration and JWT token endpoints

### Step 1.1: Update settings
- [ ] Add to `backend/settings.py`:
  ```python
  INSTALLED_APPS = [
      ...
      'rest_framework',
      'rest_framework_simplejwt',
      'django_filters',
  ]
  
  REST_FRAMEWORK = {
      'DEFAULT_AUTHENTICATION_CLASSES': [
          'rest_framework_simplejwt.authentication.JWTAuthentication',
      ],
      'DEFAULT_PERMISSION_CLASSES': [
          'rest_framework.permissions.IsAuthenticated',
      ],
      'DEFAULT_FILTER_BACKENDS': [
          'django_filters.rest_framework.DjangoFilterBackend',
          'rest_framework.filters.OrderingFilter',
      ],
      'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
      'PAGE_SIZE': 20,
  }
  
  from datetime import timedelta
  SIMPLE_JWT = {
      'ACCESS_TOKEN_LIFETIME': timedelta(hours=24),
      'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
  }
  ```

### Step 1.2: Update requirements.txt
- [ ] Add:
  ```
  djangorestframework>=3.14.0
  djangorestframework-simplejwt>=5.0.0
  django-filter>=23.0
  ```

### Step 1.3: Install and run migration
- [ ] Run:
  ```bash
  pip install -r requirements.txt
  python manage.py makemigrations api
  python manage.py migrate
  ```

### Step 1.4: Update urls.py
- [ ] In `backend/urls.py`:
  ```python
  from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
  
  urlpatterns = [
      path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
      path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
      ...
  ]
  ```

### Step 1.5: Test JWT endpoints
- [ ] POST `/api/token/` with `{username, password}` → should return access/refresh tokens
- [ ] POST `/api/token/refresh/` with `{refresh}` → should return new access token

**Checkpoint:** Users can get JWT tokens and use them in Authorization headers

---

## PHASE 2: Orchard Management (~3 hours)

**Goal:** Full CRUD for orchards under user's farm

### Step 2.1: Register OrchardViewSet in urls.py
- [ ] Create `api/urls.py`:
  ```python
  from django.urls import path, include
  from rest_framework.routers import DefaultRouter
  from api.viewsets import OrchardViewSet
  
  router = DefaultRouter()
  router.register(r'orchards', OrchardViewSet, basename='orchard')
  
  urlpatterns = [
      path('api/', include(router.urls)),
  ]
  ```

- [ ] Include in `backend/urls.py`:
  ```python
  urlpatterns = [
      ...
      path('', include('api.urls')),
  ]
  ```

### Step 2.2: Test orchard endpoints
- [ ] GET `/api/orchards/` → empty list (no auth)
- [ ] POST `/api/token/` → get JWT token
- [ ] GET `/api/orchards/` with JWT → empty list
- [ ] POST `/api/orchards/` with JWT → create orchard
- [ ] GET `/api/orchards/` → list with 1 orchard
- [ ] GET `/api/orchards/1/` → detail view
- [ ] PATCH `/api/orchards/1/` → update name
- [ ] DELETE `/api/orchards/1/` → delete

**Checkpoint:** Complete orchard lifecycle works with JWT authentication

---

## PHASE 3: Estimation History (~3 hours)

**Goal:** Store and retrieve estimation results linked to orchards

### Step 3.1: Register EstimationRecordViewSet
- [ ] Update `api/urls.py`:
  ```python
  from api.viewsets import EstimationRecordViewSet
  
  router.register(r'estimations', EstimationRecordViewSet, basename='estimation')
  ```

### Step 3.2: Modify `/api/predict/yield/` view
- [ ] After yield calculation completes, create EstimationRecord:
  ```python
  # In api/views.py, after yield_result is computed:
  estimation = EstimationRecord.objects.create(
      orchard=orchard,
      num_images=len(images),
      raw_fruit_count=raw_count,
      adjusted_fruit_count=adjusted_count,
      overlap_ratio=overlap_ratio,
      ripe_percentage=ripe_pct,
      midripe_percentage=midripe_pct,
      unripe_percentage=unripe_pct,
      canopy_density_score=canopy_density,
      canopy_completeness_score=canopy_completeness,
      rgb_vvi_score=vvi_score,
      vvi_reliability=vvi_reliability,
      orchard_yield_kg=yield_kg,
      orchard_yield_tonnes=yield_tonnes,
      yield_uncertainty_kg=yield_uncertainty,
      full_response_json=yield_result,
  )
  ```

### Step 3.3: Test estimation endpoints
- [ ] POST `/api/predict/yield/` → should create EstimationRecord
- [ ] GET `/api/estimations/` → list with created record
- [ ] GET `/api/estimations/1/` → detail with all factors
- [ ] GET `/api/estimations/?days=7` → filter by time
- [ ] PATCH `/api/estimations/1/` → update notes

**Checkpoint:** All past estimations are tracked and queryable

---

## PHASE 4: Task Management (~4 hours)

**Goal:** Auto-generate and manually manage tasks based on rules

### Step 4.1: Register TaskRuleViewSet and TaskViewSet
- [ ] Update `api/urls.py`:
  ```python
  from api.viewsets import TaskRuleViewSet, TaskViewSet
  
  router.register(r'task-rules', TaskRuleViewSet, basename='taskrule')
  router.register(r'tasks', TaskViewSet, basename='task')
  ```

### Step 4.2: Implement auto-task generation
- [ ] In `/api/predict/yield/` view, after creating EstimationRecord:
  ```python
  # Check and apply all active rules
  from api.models import TaskRule
  
  for rule in request.user.farm_profile.task_rules.filter(is_active=True):
      should_create = False
      
      if rule.trigger_type == "ripeness_high" and estimation.ripe_percentage >= rule.ripeness_threshold:
          should_create = True
      elif rule.trigger_type == "canopy_weak" and estimation.canopy_completeness_score < rule.canopy_completeness_threshold:
          should_create = True
      elif rule.trigger_type == "vvi_low" and estimation.rgb_vvi_score < rule.vvi_threshold:
          should_create = True
      
      if should_create:
          Task.objects.create(
              farm_profile=request.user.farm_profile,
              orchard=orchard,
              title=rule.task_title,
              description=rule.task_description,
              priority=rule.priority,
              triggered_by_rule=rule,
              triggered_by_estimation=estimation,
          )
  ```

### Step 4.3: Test task endpoints
- [ ] POST `/api/task-rules/` → create rule with ripeness_threshold=70
- [ ] POST `/api/predict/yield/` → should auto-create task if ripe >= 70
- [ ] GET `/api/tasks/` → see auto-generated task
- [ ] POST `/api/tasks/` → manually create task
- [ ] PATCH `/api/tasks/1/` → change status to "completed"
- [ ] GET `/api/tasks/?status=pending` → filter by status
- [ ] GET `/api/tasks/summary/` → see counts

**Checkpoint:** Tasks auto-generate and can be managed manually

---

## PHASE 5: Analytics & Dashboard (~3 hours)

**Goal:** Provide trend data and summary stats for mobile dashboard

### Step 5.1: Register analytics viewsets
- [ ] Update `api/urls.py`:
  ```python
  from api.viewsets import DashboardViewSet, OrchardAnalyticsViewSet
  
  router.register(r'analytics/dashboard', DashboardViewSet, basename='dashboard')
  router.register(r'analytics/orchard', OrchardAnalyticsViewSet, basename='orchard-analytics')
  ```

### Step 5.2: Test analytics endpoints
- [ ] GET `/api/analytics/dashboard/` → summary for all orchards, last 30 days
- [ ] GET `/api/analytics/dashboard/?days=7` → 7-day window
- [ ] GET `/api/analytics/orchard/1/` → detailed analytics for orchard 1
- [ ] Verify time_series, by_variety, task_summary fields

**Checkpoint:** Mobile can fetch aggregated analytics for dashboard display

---

## FINAL STEPS

### Update Django Admin (optional but recommended)
- [ ] Register models in `api/admin.py`:
  ```python
  from django.contrib import admin
  from api.models import User, FarmProfile, Orchard, EstimationRecord, TaskRule, Task
  
  admin.site.register([FarmProfile, Orchard, EstimationRecord, TaskRule, Task])
  ```

### Verify All Endpoints
- [ ] Run `/api/` in browser → see full API schema
- [ ] Test each endpoint with curl or Postman
- [ ] Verify pagination, filtering, permissions work

### Document API (optional)
- [ ] Install `drf-spectacular`:
  ```bash
  pip install drf-spectacular
  ```
- [ ] Add to INSTALLED_APPS and configure for OpenAPI docs

---

## Implementation Notes

### Database Migrations
After each phase, run:
```bash
python manage.py makemigrations api
python manage.py migrate
```

### Permission Scoping
All viewsets must filter querysets to user's data:
```python
def get_queryset(self):
    return YourModel.objects.filter(
        orchard__farm_profile=self.request.user.farm_profile
    )
```

### Validation
- Serializers handle input validation
- ViewSets handle permissions and filtering
- Models handle database constraints

### Common Issues & Fixes

**Issue:** `ImportError: No module named 'rest_framework'`
- **Fix:** `pip install djangorestframework djangorestframework-simplejwt django-filter`

**Issue:** `ForeignKeyReferenceError` on migration
- **Fix:** Ensure models.py has correct imports and User references the custom User model

**Issue:** JWT token not working in Authorization header
- **Fix:** Check format is `Authorization: Bearer <token>` (not `Token`)

**Issue:** Estimations queryset empty
- **Fix:** Make sure EstimationRecord is created in `/predict/yield/` view AND orchard is associated with user

---

## Time Estimate

- Phase 1: 2 hours
- Phase 2: 3 hours
- Phase 3: 3 hours
- Phase 4: 4 hours
- Phase 5: 3 hours
- Buffer: 2 hours

**Total: ~17 hours** (can be parallelized somewhat)

Build one phase at a time, test thoroughly before moving to next.
