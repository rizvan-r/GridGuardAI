"""
Statistical Anomaly Detector for GridGuard AI
Computes rolling baseline, robust z-scores, persistence counters,
and classifies severity while flagging data quality issues.
"""
from typing import Dict, List, Any, Optional, Tuple
import numpy as np


class AnomalyDetector:
    def __init__(
        self,
        z_warning_threshold: float = 2.0,
        z_critical_threshold: float = 3.2,
        persistence_requirement: int = 3,  # Consecutive intervals required for HIGH/CRITICAL
    ):
        self.z_warning_threshold = z_warning_threshold
        self.z_critical_threshold = z_critical_threshold
        self.persistence_requirement = persistence_requirement

    def detect_anomalies(
        self,
        unexplained_residuals: np.ndarray,
        section_residuals: Dict[str, Dict[str, np.ndarray]],
        quality_flags: Dict[str, List[str]],
        transformer_quality_flags: List[str],
        window_size: int = 12,  # 3-hour rolling window
    ) -> Dict[str, Any]:
        """
        Executes transparent statistical anomaly detection.
        Uses rolling window mean and robust std (with outlier resistance)
        to identify unexpected deviations from baseline physical expectations.
        """
        n = len(unexplained_residuals)
        anomaly_scores = np.zeros(n)
        baseline_means = np.zeros(n)
        baseline_stds = np.zeros(n)
        is_anomalous = np.zeros(n, dtype=bool)
        severity_labels = ["NORMAL"] * n

        # Check data quality across intervals
        interval_data_quality = ["good"] * n
        for i in range(n):
            missing_count = sum(1 for flags in quality_flags.values() if flags[i] == "missing")
            noisy_count = sum(1 for flags in quality_flags.values() if flags[i] == "noisy")
            faulty_count = sum(1 for flags in quality_flags.values() if flags[i] == "faulty")

            if missing_count > 3:
                interval_data_quality[i] = "missing_data"
            elif faulty_count > 0:
                interval_data_quality[i] = "meter_fault_suspected"
            elif noisy_count > 10:
                interval_data_quality[i] = "noisy_measurements"

        # Baseline computation: robust rolling mean & standard deviation
        # Using a rolling window of 12 intervals (3 hours)
        for i in range(n):
            start_idx = max(0, i - window_size)
            end_idx = min(n, i + window_size + 1)
            # Use surrounding window excluding the current point for fair test
            window = np.concatenate([unexplained_residuals[start_idx:i], unexplained_residuals[i+1:end_idx]])
            if len(window) < 4:
                window = unexplained_residuals

            # Robust baseline: median and MAD (Median Absolute Deviation)
            med = float(np.median(window))
            mad = float(np.median(np.abs(window - med)))
            robust_std = max(0.04, 1.4826 * mad)

            baseline_means[i] = med
            baseline_stds[i] = robust_std

            val = unexplained_residuals[i]
            z_score = (val - med) / robust_std
            anomaly_scores[i] = z_score

            if z_score >= self.z_warning_threshold:
                is_anomalous[i] = True

        # Persistence filtering and severity assignment
        consecutive_count = 0
        for i in range(n):
            if is_anomalous[i]:
                consecutive_count += 1
                score = anomaly_scores[i]
                
                if consecutive_count >= self.persistence_requirement:
                    if score >= self.z_critical_threshold:
                        severity_labels[i] = "CRITICAL"
                    else:
                        severity_labels[i] = "HIGH"
                elif consecutive_count >= 2:
                    severity_labels[i] = "MEDIUM"
                else:
                    severity_labels[i] = "LOW"
            else:
                consecutive_count = 0
                severity_labels[i] = "NORMAL"

        # Identify most suspicious section per anomalous interval
        dominant_sections = [None] * n
        for i in range(n):
            if is_anomalous[i]:
                max_sec = None
                max_res = -999.0
                for sec, data in section_residuals.items():
                    sec_res = data["residual"][i]
                    if sec_res > max_res:
                        max_res = sec_res
                        max_sec = sec
                dominant_sections[i] = max_sec

        return {
            "anomaly_scores": anomaly_scores,
            "baseline_means": baseline_means,
            "baseline_stds": baseline_stds,
            "is_anomalous": is_anomalous,
            "severity_labels": severity_labels,
            "interval_data_quality": interval_data_quality,
            "dominant_sections": dominant_sections,
        }
