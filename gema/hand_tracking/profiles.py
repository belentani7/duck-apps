"""
Synthetic Profile Generator
============================
50 hand profiles across 5 edge-case categories.
Each profile generates synthetic keypoint data with category-specific noise.
"""
import numpy as np
from dataclasses import dataclass, field
from typing import List, Tuple, Optional


@dataclass
class HandProfile:
    """Single hand profile with metadata and ground truth."""
    id: int
    category: str
    description: str
    skin_tone: float = 0.5          # 0=lightest, 1=darkest (Fitzpatrick I-VI)
    finger_scale: np.ndarray = None # per-finger length multiplier
    occlusion_mask: np.ndarray = None  # which keypoints occluded
    ambient_lux: float = 300.0
    motion_blur: float = 0.0
    has_accessories: bool = False
    anomaly_type: Optional[str] = None
    noise_std: float = 0.005        # base noise level
    ground_truth: np.ndarray = None # (21, 3) xyz keypoints

    def __post_init__(self):
        if self.finger_scale is None:
            self.finger_scale = np.ones(5)
        if self.occlusion_mask is None:
            self.occlusion_mask = np.zeros(21, dtype=bool)
        if self.ground_truth is None:
            self.ground_truth = self._generate_canonical_hand()

    def _generate_canonical_hand(self) -> np.ndarray:
        """Generate anatomically plausible canonical hand keypoints."""
        # Canonical 21-keypoint hand layout (normalized coordinates)
        # Wrist(0), Thumb(1-4), Index(5-8), Middle(9-12), Ring(13-16), Pinky(17-20)
        base = np.array([
            # Wrist
            [0.0, 0.0, 0.0],
            # Thumb: CMC, MCP, IP, TIP
            [-0.08, 0.02, 0.0], [-0.12, 0.08, 0.0],
            [-0.14, 0.14, 0.0], [-0.15, 0.19, 0.0],
            # Index: MCP, PIP, DIP, TIP
            [-0.04, 0.10, 0.0], [-0.04, 0.18, 0.0],
            [-0.04, 0.24, 0.0], [-0.04, 0.28, 0.0],
            # Middle: MCP, PIP, DIP, TIP
            [0.0, 0.11, 0.0], [0.0, 0.19, 0.0],
            [0.0, 0.26, 0.0], [0.0, 0.30, 0.0],
            # Ring: MCP, PIP, DIP, TIP
            [0.04, 0.10, 0.0], [0.04, 0.18, 0.0],
            [0.04, 0.24, 0.0], [0.04, 0.27, 0.0],
            # Pinky: MCP, PIP, DIP, TIP
            [0.08, 0.08, 0.0], [0.08, 0.14, 0.0],
            [0.08, 0.19, 0.0], [0.08, 0.22, 0.0],
        ], dtype=np.float64)

        # Apply finger scaling
        finger_groups = [(1, 5), (5, 9), (9, 13), (13, 17), (17, 21)]
        for i, (start, end) in enumerate(finger_groups):
            scale = self.finger_scale[i]
            wrist = base[0]
            for j in range(start, end):
                base[j] = wrist + (base[j] - wrist) * scale

        return base

    def get_noisy_prediction(self, extra_noise: float = 0.0) -> np.ndarray:
        """Simulate a model prediction with profile-specific noise."""
        total_noise = self.noise_std + extra_noise
        prediction = self.ground_truth.copy()

        # Add base gaussian noise
        prediction += np.random.randn(*prediction.shape) * total_noise

        # Category-specific perturbations
        if self.category == "environment" and self.ambient_lux < 10:
            # Low-light: extra noise on fingertips
            tips = [4, 8, 12, 16, 20]
            prediction[tips] += np.random.randn(5, 3) * total_noise * 3

        if self.category == "environment" and self.motion_blur > 0.2:
            # Motion blur: temporal smear along x-axis
            prediction[:, 0] += np.random.randn(21) * self.motion_blur * 0.05

        if self.occlusion_mask.any():
            # Occluded points get much higher noise
            occ_idx = np.where(self.occlusion_mask)[0]
            prediction[occ_idx] += np.random.randn(len(occ_idx), 3) * total_noise * 5

        if self.has_accessories:
            # Accessories shift nearby keypoints
            accessory_noise = np.random.randn(21, 3) * total_noise * 1.5
            prediction += accessory_noise * 0.3

        if self.anomaly_type == "amputation":
            # Missing fingers: set to wrist with noise
            missing = np.random.choice([1, 2, 3, 4], size=1)[0]
            finger_start = 1 + (missing - 1) * 4
            prediction[finger_start:finger_start + 4] = (
                self.ground_truth[0] + np.random.randn(4, 3) * total_noise * 2
            )

        return prediction


