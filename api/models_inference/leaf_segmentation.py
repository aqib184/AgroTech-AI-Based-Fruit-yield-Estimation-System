from pathlib import Path
from typing import Dict, List, Optional
import pathlib
import pickle
import types

import numpy as np
import cv2
from PIL import Image
import torch
import torch.nn as nn
import torchvision.transforms as T

try:
    import segmentation_models_pytorch as smp
except Exception:
    smp = None


class DoubleConv(nn.Module):
    def __init__(self, in_ch: int, out_ch: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
        )

    def forward(self, x):
        return self.net(x)


class UNet(nn.Module):
    def __init__(self, in_channels: int = 3, out_channels: int = 1, features=(64, 128, 256, 512)):
        super().__init__()
        self.downs = nn.ModuleList()
        self.ups = nn.ModuleList()
        self.pool = nn.MaxPool2d(2, 2)

        ch = in_channels
        for f in features:
            self.downs.append(DoubleConv(ch, f))
            ch = f

        self.bottleneck = DoubleConv(features[-1], features[-1] * 2)

        rev = features[::-1]
        up_ch = features[-1] * 2
        for f in rev:
            self.ups.append(nn.ConvTranspose2d(up_ch, f, kernel_size=2, stride=2))
            self.ups.append(DoubleConv(f * 2, f))
            up_ch = f

        self.final_conv = nn.Conv2d(features[0], out_channels, kernel_size=1)

    def forward(self, x):
        skips = []
        for down in self.downs:
            x = down(x)
            skips.append(x)
            x = self.pool(x)

        x = self.bottleneck(x)
        skips = skips[::-1]

        for i in range(0, len(self.ups), 2):
            x = self.ups[i](x)
            skip = skips[i // 2]
            if x.shape[-2:] != skip.shape[-2:]:
                x = torch.nn.functional.interpolate(x, size=skip.shape[-2:], mode="bilinear", align_corners=False)
            x = torch.cat([skip, x], dim=1)
            x = self.ups[i + 1](x)

        return self.final_conv(x)


class LeafSegmentation:
    def __init__(self, model_path: str, device: Optional[str] = None):
        self.model_path = Path(model_path)
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None
        self.loaded = False

        # Multi-scale inference recovers small and edge foliage that 256x256 alone may miss.
        self.inference_sizes = [256, 384]
        self.use_flip_tta = True
        self.mask_threshold = 0.50
        self.green_prior_strength = 0.35
        self.score_weight_binary = 0.55
        self.score_weight_mean = 0.30
        self.score_weight_green = 0.15

        self._load_model()

    def _green_coverage_fallback(self, pil_image: Image.Image) -> float:
        # HSV-based fallback estimate used only when model output is invalid.
        rgb = np.array(pil_image.convert("RGB"))
        hsv = rgb.astype(np.float32)
        hsv = hsv / 255.0

        r = hsv[:, :, 0]
        g = hsv[:, :, 1]
        b = hsv[:, :, 2]

        # Simple vegetation heuristic in RGB space.
        green_mask = (g > r * 1.05) & (g > b * 1.05) & (g > 0.2)
        return float(np.mean(green_mask)) if green_mask.size else 0.0

    def _green_mask_resized(self, pil_image: Image.Image, size_hw) -> np.ndarray:
        img = pil_image.convert("RGB").resize((size_hw[1], size_hw[0]), Image.BILINEAR)
        rgb = np.array(img).astype(np.float32) / 255.0
        r = rgb[:, :, 0]
        g = rgb[:, :, 1]
        b = rgb[:, :, 2]
        return ((g > r * 1.05) & (g > b * 1.05) & (g > 0.2)).astype(np.uint8)

    def _choose_prob_map(self, out: torch.Tensor, pil_image: Image.Image) -> Optional[torch.Tensor]:
        if out.ndim == 4 and out.shape[1] == 1:
            return torch.sigmoid(out[:, 0, :, :])

        if out.ndim == 4 and out.shape[1] >= 2:
            probs = torch.softmax(out, dim=1)
            candidates = [probs[:, i, :, :] for i in range(min(out.shape[1], 3))]

            best = None
            best_score = -1.0
            green_mask = self._green_mask_resized(pil_image, candidates[0].shape[-2:])
            green_area = float(np.mean(green_mask))

            for cand in candidates:
                cand_np = cand.squeeze(0).detach().cpu().numpy()
                bin_mask = (cand_np >= 0.5).astype(np.uint8)
                union = np.logical_or(bin_mask == 1, green_mask == 1).sum()
                inter = np.logical_and(bin_mask == 1, green_mask == 1).sum()
                iou = float(inter / union) if union > 0 else 0.0

                area = float(np.mean(bin_mask))
                # Penalize channels that paint almost entire image as canopy.
                saturation_penalty = 0.4 if area > 0.95 and green_area < 0.9 else 0.0
                score = iou - saturation_penalty

                if score > best_score:
                    best_score = score
                    best = cand

            return best

        if out.ndim == 3:
            return torch.sigmoid(out)

        return None

    
    def _safe_torch_load(self, path: str):
        class _PathFixUnpickler(pickle.Unpickler):
            def find_class(self, module, name):
                if module == "pathlib" and name == "PosixPath":
                    return pathlib.WindowsPath
                return super().find_class(module, name)

        pickle_module = types.ModuleType("pickle_pathfix")
        pickle_module.Unpickler = _PathFixUnpickler
        pickle_module.Pickler = pickle.Pickler
        pickle_module.dump = pickle.dump
        pickle_module.dumps = pickle.dumps
        pickle_module.load = pickle.load
        pickle_module.loads = pickle.loads

        return torch.load(path, map_location=self.device, weights_only=False, pickle_module=pickle_module)

    def _extract_state_dict(self, obj):
        if isinstance(obj, dict):
            for key in ["state_dict", "model_state_dict", "model"]:
                if key in obj and isinstance(obj[key], dict):
                    return obj[key]
        if isinstance(obj, dict):
            return obj
        return None

    def _clean_state_dict(self, sd: dict):
        return {k.replace("module.", ""): v for k, v in sd.items()}

    def _load_model(self):
        try:
            # Try TorchScript first
            try:
                ts_model = torch.jit.load(str(self.model_path), map_location=self.device)
                ts_model.eval()
                self.model = ts_model
                self.loaded = True
                print(f"✓ LeafSegmentation TorchScript loaded: {self.model_path}")
                return
            except Exception:
                pass

            # Use safe loader for PosixPath issue
            ckpt = self._safe_torch_load(str(self.model_path))

            if isinstance(ckpt, nn.Module):
                ckpt.to(self.device).eval()
                self.model = ckpt
                self.loaded = True
                print(f"✓ LeafSegmentation nn.Module loaded: {self.model_path}")
                return

            state_dict = self._extract_state_dict(ckpt)
            if state_dict is None:
                raise RuntimeError("Unsupported checkpoint format for leaf segmentation model.")

            state_dict = self._clean_state_dict(state_dict)

            # SMP Unet checkpoints have encoder/decoder/segmentation_head keys.
            if any(k.startswith("encoder.") for k in state_dict.keys()) and any(
                k.startswith("decoder.") for k in state_dict.keys()
            ):
                if smp is None:
                    raise RuntimeError(
                        "segmentation_models_pytorch checkpoint detected, but package is not installed."
                    )

                smp_model = smp.Unet(
                    encoder_name="resnet50",
                    encoder_weights=None,
                    in_channels=3,
                    classes=1,
                    decoder_attention_type="scse",
                )
                load_info = smp_model.load_state_dict(state_dict, strict=False)

                overlap = len(set(smp_model.state_dict().keys()) & set(state_dict.keys()))
                overlap_ratio = overlap / max(1, len(smp_model.state_dict()))
                if overlap_ratio < 0.6:
                    raise RuntimeError(f"Leaf SMP state_dict mismatch: only {overlap_ratio:.1%} key overlap")

                smp_model.to(self.device).eval()
                self.model = smp_model
                self.loaded = True
                print(f"✓ LeafSegmentation SMP Unet loaded: {self.model_path}")
                if load_info.missing_keys or load_info.unexpected_keys:
                    print(
                        f"⚠️ Leaf SMP partial load: missing={len(load_info.missing_keys)}, "
                        f"unexpected={len(load_info.unexpected_keys)}"
                    )
                return

            out_channels = 1
            final_keys = [k for k in state_dict.keys() if k.endswith("final_conv.weight")]
            if final_keys:
                out_channels = state_dict[final_keys[0]].shape[0]

            model = UNet(in_channels=3, out_channels=out_channels)
            load_info = model.load_state_dict(state_dict, strict=False)

            overlap = len(set(model.state_dict().keys()) & set(state_dict.keys()))
            overlap_ratio = overlap / max(1, len(model.state_dict()))
            if overlap_ratio < 0.4:
                raise RuntimeError(f"Leaf state_dict mismatch: only {overlap_ratio:.1%} key overlap")

            model.to(self.device).eval()

            self.model = model
            self.loaded = True
            print(f"✓ LeafSegmentation state_dict loaded: {self.model_path}")
            if load_info.missing_keys or load_info.unexpected_keys:
                print(
                    f"⚠️ Leaf partial load: missing={len(load_info.missing_keys)}, "
                    f"unexpected={len(load_info.unexpected_keys)}"
                )

        except Exception as e:
            self.model = None
            self.loaded = False
            print(f"✗ Failed to load LeafSegmentation: {e}")

    @torch.no_grad()
    def predict_image(self, pil_image: Image.Image) -> Optional[float]:
        result = self.predict_image_with_mask(pil_image)
        return None if result is None else result["canopy_score"]

    @torch.no_grad()
    def _predict_prob_map(self, pil_image: Image.Image, size: int) -> Optional[np.ndarray]:
        transform = T.Compose([
            T.Resize((size, size)),
            T.ToTensor(),
        ])

        x = transform(pil_image.convert("RGB")).unsqueeze(0).to(self.device)
        out = self.model(x)

        if isinstance(out, dict) and "out" in out:
            out = out["out"]
        if isinstance(out, (list, tuple)):
            out = out[0]

        prob = self._choose_prob_map(out, pil_image)
        if prob is None:
            return None

        prob_map = prob.squeeze(0).detach().cpu().numpy()

        if self.use_flip_tta:
            x_flip = torch.flip(x, dims=[3])
            out_flip = self.model(x_flip)
            if isinstance(out_flip, dict) and "out" in out_flip:
                out_flip = out_flip["out"]
            if isinstance(out_flip, (list, tuple)):
                out_flip = out_flip[0]

            prob_flip = self._choose_prob_map(out_flip, pil_image)
            if prob_flip is not None:
                prob_flip_map = prob_flip.squeeze(0).detach().cpu().numpy()
                prob_flip_map = np.flip(prob_flip_map, axis=1)
                prob_map = 0.5 * prob_map + 0.5 * prob_flip_map

        return prob_map

    def _fuse_multiscale_prob(self, pil_image: Image.Image) -> Optional[np.ndarray]:
        prob_maps = []
        target_size = max(self.inference_sizes) if self.inference_sizes else 256

        for size in self.inference_sizes:
            prob_map = self._predict_prob_map(pil_image, size)
            if prob_map is None:
                continue

            if prob_map.shape != (target_size, target_size):
                prob_map = cv2.resize(prob_map, (target_size, target_size), interpolation=cv2.INTER_LINEAR)

            prob_maps.append(prob_map)

        if not prob_maps:
            return None

        return np.mean(np.stack(prob_maps, axis=0), axis=0)

    @torch.no_grad()
    def predict_image_with_mask(self, pil_image: Image.Image) -> Optional[Dict]:
        if not self.loaded or self.model is None:
            return None
        try:
            prob_map = self._fuse_multiscale_prob(pil_image)
            if prob_map is None:
                return None

            mean_prob = float(np.mean(prob_map))
            green_mask = self._green_mask_resized(pil_image, prob_map.shape)
            green_area = float(np.mean(green_mask))

            local_threshold = self.mask_threshold
            if mean_prob < 0.28 and green_area > 0.22:
                local_threshold = max(0.33, self.mask_threshold - 0.06)

            edge_cols = max(12, int(0.16 * prob_map.shape[1]))
            right_prob = float(np.mean(prob_map[:, -edge_cols:]))
            right_green = float(np.mean(green_mask[:, -edge_cols:]))
            if right_green > right_prob + 0.10:
                local_threshold = max(0.31, local_threshold - 0.04)

            # Blend model confidence with a green prior to recover missed leaf pixels.
            hybrid_prob = np.maximum(prob_map, green_mask.astype(np.float32) * self.green_prior_strength)
            binary_mask = (hybrid_prob >= local_threshold).astype(np.uint8)

            # Post-process to recover connected canopy regions while avoiding full-frame flooding.
            kernel = np.ones((3, 3), np.uint8)
            closed = cv2.morphologyEx(binary_mask, cv2.MORPH_CLOSE, kernel, iterations=1)
            dilated = cv2.dilate(closed, kernel, iterations=1)

            # Keep strong model regions plus green-supported neighborhoods.
            strong_model = (prob_map >= max(0.28, local_threshold - 0.08)).astype(np.uint8)
            soft_model = (prob_map >= max(0.22, local_threshold - 0.14)).astype(np.uint8)
            candidate = np.where((dilated == 1) & ((green_mask == 1) | (soft_model == 1)), 1, 0).astype(np.uint8)

            num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(candidate, connectivity=8)
            filtered = np.zeros_like(candidate)
            min_keep_area = max(24, int(0.00055 * candidate.size))
            for label_idx in range(1, num_labels):
                area = int(stats[label_idx, cv2.CC_STAT_AREA])
                if area < min_keep_area:
                    continue

                component = (labels == label_idx)
                model_overlap = strong_model[component].mean() if component.any() else 0.0
                green_overlap = green_mask[component].mean() if component.any() else 0.0
                if model_overlap >= 0.05 or green_overlap >= 0.72:
                    filtered[component] = 1

            binary_mask = filtered
            threshold_score = float(np.mean(binary_mask))

            canopy_score = (
                (self.score_weight_binary * threshold_score)
                + (self.score_weight_mean * mean_prob)
                + (self.score_weight_green * green_area)
            )
            canopy_score = max(0.0, min(1.0, canopy_score))

            return {
                "canopy_score": canopy_score,
                "mask": binary_mask,
                "method": "model_hybrid",
            }
        except Exception as e:
            print(f"⚠️ LeafSegmentation inference fallback: {e}", flush=True)
            fallback_score = self._green_coverage_fallback(pil_image)
            fallback_size = max(self.inference_sizes) if self.inference_sizes else 256
            mask = np.zeros((fallback_size, fallback_size), dtype=np.uint8)
            return {
                "canopy_score": fallback_score,
                "mask": mask,
                "method": "fallback_green_coverage",
            }

    def predict_batch_with_masks(self, images: List[Image.Image]) -> Dict:
        outputs = [self.predict_image_with_mask(img) for img in images]
        valid = [item for item in outputs if item is not None]
        if not valid:
            return {"score": 0.0, "per_image": []}

        score = float(np.mean([item["canopy_score"] for item in valid]))
        return {
            "score": score,
            "per_image": valid,
        }

    def predict_batch(self, images: List[Image.Image]) -> float:
        batch_result = self.predict_batch_with_masks(images)
        return batch_result["score"]