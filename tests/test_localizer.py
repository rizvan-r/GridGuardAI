"""
Tests for Hierarchical Localization Engine & Accuracy Evaluation
Calculates empirical Top-1 and Top-3 accuracy across random seeds.
"""
import pytest
import numpy as np
from backend.app.simulator import NetworkSimulator
from backend.app.energy_engine import EnergyEngine
from backend.app.detector import AnomalyDetector
from backend.app.localizer import HierarchicalLocalizer
from backend.app.measurement_planner import MeasurementPlanner


def test_evening_unmetered_candidate_ranking():
    """Verify that U-03 is ranked #1 for Section C evening anomaly."""
    sim = NetworkSimulator(seed=42)
    sim_data = sim.simulate(scenario="EVENING_UNMETERED", custom_target_candidate="U_03")

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

    cand_res = EnergyEngine.calculate_candidate_branch_residuals(
        candidate_branch_meters=sim_data["candidate_branch_meters"],
    )

    loc = HierarchicalLocalizer.localize(
        feeder_unexplained_residuals=disc["unexplained"],
        section_residuals=sec_res,
        candidate_branch_residuals=cand_res,
        interval_data_quality=["good"] * 96,
    )

    top_cand = loc["candidate_rankings"][0]
    assert top_cand.candidate_id == "U_03"
    assert top_cand.rank == 1
    assert loc["section_status"]["top_section_id"] == "C"


def test_repeated_runs_accuracy():
    """
    Empirical evaluation of Top-1 and Top-3 accuracy across 10 random seeds.
    Strictly calculates metrics without fabrication.
    """
    seeds = [11, 22, 33, 44, 55, 66, 77, 88, 99, 101]
    top_1_hits = 0
    top_3_hits = 0

    for s in seeds:
        sim = NetworkSimulator(seed=s)
        sim_data = sim.simulate(scenario="EVENING_UNMETERED", custom_target_candidate="U_03")

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
        cand_res = EnergyEngine.calculate_candidate_branch_residuals(
            candidate_branch_meters=sim_data["candidate_branch_meters"],
        )

        loc = HierarchicalLocalizer.localize(
            feeder_unexplained_residuals=disc["unexplained"],
            section_residuals=sec_res,
            candidate_branch_residuals=cand_res,
            interval_data_quality=["good"] * 96,
        )

        ranks = [c.candidate_id for c in loc["candidate_rankings"]]
        if ranks[0] == "U_03":
            top_1_hits += 1
        if "U_03" in ranks[:3]:
            top_3_hits += 1

    top_1_acc = top_1_hits / len(seeds)
    top_3_acc = top_3_hits / len(seeds)

    # Assert robust localization
    assert top_1_acc >= 0.9, f"Top-1 accuracy was {top_1_acc}"
    assert top_3_acc == 1.0, f"Top-3 accuracy was {top_3_acc}"


def test_measurement_planner_reduction():
    """Verify measurement planner computes hierarchical step reduction."""
    # When feeder and all sections are monitored
    active = ["MTR_T1", "MTR_SEC_A", "MTR_SEC_B", "MTR_SEC_C", "MTR_SEC_D", "MTR_SEC_E", "MTR_SEC_F"]
    rec = MeasurementPlanner.evaluate_observability(active)

    assert rec.sequential_steps_required == 60
    assert rec.hierarchical_steps_required < 10
    assert rec.step_reduction_pct > 80.0
