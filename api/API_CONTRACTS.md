# API Endpoint Contracts & Implementation Order

## Implementation Phases

This document defines the exact request/response contracts in build order. Each phase is independent and additive.

---

## PHASE 1: AUTHENTICATION (No new endpoints yet - use DRF defaults)

**Files to create/modify:**
- Add `rest_framework_simplejwt` to requirements.txt
- Update `backend/settings.py` with JWT auth config
- Create `api/serializers.py` with UserSerializer, FarmProfileSerializer
- Create migration: `python manage.py makemigrations`

**Settings changes needed in `backend/settings.py`:**
```python
INSTALLED_APPS += ['rest_framework_simplejwt']

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=24),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
}
```

**Standard DRF endpoints (built-in):**
- `POST /api/token/` - Obtain JWT tokens
- `POST /api/token/refresh/` - Refresh access token

---

## PHASE 2: ORCHARD MANAGEMENT

**Endpoint: `POST /api/orchards/`**

**Request:**
```json
{
  "name": "North Block A",
  "variety": "gala",
  "area_hectares": 2.5,
  "total_trees": 625,
  "planting_density": "semi_dwarf",
  "tree_maturity": "mature",
  "section": "North Block A"
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "name": "North Block A",
  "variety": "gala",
  "area_hectares": 2.5,
  "total_trees": 625,
  "planting_density": "semi_dwarf",
  "tree_maturity": "mature",
  "section": "North Block A",
  "trees_per_hectare": 250.0,
  "created_at": "2026-04-10T10:30:00Z",
  "updated_at": "2026-04-10T10:30:00Z"
}
```

**Requirements:**
- Authentication required (JWT token in Authorization header)
- Automatically links to user's FarmProfile
- Validate area_hectares > 0.01 and total_trees > 0

---

**Endpoint: `GET /api/orchards/`**

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "name": "North Block A",
    "variety": "gala",
    "area_hectares": 2.5,
    "total_trees": 625,
    "trees_per_hectare": 250.0,
    "last_estimation_date": "2026-04-09T14:15:00Z",
    "last_estimation_yield_kg": 524.3
  },
  {
    "id": 2,
    "name": "South Block B",
    "variety": "fuji",
    "area_hectares": 1.8,
    "total_trees": 450,
    "trees_per_hectare": 250.0,
    "last_estimation_date": null,
    "last_estimation_yield_kg": null
  }
]
```

**Filters/Query Params:**
- `?variety=gala` - Filter by variety
- `?ordering=-created_at` - Order by field

---

**Endpoint: `GET /api/orchards/{id}/`**

**Response (200 OK):**
```json
{
  "id": 1,
  "name": "North Block A",
  "variety": "gala",
  "area_hectares": 2.5,
  "total_trees": 625,
  "planting_density": "semi_dwarf",
  "tree_maturity": "mature",
  "section": "North Block A",
  "trees_per_hectare": 250.0,
  "created_at": "2026-04-10T10:30:00Z",
  "updated_at": "2026-04-10T10:30:00Z",
  "estimation_count": 12,
  "avg_yield_kg": 518.5,
  "latest_estimation": {
    "id": 42,
    "estimation_date": "2026-04-09T14:15:00Z",
    "orchard_yield_kg": 524.3,
    "ripe_percentage": 68.5
  }
}
```

---

**Endpoint: `PATCH /api/orchards/{id}/`**

**Request:**
```json
{
  "name": "North Block A (revised)",
  "total_trees": 630
}
```

**Response (200 OK):**
Same as GET response

**Note:** Only allow patching non-core fields (name, section). Variety, maturity are immutable.

---

**Endpoint: `DELETE /api/orchards/{id}/`**

**Response (204 No Content)**

**Warning:** Cascades to delete all EstimationRecords and Tasks for this orchard.

---

## PHASE 3: ESTIMATION HISTORY

**Endpoint: `GET /api/estimations/`** (Dashboard list)

**Query Params:**
- `?orchard_id=1`
- `?days=7` or `?days=30` (filter by time window)
- `?ordering=-estimation_date`

**Response (200 OK):**
```json
{
  "count": 25,
  "next": "http://.../api/estimations/?page=2",
  "previous": null,
  "results": [
    {
      "id": 42,
      "orchard_id": 1,
      "orchard_name": "North Block A",
      "estimation_date": "2026-04-09T14:15:00Z",
      "num_images": 2,
      "fruit_count": 48,
      "ripe_pct": 68.5,
      "canopy_score": 0.82,
      "vvi_score": 0.67,
      "yield_kg": 524.3,
      "yield_tonnes": 0.524,
      "yield_uncertainty_kg": 78.6
    },
    {
      "id": 41,
      "orchard_id": 1,
      "orchard_name": "North Block A",
      "estimation_date": "2026-04-08T09:00:00Z",
      "num_images": 2,
      "fruit_count": 51,
      "ripe_pct": 65.2,
      "canopy_score": 0.80,
      "vvi_score": 0.64,
      "yield_kg": 512.7,
      "yield_tonnes": 0.513,
      "yield_uncertainty_kg": 82.1
    }
  ]
}
```

---

**Endpoint: `GET /api/estimations/{id}/`** (Detailed view)

**Response (200 OK):**
```json
{
  "id": 42,
  "orchard": {
    "id": 1,
    "name": "North Block A",
    "variety": "gala",
    "total_trees": 625
  },
  "estimation_date": "2026-04-09T14:15:00Z",
  "num_images": 2,
  "fruit_count_raw": 52,
  "fruit_count_adjusted": 48,
  "overlap_ratio": 0.40,
  "ripeness": {
    "ripe_pct": 68.5,
    "midripe_pct": 22.3,
    "unripe_pct": 9.2,
    "flower_filtered": 2
  },
  "canopy": {
    "canopy_density": 0.84,
    "canopy_completeness": 0.82,
    "canopy_coverage_bbox": 0.76
  },
  "vegetation_vigor": {
    "rgb_vvi_score": 0.67,
    "vvi_reliability": 0.62,
    "vvi_components": {
      "vari": 0.55,
      "exg": 0.68,
      "ngrdi": 0.71
    }
  },
  "yield_estimate": {
    "orchard_yield_kg": 524.3,
    "orchard_yield_tonnes": 0.524,
    "yield_uncertainty_kg": 78.6,
    "uncertainty_pct": 15.0,
    "factors": {
      "ripeness_factor": 1.05,
      "canopy_health_factor": 0.99,
      "vigor_factor": 1.014,
      "occlusion_factor": 1.08,
      "maturity_factor": 1.0
    }
  },
  "notes": "Good canopy, ready to harvest",
  "created_at": "2026-04-09T14:15:00Z",
  "updated_at": "2026-04-09T14:15:00Z"
}
```

---

**Endpoint: `DELETE /api/estimations/{id}/`**

**Response (204 No Content)**

**Note:** Also deletes any automatically-generated Tasks from this estimation.

---

**Endpoint: `PATCH /api/estimations/{id}/`** (Update notes only)

**Request:**
```json
{
  "notes": "Harvested on 2026-04-10"
}
```

**Response (200 OK):** Same as GET detailed view

---

## PHASE 4: TASK MANAGEMENT

**Endpoint: `POST /api/task-rules/`** (Create auto-generation rule)

**Request:**
```json
{
  "name": "High Ripeness Alert",
  "trigger_type": "ripeness_high",
  "ripeness_threshold": 70.0,
  "task_title": "Ready for Harvest",
  "task_description": "Fruits have reached target ripeness. Begin harvest operations.",
  "priority": "high",
  "is_active": true
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "name": "High Ripeness Alert",
  "trigger_type": "ripeness_high",
  "ripeness_threshold": 70.0,
  "canopy_completeness_threshold": null,
  "vvi_threshold": null,
  "task_title": "Ready for Harvest",
  "task_description": "Fruits have reached target ripeness. Begin harvest operations.",
  "priority": "high",
  "is_active": true,
  "created_at": "2026-04-10T10:30:00Z",
  "updated_at": "2026-04-10T10:30:00Z"
}
```

---

**Endpoint: `GET /api/task-rules/`**

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "name": "High Ripeness Alert",
    "trigger_type": "ripeness_high",
    "task_title": "Ready for Harvest",
    "priority": "high",
    "is_active": true,
    "created_at": "2026-04-10T10:30:00Z"
  },
  {
    "id": 2,
    "name": "Weak Canopy Alert",
    "trigger_type": "canopy_weak",
    "canopy_completeness_threshold": 0.6,
    "task_title": "Schedule Pruning",
    "priority": "medium",
    "is_active": true,
    "created_at": "2026-04-09T15:00:00Z"
  }
]
```

