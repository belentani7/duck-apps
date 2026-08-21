"""
Hand Tracking Pipeline Configuration
=====================================
50-profile evaluation with strict convergence criteria.
"""

# --- Convergence ---
TARGET_NME = 0.01          # Normalized Mean Error threshold (10/10)
NUM_KEYPOINTS = 21         # Standard hand landmark count
PASS_RATE_REQUIRED = 1.0   # 100% of profiles must pass
MAX_ITERATIONS = 500       # Safety cap per loop

# --- Profile Categories ---
PROFILE_CATEGORIES = {
    "morphology":    list(range(1, 11)),   # P01-P10
    "skin_occlusion": list(range(11, 21)), # P11-P20
    "accessories":   list(range(21, 31)),  # P21-P30
    "environment":   list(range(31, 41)),  # P31-P40
    "anomalies":     list(range(41, 51)),  # P41-P50
}

# --- Correction Node Thresholds ---
NODE_A_TRIGGERS = ["joint_inversion", "impossible_angle", "finger_mismatch"]
NODE_B_TRIGGERS = ["keypoint_flicker", "spatial_jitter", "frame_jump"]
NODE_C_TRIGGERS = ["skin_blend", "low_contrast", "texture_artifact"]

# --- Biomechanical Limits (degrees) ---
JOINT_ANGLE_LIMITS = {
    "MCP_flexion":   (0, 90),
    "MCP_abduction": (-20, 20),
    "PIP_flexion":   (0, 110),
    "DIP_flexion":   (0, 80),
    "thumb_CMC":     (-15, 60),
    "thumb_MCP":     (0, 70),
    "thumb_IP":      (0, 80),
}

# --- Finger Length Ratios (relative to palm width) ---
FINGER_LENGTH_RATIOS = {
    "thumb":  0.72,
    "index":  0.95,
    "middle": 1.00,  # reference
    "ring":   0.94,
    "pinky":  0.78,
}
RATIO_TOLERANCE = 0.15  # 15% variance allowed

# --- Temporal Filter Defaults ---
ONE_EURO_DEFAULTS = {
    "min_cutoff": 1.0,
    "beta": 0.007,
    "d_cutoff": 1.0,
}

# --- CLAHE Defaults ---
CLAHE_DEFAULTS = {
    "clip_limit": 2.0,
    "tile_grid_size": (8, 8),
}

# --- Environment Thresholds ---
LOW_LIGHT_LUX = 10
MOTION_BLUR_THRESHOLD = 0.3  # normalized blur metric
