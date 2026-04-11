from typing import Dict, List, Tuple


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, float(value)))


def estimate_view_overlap_ratio(
    per_image_counts: List[int],
    fruit_per_mpx: float,
    canopy_completeness: float,
    canopy_coverage_fraction: float,
    bbox_coverage_ratio: float,
    mean_detection_confidence: float,
) -> Tuple[float, Dict]:
    """
    Estimate front/back overlap ratio for adaptive double-count correction.

    Preferred mode is a pair of views (front + back) for a single tree.
    For any other number of images, a safe fallback overlap ratio is used.
    """
    if len(per_image_counts) == 2:
        front_count = int(per_image_counts[0])
        back_count = int(per_image_counts[1])
        pair_total = max(1, front_count + back_count)

        # Similar view counts suggest stronger overlap between front/back captures.
        view_similarity = 1.0 - abs(front_count - back_count) / pair_total
        view_similarity = _clamp(view_similarity, 0.0, 1.0)

        # Density and canopy cues increase expected overlap when canopy is dense/connected.
        density_signal = _clamp(fruit_per_mpx / 140.0, 0.0, 1.0)
        canopy_overlap_proxy = _clamp(
            (0.45 * canopy_completeness) + (0.30 * canopy_coverage_fraction) + (0.25 * bbox_coverage_ratio),
            0.0,
            1.0,
        )
        confidence_signal = _clamp((mean_detection_confidence - 0.35) / 0.45, 0.0, 1.0)

        overlap_ratio = (
            0.25
            + (0.14 * density_signal)
            + (0.10 * canopy_overlap_proxy)
            + (0.06 * view_similarity)
            + (0.03 * confidence_signal)
        )
        overlap_ratio = _clamp(overlap_ratio, 0.25, 0.55)

        meta = {
            "method": "pair_overlap_estimator",
            "front_count": front_count,
            "back_count": back_count,
            "view_similarity": view_similarity,
            "density_signal": density_signal,
            "canopy_overlap_proxy": canopy_overlap_proxy,
            "confidence_signal": confidence_signal,
        }
        return overlap_ratio, meta

    # Fallback for non-paired workflows (single image or >2 images).
    return 0.40, {
        "method": "fixed_fallback",
        "reason": "pair estimator requires exactly 2 images",
    }


def correct_double_count(raw_count: int, overlap_ratio: float = 0.40) -> int:
    """
    Apply overlap-based double-count correction.

    Formula: adjusted_count = raw_count * (1 - overlap_ratio)
    """
    overlap_ratio = _clamp(overlap_ratio, 0.0, 0.95)
    adjusted_count = int(round(raw_count * (1.0 - overlap_ratio)))
    return max(0, adjusted_count)