def generate_profiles() -> List[HandProfile]:
    """Generate all 50 evaluation profiles."""
    profiles = []
    rng = np.random.RandomState(42)

    # P01-P10: Morphology
    morphology_configs = [
        ("Infant hand - small scale", 0.6),
        ("Toddler hand", 0.7),
        ("Child hand", 0.8),
        ("Adult female average", 0.95),
        ("Adult male average", 1.05),
        ("Large adult hand", 1.15),
        ("Elderly - arthritic tremor", 0.9),
        ("Hyper-muscular - thick fingers", 1.2),
        ("Long slender fingers", 1.1),
        ("Short stubby fingers", 0.85),
    ]
    for i, (desc, scale_base) in enumerate(morphology_configs):
        scale = np.ones(5) * scale_base + rng.randn(5) * 0.05
        noise = 0.003 if "arthritic" not in desc else 0.008
        profiles.append(HandProfile(
            id=i + 1, category="morphology", description=desc,
            finger_scale=scale, noise_std=noise
        ))

    # P11-P20: Skin & Occlusion
    for i in range(10):
        skin_tone = i / 9.0  # Fitzpatrick I through VI+
        occlusion = np.zeros(21, dtype=bool)
        if i >= 5:
            # Self-occlusion scenarios
            occluded_count = min(i - 4, 8)
            occ_indices = rng.choice(21, size=occluded_count, replace=False)
            occlusion[occ_indices] = True
        desc = f"Skin tone {skin_tone:.1f}, occlusion={occlusion.sum()}"
        profiles.append(HandProfile(
            id=i + 11, category="skin_occlusion", description=desc,
            skin_tone=skin_tone, occlusion_mask=occlusion,
            noise_std=0.004 + skin_tone * 0.002
        ))

    # P21-P30: Accessories
    accessory_types = [
        "Wedding ring", "Oversized ring", "Multiple rings",
        "Bracelet thin", "Bracelet chunky", "Long acrylic nails",
        "Short press-on nails", "White glove", "Black glove",
        "Fingerless glove"
    ]
    for i, acc in enumerate(accessory_types):
        profiles.append(HandProfile(
            id=i + 21, category="accessories", description=acc,
            has_accessories=True, noise_std=0.005 + rng.rand() * 0.003
        ))

    # P31-P40: Environment
    env_configs = [
        ("Pitch dark <5 lux", 3, 0.0),
        ("Dim room 10 lux", 10, 0.0),
        ("Candlelight 20 lux", 20, 0.0),
        ("Office lighting", 300, 0.0),
        ("Outdoor shade", 1000, 0.0),
        ("Direct sunlight", 10000, 0.05),
        ("Fast motion blur", 300, 0.5),
        ("Extreme motion blur", 300, 0.8),
        ("Complex background", 300, 0.1),
        ("Strobe/flicker light", 50, 0.3),
    ]
    for i, (desc, lux, blur) in enumerate(env_configs):
        noise = 0.003
        if lux < 10:
            noise = 0.012
        elif blur > 0.3:
            noise = 0.010
        profiles.append(HandProfile(
            id=i + 31, category="environment", description=desc,
            ambient_lux=lux, motion_blur=blur, noise_std=noise
        ))

    # P41-P50: Anomalies
    anomaly_configs = [
        ("Single finger amputation", "amputation"),
        ("Multiple finger amputation", "amputation"),
        ("Webbed fingers partial", "webbed"),
        ("Webbed fingers full", "webbed"),
        ("Severe joint deviation - MCP", "deviation"),
        ("Severe joint deviation - PIP", "deviation"),
        ("Contracted hand", "contracture"),
        ("Hypermobile joints", "hypermobile"),
        ("Swollen joints - arthritis", "swelling"),
        ("Prosthetic hand", "prosthetic"),
    ]
    for i, (desc, anomaly) in enumerate(anomaly_configs):
        profiles.append(HandProfile(
            id=i + 41, category="anomalies", description=desc,
            anomaly_type=anomaly, noise_std=0.008 + rng.rand() * 0.004
        ))

    return profiles
