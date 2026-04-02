from pathlib import Path
from typing import List, Tuple, Optional

import cv2
import numpy as np
from PIL import Image
from ultralytics import YOLO


class FruitCounter:
    """
    YOLOv11 wrapper for fruit detection.
    Returns bounding boxes and fruit counts per image.
    """

    def __init__(self, model_path: str, device: Optional[str] = None):
        self.model_path = Path(model_path)
        self.device = device or 0  # 0 for GPU, "cpu" for CPU
        self.model = None
        self.loaded = False
        self._load_model()

    def _load_model(self):
        try:
            print(f"Loading YOLO from: {self.model_path}")
            print(f"Model file exists: {self.model_path.exists()}")
            print(f"Model file size: {self.model_path.stat().st_size if self.model_path.exists() else 'NOT FOUND'}")
            self.model = YOLO(str(self.model_path))
            self.model.to("cpu")
            self.loaded = True
            print(f"✓ YOLOv11 loaded successfully")
        except Exception as e:
            print(f"✗ Failed to load YOLOv11: {e}")
            self.model = None
            self.loaded = False

    def detect_fruits(self, images: List[Image.Image]) -> Tuple[int, List[int]]:
        """
        Run YOLO on all images and return total + per-image fruit counts.
        
        Args:
            images: List of PIL Image objects
            
        Returns:
            (raw_total_count, per_image_counts)
        """
        if not self.loaded or self.model is None:
            raise RuntimeError("YOLO model not loaded")

        raw_count = 0
        per_image_counts = []

        for img in images:
            try:
                # Convert PIL to numpy array
                img_array = np.array(img)

                # Run inference
                results = self.model.predict(img_array, conf=0.25, verbose=False)

                # Extract detections from first result
                if results and len(results) > 0:
                    result = results[0]
                    # result.boxes contains all detections
                    num_detections = len(result.boxes)
                    per_image_counts.append(num_detections)
                    raw_count += num_detections
                else:
                    per_image_counts.append(0)

            except Exception as e:
                print(f"⚠️  Skipped image due to YOLO error: {e}")
                per_image_counts.append(0)

        return raw_count, per_image_counts

    def detect_fruits_with_crops(self, images: List[Image.Image]) -> Tuple[int, List[int], List[List[Image.Image]]]:
        """
        Run YOLO and also return cropped fruit regions for ripeness classification.
        
        Args:
            images: List of PIL Image objects
            
        Returns:
            (raw_total_count, per_image_counts, list_of_crop_lists)
        """
        if not self.loaded or self.model is None:
            raise RuntimeError("YOLO model not loaded")

        raw_count = 0
        per_image_counts = []
        all_crops = []

        for img in images:
            try:
                img_array = np.array(img)
                img_h, img_w = img_array.shape[:2]

                # Run inference
                results = self.model.predict(img_array, conf=0.4, verbose=False)
                image_crops = []

                if results and len(results) > 0:
                    result = results[0]
                    num_detections = len(result.boxes)
                    per_image_counts.append(num_detections)
                    raw_count += num_detections

                    # Extract bounding boxes and crop regions
                    for box in result.boxes:
                        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                        
                        # Clamp to image bounds
                        x1 = max(0, x1)
                        y1 = max(0, y1)
                        x2 = min(img_w, x2)
                        y2 = min(img_h, y2)

                        # Crop from original PIL image
                        crop = img.crop((x1, y1, x2, y2))
                        image_crops.append(crop)

                    all_crops.append(image_crops)
                else:
                    per_image_counts.append(0)
                    all_crops.append([])

            except Exception as e:
                print(f"⚠️  Skipped image due to YOLO error: {e}")
                per_image_counts.append(0)
                all_crops.append([])

        return raw_count, per_image_counts, all_crops