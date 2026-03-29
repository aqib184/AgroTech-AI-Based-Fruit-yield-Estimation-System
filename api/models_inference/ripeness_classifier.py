from pathlib import Path
from typing import List, Dict, Optional

import torch
import torch.nn as nn
import torchvision.transforms as T
from torchvision.models import efficientnet_b0
from PIL import Image


class RipenessClassifier:
    """
    EfficientNet B0 wrapper for ripeness classification.
    Classifies fruits into: unripe, midripe, ripe, flower.
    Ignores all "flower" classifications in calculations.
    """

    def __init__(self, model_path: str, device: Optional[str] = None):
        self.model_path = Path(model_path)
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None
        self.loaded = False
        
        # Class mapping
        self.class_names = ["unripe", "midripe", "ripe", "flower"]
        
        # Preprocessing
        self.transform = T.Compose([
            T.Resize((224, 224)),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406],
                       std=[0.229, 0.224, 0.225])
        ])

        self._load_model()

    def _load_model(self):
        """Load EfficientNet B0 model from .pth file."""
        try:
            # Build EfficientNet B0 architecture
            self.model = efficientnet_b0(pretrained=False)
            
            # Replace final classifier for 4 classes
            num_ftrs = self.model.classifier[1].in_features
            self.model.classifier[1] = nn.Linear(num_ftrs, 4)  # 4 ripeness classes
            
            # Load state_dict from .pth file
            state_dict = torch.load(self.model_path, map_location=self.device, weights_only=False)
            
            # Handle if state_dict is wrapped
            if isinstance(state_dict, dict) and 'state_dict' in state_dict:
                state_dict = state_dict['state_dict']
            
            self.model.load_state_dict(state_dict, strict=False)
            self.model.to(self.device)
            self.model.eval()
            self.loaded = True
            print(f"✓ RipenessClassifier model loaded from {self.model_path}")
        except Exception as e:
            print(f"✗ Failed to load RipenessClassifier: {e}")
            self.model = None
            self.loaded = False

    @torch.no_grad()
    def classify_ripeness_from_crops(self, crop_lists: List[List[Image.Image]]) -> Dict:
        """
        Classify ripeness for cropped fruit regions.
        IMPORTANT: Completely ignore "flower" predictions.
        
        Args:
            crop_lists: List of lists of cropped fruit images
            
        Returns:
            {'ripe_percentage': float, 'midripe_percentage': float, 
             'unripe_percentage': float, 'flower_count_ignored': int}
        """
        if not self.loaded or self.model is None:
            raise RuntimeError("RipenessClassifier model not loaded")

        ripe_count = 0
        midripe_count = 0
        unripe_count = 0
        flower_count = 0

        # Flatten all crops and classify each
        for crop_list in crop_lists:
            for crop in crop_list:
                try:
                    x = self.transform(crop.convert("RGB")).unsqueeze(0).to(self.device)
                    logits = self.model(x)
                    probs = torch.softmax(logits, dim=1)
                    pred_class = torch.argmax(probs, dim=1).item()
                    pred_name = self.class_names[pred_class]

                    if pred_name == "ripe":
                        ripe_count += 1
                    elif pred_name == "midripe":
                        midripe_count += 1
                    elif pred_name == "unripe":
                        unripe_count += 1
                    elif pred_name == "flower":
                        flower_count += 1

                except Exception as e:
                    print(f"⚠️  Skipped crop: {e}")

        # Calculate percentages (excluding flowers)
        total_classified = ripe_count + midripe_count + unripe_count

        if total_classified == 0:
            return {
                'ripe_percentage': 0.0,
                'midripe_percentage': 0.0,
                'unripe_percentage': 0.0,
                'flower_count_ignored': flower_count
            }

        return {
            'ripe_percentage': (ripe_count / total_classified) * 100,
            'midripe_percentage': (midripe_count / total_classified) * 100,
            'unripe_percentage': (unripe_count / total_classified) * 100,
            'flower_count_ignored': flower_count
        }