---

**Endpoint: `POST /api/tasks/`** (Manual task creation)

**Request:**
```json
{
  "orchard_id": 1,
  "title": "Inspect for pests",
  "description": "Weekly pest check on north block",
  "priority": "medium",
  "due_date": "2026-04-15"
}
```

**Response (201 Created):**
```json
{
  "id": 100,
  "orchard_id": 1,
  "orchard_name": "North Block A",
  "title": "Inspect for pests",
  "description": "Weekly pest check on north block",
  "priority": "medium",
  "status": "pending",
  "triggered_by_rule": null,
  "triggered_by_estimation": null,
  "due_date": "2026-04-15",
  "created_at": "2026-04-10T11:00:00Z",
  "completed_at": null
}
```

---

**Endpoint: `GET /api/tasks/`** (Task inbox)

**Query Params:**
- `?status=pending` or `status=in_progress`
- `?priority=high`
- `?orchard_id=1`
- `?due_date_before=2026-04-20` (overdue)
- `?ordering=-created_at`

**Response (200 OK):**
```json
{
  "count": 8,
  "results": [
    {
      "id": 200,
      "orchard_id": 1,
      "orchard_name": "North Block A",
      "title": "Ready for Harvest",
      "priority": "high",
      "status": "pending",
      "due_date": null,
      "created_at": "2026-04-10T14:15:00Z",
      "triggered_by_estimation_id": 42,
      "triggered_by_rule_id": 1
    },
    {
      "id": 100,
      "orchard_id": 1,
      "title": "Inspect for pests",
      "priority": "medium",
      "status": "pending",
      "due_date": "2026-04-15",
      "created_at": "2026-04-10T11:00:00Z"
    }
  ]
}
```

---

**Endpoint: `PATCH /api/tasks/{id}/`** (Update task status)

**Request:**
```json
{
  "status": "completed"
}
```

**Response (200 OK):**
```json
{
  "id": 100,
  "orchard_id": 1,
  "title": "Inspect for pests",
  "status": "completed",
  "completed_at": "2026-04-10T16:30:00Z",
  "priority": "medium"
}
```

**Allowed status transitions:**
- pending → in_progress, completed, cancelled
- in_progress → completed, cancelled
- completed, cancelled (terminal)

---

**Endpoint: `DELETE /api/tasks/{id}/`**

**Response (204 No Content)**

---

## PHASE 5: ANALYTICS & DASHBOARD

**Endpoint: `GET /api/analytics/dashboard/`**

**Query Params:**
- `?days=7` or `?days=30`

**Response (200 OK):**
```json
{
  "period": "last_7_days",
  "summary": {
    "total_estimations": 12,
    "total_estimations_kg": 6287.4,
    "avg_yield_per_estimation_kg": 523.9,
    "orchards_with_estimations": 3,
    "ripe_average_pct": 67.3
  },
  "time_series": [
    {
      "date": "2026-04-04",
      "estimations": 2,
      "total_yield_kg": 1025.3,
      "avg_ripe_pct": 62.1
    },
    {
      "date": "2026-04-05",
      "estimations": 1,
      "total_yield_kg": 524.3,
      "avg_ripe_pct": 68.5
    }
  ],
  "by_variety": [
    {
      "variety": "gala",
      "estimations": 8,
      "avg_yield_kg": 535.2,
      "max_yield_kg": 612.4
    },
    {
      "variety": "fuji",
      "estimations": 4,
      "avg_yield_kg": 498.1,
      "max_yield_kg": 544.2
    }
  ],
  "task_summary": {
    "pending": 5,
    "in_progress": 2,
    "completed": 18,
    "overdue": 1
  }
}
```

---

**Endpoint: `GET /api/analytics/orchard/{orchard_id}/`** (Detailed orchard analytics)

**Query Params:**
- `?days=30`

