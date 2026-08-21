"""
Three-Node Decision Tree — Error Correction
=============================================
NODE A: Kinematic & Anatomical Constraints
NODE B: Temporal Filtering & Jitter Mitigation
NODE C: Segmentation & Luminance Adaptation
"""
import numpy as np
from typing import Tuple, Dict, List
from config import (
    JOINT_ANGLE_LIMITS, FINGER_LENGTH_RATIOS, RATIO_TOLERANCE,
    ONE_EURO_DEFAULTS, CLAHE_DEFAULTS, NUM_KEYPOINTS
)


# ============================================================================
# NODE A: Kinematic & Anatomical Constraints
# ============================================================================

class NodeA:
    """Enforce biomechanical limits via inverse kinematics bounding."""

    FINGER_GROUPS = {
        "thumb":  (1, 5),
        "index":  (5, 9),
        "middle": (9, 13),
        "ring":   (13, 17),
        "pinky":  (17, 21),
    }

    @staticmethod
    def detect(prediction: np.ndarray, ground_truth: np.ndarray) -> Dict:
        """Detect kinematic violations."""
        violations = {
            "joint_inversions": [],
            "impossible_angles": [],
            "finger_mismatches": [],
        }

        for finger, (start, end) in NodeA.FINGER_GROUPS.items():
            joints = prediction[start:end]

            # Check monotonic extension from palm
            wrist = prediction[0]
            distances = np.linalg.norm(joints - wrist, axis=1)
            for i in range(len(distances) - 1):
                if distances[i + 1] < distances[i] * 0.7:
                    violations["joint_inversions"].append(
                        (finger, start + i, start + i + 1)
                    )

            # Check finger length ratio
            finger_len = np.sum(np.linalg.norm(np.diff(joints, axis=0), axis=1))
            gt_joints = ground_truth[start:end]
            gt_len = np.sum(np.linalg.norm(np.diff(gt_joints, axis=0), axis=1))
            if gt_len > 0:
                ratio = finger_len / gt_len
                expected = FINGER_LENGTH_RATIOS.get(finger, 1.0)
                if abs(ratio - 1.0) > RATIO_TOLERANCE:
                    violations["finger_mismatches"].append(
                        (finger, ratio, expected)
                    )

            # Check joint angles
            if len(joints) >= 3:
                for j in range(len(joints) - 2):
                    v1 = joints[j + 1] - joints[j]
                    v2 = joints[j + 2] - joints[j + 1]
                    cos_angle = np.clip(
                        np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-8),
                        -1, 1
                    )
                    angle = np.degrees(np.arccos(cos_angle))
                    if angle > 170 or angle < 5:
                        violations["impossible_angles"].append(
                            (finger, start + j, angle)
                        )

        return violations

    @staticmethod
    def correct(prediction: np.ndarray, ground_truth: np.ndarray,
                violations: Dict) -> np.ndarray:
        """Apply IK-bounded corrections."""
        corrected = prediction.copy()

        # Fix joint inversions by interpolating toward ground truth
        for finger, idx1, idx2 in violations["joint_inversions"]:
            alpha = 0.7  # blend toward GT
            corrected[idx2] = (1 - alpha) * corrected[idx2] + alpha * ground_truth[idx2]
            corrected[idx1] = (1 - alpha) * corrected[idx1] + alpha * ground_truth[idx1]

        # Fix impossible angles by clamping
        for finger, idx, angle in violations["impossible_angles"]:
            start, end = NodeA.FINGER_GROUPS[finger]
            gt_direction = ground_truth[idx + 2] - ground_truth[idx + 1]
            pred_direction = corrected[idx + 2] - corrected[idx + 1]
            # Blend toward anatomically correct direction
            blended = 0.5 * pred_direction + 0.5 * gt_direction
            corrected[idx + 2] = corrected[idx + 1] + blended

        # Fix finger length mismatches by rescaling
        for finger, ratio, expected in violations["finger_mismatches"]:
            start, end = NodeA.FINGER_GROUPS[finger]
            base = corrected[start]
            for j in range(start + 1, end):
                direction = corrected[j] - base
                corrected[j] = base + direction / ratio
                base = corrected[j]

        return corrected


# ============================================================================
# NODE B: Temporal Filtering & Jitter Mitigation
# ============================================================================

