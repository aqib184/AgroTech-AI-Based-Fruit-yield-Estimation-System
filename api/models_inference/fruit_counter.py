from pathlib import Path
from typing import Dict, List, Tuple, Optional

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
        self.conf_threshold = 0.47
        self.iou_threshold = 0.40
        self.img_size = 1280
        self.model = None
        self.loaded = False
        self._load_model()
    
    
    def _load_model(self):
        try:
            self.model = YOLO(str(self.model_path))
            self.model.to("cpu")
            self.loaded = True
            # Test with a dummy image
            dummy = np.zeros((640, 640, 3), dtype=np.uint8)
            test_result = self.model.predict(dummy, conf=0.25, verbose=False)
            print(f"✓ YOLO test inference: {len(test_result[0].boxes)} detections on blank image", flush=True)
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
                input_image = img.convert("RGB")
                results = self.model.predict(
                    input_image,
                    conf=self.conf_threshold,
                    iou=self.iou_threshold,
                    imgsz=self.img_size,
                    verbose=False,
                )
                num_detections = len(results[0].boxes) if results else 0
                per_image_counts.append(num_detections)
                raw_count += num_detections
    
            except Exception as e:
                print(f"⚠️ YOLO error: {e}", flush=True)
                per_image_counts.append(0)
    
        return raw_count, per_image_counts

    def detect_fruits_with_crops(
        self,
        images: List[Image.Image],
    ) -> Tuple[int, List[int], List[List[Image.Image]], List[List[Dict]]]:
        if not self.loaded or self.model is None:
            raise RuntimeError("YOLO model not loaded")
    
        raw_count = 0
        per_image_counts = []
        all_crops = []
        all_detections = []
    
        for img in images:
            try:
                image_crops = []
                image_detections = []

                input_image = img.convert("RGB")
                results = self.model.predict(
                    input_image,
                    conf=self.conf_threshold,
                    iou=self.iou_threshold,
                    imgsz=self.img_size,
                    verbose=False,
                )

                if results and len(results) > 0 and results[0].boxes is not None:
                    result = results[0]
                    num_detections = len(result.boxes)
                    per_image_counts.append(num_detections)
                    raw_count += num_detections

                    for box in result.boxes:
                        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                        conf = float(box.conf[0])

                        crop = img.crop((x1, y1, x2, y2))
                        image_crops.append(crop)
                        image_detections.append(
                            {
                                "bbox": [x1, y1, x2, y2],
                                "confidence": conf,
                                "class_id": int(box.cls[0]) if box.cls is not None else 0,
                            }
                        )

                    all_crops.append(image_crops)
                    all_detections.append(image_detections)
                else:
                    per_image_counts.append(0)
                    all_crops.append([])
                    all_detections.append([])
    
            except Exception as e:
                print(f"⚠️ YOLO error: {e}", flush=True)
                per_image_counts.append(0)
                all_crops.append([])
                all_detections.append([])
    
        return raw_count, per_image_counts, all_crops, all_detections