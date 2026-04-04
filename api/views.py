from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from PIL import Image
import io

from .serializers import YieldEstimateSerializer
from .models_inference.fruit_counter import FruitCounter
from .models_inference.ripeness_classifier import RipenessClassifier
from .models_inference.leaf_segmentation import LeafSegmentation
from .utils.yield_calculator import calculate_yield
from .utils.double_count import correct_double_count



# Global model instances — loaded once at startup
import os

# Global model instances — loaded once at startup
_fruit_counter = None
_ripeness_classifier = None
_leaf_segmentation = None
_models_loaded = False

# Load models immediately at module import
def load_models():
    """Load all three models once at server startup."""
    global _fruit_counter, _ripeness_classifier, _leaf_segmentation, _models_loaded

    models_dir = '/app/models'

    print(f"Loading models from: {models_dir}")
    print(f"fruit_detection.pt exists: {os.path.exists(os.path.join(models_dir, 'fruit_detection.pt'))}")
    print(f"ripeness_classifier.pth exists: {os.path.exists(os.path.join(models_dir, 'ripeness_classifier.pth'))}")
    print(f"leaf_segmentation.pth exists: {os.path.exists(os.path.join(models_dir, 'leaf_segmentation.pth'))}")

    _fruit_counter = FruitCounter(
        model_path=os.path.join(models_dir, 'fruit_detection.pt'),
        device="cpu"
    )
    _ripeness_classifier = RipenessClassifier(
        model_path=os.path.join(models_dir, 'ripeness_classifier.pth'),
        device="cpu"
    )
    _leaf_segmentation = LeafSegmentation(
        model_path=os.path.join(models_dir, 'leaf_segmentation.pth'),
        device="cpu"
    )

    _models_loaded = all([
        _fruit_counter and _fruit_counter.loaded,
        _ripeness_classifier and _ripeness_classifier.loaded,
        _leaf_segmentation and _leaf_segmentation.loaded,
    ])

    print("✓ All models loaded" if _models_loaded else "✗ One or more models failed to load")

# Call immediately when module is imported
load_models()


class HealthCheckView(APIView):
    """
    GET /api/health/
    Returns model load status.
    """
    def get(self, request):
        return Response({
            "status": "healthy" if _models_loaded else "unhealthy",
            "fruit_detection_model": "loaded" if _fruit_counter and _fruit_counter.loaded else "not_loaded",
            "ripeness_classifier_model": "loaded" if _ripeness_classifier and _ripeness_classifier.loaded else "not_loaded",
            "leaf_segmentation_model": "loaded" if _leaf_segmentation and _leaf_segmentation.loaded else "not_loaded",
        }, status=status.HTTP_200_OK if _models_loaded else status.HTTP_503_SERVICE_UNAVAILABLE)


class DebugView(APIView):
    def get(self, request):
        import os
        app_dir = '/app'
        result = {}
        for root, dirs, files in os.walk(app_dir):
            dirs[:] = [d for d in dirs if d not in ['__pycache__', 'venv', '.git']]
            for file in files:
                if file.endswith(('.pt', '.pth')):
                    full_path = os.path.join(root, file)
                    result[full_path] = os.path.getsize(full_path)
        return Response({
            "model_files_found": result,
            "app_contents": os.listdir('/app'),
        })

class YieldEstimateView(APIView):
    """
    POST /api/predict/yield/
    Accepts multipart form data with images and orchard details.
    """
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
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

        # Debug: print what we actually received
        print(f"FILES received: {dict(request.FILES)}")
        print(f"DATA received: {dict(request.data)}")
        print(f"Image files found: {len(image_files)}")

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
                pil_images.append(Image.open(io.BytesIO(img_file.read())).convert('RGB'))
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
            raw_count, per_image_counts, all_crops = _fruit_counter.detect_fruits_with_crops(pil_images)

            # STEP 2: Double Count Correction
            adjusted_count = correct_double_count(raw_count)

            # STEP 3: Ripeness Classification (EfficientNet B0) on cropped fruits
            ripeness_data = _ripeness_classifier.classify_ripeness_from_crops(all_crops)
            ripe_pct = ripeness_data['ripe_percentage']
            midripe_pct = ripeness_data['midripe_percentage']
            unripe_pct = ripeness_data['unripe_percentage']
            flower_count = ripeness_data['flower_count_ignored']

            # STEP 4: Leaf Area Segmentation (DeepLabv3+)
            canopy_density_score = _leaf_segmentation.predict_batch(pil_images)
            
            # Map canopy density to health label
            if canopy_density_score < 0.4:
                canopy_health = "sparse"
            elif canopy_density_score < 0.7:
                canopy_health = "moderate"
            else:
                canopy_health = "dense"

            # STEP 5: Calculate tree count
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

            # STEP 6: Calculate yield
            yield_result = calculate_yield(
                adjusted_count=adjusted_count,
                ripe_pct=ripe_pct,
                midripe_pct=midripe_pct,
                unripe_pct=unripe_pct,
                variety=variety,
                tree_maturity=tree_maturity,
                canopy_factor=canopy_density_score,
                final_tree_count=final_tree_count
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
                    "per_image_counts": per_image_counts
                },
                "ripeness": {
                    "ripe_percentage": round(ripe_pct, 2),
                    "midripe_percentage": round(midripe_pct, 2),
                    "unripe_percentage": round(unripe_pct, 2),
                    "flower_count_ignored": flower_count
                },
                "leaf_area": {
                    "canopy_density_score": round(canopy_density_score, 3),
                    "canopy_health": canopy_health
                },
                "orchard_inputs": {
                    "variety": variety,
                    "tree_maturity": tree_maturity,
                    "final_tree_count": final_tree_count,
                    "tree_count_source": tree_count_source
                },
                "yield_estimate": {
                    "per_tree_yield_kg": round(yield_result['per_tree_yield_kg'], 2),
                    "orchard_yield_kg": round(yield_result['orchard_yield_kg'], 2),
                    "orchard_yield_tonnes": round(yield_result['orchard_yield_kg'] / 1000, 2),
                    "confidence_interval": {
                        "lower_kg": round(yield_result['lower_bound'], 2),
                        "upper_kg": round(yield_result['upper_bound'], 2)
                    }
                },
                "harvest_recommendation": harvest_rec
            }

            return Response(response_data, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"error": f"Inference failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )