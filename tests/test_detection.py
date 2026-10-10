"""
Tests for Anomaly Detector
"""
import pytest
import numpy as np
from backend.app.simulator import NetworkSimulator
from backend.app.energy_engine import EnergyEngine
from backend.app.detector import AnomalyDetector


def test_normal_day_low_false_alarms():
    """Verify that a normal day produces virtually zero persistent anomalies."""
    sim = NetworkSimulator(seed=99)
    sim_data = sim.simulate(scenario="NORMAL")

    disc = EnergyEngine.calculate_discrepancies(
        transformer_input=sim_data["transformer_input"],
        total_household_energy=sim_data["total_household_reported"],
        estimated_technical_losses=sim_data["total_technical_loss"],
    )

    sec_res = EnergyEngine.calculate_section_residuals(
        section_incoming_meters=sim_data["section_incoming_meters"],
        section_household_totals=sim_data["section_household_totals"],
        estimated_section_losses=sim_data["section_technical_losses"],
    )

    detector = AnomalyDetector()
    results = detector.detect_anomalies(
        unexplained_residuals=disc["unexplained"],
        section_residuals=sec_res,
        quality_flags=sim_data["quality_flags"],
        transformer_quality_flags=sim_data["transformer_quality_flags"],
    )

    # In a normal day, CRITICAL alerts must be 0
    critical_count = sum(1 for s in results["severity_labels"] if s == "CRITICAL")
    assert critical_count == 0


def test_evening_anomaly_detection():
    """Verify that evening unmetered load triggers HIGH/CRITICAL severity."""
    sim = NetworkSimulator(seed=42)
    sim_data = sim.simulate(scenario="EVENING_UNMETERED")

    disc = EnergyEngine.calculate_discrepancies(
        transformer_input=sim_data["transformer_input"],
        total_household_energy=sim_data["total_household_reported"],
        estimated_technical_losses=sim_data["total_technical_loss"],
    )

    sec_res = EnergyEngine.calculate_section_residuals(
        section_incoming_meters=sim_data["section_incoming_meters"],
        section_household_totals=sim_data["section_household_totals"],
        estimated_section_losses=sim_data["section_technical_losses"],
    )

    detector = AnomalyDetector()
    results = detector.detect_anomalies(
        unexplained_residuals=disc["unexplained"],
        section_residuals=sec_res,
        quality_flags=sim_data["quality_flags"],
        transformer_quality_flags=sim_data["transformer_quality_flags"],
    )

    # During evening peak (interval 80 = 20:00), severity should be HIGH or CRITICAL
    assert results["severity_labels"][80] in ["HIGH", "CRITICAL"]
    assert bool(results["is_anomalous"][80]) is True
    # Dominant section should be Section C
    assert results["dominant_sections"][80] == "C"


def test_noisy_measurements_flagging():
    """Verify that noisy/missing data flags data quality."""
    sim = NetworkSimulator(seed=42)
    sim_data = sim.simulate(scenario="NOISY_MEASUREMENTS")

    disc = EnergyEngine.calculate_discrepancies(
        transformer_input=sim_data["transformer_input"],
        total_household_energy=sim_data["total_household_reported"],
        estimated_technical_losses=sim_data["total_technical_loss"],
    )

    sec_res = EnergyEngine.calculate_section_residuals(
        section_incoming_meters=sim_data["section_incoming_meters"],
        section_household_totals=sim_data["section_household_totals"],
        estimated_section_losses=sim_data["section_technical_losses"],
    )

    detector = AnomalyDetector()
    results = detector.detect_anomalies(
        unexplained_residuals=disc["unexplained"],
        section_residuals=sec_res,
        quality_flags=sim_data["quality_flags"],
        transformer_quality_flags=sim_data["transformer_quality_flags"],
    )

    assert any(q in ["missing_data", "noisy_measurements"] for q in results["interval_data_quality"])
