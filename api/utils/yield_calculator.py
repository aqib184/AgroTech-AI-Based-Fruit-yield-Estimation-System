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


def calculate_yield(
    adjusted_count: int,
    ripe_pct: float,
    midripe_pct: float,
    unripe_pct: float,
    variety: str,
    tree_maturity: str,
    canopy_factor: float,
    final_tree_count: int
) -> Dict:
    """
    Calculate yield estimate using the proprietary formula.
    
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
        {
            'per_tree_yield_kg': float,
            'orchard_yield_kg': float,
            'lower_bound': float,  # 85% confidence interval
            'upper_bound': float   # 115% confidence interval
        }
    """
    
    # Get variety mass data
    masses = VARIETY_MASSES.get(variety, VARIETY_MASSES["other"])
    
    # Calculate weighted average mass (grams)
    weighted_mass_g = (
        (ripe_pct / 100) * masses["ripe"] +
        (midripe_pct / 100) * masses["midripe"] +
        (unripe_pct / 100) * masses["unripe"]
    )
    
    # Convert to kg
    weighted_mass_kg = weighted_mass_g / 1000
    
    # Get maturity factor
    maturity_factor = MATURITY_FACTORS.get(tree_maturity, 1.0)
    
    # Calculate per-tree yield
    per_tree_yield_kg = adjusted_count * weighted_mass_kg * canopy_factor
    
    # Calculate orchard yield
    orchard_yield_kg = per_tree_yield_kg * final_tree_count * maturity_factor
    
    # Calculate confidence interval (±15%)
    lower_bound = orchard_yield_kg * 0.85
    upper_bound = orchard_yield_kg * 1.15
    
    return {
        'per_tree_yield_kg': per_tree_yield_kg,
        'orchard_yield_kg': orchard_yield_kg,
        'lower_bound': lower_bound,
        'upper_bound': upper_bound
    }