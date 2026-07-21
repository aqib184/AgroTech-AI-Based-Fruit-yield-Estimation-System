# AgroYield — AI-Based Fruit Yield Estimation System

AgroYield is a precision agriculture system that estimates apple orchard yield from **ground-level RGB images alone** — no drones, no multispectral sensors, no historical yield records required. A multi-model computer vision pipeline (fruit detection, ripeness classification, and canopy segmentation) is fused with a literature-informed yield formula and exposed through a Django REST backend and a React Native mobile app.


---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Models & Performance](#models--performance)
- [Yield Estimation Methodology](#yield-estimation-methodology)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [API Overview](#api-overview)
- [Datasets](#datasets)
- [Limitations](#limitations)
- [Future Work](#future-work)
- [References](#references)

---

## Overview

Traditional fruit yield estimation relies on manual sampling and visual inspection — subjective, labor-intensive, and inaccurate at scale. AgroYield automates this using deep learning on smartphone-captured orchard images, combining four visual cues into a single yield estimate:

1. **Fruit count** — via object detection
2. **Ripeness distribution** — via classification
3. **Canopy structure** — via segmentation
4. **Vegetation vigor** — via RGB-derived vegetation indices

These signals are fused in a multiplicative yield model that also produces a **confidence interval**, giving farmers not just a number but a sense of how reliable it is.

## Key Features

- 🍎 **Fruit detection & counting** with occlusion-aware double-count correction for multi-angle captures
- 🎨 **Ripeness classification** into Unripe / Mid-ripe / Ripe / Flower stages
- 🌿 **Canopy & leaf segmentation** for density, completeness, and edge coverage
- 📊 **Vegetation Vigor Index (VVI)** computed from standard RGB channels (no NIR needed)
- ⚖️ **Multi-factor yield model** combining all signals with literature-backed correction factors
- 📈 **Uncertainty-aware output** — every estimate ships with a confidence interval
- 📱 **Mobile dashboard** — capture images, view results, manage orchards, track tasks, and view historical analytics
- 🔁 **Automated task generation** — e.g., harvest or pruning tasks triggered by configurable rules based on estimation outcomes

## System Architecture

```
┌─────────────────────┐
│  React Native App    │  Image capture, metadata entry, results & analytics UI
│  (Expo + TypeScript) │  Redux Toolkit + RTK Query
└──────────┬───────────┘
           │ REST (JWT auth)
┌──────────▼───────────┐
│   Django REST API     │  Orchard mgmt, estimation, tasks, analytics
│                        │
│  ┌──────────────────┐  │
│  │ FruitCounter      │  │  YOLOv11
│  │ RipenessClassifier│  │  EfficientNet-B0
│  │ LeafSegmentation  │  │  U-Net
│  │ DoubleCountCorrector│ │
│  │ YieldCalculator    │  │
│  └──────────────────┘  │
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│      SQLite DB         │  EstimationRecord, Orchard, TaskRule, Task
└───────────────────────┘
```

**Pipeline flow:** capture images → detect fruit → classify ripeness → segment canopy → correct double-counts → calculate yield + confidence interval → persist record → evaluate task rules → return result to mobile client.

## Models & Performance

| Task | Model | Key Metric | Result |
|---|---|---|---|
| Fruit Detection | YOLOv11 | mAP@50 | **0.867** (Precision 0.830, Recall 0.777) |
| Ripeness Classification | EfficientNet-B0 | Validation Accuracy | **97.76%** (Weighted F1 0.977) |
| Canopy Segmentation | U-Net (replaced DeepLabv3+) | Dice / IoU | **0.851 / 0.755** |

- **Ripeness classes:** Mid-ripe, Ripe, Unripe, Flower — Ripe class F1 = 0.992; Mid-ripe has the lowest recall (0.876) due to expected ambiguity near maturity transitions.
- **U-Net** was chosen over DeepLabv3+ after the latter showed overfitting risk given the dataset size.
- Train/validation curves for all three models show tight convergence with no significant overfitting.

## Yield Estimation Methodology

The pipeline combines fruit count, ripeness mix, canopy health, and vigor into a single multiplicative yield model:

**1. Double-count correction** (for overlapping multi-view captures)

```
C_adj = round(C_raw × (1 − R_overlap)),   R_overlap ∈ [0.25, 0.55]
```

**2. Weighted average fruit mass** (from ripeness distribution)

```
M_g = s_r·m_r + s_m·m_m + s_u·m_u
```

**3. Ripeness, canopy, and occlusion adjustment factors**

```
F_ripeness  = clamp(0.88 + 0.24·s_r + 0.12·s_m − 0.06·s_u, 0.82, 1.12)
F_canopy    = clamp(0.82 + 0.22·d_canopy + 0.08·c_canopy, 0.78, 1.15)
F_occlusion = clamp(1.0 + 0.35·max(0, d_canopy − b_coverage), 0.92, 1.18)
```

**4. Vegetation Vigor Index** (RGB-only, no NIR required)

```
VARI  = (G − R) / (G + R − B + ε)
EXG   = 2G − R − B
NGRDI = (G − R) / (G + R + ε)
F_vigor = clamp(0.5·VARI + 0.3·EXG + 0.2·NGRDI, 0, 1)
```

**5. Per-tree and orchard-level yield**

```
Y_per_tree = C_adj × M_kg × F_ripeness × F_canopy × F_vigor × F_occlusion
Y_orchard  = Y_per_tree × N_trees × F_maturity
```

**6. Confidence interval**

```
ConfSig = clamp(0.5·conf_fruit + 0.3·c_canopy + 0.2·d_canopy, 0, 1)
U = clamp(0.24 − 0.14·ConfSig, 0.10, 0.24)
CI_lower = Y_orchard × (1 − U),   CI_upper = Y_orchard × (1 + U)
```

## Tech Stack

**Machine Learning**
- PyTorch, Torchvision, Ultralytics (YOLOv11)
- OpenCV, Pillow, NumPy
- CVAT (segmentation mask annotation)

**Backend**
- Django + Django REST Framework
- SQLite (prototype-stage storage)
- JWT authentication with auto-refresh

**Frontend**
- React Native (Expo) + TypeScript
- Redux Toolkit + RTK Query

**Hardware used for training**
- Intel Core i9-13900K, NVIDIA RTX A4000 (16GB VRAM), 64GB RAM


## Getting Started

### Prerequisites
- Python 3.10+
- Node.js + npm/yarn
- CUDA-capable GPU recommended for inference (CPU fallback supported but slower)

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Place trained model weights (YOLOv11 `.pt`, EfficientNet-B0 checkpoint, U-Net checkpoint) in the path configured in your Django settings before starting the server, and verify them via the model health-check endpoint.

### Mobile App Setup

```bash
cd mobile
npm install
npx expo start
```

Update the API base URL in the app's environment/config file to point to your backend host (e.g., your machine's LAN IP when testing on a physical device).

## API Overview

| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/login/` | POST | Obtain JWT access/refresh tokens |
| `/api/auth/refresh/` | POST | Refresh access token |
| `/api/orchards/` | GET/POST | List / create orchards |
| `/api/orchards/{id}/` | GET/PATCH/DELETE | Retrieve / update / delete an orchard |
| `/api/estimations/predict/` | POST | Submit 6 orchard images + metadata → run full inference pipeline |
| `/api/estimations/` | GET | List past estimation records (history/analytics) |
| `/api/tasks/` | GET/POST/PATCH | View and manage auto-generated / manual tasks |

`predict/` expects a multipart form with exactly six images plus metadata (variety, maturity level, canopy density estimate, tree count), and returns fruit counts, ripeness breakdown, canopy metrics, yield per tree/orchard, confidence interval, and a harvest recommendation.

## Datasets

| Task | Source |
|---|---|
| Fruit Detection | [MinneApple](https://arxiv.org/abs/1909.06441) |
| Ripeness Classification | Roboflow Universe |
| Canopy Segmentation | Manually annotated (CVAT) |

All three pipelines use geometric and photometric augmentation (flipping, scale/viewpoint variation, brightness/contrast, color perturbation) to improve robustness to real orchard conditions.

## Limitations

- Sensitive to image quality, viewpoint consistency, and difficult lighting
- Generalization across varieties, orchards, and seasons requires broader field validation
- No direct ground-truth harvest data used for calibration (literature-informed formula instead)
- Backend is not yet deployed to production infrastructure
- No Grad-CAM or other explainability techniques currently implemented
- Research prototype — not yet validated at field scale

## Future Work

- Multi-season field validation with harvest ground-truth for calibration
- Expanded augmentation/domain diversity for robustness under extreme conditions
- Integration of weather and growth-stage time series for temporal yield forecasting
- Inference and deployment optimization, plus offline/low-connectivity support
- Extended analytics and explainable agronomic recommendations

## References

Full citation list is available in the FYP report (Chapter: References). Key works include MinneApple (Häni et al., 2019), vegetation index formulations (Gitelson et al. 2002; Woebbecke et al. 1995; Tucker 1979), and multimodal yield fusion literature (Patel & Smith, 2019).

---
