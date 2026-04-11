from django.conf import settings
from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from copy import deepcopy

from PIL import Image
from PIL import ImageDraw
import numpy as np
import cv2
import io
import json
import os
import base64

from .serializers import YieldEstimateSerializer
from .models import EstimationRecord, Orchard, Task
from .utils.yield_calculator import calculate_yield
from .utils.double_count import correct_double_count, estimate_view_overlap_ratio

# Global model instances
_fruit_counter = None
_ripeness_classifier = None
_leaf_segmentation = None
_models_loaded = False


def _ensure_models_loaded():
    if not _models_loaded:
        load_models()
    return _models_loaded


def _image_to_base64(pil_img: Image.Image, fmt: str = "PNG") -> str:
    buffer = io.BytesIO()
    pil_img.save(buffer, format=fmt)
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def _draw_detection_overlay(image: Image.Image, detections: list) -> Image.Image:
    canvas = image.copy().convert("RGB")
    draw = ImageDraw.Draw(canvas)
    for idx, det in enumerate(detections):
        x1, y1, x2, y2 = det["bbox"]
        label = det.get("ripeness", "unknown")
        conf = det.get("confidence", 0.0)

        color = {
            "ripe": (45, 198, 83),
            "midripe": (245, 158, 11),
            "unripe": (59, 130, 246),
            "flower": (236, 72, 153),
        }.get(label, (239, 68, 68))

        draw.rectangle([x1, y1, x2, y2], outline=color, width=3)
        draw.text((x1 + 2, max(2, y1 - 14)), f"#{idx + 1} {label} {conf:.2f}", fill=color)
    return canvas


def _overlay_leaf_mask(image: Image.Image, mask) -> Image.Image:
    if mask is None:
        return image

    rgb = image.convert("RGBA")
    mask_img = Image.fromarray((mask * 255).astype("uint8"), mode="L").resize(image.size, Image.BILINEAR)
    overlay = Image.new("RGBA", image.size, (16, 185, 129, 0))
    overlay.putalpha(mask_img.point(lambda p: int(p * 0.45)))
    return Image.alpha_composite(rgb, overlay).convert("RGB")


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, float(value)))


def _json_safe(value):
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if isinstance(value, tuple):
        return [_json_safe(item) for item in value]
    if isinstance(value, (np.integer, np.floating)):
        return value.item()
    return value


def _robust_unit_scale(values: np.ndarray, lower_q: float = 5.0, upper_q: float = 95.0) -> np.ndarray:
    if values.size == 0:
        return values
    lo = np.percentile(values, lower_q)
    hi = np.percentile(values, upper_q)
    if hi <= lo:
        return np.zeros_like(values, dtype=np.float32)
    scaled = (values - lo) / (hi - lo)
    return np.clip(scaled, 0.0, 1.0).astype(np.float32)


def _compute_detection_features(per_image_detections: list, pil_images: list) -> dict:
    total_image_pixels = 0.0
    total_box_area = 0.0
    bbox_areas = []
    confidences = []

    for idx, img in enumerate(pil_images):
        width, height = img.size
        image_area = float(max(1, width * height))
        total_image_pixels += image_area
        detections = per_image_detections[idx] if idx < len(per_image_detections) else []

        image_box_area = 0.0
        for det in detections:
            x1, y1, x2, y2 = det.get("bbox", [0, 0, 0, 0])
            bw = max(0, int(x2) - int(x1))
            bh = max(0, int(y2) - int(y1))
            area = float(bw * bh)
            image_box_area += area
            bbox_areas.append(area)
            confidences.append(float(det.get("confidence", 0.0)))

        total_box_area += image_box_area

    total_boxes = len(bbox_areas)
    mean_conf = float(np.mean(confidences)) if confidences else 0.0
    mean_bbox_area = float(np.mean(bbox_areas)) if bbox_areas else 0.0
    median_bbox_area = float(np.median(bbox_areas)) if bbox_areas else 0.0
    fruit_per_mpx = float(total_boxes / max(1e-6, total_image_pixels / 1e6))
    bbox_coverage_ratio = float(total_box_area / max(1.0, total_image_pixels))
    bbox_coverage_ratio = _clamp(bbox_coverage_ratio, 0.0, 1.0)

    return {
        "total_boxes": int(total_boxes),
        "mean_confidence": mean_conf,
        "mean_bbox_area_px": mean_bbox_area,
        "median_bbox_area_px": median_bbox_area,
        "fruit_per_mpx": fruit_per_mpx,
        "bbox_coverage_ratio": bbox_coverage_ratio,
    }


