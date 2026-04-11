# API Quick Reference & Testing Guide

## Base URL
```
http://localhost:8000
```

## Authentication
All endpoints except `/api/token/` and `/api/users/register/` require JWT token:
```
Authorization: Bearer <access_token>
```

---

## PHASE 1: User & Auth

### Register New User
```
POST /api/users/register/
Content-Type: application/json

{
  "username": "farmer_john",
  "email": "john@farm.com",
  "password": "SecurePass123",
  "password2": "SecurePass123",
  "first_name": "John",
  "last_name": "Smith"
}

Response: 201 Created
{
  "id": 1,
  "username": "farmer_john",
  "email": "john@farm.com",
  "first_name": "John",
  "last_name": "Smith"
}
```

### Get Access Token
```
POST /api/token/
Content-Type: application/json

{
  "username": "farmer_john",
  "password": "SecurePass123"
}

Response: 200 OK
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### Refresh Access Token
```
POST /api/token/refresh/
Content-Type: application/json

{
  "refresh": "<refresh_token>"
}

Response: 200 OK
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### Get User Profile
```
GET /api/users/profile/
Authorization: Bearer <access_token>

Response: 200 OK
{
  "id": 1,
  "user_name": "John Smith",
  "email": "john@farm.com",
  "farm_name": "",
  "region": null,
  "total_area_hectares": null,
  "preferred_unit": "kg",
  "created_at": "2026-04-10T10:00:00Z",
  "updated_at": "2026-04-10T10:00:00Z"
}
```

### Update Profile
```
PATCH /api/users/profile/
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "farm_name": "Green Valley Farm",
  "region": "Mudgee",
  "total_area_hectares": 50.0,
  "preferred_unit": "tonnes"
}

Response: 200 OK
```

---

## PHASE 2: Orchard Management

### List Orchards
```
GET /api/orchards/
Authorization: Bearer <access_token>

Optional Filters:
  ?variety=gala
  ?tree_maturity=mature
  ?planting_density=semi_dwarf
  ?ordering=-created_at

Response: 200 OK
{
  "count": 2,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "name": "North Block A",
      "variety": "gala",
      "area_hectares": 2.5,
      "total_trees": 625,
      "trees_per_hectare": 250.0,
      "last_estimation_date": "2026-04-09T14:15:00Z",
      "last_estimation_yield_kg": 524.3,
      "estimations_count": 12,
      "created_at": "2026-04-10T10:30:00Z"
    }
  ]
}
```

### Create Orchard
```
POST /api/orchards/
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "North Block A",
  "variety": "gala",
  "area_hectares": 2.5,
  "total_trees": 625,
  "planting_density": "semi_dwarf",
  "tree_maturity": "mature",
  "section": "North Block A"
}

Response: 201 Created
{
  "id": 1,
  "name": "North Block A",
  ...
}
```

### Get Orchard Detail
```
GET /api/orchards/1/
Authorization: Bearer <access_token>

Response: 200 OK
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
  "estimation_count": 12,
  "avg_yield_kg": 518.5,
  "latest_estimation": {
    "id": 42,
    "estimation_date": "2026-04-09T14:15:00Z",
    "orchard_yield_kg": 524.3,
    "ripe_percentage": 68.5,
    "canopy_score": 0.82
  },
  "created_at": "2026-04-10T10:30:00Z",
  "updated_at": "2026-04-10T10:30:00Z"
}
```

### Update Orchard
```
PATCH /api/orchards/1/
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "North Block A (revised)",
  "total_trees": 630
}

Response: 200 OK
```

### Delete Orchard
```
DELETE /api/orchards/1/
Authorization: Bearer <access_token>

Response: 204 No Content
```

---

## PHASE 3: Estimation History

### List Estimations
```
GET /api/estimations/
Authorization: Bearer <access_token>

Optional Filters:
  ?orchard_id=1
  ?days=7
  ?days=30
  ?ordering=-estimation_date

Response: 200 OK
{
  "count": 25,
  "next": "http://.../api/estimations/?page=2",
  "results": [
    {
      "id": 42,
      "orchard_id": 1,
      "orchard_name": "North Block A",
      "estimation_date": "2026-04-09T14:15:00Z",
      "num_images": 2,
      "adjusted_fruit_count": 48,
      "ripe_percentage": 68.5,
      "canopy_completeness_score": 0.82,
      "rgb_vvi_score": 0.67,
      "orchard_yield_kg": 524.3,
      "orchard_yield_tonnes": 0.524,
      "yield_uncertainty_kg": 78.6
    }
  ]
}
```

### Get Estimation Detail
```
GET /api/estimations/42/
Authorization: Bearer <access_token>

Response: 200 OK
{
  "id": 42,
  "orchard": {
    "id": 1,
    "name": "North Block A",
    "variety": "gala",
    "area_hectares": 2.5,
    "total_trees": 625,
    "trees_per_hectare": 250.0,
    "last_estimation_date": "2026-04-09T14:15:00Z",
    "last_estimation_yield_kg": 524.3,
    "estimations_count": 12,
    "created_at": "2026-04-10T10:30:00Z"
  },
  "estimation_date": "2026-04-09T14:15:00Z",
  "num_images": 2,
  "raw_fruit_count": 52,
  "adjusted_fruit_count": 48,
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

### Update Estimation Notes
```
PATCH /api/estimations/42/
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "notes": "Harvested on 2026-04-10"
}

Response: 200 OK
```

### Delete Estimation
```
DELETE /api/estimations/42/
Authorization: Bearer <access_token>

Response: 204 No Content

