"""
Evaluation Engine
==================
NME computation + convergence tracking per profile.
"""
import numpy as np
from typing import Dict, List, Tuple
from config import TARGET_NME, NUM_KEYPOINTS


def compute_nme(prediction: np.ndarray, ground_truth: np.ndarray) -> float:
    """
    Normalized Mean Error for 21 hand keypoints.
    Normalized by palm diagonal (wrist to middle MCP distance).
    """
    # Normalization factor: wrist(0) to middle-finger MCP(9)
    palm_diag = np.linalg.norm(ground_truth[0] - ground_truth[9])
    if palm_diag < 1e-8:
        palm_diag = 1.0  # fallback

    per_keypoint_error = np.linalg.norm(prediction - ground_truth, axis=1)
    nme = per_keypoint_error.mean() / palm_diag
    return float(nme)


def compute_per_keypoint_nme(prediction: np.ndarray,
                              ground_truth: np.ndarray) -> np.ndarray:
    """Per-keypoint NME breakdown."""
    palm_diag = np.linalg.norm(ground_truth[0] - ground_truth[9])
    if palm_diag < 1e-8:
        palm_diag = 1.0
    return np.linalg.norm(prediction - ground_truth, axis=1) / palm_diag


def evaluate_profile(prediction: np.ndarray,
                     ground_truth: np.ndarray) -> Dict:
    """Full evaluation for one profile."""
    nme = compute_nme(prediction, ground_truth)
    per_kp = compute_per_keypoint_nme(prediction, ground_truth)

    return {
        "nme": nme,
        "passed": nme <= TARGET_NME,
        "score": min(10.0, 10.0 * (TARGET_NME / max(nme, 1e-8))),
        "per_keypoint_nme": per_kp,
        "worst_keypoint": int(np.argmax(per_kp)),
        "worst_keypoint_nme": float(per_kp.max()),
        "best_keypoint": int(np.argmin(per_kp)),
    }


def evaluate_all(predictions: Dict[int, np.ndarray],
                 ground_truths: Dict[int, np.ndarray]) -> Dict:
    """Evaluate all 50 profiles."""
    results = {}
    passed_count = 0
    total_nme = 0.0

    for pid in sorted(predictions.keys()):
        result = evaluate_profile(predictions[pid], ground_truths[pid])
        results[pid] = result
        total_nme += result["nme"]
        if result["passed"]:
            passed_count += 1

    total = len(predictions)
    return {
        "profiles": results,
        "pass_count": passed_count,
        "fail_count": total - passed_count,
        "pass_rate": passed_count / total if total > 0 else 0.0,
        "mean_nme": total_nme / total if total > 0 else 0.0,
        "converged": passed_count == total,
        "failed_ids": [pid for pid, r in results.items() if not r["passed"]],
    }


class ConvergenceTracker:
    """Track convergence progress across iterations."""

    def __init__(self):
        self.history: List[Dict] = []
        self.best_pass_rate: float = 0.0
        self.best_mean_nme: float = float("inf")
        self.stagnation_counter: int = 0
        self.improvement_threshold: float = 0.001

    def update(self, eval_result: Dict) -> Dict:
        """Record iteration and check convergence trend."""
        self.history.append({
            "iteration": len(self.history),
            "pass_rate": eval_result["pass_rate"],
            "mean_nme": eval_result["mean_nme"],
            "pass_count": eval_result["pass_count"],
            "fail_count": eval_result["fail_count"],
        })

        # Track improvements
        improved = False
        if eval_result["mean_nme"] < self.best_mean_nme - self.improvement_threshold:
            self.best_mean_nme = eval_result["mean_nme"]
            improved = True
        if eval_result["pass_rate"] > self.best_pass_rate:
            self.best_pass_rate = eval_result["pass_rate"]
            improved = True

        if improved:
            self.stagnation_counter = 0
        else:
            self.stagnation_counter += 1

        return {
            "iteration": len(self.history) - 1,
            "improved": improved,
            "stagnation": self.stagnation_counter,
            "best_pass_rate": self.best_pass_rate,
            "best_mean_nme": self.best_mean_nme,
            "converged": eval_result["converged"],
        }

    def get_trend(self, window: int = 10) -> Dict:
        """Get recent trend direction."""
        if len(self.history) < window:
            return {"trend": "insufficient_data"}

        recent = self.history[-window:]
        nme_values = [h["mean_nme"] for h in recent]
        slope = np.polyfit(range(window), nme_values, 1)[0]

        return {
            "trend": "improving" if slope < -0.0001 else
                     "stagnating" if abs(slope) < 0.0001 else "degrading",
            "slope": float(slope),
            "recent_mean_nme": float(np.mean(nme_values)),
        }
