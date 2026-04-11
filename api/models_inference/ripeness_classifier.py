from pathlib import Path
from typing import List, Dict, Optional

import torch
import torch.nn as nn
import torchvision.transforms as T
from torchvision.models import efficientnet_b0
from PIL import Image

try:
    import timm
except Exception:
    timm = None


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
        # User-provided training label order.
        self.class_names = ["midripe", "ripe", "unripe", "flower"]
        
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
            # Build torchvision EfficientNet by default.
            self.model = efficientnet_b0(weights=None)

            # Replace final classifier for 4 classes
            num_ftrs = self.model.classifier[1].in_features
            self.model.classifier[1] = nn.Linear(num_ftrs, 4)  # 4 ripeness classes
            
            # Load checkpoint and allow optional class metadata.
            checkpoint = torch.load(self.model_path, map_location=self.device, weights_only=False)

            state_dict = checkpoint
            if isinstance(checkpoint, dict) and 'state_dict' in checkpoint:
                state_dict = checkpoint['state_dict']

            if isinstance(state_dict, dict):
                cleaned = {}
                for key, value in state_dict.items():
                    new_key = key.replace("module.", "")
                    if new_key.startswith("model."):
                        new_key = new_key[len("model."):]
                    cleaned[new_key] = value
                state_dict = cleaned

            if isinstance(checkpoint, dict):
                class_names = checkpoint.get('class_names') or checkpoint.get('classes')
                if isinstance(class_names, (list, tuple)) and len(class_names) == 4:
                    self.class_names = [str(name).lower() for name in class_names]

            current_keys = set(self.model.state_dict().keys())
            incoming_keys = set(state_dict.keys()) if isinstance(state_dict, dict) else set()
            overlap = len(current_keys & incoming_keys)
            overlap_ratio = overlap / max(1, len(current_keys))

            # If keys look like timm EfficientNet, switch to matching architecture.
            if overlap_ratio < 0.2 and any(k.startswith("conv_stem") for k in incoming_keys):
                if timm is None:
                    raise RuntimeError(
                        "timm-style checkpoint detected, but timm is not installed."
                    )
                self.model = timm.create_model("efficientnet_b0", pretrained=False, num_classes=4)
                current_keys = set(self.model.state_dict().keys())
                overlap = len(current_keys & incoming_keys)
                overlap_ratio = overlap / max(1, len(current_keys))

            if overlap_ratio < 0.6:
                raise RuntimeError(
                    f"Checkpoint/state_dict mismatch: only {overlap_ratio:.1%} key overlap."
                )

            load_info = self.model.load_state_dict(state_dict, strict=False)
            self.model.to(self.device)
            self.model.eval()
            self.loaded = True
            print(f"✓ RipenessClassifier model loaded from {self.model_path}")
            print(f"✓ Ripeness classes: {self.class_names}")
            if load_info.missing_keys or load_info.unexpected_keys:
                print(
                    f"⚠️ Ripeness partial load: missing={len(load_info.missing_keys)}, "
                    f"unexpected={len(load_info.unexpected_keys)}"
                )
        except Exception as e:
            print(f"✗ Failed to load RipenessClassifier: {e}")
            self.model = None
            self.loaded = False

    def _normalize_label(self, raw_label: str) -> str:
        label = str(raw_label).strip().lower().replace("-", "_")
        alias_map = {
            "half_ripe": "midripe",
            "semi_ripe": "midripe",
            "medium_ripe": "midripe",
            "middle_ripe": "midripe",
            "not_ripe": "unripe",
            "immature": "unripe",
            "fully_ripe": "ripe",
            "blossom": "flower",
            "flowers": "flower",
            "bloom": "flower",
            "ripe_fruit": "ripe",
            "unripe_fruit": "unripe",
        }
        return alias_map.get(label, label)

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

        summary = self.classify_with_details(crop_lists)
        return {
            'ripe_percentage': summary['ripe_percentage'],
            'midripe_percentage': summary['midripe_percentage'],
            'unripe_percentage': summary['unripe_percentage'],
            'flower_count_ignored': summary['flower_count_ignored'],
        }

    @torch.no_grad()
    def classify_with_details(self, crop_lists: List[List[Image.Image]]) -> Dict:
        ripe_count = 0
        midripe_count = 0
        unripe_count = 0
        flower_count = 0
        per_crop_predictions = []

        # Flatten all crops and classify each
        for crop_list in crop_lists:
            image_predictions = []
            for crop in crop_list:
                try:
                    x = self.transform(crop.convert("RGB")).unsqueeze(0).to(self.device)
                    logits = self.model(x)
                    probs = torch.softmax(logits, dim=1)
                    pred_class = torch.argmax(probs, dim=1).item()
                    pred_conf = float(probs[0, pred_class].item())

                    pred_name = self.class_names[pred_class] if pred_class < len(self.class_names) else str(pred_class)
                    pred_name = self._normalize_label(pred_name)

                    if pred_name == "ripe":
                        ripe_count += 1
                    elif pred_name == "midripe":
                        midripe_count += 1
                    elif pred_name == "unripe":
                        unripe_count += 1
                    elif pred_name == "flower":
                        flower_count += 1
                    else:
                        # Unknown labels are treated as midripe to avoid silently dropping fruit.
                        midripe_count += 1
                        pred_name = "midripe"

                    image_predictions.append(
                        {
                            "label": pred_name,
                            "confidence": pred_conf,
                        }
                    )

                except Exception as e:
                    print(f"⚠️  Skipped crop: {e}")
                    image_predictions.append({"label": "unknown", "confidence": 0.0})

            per_crop_predictions.append(image_predictions)

        # Calculate percentages (excluding flowers)
        total_classified = ripe_count + midripe_count + unripe_count

        if total_classified == 0:
            return {
                'ripe_percentage': 0.0,
                'midripe_percentage': 0.0,
                'unripe_percentage': 0.0,
                'flower_count_ignored': flower_count,
                'per_crop_predictions': per_crop_predictions,
            }

        return {
            'ripe_percentage': (ripe_count / total_classified) * 100,
            'midripe_percentage': (midripe_count / total_classified) * 100,
            'unripe_percentage': (unripe_count / total_classified) * 100,
            'flower_count_ignored': flower_count,
            'per_crop_predictions': per_crop_predictions,
        }