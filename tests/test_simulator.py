"""
Tests for Synthetic Network Simulator
"""
import pytest
import numpy as np
from backend.app.simulator import NetworkSimulator, TOTAL_INTERVALS


def test_seed_reproducibility():
    """Verify that re-running with the same seed yields exact identical results."""
    sim1 = NetworkSimulator(seed=123)
    data1 = sim1.simulate(scenario="EVENING_UNMETERED")

    sim2 = NetworkSimulator(seed=123)
    data2 = sim2.simulate(scenario="EVENING_UNMETERED")

    np.testing.assert_array_equal(data1["transformer_input"], data2["transformer_input"])
    np.testing.assert_array_equal(data1["total_household_reported"], data2["total_household_reported"])


def test_evening_unmetered_profile():
    """Verify unmetered load is injected between 19:00 (int 76) and 22:00 (int 88)."""
    sim = NetworkSimulator(seed=42)
    data = sim.simulate(scenario="EVENING_UNMETERED", custom_target_candidate="U_03")

    u03_injected = data["candidate_unmetered"]["U_03"]
    # Before 19:00 (int 0..75) should be 0
    assert np.all(u03_injected[:76] == 0.0)
    # During peak (e.g. interval 82, 20:30) should be significantly positive
    assert u03_injected[82] > 2.0
    # After 22:00 (int 89..95) should be 0
    assert np.all(u03_injected[89:] == 0.0)


def test_meter_fault_scenario():
    """Verify meter fault creates under-reporting for specific meter H_24."""
    sim = NetworkSimulator(seed=42)
    data = sim.simulate(scenario="METER_FAULT")

    assert "H_24" in data["ground_truth"]["faulty_meters"]
    reported_h24 = data["household_meter_profiles"]["H_24"]
    # Should report significantly less than normal households (25% of actual)
    assert np.sum(reported_h24) < 10.0
    avg_normal_hh = np.sum(data["total_household_actual"]) / 60
    assert np.sum(reported_h24) < 0.4 * avg_normal_hh


def test_ground_truth_separation():
    """Verify ground truth dict is distinct from measurement data returned to consumers."""
    sim = NetworkSimulator(seed=42)
    data = sim.simulate(scenario="EVENING_UNMETERED")

    assert "ground_truth" in data
    # The readings array itself has no labels of who is guilty
    assert "injected_locations" not in data["transformer_input"]
