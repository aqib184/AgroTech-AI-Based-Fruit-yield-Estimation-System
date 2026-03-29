from rest_framework import serializers


class YieldEstimateSerializer(serializers.Serializer):
    """Validate POST request data for yield estimation."""
    
    variety = serializers.ChoiceField(
        choices=["golden_delicious", "fuji", "gala", "granny_smith", "honeycrisp", "other"],
        required=True
    )
    tree_maturity = serializers.ChoiceField(
        choices=["young", "mature", "old"],
        required=True
    )
    planting_density = serializers.ChoiceField(
        choices=["traditional", "semi_dwarf", "high_density"],
        required=True
    )
    
    total_trees = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    orchard_area = serializers.FloatField(required=False, allow_null=True, min_value=0.1)
    area_unit = serializers.ChoiceField(
        choices=["acres", "hectares"],
        required=False,
        default="acres"
    )

    def validate(self, data):
        """Ensure either total_trees OR (orchard_area + planting_density) is provided."""
        total_trees = data.get('total_trees')
        orchard_area = data.get('orchard_area')
        planting_density = data.get('planting_density')

        # If total_trees is provided, use it
        if total_trees:
            return data

        # Otherwise, require both orchard_area and planting_density
        if not orchard_area or not planting_density:
            raise serializers.ValidationError(
                "Either total_trees OR (orchard_area + planting_density) must be provided."
            )
        
        return data