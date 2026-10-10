"""
Measurement Planner & Observability Engine for GridGuard AI
Evaluates network tree observability, compares sequential vs. hierarchical inspection strategies,
and recommends high-value sensor placements to minimize uncertainty.
"""
from typing import Dict, List, Any, Set
from .models import MeasurementPlanRecommendation, SensorPlacementOption


AVAILABLE_SENSORS = [
    SensorPlacementOption(
        sensor_id="MTR_T1",
        location_type="feeder",
        target_id="T1",
        label="Transformer Feeder Bulk Meter (T1)",
        cost_units=1,
        uncertainty_reduction_pct=25.0,
        is_active=True,
    ),
    SensorPlacementOption(
        sensor_id="MTR_SEC_A",
        location_type="section",
        target_id="SEC_A",
        label="Section A Header Meter (North Hamlet)",
        cost_units=2,
        uncertainty_reduction_pct=15.0,
        is_active=True,
    ),
    SensorPlacementOption(
        sensor_id="MTR_SEC_B",
        location_type="section",
        target_id="SEC_B",
        label="Section B Header Meter (Central Hamlet)",
        cost_units=2,
        uncertainty_reduction_pct=15.0,
        is_active=True,
    ),
    SensorPlacementOption(
        sensor_id="MTR_SEC_C",
        location_type="section",
        target_id="SEC_C",
        label="Section C Header Meter (East Extension)",
        cost_units=2,
        uncertainty_reduction_pct=15.0,
        is_active=True,
    ),
    SensorPlacementOption(
        sensor_id="MTR_SEC_D",
        location_type="section",
        target_id="SEC_D",
        label="Section D Header Meter (South Hamlet)",
        cost_units=2,
        uncertainty_reduction_pct=15.0,
        is_active=True,
    ),
    SensorPlacementOption(
        sensor_id="MTR_SEC_E",
        location_type="section",
        target_id="SEC_E",
        label="Section E Header Meter (West Hamlet)",
        cost_units=2,
        uncertainty_reduction_pct=15.0,
        is_active=True,
    ),
    SensorPlacementOption(
        sensor_id="MTR_SEC_F",
        location_type="section",
        target_id="SEC_F",
        label="Section F Header Meter (Agri Pump Cluster)",
        cost_units=2,
        uncertainty_reduction_pct=15.0,
        is_active=True,
    ),
    SensorPlacementOption(
        sensor_id="MTR_BR_U03",
        location_type="branch",
        target_id="U_03",
        label="Branch Boundary Clamp CT (U-03 / Line C-08)",
        cost_units=3,
        uncertainty_reduction_pct=10.0,
        is_active=False,
    ),
]


class MeasurementPlanner:
    @staticmethod
    def get_all_sensors() -> List[SensorPlacementOption]:
        return AVAILABLE_SENSORS

    @staticmethod
    def evaluate_observability(active_sensor_ids: List[str]) -> MeasurementPlanRecommendation:
        active_set: Set[str] = set(active_sensor_ids)
        has_feeder = "MTR_T1" in active_set
        has_all_sections = all(f"MTR_SEC_{s}" in active_set for s in ["A", "B", "C", "D", "E", "F"])
        section_meters_count = sum(1 for s in ["A", "B", "C", "D", "E", "F"] if f"MTR_SEC_{s}" in active_set)
        has_branch_u03 = "MTR_BR_U03" in active_set

        ambiguity_groups = []
        if not has_feeder:
            ambiguity_groups.append({
                "group_id": "GRP_TOTAL_BLIND",
                "label": "Entire Feeder T1 (Zero bulk observability)",
                "unobservable_nodes": 60,
                "status": "CRITICAL_BLINDSPOT",
            })
            seq_steps = 60
            hier_steps = 60
            next_rec = "Install MTR_T1 bulk transformer meter immediately."
            rationale = "Without bulk feeder metering, no energy balance or loss calculation is mathematically possible."
        elif not has_all_sections:
            unmonitored_sections = [s for s in ["A", "B", "C", "D", "E", "F"] if f"MTR_SEC_{s}" not in active_set]
            ambiguity_groups.append({
                "group_id": "GRP_SECTION_COARSE",
                "label": f"Sections {', '.join(unmonitored_sections)} are aggregated together",
                "unobservable_nodes": len(unmonitored_sections) * 10,
                "status": "PARTIAL_OBSERVABILITY",
            })
            seq_steps = 60
            # Need to manually inspect across unmonitored sections
            hier_steps = 1 + len(unmonitored_sections) * 10
            next_rec = f"Deploy header meter at Section {unmonitored_sections[0]} (MTR_SEC_{unmonitored_sections[0]})"
            rationale = f"Isolating Section {unmonitored_sections[0]} eliminates 10 household nodes from the search space in a single reading."
        elif not has_branch_u03:
            ambiguity_groups.append({
                "group_id": "GRP_SECTION_RESOLVED",
                "label": "Section boundaries observable. Within suspect section, 10 households and tap line remain in ambiguity set.",
                "unobservable_nodes": 10,
                "status": "SECTION_ISOLATED",
            })
            seq_steps = 60
            # 1 feeder check + 1 section check + 3-4 targeted branch tests
            hier_steps = 4
            next_rec = "Deploy portable clamp CT at Branch U-03 (Service Line C-08)"
            rationale = "Section C is isolated. Deploying branch clamp CT narrows candidates directly down to the service drop."
        else:
            ambiguity_groups.append({
                "group_id": "GRP_PINPOINTED",
                "label": "Full hierarchical observability achieved. Branch boundary fully constrained.",
                "unobservable_nodes": 1,
                "status": "FULLY_OBSERVABLE",
            })
            seq_steps = 60
            hier_steps = 2
            next_rec = "Maintain periodic calibration and continuous AMI telemetry monitoring."
            rationale = "High observability achieved. All 3 hierarchical tiers are instrumented."

        reduction_pct = max(0.0, round(((seq_steps - hier_steps) / max(1, seq_steps)) * 100.0, 1))

        limitations = (
            "Mathematical Limitation: Measurements at transformer and household meters alone cannot uniquely "
            "differentiate between an unmetered tap, localized physical line resistance degradation, and simultaneous "
            "household meter calibration drift without synchronized sub-feeder intermediate boundary meters."
        )

        return MeasurementPlanRecommendation(
            active_meters=list(active_set),
            ambiguity_groups=ambiguity_groups,
            sequential_steps_required=seq_steps,
            hierarchical_steps_required=hier_steps,
            step_reduction_pct=reduction_pct,
            next_recommended_sensor=next_rec,
            rationale=rationale,
            limitations=limitations,
        )