def _compute_leaf_vigor_features(pil_images: list, leaf_per_image: list) -> dict:
    per_image = []
    weighted_vvi = 0.0
    weighted_vari = 0.0
    weighted_exg = 0.0
    weighted_ngrdi = 0.0
    total_leaf_pixels = 0.0

    canopy_coverages = []
    completeness_scores = []
    edge_coverages = []
    method_confidences = []

    for idx, img in enumerate(pil_images):
        item = leaf_per_image[idx] if idx < len(leaf_per_image) else {}
        mask = item.get("mask")
        method = item.get("method", "model")
        canopy_score = float(item.get("canopy_score", 0.0))

        if mask is None:
            per_image.append(
                {
                    "image_index": idx,
                    "canopy_score": canopy_score,
                    "canopy_coverage_fraction": 0.0,
                    "edge_leaf_coverage": 0.0,
                    "canopy_component_count": 0,
                    "largest_component_ratio": 0.0,
                    "canopy_completeness_score": 0.0,
                    "rgb_vvi_score": 0.0,
                    "vari_mean": 0.0,
                    "exg_mean": 0.0,
                    "ngrdi_mean": 0.0,
                    "leaf_pixels": 0,
                    "method": method,
                }
            )
            continue

        mask_arr = np.asarray(mask).astype(np.uint8)
        if mask_arr.ndim != 2:
            mask_arr = np.squeeze(mask_arr)
        if mask_arr.ndim != 2:
            mask_arr = np.zeros((256, 256), dtype=np.uint8)

        h, w = mask_arr.shape[:2]
        leaf_bool = mask_arr > 0
        leaf_pixels = int(np.count_nonzero(leaf_bool))
        total_pixels = float(max(1, h * w))
        coverage = float(leaf_pixels / total_pixels)

        # Edge foliage helps detect whether canopy is only center-segmented.
        edge_band = max(2, int(0.05 * min(h, w)))
        edge_mask = np.zeros_like(mask_arr, dtype=bool)
        edge_mask[:edge_band, :] = True
        edge_mask[-edge_band:, :] = True
        edge_mask[:, :edge_band] = True
        edge_mask[:, -edge_band:] = True
        edge_leaf_coverage = float(np.mean(leaf_bool[edge_mask])) if np.any(edge_mask) else 0.0

        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask_arr, connectivity=8)
        min_component = max(24, int(0.00055 * total_pixels))
        valid_areas = []
        for label_idx in range(1, num_labels):
            area = int(stats[label_idx, cv2.CC_STAT_AREA])
            if area >= min_component:
                valid_areas.append(area)
        component_count = len(valid_areas)
        largest_component_ratio = float(max(valid_areas) / total_pixels) if valid_areas else 0.0

        if leaf_pixels > 0:
            ys, xs = np.where(leaf_bool)
            span_h = float((ys.max() - ys.min() + 1) / max(1, h)) if ys.size else 0.0
            span_w = float((xs.max() - xs.min() + 1) / max(1, w)) if xs.size else 0.0
            canopy_extent = _clamp(span_h * span_w, 0.0, 1.0)
            largest_component_share_of_leaf = float(max(valid_areas) / leaf_pixels) if valid_areas else 0.0
        else:
            canopy_extent = 0.0
            largest_component_share_of_leaf = 0.0

        # Completeness prioritizes connected canopy structure and spatial extent,
        # not just fraction of the full frame that is segmented.
        canopy_completeness = _clamp(
            (0.52 * largest_component_share_of_leaf)
            + (0.26 * canopy_extent)
            + (0.14 * edge_leaf_coverage)
            + (0.08 * min(1.0, coverage / 0.35)),
            0.0,
            1.0,
        )

        resized = img.convert("RGB").resize((w, h), Image.BILINEAR)
        rgb = np.asarray(resized).astype(np.float32) / 255.0
        r = rgb[:, :, 0]
        g = rgb[:, :, 1]
        b = rgb[:, :, 2]
        eps = 1e-6

        vari = (g - r) / (g + r - b + eps)
        exg = (2.0 * g) - r - b
        ngrdi = (g - r) / (g + r + eps)

        if leaf_pixels > 0:
            vari_leaf = vari[leaf_bool]
            exg_leaf = exg[leaf_bool]
            ngrdi_leaf = ngrdi[leaf_bool]

            vari_norm = _robust_unit_scale(vari_leaf)
            exg_norm = _robust_unit_scale(exg_leaf)
            ngrdi_norm = _robust_unit_scale(ngrdi_leaf)

            vari_mean = float(np.mean(vari_norm))
            exg_mean = float(np.mean(exg_norm))
            ngrdi_mean = float(np.mean(ngrdi_norm))
            rgb_vvi = _clamp((0.5 * vari_mean) + (0.3 * exg_mean) + (0.2 * ngrdi_mean), 0.0, 1.0)
        else:
            vari_mean = 0.0
            exg_mean = 0.0
            ngrdi_mean = 0.0
            rgb_vvi = 0.0

        method_conf = 1.0 if method == "model_hybrid" else 0.75

        weighted_vvi += rgb_vvi * leaf_pixels
        weighted_vari += vari_mean * leaf_pixels
        weighted_exg += exg_mean * leaf_pixels
        weighted_ngrdi += ngrdi_mean * leaf_pixels
        total_leaf_pixels += leaf_pixels

        canopy_coverages.append(coverage)
        completeness_scores.append(canopy_completeness)
        edge_coverages.append(edge_leaf_coverage)
        method_confidences.append(method_conf)

        per_image.append(
            {
                "image_index": idx,
                "canopy_score": canopy_score,
                "canopy_coverage_fraction": coverage,
                "edge_leaf_coverage": edge_leaf_coverage,
                "canopy_component_count": component_count,
                "largest_component_ratio": largest_component_ratio,
                "canopy_completeness_score": canopy_completeness,
                "rgb_vvi_score": rgb_vvi,
                "vari_mean": vari_mean,
                "exg_mean": exg_mean,
                "ngrdi_mean": ngrdi_mean,
                "leaf_pixels": leaf_pixels,
                "method": method,
            }
        )

    orchard_vvi = float(weighted_vvi / max(1.0, total_leaf_pixels))
    orchard_vari = float(weighted_vari / max(1.0, total_leaf_pixels))
    orchard_exg = float(weighted_exg / max(1.0, total_leaf_pixels))
    orchard_ngrdi = float(weighted_ngrdi / max(1.0, total_leaf_pixels))

    orchard = {
        "canopy_coverage_fraction": float(np.mean(canopy_coverages)) if canopy_coverages else 0.0,
        "canopy_completeness_score": float(np.mean(completeness_scores)) if completeness_scores else 0.0,
        "edge_leaf_coverage": float(np.mean(edge_coverages)) if edge_coverages else 0.0,
        "segmentation_method_confidence": float(np.mean(method_confidences)) if method_confidences else 0.0,
        "rgb_vvi_score": orchard_vvi,
        "vari_mean": orchard_vari,
        "exg_mean": orchard_exg,
        "ngrdi_mean": orchard_ngrdi,
        "total_leaf_pixels": int(total_leaf_pixels),
    }

    return {
        "orchard": orchard,
        "per_image": per_image,
    }