Note: Cascades to delete auto-generated tasks
```

---

## PHASE 4: Task Management

### Create Task Rule
```
POST /api/task-rules/
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "High Ripeness Alert",
  "trigger_type": "ripeness_high",
  "ripeness_threshold": 70.0,
  "task_title": "Ready for Harvest",
  "task_description": "Fruits have reached target ripeness.",
  "priority": "high",
  "is_active": true
}

Response: 201 Created
```

### List Task Rules
```
GET /api/task-rules/
Authorization: Bearer <access_token>

Response: 200 OK
{
  "count": 2,
  "results": [
    {
      "id": 1,
      "name": "High Ripeness Alert",
      "trigger_type": "ripeness_high",
      "ripeness_threshold": 70.0,
      "canopy_completeness_threshold": null,
      "vvi_threshold": null,
      "task_title": "Ready for Harvest",
      "task_description": "Fruits have reached target ripeness.",
      "priority": "high",
      "is_active": true,
      "created_at": "2026-04-10T10:30:00Z",
      "updated_at": "2026-04-10T10:30:00Z"
    }
  ]
}
```

### Create Task (Manual)
```
POST /api/tasks/
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "orchard_id": 1,
  "title": "Inspect for pests",
  "description": "Weekly pest check on north block",
  "priority": "medium",
  "due_date": "2026-04-15"
}

Response: 201 Created
{
  "id": 100,
  "orchard_id": 1,
  "orchard_name": "North Block A",
  "title": "Inspect for pests",
  "priority": "medium",
  "status": "pending",
  "due_date": "2026-04-15",
  "triggered_by_rule_id": null,
  "triggered_by_rule_name": null,
  "triggered_by_estimation_id": null,
  "created_at": "2026-04-10T11:00:00Z"
}
```

### List Tasks
```
GET /api/tasks/
Authorization: Bearer <access_token>

Optional Filters:
  ?status=pending
  ?status=in_progress
  ?priority=high
  ?orchard_id=1
  ?due_date_before=2026-04-20 (overdue)
  ?ordering=-created_at

Response: 200 OK
```

### Update Task Status
```
PATCH /api/tasks/100/
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "status": "completed"
}

Response: 200 OK
{
  "id": 100,
  "orchard_id": 1,
  "title": "Inspect for pests",
  "status": "completed",
  "completed_at": "2026-04-10T16:30:00Z",
  "priority": "medium"
}
```

### Get Task Summary
```
GET /api/tasks/summary/
Authorization: Bearer <access_token>

Response: 200 OK
{
  "pending": 5,
  "in_progress": 2,
  "completed": 18,
  "overdue": 1
}
```

### Delete Task
```
DELETE /api/tasks/100/
Authorization: Bearer <access_token>

Response: 204 No Content
```

---

## PHASE 5: Analytics & Dashboard

### Get Dashboard Summary
```
GET /api/analytics/dashboard/
Authorization: Bearer <access_token>

Optional:
  ?days=7
  ?days=30 (default)

Response: 200 OK
{
  "period": "last_30_days",
  "summary": {
    "period": "last_30_days",
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
      "total_yield": 512.5,
      "avg_ripe": 62.1
    }
  ],
  "by_variety": [
    {
      "variety": "gala",
      "num_estimations": 8,
      "avg_yield": 535.2,
      "max_yield": 612.4
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

### Get Orchard Analytics
```
GET /api/analytics/orchard/1/
Authorization: Bearer <access_token>

Optional:
  ?days=30 (default)

Response: 200 OK
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
      "estimation_date": "2026-03-12",
      "adjusted_fruit_count": 48,
      "orchard_yield_kg": 501.2,
      "ripe_percentage": 62.3,
      "canopy_completeness_score": 0.79
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

## Postman Collection Template

Save as `postman_collection.json` and import into Postman:

```json
{
  "info": {
    "name": "Fruit Yield Estimator API",
    "version": "1.0"
  },
  "item": [
    {
      "name": "Register",
      "request": {
        "method": "POST",
        "url": "http://localhost:8000/api/users/register/",
        "body": {
          "mode": "raw",
          "raw": "{\"username\": \"farmer_john\", \"email\": \"john@farm.com\", \"password\": \"SecurePass123\", \"password2\": \"SecurePass123\"}"
        }
      }
    },
    {
      "name": "Get Token",
      "request": {
        "method": "POST",
        "url": "http://localhost:8000/api/token/",
        "body": {
          "mode": "raw",
          "raw": "{\"username\": \"farmer_john\", \"password\": \"SecurePass123\"}"
        }
      }
    },
    {
      "name": "List Orchards",
      "request": {
        "method": "GET",
        "url": "http://localhost:8000/api/orchards/",
        "header": [
          {"key": "Authorization", "value": "Bearer {{access_token}}"}
        ]
      }
    }
  ]
}
```

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200  | OK - Request successful |
| 201  | Created - Resource created |
| 204  | No Content - Deletion successful |
| 400  | Bad Request - Invalid input |
| 401  | Unauthorized - Missing/invalid token |
| 403  | Forbidden - No permission |
| 404  | Not Found - Resource not found |
| 500  | Server Error |

## Common Test Workflow

1. Register new user → `POST /api/users/register/`
2. Get JWT token → `POST /api/token/`
3. Copy access token
4. Create orchard → `POST /api/orchards/` with token
5. Run estimation → `POST /api/predict/yield/` (existing endpoint)
6. Check estimation → `GET /api/estimations/`
7. Create task rule → `POST /api/task-rules/`
8. Verify auto-task created → `GET /api/tasks/`
9. View dashboard → `GET /api/analytics/dashboard/`
