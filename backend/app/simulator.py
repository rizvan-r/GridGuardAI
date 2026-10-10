"""
Synthetic Distribution Network & Meter Reading Simulator for GridGuard AI
Conservation of energy, realistic load curves, and 5 distinct simulation scenarios.
"""
import math
from typing import Dict, List, Any, Optional, Tuple
import numpy as np


# Network Constants
SECTIONS = ["A", "B", "C", "D", "E", "F"]
SECTION_NAMES = {
    "A": "Section A (North Hamlet)",
    "B": "Section B (Central Hamlet)",
    "C": "Section C (East Extension)",
    "D": "Section D (South Hamlet)",
    "E": "Section E (West Hamlet)",
    "F": "Section F (Agri Pump Cluster)",
}

HOUSEHOLDS_PER_SECTION = 10
TOTAL_HOUSEHOLDS = 60
TOTAL_INTERVALS = 96  # 24 hours at 15-minute intervals


def get_interval_time(interval_idx: int) -> str:
    """Convert interval index (0..95) to HH:MM format."""
    total_minutes = interval_idx * 15
    hours = total_minutes // 60
    minutes = total_minutes % 60
    return f"{hours:02d}:{minutes:02d}"


def get_households_for_section(section_id: str) -> List[str]:
    """Get household IDs H_01 to H_60 for a given section."""
    sec_idx = SECTIONS.index(section_id)
    start_num = sec_idx * HOUSEHOLDS_PER_SECTION + 1
    return [f"H_{i:02d}" for i in range(start_num, start_num + HOUSEHOLDS_PER_SECTION)]


def get_candidate_for_section(section_id: str) -> str:
    """Return default candidate connection ID for section."""
    sec_idx = SECTIONS.index(section_id)
    return f"U_{sec_idx + 1:02d}"


