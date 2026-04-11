from typing import Dict


# Variety mass table (grams)
VARIETY_MASSES = {
    "golden_delicious": {"ripe": 180, "midripe": 140, "unripe": 90},
    "fuji":             {"ripe": 200, "midripe": 155, "unripe": 100},
    "gala":             {"ripe": 160, "midripe": 125, "unripe": 80},
    "granny_smith":     {"ripe": 170, "midripe": 130, "unripe": 85},
    "honeycrisp":       {"ripe": 210, "midripe": 165, "unripe": 105},
    "other":            {"ripe": 175, "midripe": 138, "unripe": 90}
}

# Maturity correction factors
MATURITY_FACTORS = {
    "young": 0.6,
    "mature": 1.0,
    "old": 0.85
}


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, float(value)))


def calculate_yield(
    adjusted_count: int,
    ripe_pct: float,
    midripe_pct: float,
    unripe_pct: float,
    variety: str,
    tree_maturity: str,
    canopy_factor: float,
    final_tree_count: int,
    canopy_completeness: float = 0.5,
    vigor_index: float = 0.5,
    vigor_reliability: float = 0.6,
    occlusion_factor: float = 1.0,
    mean_fruit_confidence: float = 0.75,
) -> Dict:
    """
    Calculate yield estimate using a multi-factor orchard model.
    
    Args:
        adjusted_count: Fruit count after double-count correction
        ripe_pct: Percentage of ripe fruits (0-100)
        midripe_pct: Percentage of midripe fruits (0-100)
        unripe_pct: Percentage of unripe fruits (0-100)
        variety: Apple variety name
        tree_maturity: Tree age category
        canopy_factor: Canopy density score (0-1)
        final_tree_count: Total number of trees in orchard
        
    Returns:
        Dictionary with point estimate, confidence bounds, and factor breakdown.
    """

    # Get variety mass data
    masses = VARIETY_MASSES.get(variety, VARIETY_MASSES["other"])

    # Calculate weighted average mass (grams)
    ripe_share = ripe_pct / 100.0
    midripe_share = midripe_pct / 100.0
    unripe_share = unripe_pct / 100.0

    weighted_mass_g = (
        ripe_share * masses["ripe"] +
        midripe_share * masses["midripe"] +
        unripe_share * masses["unripe"]
    )

    # Convert to kg
    weighted_mass_kg = weighted_mass_g / 1000

    # Get maturity factor
    maturity_factor = MATURITY_FACTORS.get(tree_maturity, 1.0)

    # Ripeness raises expected marketable mass while unripe share lowers short-term harvest value.
    ripeness_factor = _clamp(
        0.88 + (0.24 * ripe_share) + (0.12 * midripe_share) - (0.06 * unripe_share),
        0.82,
        1.12,
    )
    canopy_health_factor = _clamp(
        0.82 + (0.22 * canopy_factor) + (0.08 * canopy_completeness),
        0.78,
        1.15,
    )
    base_vigor_factor = _clamp(0.94 + (0.12 * vigor_index), 0.94, 1.06)
    vigor_reliability = _clamp(vigor_reliability, 0.0, 1.0)
    # Keep RGB-VVI as a secondary signal by shrinking its effect when reliability is low.
    vigor_factor = 1.0 + ((base_vigor_factor - 1.0) * vigor_reliability)
    vigor_factor = _clamp(vigor_factor, 0.94, 1.06)
    occlusion_factor = _clamp(occlusion_factor, 0.90, 1.20)

    # Yield per tree uses visible fruits scaled by maturity, canopy, vigor, and occlusion adjustments.
    per_tree_yield_kg = (
        adjusted_count
        * weighted_mass_kg
        * ripeness_factor
        * canopy_health_factor
        * vigor_factor
        * occlusion_factor
    )

    orchard_yield_kg = per_tree_yield_kg * final_tree_count * maturity_factor

    # Uncertainty narrows when detector confidence and canopy quality are strong.
    confidence_signal = _clamp(
        (0.5 * mean_fruit_confidence) + (0.3 * canopy_completeness) + (0.2 * canopy_factor),
        0.0,
        1.0,
    )
    uncertainty_ratio = _clamp(0.24 - (0.14 * confidence_signal), 0.10, 0.24)
    lower_bound = orchard_yield_kg * (1.0 - uncertainty_ratio)
    upper_bound = orchard_yield_kg * (1.0 + uncertainty_ratio)

    return {
        'per_tree_yield_kg': per_tree_yield_kg,
        'orchard_yield_kg': orchard_yield_kg,
        'lower_bound': lower_bound,
        'upper_bound': upper_bound,
        'uncertainty_ratio': uncertainty_ratio,
        'factors': {
            'weighted_mass_kg': weighted_mass_kg,
            'maturity_factor': maturity_factor,
            'ripeness_factor': ripeness_factor,
            'canopy_health_factor': canopy_health_factor,
            'vigor_factor': vigor_factor,
            'vigor_reliability': vigor_reliability,
            'occlusion_factor': occlusion_factor,
            'confidence_signal': confidence_signal,
        },
    }