import numpy as np
from typing import Tuple

# Model architecture constants
N_FEATURES = 6
FEATURE_WEIGHTS = [0.25, 0.20, 0.15, 0.15, 0.10, 0.15]
RISK_THRESHOLDS = {"MEDIUM": 0.40, "HIGH": 0.62}
RISK_LABELS = {0: "LOW", 1: "MEDIUM", 2: "HIGH"}


def compute_raw_risk(features: np.ndarray) -> np.ndarray:
    """Weighted sum of feature columns to produce a raw risk score."""
    w = np.array(FEATURE_WEIGHTS)
    return features @ w


def assign_labels(raw_risk: np.ndarray) -> np.ndarray:
    """Convert continuous risk scores to discrete class labels."""
    labels = np.zeros(len(raw_risk), dtype=int)
    labels[raw_risk >= RISK_THRESHOLDS["MEDIUM"]] = 1
    labels[raw_risk >= RISK_THRESHOLDS["HIGH"]] = 2
    return labels


def generate_synthetic_dataset(
    n_samples: int = 10000, seed: int = 42
) -> Tuple[np.ndarray, np.ndarray]:
    """Generate the standard synthetic DeFi risk dataset."""
    np.random.seed(seed)
    features = np.random.uniform(0.0, 1.0, (n_samples, N_FEATURES))
    raw_risk = compute_raw_risk(features)
    labels = assign_labels(raw_risk)
    return features, labels


def get_investment_range(amount: float) -> str:
    """Bucket a dollar amount into a human-readable investment range."""
    if amount >= 200000:
        return "Over 200K"
    if amount >= 50000:
        return "50K-200K"
    if amount >= 10000:
        return "10K-50K"
    return "Under 10K"
