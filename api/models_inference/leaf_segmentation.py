from pathlib import Path
from typing import List, Optional
import pathlib

import numpy as np
from PIL import Image
import torch
import torch.nn as nn
import torchvision.transforms as T


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

        self.transform = T.Compose([
            T.Resize((256, 256)),
            T.ToTensor(),
        ])

        self._load_model()

    
    def _safe_torch_load(self, path: str):
        try:
            return torch.load(path, map_location=self.device, weights_only=False)
        except Exception:
            original_windows = pathlib.WindowsPath
            try:
                pathlib.WindowsPath = pathlib.PosixPath
                return torch.load(path, map_location=self.device, weights_only=False)
            finally:
                pathlib.WindowsPath = original_windows

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

            out_channels = 1
            final_keys = [k for k in state_dict.keys() if k.endswith("final_conv.weight")]
            if final_keys:
                out_channels = state_dict[final_keys[0]].shape[0]

            model = UNet(in_channels=3, out_channels=out_channels)
            model.load_state_dict(state_dict, strict=False)
            model.to(self.device).eval()

            self.model = model
            self.loaded = True
            print(f"✓ LeafSegmentation state_dict loaded: {self.model_path}")

        except Exception as e:
            self.model = None
            self.loaded = False
            print(f"✗ Failed to load LeafSegmentation: {e}")

    @torch.no_grad()
    def predict_image(self, pil_image: Image.Image) -> Optional[float]:
        if not self.loaded or self.model is None:
            return None
        try:
            x = self.transform(pil_image.convert("RGB")).unsqueeze(0).to(self.device)
            out = self.model(x)

            if isinstance(out, dict) and "out" in out:
                out = out["out"]
            if isinstance(out, (list, tuple)):
                out = out[0]

            if out.ndim == 4 and out.shape[1] == 1:
                prob = torch.sigmoid(out[:, 0, :, :])
            elif out.ndim == 4 and out.shape[1] >= 2:
                prob = torch.softmax(out, dim=1)[:, 1, :, :]
            else:
                return None

            canopy_score = float((prob >= 0.5).float().mean().item())
            return max(0.0, min(1.0, canopy_score))
        except Exception:
            return None

    def predict_batch(self, images: List[Image.Image]) -> float:
        scores = [s for s in (self.predict_image(img) for img in images) if s is not None]
        return float(np.mean(scores)) if scores else 0.0