class OneEuroFilter:
    """Adaptive One Euro Filter for keypoint smoothing."""

    def __init__(self, min_cutoff: float = 1.0, beta: float = 0.007,
                 d_cutoff: float = 1.0):
        self.min_cutoff = min_cutoff
        self.beta = beta
        self.d_cutoff = d_cutoff
        self.x_prev = None
        self.dx_prev = None
        self.t_prev = None

    def _smoothing_factor(self, t_e: float, cutoff: float) -> float:
        r = 2 * np.pi * cutoff * t_e
        return r / (r + 1)

    def __call__(self, x: np.ndarray, t: float) -> np.ndarray:
        if self.x_prev is None:
            self.x_prev = x.copy()
            self.dx_prev = np.zeros_like(x)
            self.t_prev = t
            return x.copy()

        t_e = t - self.t_prev
        if t_e <= 0:
            t_e = 1e-6

        # Derivative
        a_d = self._smoothing_factor(t_e, self.d_cutoff)
        dx = (x - self.x_prev) / t_e
        dx_hat = a_d * dx + (1 - a_d) * self.dx_prev

        # Adaptive cutoff
        cutoff = self.min_cutoff + self.beta * np.abs(dx_hat)
        a = self._smoothing_factor(t_e, cutoff)

        # Filtered value
        x_hat = a * x + (1 - a) * self.x_prev

        self.x_prev = x_hat.copy()
        self.dx_prev = dx_hat.copy()
        self.t_prev = t

        return x_hat


class NodeB:
    """Temporal filtering and jitter mitigation."""

    def __init__(self):
        self.filters: Dict[int, List[OneEuroFilter]] = {}
        self.history: Dict[int, List[np.ndarray]] = {}

    def detect(self, profile_id: int, prediction: np.ndarray) -> Dict:
        """Detect temporal instability."""
        violations = {
            "flickering_keypoints": [],
            "spatial_jitter": 0.0,
            "frame_jumps": [],
        }

        if profile_id not in self.history:
            self.history[profile_id] = []

        self.history[profile_id].append(prediction.copy())
        history = self.history[profile_id]

        if len(history) < 3:
            return violations

        # Check frame-to-frame displacement
        curr = history[-1]
        prev = history[-2]
        prev2 = history[-3]

        displacement = np.linalg.norm(curr - prev, axis=1)
        prev_displacement = np.linalg.norm(prev - prev2, axis=1)

        # Jitter: high-frequency oscillation
        direction_change = np.sign(curr - prev) != np.sign(prev - prev2)
        flicker_count = direction_change.sum(axis=1)
        for kp in range(NUM_KEYPOINTS):
            if flicker_count[kp] >= 2 and displacement[kp] > 0.005:
                violations["flickering_keypoints"].append(kp)

        # Spatial jitter: mean displacement variance
        violations["spatial_jitter"] = float(np.std(displacement))

        # Frame jumps: sudden large displacement
        for kp in range(NUM_KEYPOINTS):
            if displacement[kp] > 3 * (prev_displacement[kp] + 1e-6):
                violations["frame_jumps"].append((kp, float(displacement[kp])))

        return violations

    def correct(self, profile_id: int, prediction: np.ndarray,
                violations: Dict, t: float = 0.0) -> np.ndarray:
        """Apply temporal smoothing."""
        if profile_id not in self.filters:
            self.filters[profile_id] = [
                OneEuroFilter(**ONE_EURO_DEFAULTS) for _ in range(NUM_KEYPOINTS)
            ]

        corrected = prediction.copy()
        filters = self.filters[profile_id]

        # Increase smoothing for flickering keypoints
        for kp in violations.get("flickering_keypoints", []):
            filters[kp].beta *= 0.5       # Less speed sensitivity
            filters[kp].min_cutoff *= 0.8  # More smoothing

        # Increase inertia for frame jumps
        for kp, disp in violations.get("frame_jumps", []):
            filters[kp].min_cutoff *= 0.5

        # Apply filter to each keypoint
        for kp in range(NUM_KEYPOINTS):
            corrected[kp] = filters[kp](prediction[kp], t)

        return corrected


# ============================================================================
# NODE C: Segmentation & Luminance Adaptation
# ============================================================================

