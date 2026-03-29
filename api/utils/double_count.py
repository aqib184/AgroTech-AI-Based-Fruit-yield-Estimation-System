def correct_double_count(raw_count: int) -> int:
    """
    Apply double-count correction formula.
    Corrects for fruits visible in both front and back photos.
    
    Formula: adjusted_count = raw_count * 0.6
    
    Args:
        raw_count: Total fruit count from YOLO across all images
        
    Returns:
        Adjusted fruit count
    """
    adjusted_count = int(raw_count * 0.6)
    return adjusted_count