**Response (200 OK):**
```json
{
  "orchard_id": 1,
  "orchard_name": "North Block A",
  "variety": "gala",
  "period": "last_30_days",
  "summary": {
    "estimations": 10,
    "avg_yield_kg": 524.6,
    "max_yield_kg": 612.4,
    "min_yield_kg": 412.1,
    "avg_ripeness_pct": 66.8,
    "avg_canopy_score": 0.81,
    "avg_vvi_score": 0.65
  },
  "estimations_trend": [
    {
      "date": "2026-03-12",
      "fruit_count": 48,
      "yield_kg": 501.2,
      "ripe_pct": 62.3,
      "canopy_score": 0.79
    },
    {
      "date": "2026-03-19",
      "fruit_count": 52,
      "yield_kg": 524.3,
      "ripe_pct": 68.5,
      "canopy_score": 0.82
    }
  ],
  "yield_factors_avg": {
    "ripeness_factor": 1.048,
    "canopy_health_factor": 0.987,
    "vigor_factor": 1.013,
    "occlusion_factor": 1.075
  }
}
```

---

## BUILD ORDER CHECKLIST

**Phase 1: Settings & Auth**
- [ ] Update `requirements.txt` (add `djangorestframework-simplejwt`)
- [ ] Update `backend/settings.py` (JWT config)
- [ ] Create initial migration: `makemigrations api`
- [ ] Test `/api/token/` endpoint with Django test client

**Phase 2: Orchard CRUD**
- [ ] Create `api/serializers.py` with `OrchardSerializer`
- [ ] Create `api/viewsets.py` with `OrchardViewSet`
- [ ] Update `api/urls.py` to register OrchardViewSet
- [ ] Create migration: `makemigrations api`
- [ ] Test POST/GET/PATCH/DELETE endpoints

**Phase 3: Estimation History**
- [ ] Create `EstimationRecordSerializer`
- [ ] Create `EstimationRecordViewSet` (read-only except PATCH notes & DELETE)
- [ ] Update `api/views.py` to create EstimationRecord after `/predict/yield/`
- [ ] Create migration: `makemigrations api`
- [ ] Test GET list, GET detail, GET with filters

**Phase 4: Task Management**
- [ ] Create `TaskRuleSerializer` and `TaskSerializer`
- [ ] Create `TaskRuleViewSet` and `TaskViewSet`
- [ ] Add task auto-generation logic in `/predict/yield/` view
- [ ] Add Task status validation (PATCH endpoint)
- [ ] Create migration: `makemigrations api`
- [ ] Test rule creation, task creation, task status updates

**Phase 5: Analytics**
- [ ] Create `AnalyticsViewSet` (or two separate views)
- [ ] Implement queryset aggregations (ORM queries at DB level)
- [ ] Add time_series and by_variety breakdowns
- [ ] Test dashboard endpoint with 7d and 30d windows

---

## Key Implementation Notes

### Authentication
- All endpoints require JWT token in `Authorization: Bearer <token>` header
- Use DRF's `IsAuthenticated` permission class
- Automatically scope queries to user's FarmProfile

### Permissions
- User can only access their own Orchards, Estimations, Tasks
- Filter all querysets: `.filter(farm_profile=request.user.farm_profile)`

### Auto-Task Generation
In the `/api/predict/yield/` view, after creating EstimationRecord:
```python
# Check all active TaskRules
for rule in farm_profile.task_rules.filter(is_active=True):
    if rule.trigger_type == "ripeness_high" and estimation.ripe_percentage >= rule.ripeness_threshold:
        Task.objects.create(
            farm_profile=farm_profile,
            orchard=orchard,
            title=rule.task_title,
            description=rule.task_description,
            priority=rule.priority,
            triggered_by_rule=rule,
            triggered_by_estimation=estimation,
        )
```

### Pagination
- Default page size: 20
- Include `?page=2` support on all list endpoints
- Use `rest_framework.pagination.PageNumberPagination`

### Serializers
- Use `SerializerMethodField` for computed fields (trees_per_hectare, last_estimation_date, etc.)
- Use nested serializers for related data in detail views
- Validate constraints in serializer.validate() methods

### Testing
- Create tests for each viewset using APITestCase
- Test both authenticated and unauthenticated access
- Test filtering, pagination, and status codes
- Use Django test client fixtures for EstimationRecord (full_response_json)

---

## Database Migrations

After each phase, run:
```bash
python manage.py makemigrations api
python manage.py migrate
```

Recommended migration names:
1. `0001_initial_user_farmprofile`
2. `0002_add_orchard`
3. `0003_add_estimation_record`
4. `0004_add_task_models`