def VisualizerPageView(request):
    return render(request, "api/visualizer.html")

class HealthCheckView(APIView):
    """
    GET /api/health/
    Returns model load status.
    """
    def get(self, request):
        _ensure_models_loaded()
        return Response({
            "status": "healthy" if _models_loaded else "unhealthy",
            "fruit_detection_model": "loaded" if _fruit_counter and _fruit_counter.loaded else "not_loaded",
            "ripeness_classifier_model": "loaded" if _ripeness_classifier and _ripeness_classifier.loaded else "not_loaded",
            "leaf_segmentation_model": "loaded" if _leaf_segmentation and _leaf_segmentation.loaded else "not_loaded",
        }, status=status.HTTP_200_OK if _models_loaded else status.HTTP_503_SERVICE_UNAVAILABLE)

class YieldEstimateView(APIView):
    """
    POST /api/predict/yield/
    Accepts multipart form data with images and orchard details.
    """
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        _ensure_models_loaded()
        include_visuals = str(request.data.get("include_visuals", "false")).lower() in {"1", "true", "yes"}

        # Check if models are loaded
        if not _models_loaded:
            return Response(
                {"error": "Models not loaded. Check server startup logs."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        # Validate input data
        serializer = YieldEstimateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data

        # Extract images
        image_files = request.FILES.getlist('images')

        if not image_files:
            # Try alternative key names
            image_files = request.FILES.getlist('image') or request.FILES.getlist('file')
            if not image_files:
                return Response(
                    {
                        "error": "At least one image is required.",
                        "debug_files_received": list(request.FILES.keys()),
                        "debug_data_received": list(request.data.keys())
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Convert to PIL Images
        try:
            pil_images = []
            for img_file in image_files:
                img_bytes = img_file.read()
                if len(img_bytes) == 0:
                    continue
                pil_img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
                pil_images.append(pil_img)
        except Exception as e:
            return Response(
                {"error": f"Failed to process images: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Extract validated fields
        variety = validated_data['variety']
        tree_maturity = validated_data['tree_maturity']
        total_trees = validated_data.get('total_trees')
        orchard_area = validated_data.get('orchard_area')
        area_unit = validated_data.get('area_unit', 'acres')
        planting_density = validated_data['planting_density']

        try:
            # STEP 1: Fruit Detection (YOLO) + get crops
            raw_count, per_image_counts, all_crops, per_image_detections = _fruit_counter.detect_fruits_with_crops(pil_images)

            # STEP 2: Ripeness Classification (EfficientNet B0) on cropped fruits
            ripeness_data = _ripeness_classifier.classify_with_details(all_crops)
            ripe_pct = ripeness_data['ripe_percentage']
            midripe_pct = ripeness_data['midripe_percentage']
            unripe_pct = ripeness_data['unripe_percentage']
            flower_count = ripeness_data['flower_count_ignored']

            # Attach per-fruit ripeness labels back to detections for debugging/visualization.
            per_crop_predictions = ripeness_data.get("per_crop_predictions", [])
            refined_per_image_counts = []
            for image_idx, detections in enumerate(per_image_detections):
                crop_predictions = per_crop_predictions[image_idx] if image_idx < len(per_crop_predictions) else []
                fruit_like_count = 0
                for det_idx, det in enumerate(detections):
                    pred = crop_predictions[det_idx] if det_idx < len(crop_predictions) else {"label": "unknown", "confidence": 0.0}
                    det["ripeness"] = pred.get("label", "unknown")
                    det["ripeness_confidence"] = float(pred.get("confidence", 0.0))

                    label = det["ripeness"]
                    conf = det["ripeness_confidence"]
                    det_conf = float(det.get("confidence", 0.0))

                    # Suppress clear flower-like false positives from final apple count.
                    is_flower_like = label == "flower" and conf >= 0.90 and det_conf <= 0.35
                    if not is_flower_like:
                        fruit_like_count += 1

                refined_per_image_counts.append(fruit_like_count)

            raw_count = int(sum(refined_per_image_counts))
            per_image_counts = refined_per_image_counts

            # STEP 3: Leaf Area Segmentation (DeepLabv3+)
            leaf_data = _leaf_segmentation.predict_batch_with_masks(pil_images)
            canopy_density_score = leaf_data["score"]
            leaf_per_image = leaf_data.get("per_image", [])
            leaf_feature_bundle = _compute_leaf_vigor_features(pil_images, leaf_per_image)
            leaf_orchard = leaf_feature_bundle.get("orchard", {})
            leaf_per_image_metrics = leaf_feature_bundle.get("per_image", [])

            detection_features = _compute_detection_features(per_image_detections, pil_images)

            canopy_completeness = float(leaf_orchard.get("canopy_completeness_score", 0.0))
            rgb_vvi_score = float(leaf_orchard.get("rgb_vvi_score", 0.0))
            vvi_scores = [float(item.get("rgb_vvi_score", 0.0)) for item in leaf_per_image_metrics if item.get("leaf_pixels", 0) > 0]
            vvi_std = float(np.std(vvi_scores)) if vvi_scores else 0.0
            vvi_consistency = _clamp(1.0 - (1.8 * vvi_std), 0.3, 1.0)

            seg_method_conf = float(leaf_orchard.get("segmentation_method_confidence", 0.0))
            canopy_quality = _clamp((canopy_density_score + canopy_completeness) * 0.5, 0.0, 1.0)
            vigor_reliability = _clamp(
                (0.45 * seg_method_conf) + (0.35 * canopy_quality) + (0.20 * vvi_consistency),
                0.2,
                1.0,
            )

            overlap_ratio, overlap_meta = estimate_view_overlap_ratio(
                per_image_counts=per_image_counts,
                fruit_per_mpx=float(detection_features.get("fruit_per_mpx", 0.0)),
                canopy_completeness=canopy_completeness,
                canopy_coverage_fraction=float(leaf_orchard.get("canopy_coverage_fraction", 0.0)),
                bbox_coverage_ratio=float(detection_features.get("bbox_coverage_ratio", 0.0)),
                mean_detection_confidence=float(detection_features.get("mean_confidence", 0.0)),
            )
            adjusted_count = correct_double_count(raw_count, overlap_ratio=overlap_ratio)

            bbox_coverage = float(detection_features.get("bbox_coverage_ratio", 0.0))
            occlusion_factor = _clamp(1.0 + (0.35 * max(0.0, canopy_density_score - bbox_coverage)), 0.92, 1.18)
            
            # Map canopy density to health label
            if canopy_density_score < 0.4:
                canopy_health = "sparse"
            elif canopy_density_score < 0.7:
                canopy_health = "moderate"
            else:
                canopy_health = "dense"

            # STEP 4: Calculate tree count
            if total_trees:
                final_tree_count = total_trees
                tree_count_source = "user_provided"
            else:
                if not orchard_area or not planting_density:
                    return Response(
                        {
                            "error": "Either total_trees OR (orchard_area + planting_density) must be provided."
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )
                # Convert hectares to acres if needed
                area_acres = orchard_area
                if area_unit == "hectares":
                    area_acres = orchard_area * 2.471
                
                density_map = {
                    "traditional": 125,
                    "semi_dwarf": 250,
                    "high_density": 600
                }
                final_tree_count = int(area_acres * density_map[planting_density])
                tree_count_source = "calculated"

            # STEP 5: Calculate yield
            yield_result = calculate_yield(
                adjusted_count=adjusted_count,
                ripe_pct=ripe_pct,
                midripe_pct=midripe_pct,
                unripe_pct=unripe_pct,
                variety=variety,
                tree_maturity=tree_maturity,
                canopy_factor=canopy_density_score,
                final_tree_count=final_tree_count,
                canopy_completeness=canopy_completeness,
                vigor_index=rgb_vvi_score,
                vigor_reliability=vigor_reliability,
                occlusion_factor=occlusion_factor,
                mean_fruit_confidence=float(detection_features.get("mean_confidence", 0.0)),
            )

            # Determine harvest recommendation
            if ripe_pct > 70:
                harvest_rec = "Ready to harvest within 3-5 days"
            elif ripe_pct >= 40:
                harvest_rec = "Approaching harvest, ready in 1-2 weeks"
            else:
                harvest_rec = "Not ready for harvest, continue monitoring"

            # Build response
            response_data = {
                "fruit_count": {
                    "raw_count": raw_count,
                    "adjusted_count": adjusted_count,
                    "per_image_counts": per_image_counts,
                    "overlap_ratio": round(float(overlap_ratio), 3),
                    "overlap_estimator": overlap_meta,
                },
                "ripeness": {
                    "ripe_percentage": round(ripe_pct, 2),
                    "midripe_percentage": round(midripe_pct, 2),
                    "unripe_percentage": round(unripe_pct, 2),
                    "flower_count_ignored": flower_count
                },
                "leaf_area": {
                    "canopy_density_score": round(canopy_density_score, 3),
                    "canopy_health": canopy_health,
                    "canopy_coverage_fraction": round(float(leaf_orchard.get("canopy_coverage_fraction", 0.0)), 3),
                    "canopy_completeness_score": round(float(leaf_orchard.get("canopy_completeness_score", 0.0)), 3),
                    "edge_leaf_coverage": round(float(leaf_orchard.get("edge_leaf_coverage", 0.0)), 3),
                    "segmentation_method_confidence": round(float(leaf_orchard.get("segmentation_method_confidence", 0.0)), 3),
                    "per_image": [
                        {
                            "canopy_score": round(float(item.get("canopy_score", 0.0)), 3),
                            "canopy_coverage_fraction": round(float(item.get("canopy_coverage_fraction", 0.0)), 3),
                            "edge_leaf_coverage": round(float(item.get("edge_leaf_coverage", 0.0)), 3),
                            "canopy_component_count": int(item.get("canopy_component_count", 0)),
                            "largest_component_ratio": round(float(item.get("largest_component_ratio", 0.0)), 3),
                            "canopy_completeness_score": round(float(item.get("canopy_completeness_score", 0.0)), 3),
                            "rgb_vvi_score": round(float(item.get("rgb_vvi_score", 0.0)), 3),
                            "vari_mean": round(float(item.get("vari_mean", 0.0)), 3),
                            "exg_mean": round(float(item.get("exg_mean", 0.0)), 3),
                            "ngrdi_mean": round(float(item.get("ngrdi_mean", 0.0)), 3),
                            "method": item.get("method", "model"),
                        }
                        for item in leaf_per_image_metrics
                    ]
                },
                "vegetation_vigor": {
                    "rgb_vvi_score": round(float(leaf_orchard.get("rgb_vvi_score", 0.0)), 3),
                    "vvi_reliability": round(float(vigor_reliability), 3),
                    "vvi_consistency": round(float(vvi_consistency), 3),
                    "vari_mean": round(float(leaf_orchard.get("vari_mean", 0.0)), 3),
                    "exg_mean": round(float(leaf_orchard.get("exg_mean", 0.0)), 3),
                    "ngrdi_mean": round(float(leaf_orchard.get("ngrdi_mean", 0.0)), 3),
                    "total_leaf_pixels": int(leaf_orchard.get("total_leaf_pixels", 0)),
                },
                "orchard_inputs": {
                    "variety": variety,
                    "tree_maturity": tree_maturity,
                    "final_tree_count": final_tree_count,
                    "tree_count_source": tree_count_source
                },
                "feature_vector": {
                    "adjusted_count": int(adjusted_count),
                    "ripe_ratio": round(ripe_pct / 100.0, 4),
                    "midripe_ratio": round(midripe_pct / 100.0, 4),
                    "unripe_ratio": round(unripe_pct / 100.0, 4),
                    "mean_bbox_area_px": round(float(detection_features.get("mean_bbox_area_px", 0.0)), 2),
                    "median_bbox_area_px": round(float(detection_features.get("median_bbox_area_px", 0.0)), 2),
                    "fruit_per_mpx": round(float(detection_features.get("fruit_per_mpx", 0.0)), 3),
                    "bbox_coverage_ratio": round(float(detection_features.get("bbox_coverage_ratio", 0.0)), 3),
                    "canopy_density_score": round(float(canopy_density_score), 3),
                    "canopy_completeness_score": round(float(canopy_completeness), 3),
                    "rgb_vvi_score": round(float(rgb_vvi_score), 3),
                    "overlap_ratio": round(float(overlap_ratio), 3),
                    "vvi_reliability": round(float(vigor_reliability), 3),
                    "occlusion_factor": round(float(occlusion_factor), 3),
                    "mean_detection_confidence": round(float(detection_features.get("mean_confidence", 0.0)), 3),
                },
                "yield_estimate": {
                    "per_tree_yield_kg": round(yield_result['per_tree_yield_kg'], 2),
                    "orchard_yield_kg": round(yield_result['orchard_yield_kg'], 2),
                    "orchard_yield_tonnes": round(yield_result['orchard_yield_kg'] / 1000, 2),
                    "confidence_interval": {
                        "lower_kg": round(yield_result['lower_bound'], 2),
                        "upper_kg": round(yield_result['upper_bound'], 2)
                    },
                    "uncertainty_ratio": round(float(yield_result.get('uncertainty_ratio', 0.0)), 3),
                    "factors": {
                        "weighted_mass_kg": round(float(yield_result.get('factors', {}).get('weighted_mass_kg', 0.0)), 4),
                        "maturity_factor": round(float(yield_result.get('factors', {}).get('maturity_factor', 1.0)), 3),
                        "ripeness_factor": round(float(yield_result.get('factors', {}).get('ripeness_factor', 1.0)), 3),
                        "canopy_health_factor": round(float(yield_result.get('factors', {}).get('canopy_health_factor', 1.0)), 3),
                        "vigor_factor": round(float(yield_result.get('factors', {}).get('vigor_factor', 1.0)), 3),
                        "vigor_reliability": round(float(yield_result.get('factors', {}).get('vigor_reliability', 0.0)), 3),
                        "occlusion_factor": round(float(yield_result.get('factors', {}).get('occlusion_factor', 1.0)), 3),
                        "confidence_signal": round(float(yield_result.get('factors', {}).get('confidence_signal', 0.0)), 3),
                    },
                },
                "harvest_recommendation": harvest_rec
            }

            history_result = {
                "saved": False,
                "estimation_id": None,
                "generated_task_ids": [],
            }

            orchard_id = validated_data.get("orchard_id")
            if orchard_id and getattr(request.user, "is_authenticated", False):
                try:
                    farm_profile = request.user.farm_profile
                    orchard = Orchard.objects.get(id=orchard_id, farm_profile=farm_profile)
                    history_payload = _json_safe(json.loads(json.dumps(deepcopy(response_data), default=str)))

                    estimation = EstimationRecord.objects.create(
                        orchard=orchard,
                        num_images=len(pil_images),
                        raw_fruit_count=int(raw_count),
                        adjusted_fruit_count=int(adjusted_count),
                        overlap_ratio=float(overlap_ratio),
                        ripe_percentage=float(ripe_pct),
                        midripe_percentage=float(midripe_pct),
                        unripe_percentage=float(unripe_pct),
                        canopy_density_score=float(canopy_density_score),
                        canopy_completeness_score=float(canopy_completeness),
                        rgb_vvi_score=float(rgb_vvi_score),
                        vvi_reliability=float(vigor_reliability),
                        orchard_yield_kg=float(yield_result['orchard_yield_kg']),
                        orchard_yield_tonnes=float(yield_result['orchard_yield_kg'] / 1000.0),
                        yield_uncertainty_kg=float(yield_result.get('upper_bound', 0.0) - yield_result.get('orchard_yield_kg', 0.0)),
                        full_response_json=history_payload,
                    )

                    generated_task_ids = []
                    for rule in farm_profile.task_rules.filter(is_active=True):
                        should_create = False
                        if rule.trigger_type == 'ripeness_high' and rule.ripeness_threshold is not None:
                            should_create = ripe_pct >= rule.ripeness_threshold
                        elif rule.trigger_type == 'ripeness_low' and rule.ripeness_threshold is not None:
                            should_create = ripe_pct <= rule.ripeness_threshold
                        elif rule.trigger_type == 'canopy_weak' and rule.canopy_completeness_threshold is not None:
                            should_create = canopy_completeness < rule.canopy_completeness_threshold
                        elif rule.trigger_type == 'vvi_low' and rule.vvi_threshold is not None:
                            should_create = rgb_vvi_score < rule.vvi_threshold
                        elif rule.trigger_type == 'routine':
                            should_create = True

                        if should_create:
                            task, _ = Task.objects.get_or_create(
                                farm_profile=farm_profile,
                                orchard=orchard,
                                triggered_by_rule=rule,
                                triggered_by_estimation=estimation,
                                defaults={
                                    'title': rule.task_title,
                                    'description': rule.task_description,
                                    'priority': rule.priority,
                                }
                            )
                            generated_task_ids.append(task.id)

                    history_result = {
                        "saved": True,
                        "estimation_id": estimation.id,
                        "generated_task_ids": generated_task_ids,
                    }
                except Exception as exc:
                    history_result = {
                        "saved": False,
                        "estimation_id": None,
                        "generated_task_ids": [],
                        "error": str(exc),
                    }

            response_data["history"] = history_result

            response_data["detections"] = {
                "per_image": per_image_detections,
                "settings": {
                    "conf": getattr(_fruit_counter, "conf_threshold", None),
                    "iou": getattr(_fruit_counter, "iou_threshold", None),
                    "imgsz": getattr(_fruit_counter, "img_size", None),
                    "min_side": getattr(_fruit_counter, "min_box_side_px", None),
                    "min_area": getattr(_fruit_counter, "min_box_area_px", None),
                    "tile_overlap": getattr(_fruit_counter, "tile_overlap", None),
                    "small_conf_boost": getattr(_fruit_counter, "small_box_conf_boost", None),
                    "tiny_box_area": getattr(_fruit_counter, "tiny_box_area_px", None),
                    "mode": "tiled" if getattr(_fruit_counter, "enable_tiled_inference", False) else "direct",
                    "augment": getattr(_fruit_counter, "use_test_time_augmentation", False),
                },
            }

            if include_visuals:
                visualizations = []
                for index, image in enumerate(pil_images):
                    detections = per_image_detections[index] if index < len(per_image_detections) else []
                    leaf_item = leaf_per_image[index] if index < len(leaf_per_image) else {}
                    mask = leaf_item.get("mask")

                    boxed = _draw_detection_overlay(image, detections)
                    segmented = _overlay_leaf_mask(image, mask)

                    visualizations.append(
                        {
                            "image_index": index,
                            "detected_count": len(detections),
                            "leaf_method": leaf_item.get("method", "model"),
                            "bbox_overlay_base64": _image_to_base64(boxed),
                            "leaf_overlay_base64": _image_to_base64(segmented),
                        }
                    )

                response_data["visualizations"] = visualizations

            return Response(response_data, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"error": f"Inference failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

def load_models():
    global _fruit_counter, _ripeness_classifier, _leaf_segmentation, _models_loaded

    models_dir = settings.BASE_DIR / 'models'
    print(f"Loading models from: {models_dir}")

    try:
        from .models_inference.fruit_counter import FruitCounter

        _fruit_counter = FruitCounter(model_path=os.path.join(models_dir, 'fruit_detection.pt'), device="cpu")
        print(f"✓ FruitCounter loaded: {_fruit_counter.loaded}")
    except Exception as e:
        print(f"✗ FruitCounter load failed: {e}")

    try:
        from .models_inference.ripeness_classifier import RipenessClassifier

        _ripeness_classifier = RipenessClassifier(model_path=os.path.join(models_dir, 'ripeness_classifier.pth'), device="cpu")
        print(f"✓ RipenessClassifier loaded: {_ripeness_classifier.loaded}")
    except Exception as e:
        print(f"✗ RipenessClassifier load failed: {e}")

    try:
        from .models_inference.leaf_segmentation import LeafSegmentation

        _leaf_segmentation = LeafSegmentation(model_path=os.path.join(models_dir, 'leaf_segmentation.pth'), device="cpu")
        print(f"✓ LeafSegmentation loaded: {_leaf_segmentation.loaded}")
    except Exception as e:
        print(f"✗ LeafSegmentation load failed: {e}")

    _models_loaded = all([
        _fruit_counter and _fruit_counter.loaded,
        _ripeness_classifier and _ripeness_classifier.loaded,
        _leaf_segmentation and _leaf_segmentation.loaded,
    ])

    print("✓ All models loaded" if _models_loaded else "✗ One or more models failed to load")