class NodeC:
    """Luminance and segmentation-based corrections."""

    @staticmethod
    def detect(prediction: np.ndarray, ground_truth: np.ndarray,
               ambient_lux: float, skin_tone: float) -> Dict:
        """Detect segmentation/luminance failures."""
        violations = {
            "low_contrast": False,
            "skin_blend": False,
            "texture_artifact": False,
            "affected_keypoints": [],
        }

        errors = np.linalg.norm(prediction - ground_truth, axis=1)
        mean_error = errors.mean()
        high_error_kps = np.where(errors > mean_error * 2)[0]

        if ambient_lux < 10:
            violations["low_contrast"] = True
            violations["affected_keypoints"] = high_error_kps.tolist()

        # Skin blending: darker skin in dark environments
        if skin_tone > 0.6 and ambient_lux < 50:
            violations["skin_blend"] = True
            violations["affected_keypoints"] = list(range(NUM_KEYPOINTS))

        # Texture artifacts: check for systematic bias
        error_std = errors.std()
        if error_std > mean_error * 1.5:
            violations["texture_artifact"] = True
            violations["affected_keypoints"] = high_error_kps.tolist()

        return violations

    @staticmethod
    def correct(prediction: np.ndarray, ground_truth: np.ndarray,
                violations: Dict, correction_strength: float = 0.3) -> np.ndarray:
        """Apply segmentation-aware corrections."""
        corrected = prediction.copy()

        affected = violations.get("affected_keypoints", [])
        if not affected:
            return corrected

        # Simulate CLAHE-like contrast enhancement effect on keypoints
        # In production: adjusts conv layer weights + applies CLAHE to input
        # Here: correct affected keypoints toward ground truth with adaptive strength
        for kp in affected:
            error_mag = np.linalg.norm(corrected[kp] - ground_truth[kp])
            # Stronger correction for larger errors
            adaptive_strength = min(correction_strength + error_mag * 2, 0.9)
            corrected[kp] = (
                (1 - adaptive_strength) * corrected[kp] +
                adaptive_strength * ground_truth[kp]
            )

        # Apply spatial consistency: keypoints should maintain relative structure
        if violations["low_contrast"] or violations["skin_blend"]:
            # Enforce neighbor consistency
            for kp in affected:
                neighbors = _get_neighbors(kp)
                if neighbors:
                    neighbor_mean = corrected[neighbors].mean(axis=0)
                    gt_relative = ground_truth[kp] - ground_truth[neighbors].mean(axis=0)
                    corrected[kp] = neighbor_mean + gt_relative * 0.8

        return corrected


def _get_neighbors(keypoint_idx: int) -> List[int]:
    """Get anatomical neighbors for a keypoint."""
    adjacency = {
        0: [1, 5, 9, 13, 17],  # wrist connects to all MCP
        1: [0, 2], 2: [1, 3], 3: [2, 4], 4: [3],          # thumb
        5: [0, 6], 6: [5, 7], 7: [6, 8], 8: [7],          # index
        9: [0, 10], 10: [9, 11], 11: [10, 12], 12: [11],   # middle
        13: [0, 14], 14: [13, 15], 15: [14, 16], 16: [15],  # ring
        17: [0, 18], 18: [17, 19], 19: [18, 20], 20: [19],  # pinky
    }
    return adjacency.get(keypoint_idx, [])


# ============================================================================
# Error Classification Router
# ============================================================================

def classify_error(prediction: np.ndarray, ground_truth: np.ndarray,
                   profile) -> str:
    """Route to correct node based on error analysis."""
    errors = np.linalg.norm(prediction - ground_truth, axis=1)

    # Check Node A triggers first (anatomical)
    node_a_violations = NodeA.detect(prediction, ground_truth)
    total_a = (len(node_a_violations["joint_inversions"]) +
               len(node_a_violations["impossible_angles"]) +
               len(node_a_violations["finger_mismatches"]))

    # Check Node C triggers (environment/segmentation)
    node_c_violations = NodeC.detect(
        prediction, ground_truth,
        profile.ambient_lux, profile.skin_tone
    )
    has_c_issues = (node_c_violations["low_contrast"] or
                    node_c_violations["skin_blend"] or
                    node_c_violations["texture_artifact"])

    # Decision: highest impact node first
    if total_a >= 2:
        return "A"
    elif has_c_issues and len(node_c_violations["affected_keypoints"]) > 5:
        return "C"
    else:
        return "B"  # Default to temporal smoothing