class NetworkSimulator:
    def __init__(self, seed: int = 42):
        self.seed = seed
        self.rng = np.random.RandomState(seed)
        
        # Ground-truth injection state (strictly separated from detector)
        self.ground_truth = {
            "scenario": "NORMAL",
            "injected_locations": [],
            "injected_intervals": [],
            "faulty_meters": [],
            "noisy_meters": []
        }

    def _generate_base_household_profile(self, household_id: str, section_id: str) -> np.ndarray:
        """
        Generate a realistic 24-hour (96 interval) active energy consumption profile (kWh per 15 min).
        Rural residential daily curves:
        - Night base: 0.05 - 0.15 kWh (refrigeration, fan)
        - Morning peak (06:00 - 08:30): 0.25 - 0.60 kWh (cooking, heating, pumps)
        - Midday lull (10:00 - 16:30): 0.10 - 0.25 kWh
        - Evening peak (18:30 - 22:30): 0.40 - 0.90 kWh (lighting, TV, dinner)
        """
        intervals = np.arange(TOTAL_INTERVALS)
        times_hours = intervals * 0.25  # in hours 0.0 to 23.75

        # Base load
        household_num = int(household_id.split("_")[1])
        # Deterministic variation per household
        base_factor = 0.8 + 0.4 * ((household_num * 17) % 10) / 10.0
        
        # Gaussian peaks
        morning_peak = 0.35 * np.exp(-((times_hours - 7.5) ** 2) / (2 * 1.2 ** 2))
        evening_peak = 0.55 * np.exp(-((times_hours - 20.0) ** 2) / (2 * 1.5 ** 2))
        afternoon_bump = 0.12 * np.exp(-((times_hours - 13.0) ** 2) / (2 * 1.8 ** 2))
        night_base = 0.08
        
        # Agri cluster special trait for Section F (pumps in morning and afternoon)
        if section_id == "F":
            agri_pump = 0.45 * np.exp(-((times_hours - 9.0) ** 2) / (2 * 2.0 ** 2))
            profile = (night_base + morning_peak * 0.7 + evening_peak * 0.8 + agri_pump) * base_factor
        else:
            profile = (night_base + morning_peak + evening_peak + afternoon_bump) * base_factor
        
        # Add slight natural randomness
        jitter = self.rng.normal(0, 0.02 * base_factor, TOTAL_INTERVALS)
        profile = np.maximum(0.02, profile + jitter)
        return profile

    def simulate(
        self,
        scenario: str = "EVENING_UNMETERED",
        technical_loss_pct: float = 4.5,
        custom_unmetered_kw: Optional[float] = None,
        custom_target_candidate: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Execute full day network simulation.
        Conserves energy:
        transformer_input = sum(household_metered) + unmetered_load + technical_loss + measurement_noise
        """
        self.rng = np.random.RandomState(self.seed)
        scenario = scenario.upper()
        
        # 1. Generate realistic household loads
        household_profiles: Dict[str, np.ndarray] = {}
        section_household_totals: Dict[str, np.ndarray] = {sec: np.zeros(TOTAL_INTERVALS) for sec in SECTIONS}
        
        for sec in SECTIONS:
            h_list = get_households_for_section(sec)
            for hid in h_list:
                prof = self._generate_base_household_profile(hid, sec)
                household_profiles[hid] = prof
                section_household_totals[sec] += prof

        total_household_actual = np.zeros(TOTAL_INTERVALS)
        for prof in household_profiles.values():
            total_household_actual += prof

        # 2. Simulated unmetered loads per candidate point
        candidate_unmetered: Dict[str, np.ndarray] = {f"U_{i:02d}": np.zeros(TOTAL_INTERVALS) for i in range(1, 7)}
        meter_reported_profiles = {hid: prof.copy() for hid, prof in household_profiles.items()}
        quality_flags: Dict[str, List[str]] = {hid: ["good"] * TOTAL_INTERVALS for hid in household_profiles}
        transformer_quality_flags = ["good"] * TOTAL_INTERVALS

        # Ground truth tracker
        self.ground_truth = {
            "scenario": scenario,
            "injected_locations": [],
            "injected_intervals": [],
            "faulty_meters": [],
            "noisy_meters": []
        }

        # Handle Scenarios
        target_cand = custom_target_candidate or "U_03"
        if not target_cand.startswith("U_"):
            target_cand = target_cand.replace("-", "_")

        if scenario == "EVENING_UNMETERED":
            # Discrepancy between 7 PM (interval 76) and 10 PM (interval 88)
            # Size it so transformer records ~18% more energy than household meters!
            target_cand = target_cand if target_cand in candidate_unmetered else "U_03"
            peak_kw = custom_unmetered_kw if custom_unmetered_kw is not None else 28.0
            peak_kwh_per_interval = peak_kw * 0.25  # 15 mins = 0.25 hr -> 7.0 kWh per interval

            intervals = np.arange(TOTAL_INTERVALS)
            times_hours = intervals * 0.25
            # Bell curve strictly concentrated between 19.0 and 22.0, peaking at 20.5 (8:30 PM)
            injection = np.zeros(TOTAL_INTERVALS)
            for i in range(TOTAL_INTERVALS):
                t = times_hours[i]
                if 19.0 <= t <= 22.0:
                    # Smooth pulse
                    injection[i] = peak_kwh_per_interval * math.sin(math.pi * (t - 19.0) / 3.0) ** 1.5

            candidate_unmetered[target_cand] = injection
            self.ground_truth["injected_locations"].append(target_cand)
            self.ground_truth["injected_intervals"] = [i for i in range(76, 88)]

        elif scenario == "METER_FAULT":
            # Household meter under-recording (e.g. H_24 in Section C)
            faulty_h = "H_24"
            # Actual load is consumed, but meter reports only 25% of it
            meter_reported_profiles[faulty_h] = household_profiles[faulty_h] * 0.25
            for i in range(TOTAL_INTERVALS):
                quality_flags[faulty_h][i] = "faulty"
            self.ground_truth["faulty_meters"].append(faulty_h)

        elif scenario == "MULTIPLE_ANOMALIES":
            # Two candidate locations: U_02 (Section B) and U_05 (Section E)
            peak_kwh_1 = (custom_unmetered_kw or 18.0) * 0.25
            peak_kwh_2 = (custom_unmetered_kw or 22.0) * 0.25

            for i in range(TOTAL_INTERVALS):
                t = i * 0.25
                if 18.0 <= t <= 21.0:
                    candidate_unmetered["U_02"][i] = peak_kwh_1 * math.sin(math.pi * (t - 18.0) / 3.0)
                if 20.0 <= t <= 23.0:
                    candidate_unmetered["U_05"][i] = peak_kwh_2 * math.sin(math.pi * (t - 20.0) / 3.0)

            self.ground_truth["injected_locations"].extend(["U_02", "U_05"])
            self.ground_truth["injected_intervals"] = [i for i in range(72, 92)]

        elif scenario == "NOISY_MEASUREMENTS":
            # Missing packets (drop 8% of readings) + high noise
            for hid in household_profiles:
                for i in range(TOTAL_INTERVALS):
                    if self.rng.rand() < 0.08:
                        quality_flags[hid][i] = "missing"
                        meter_reported_profiles[hid][i] = 0.0  # Packet lost
                    else:
                        noise = self.rng.normal(0, 0.04)
                        meter_reported_profiles[hid][i] = max(0.01, meter_reported_profiles[hid][i] + noise)
                        quality_flags[hid][i] = "noisy"
            self.ground_truth["noisy_meters"] = list(household_profiles.keys())

        # 3. Calculate Section Incoming Energy & Physical Technical Losses
        # Candidate point U_01 -> Sec A, U_02 -> Sec B, etc.
        section_actual_load = {sec: section_household_totals[sec].copy() for sec in SECTIONS}
        for sec_idx, sec in enumerate(SECTIONS):
            cand_id = f"U_{sec_idx + 1:02d}"
            section_actual_load[sec] += candidate_unmetered[cand_id]

        # Technical losses: Physical I^2*R model + core excitation baseline
        # Expected baseline ~4.5% of total consumption
        section_technical_losses: Dict[str, np.ndarray] = {}
        for sec in SECTIONS:
            # P_loss = P_core + k * (P_load)^1.6
            load = section_actual_load[sec]
            mean_load = np.mean(load)
            k = (technical_loss_pct / 100.0) / max(0.01, mean_load ** 0.6)
            loss = 0.008 + k * (load ** 1.6)
            section_technical_losses[sec] = loss

        total_technical_loss = sum(section_technical_losses.values())

        # Total actual feeder physical demand
        total_feeder_physical_load = sum(section_actual_load.values()) + total_technical_loss

        # Transformer meter measurement: physical load + small measurement instrument noise (Class 0.5)
        transformer_meter_noise = self.rng.normal(0, 0.012, TOTAL_INTERVALS)
        transformer_input = np.maximum(0.1, total_feeder_physical_load + transformer_meter_noise)

        # Section incoming meters (simulated upstream section clamp meters)
        section_incoming_meters: Dict[str, np.ndarray] = {}
        for sec in SECTIONS:
            sec_meter_noise = self.rng.normal(0, 0.008, TOTAL_INTERVALS)
            section_incoming_meters[sec] = np.maximum(
                0.05,
                section_actual_load[sec] + section_technical_losses[sec] + sec_meter_noise
            )

        # Candidate branch downstream meters (simulated branch boundary measurements)
        # Downstream of candidate tap is the group of households connected downstream
        candidate_branch_meters: Dict[str, Dict[str, np.ndarray]] = {}
        for sec_idx, sec in enumerate(SECTIONS):
            cand_id = f"U_{sec_idx + 1:02d}"
            # Simulated branch upstream: section entrance
            # Simulated branch downstream: sum of households on that branch
            downstream_hh_energy = section_household_totals[sec]
            candidate_branch_meters[cand_id] = {
                "upstream_kwh": section_incoming_meters[sec],
                "downstream_kwh": downstream_hh_energy + self.rng.normal(0, 0.005, TOTAL_INTERVALS),
                "unmetered_injected": candidate_unmetered[cand_id]
            }

        # 4. Aggregated reported household consumption (what utility billing/AMI sees)
        total_household_reported = np.zeros(TOTAL_INTERVALS)
        for hid, prof in meter_reported_profiles.items():
            total_household_reported += prof

        # Store full simulation payload
        return {
            "scenario": scenario,
            "seed": self.seed,
            "intervals_count": TOTAL_INTERVALS,
            "transformer_input": transformer_input,
            "total_household_reported": total_household_reported,
            "total_household_actual": total_household_actual,
            "total_technical_loss": total_technical_loss,
            "section_technical_losses": section_technical_losses,
            "section_incoming_meters": section_incoming_meters,
            "section_household_totals": {
                sec: np.sum([meter_reported_profiles[h] for h in get_households_for_section(sec)], axis=0)
                for sec in SECTIONS
            },
            "candidate_unmetered": candidate_unmetered,
            "candidate_branch_meters": candidate_branch_meters,
            "household_meter_profiles": meter_reported_profiles,
            "quality_flags": quality_flags,
            "transformer_quality_flags": transformer_quality_flags,
            "ground_truth": self.ground_truth,
        }
