"""
Agricultural Electricity Diversion Detection & Prevention Engine
Implements:
1. Smart energy telemetry simulation for agricultural pumps (V, I, kW, PF, status).
2. Unsupervised Isolation Forest + Physics-based Load Pattern Analysis.
3. Multi-point energy boundary accounting (Transformer -> Section F Header -> Pump Meter -> Downstream).
4. Presumption of Innocence diagnostic rules (motor faults, seasonal irrigation shifts, CT saturation).
5. Smallest confirmed monitoring zone calculation.
6. Evidence-based alert generation and safety-governed action workflows.
"""
import math
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional, Tuple
import numpy as np
from sklearn.ensemble import IsolationForest

from .agri_models import (
    AgriConnection,
    AgriTelemetryReading,
    MultiPointEnergyBalance,
    AgriAnomalyEvaluation,
    AgriAlert,
    AgriOverviewSummary,
)


# Default registered agricultural connections in Section F (Kaveri Delta Agri Cluster)
DEFAULT_AGRI_CONNECTIONS: List[AgriConnection] = [
    AgriConnection(
        service_id="AGRI-TN-042-F01",
        farmer_name="S. Murugesan",
        survey_number="142/2A",
        feeder_id="T1",
        transformer_id="NODE_T1",
        section_id="F",
        sanctioned_load_hp=7.5,
        sanctioned_load_kw=5.60,
        pump_type="Submersible Borewell Pump",
        permitted_use="Paddy & Groundnut Irrigation",
        irrigation_schedule_summary="Day: 07:00-11:00, Afternoon: 14:00-17:00",
        meter_id="MTR_AGRI_01",
        upstream_branch_id="U_06",
        is_active=True,
        registration_date="2023-06-12",
        is_simulated=True,
    ),
    AgriConnection(
        service_id="AGRI-TN-042-F02",
        farmer_name="K. Ramasamy",
        survey_number="145/1B",
        feeder_id="T1",
        transformer_id="NODE_T1",
        section_id="F",
        sanctioned_load_hp=10.0,
        sanctioned_load_kw=7.46,
        pump_type="Deep Borewell Submersible Pump",
        permitted_use="Sugarcane & Banana Plantation",
        irrigation_schedule_summary="Morning: 06:30-10:30, Evening: 15:00-18:00",
        meter_id="MTR_AGRI_02",
        upstream_branch_id="U_06",
        is_active=True,
        registration_date="2022-11-20",
        is_simulated=True,
    ),
    AgriConnection(
        service_id="AGRI-TN-042-F03",
        farmer_name="M. Anbazhagan",
        survey_number="148/3",
        feeder_id="T1",
        transformer_id="NODE_T1",
        section_id="F",
        sanctioned_load_hp=5.0,
        sanctioned_load_kw=3.73,
        pump_type="Surface Centrifugal Pump",
        permitted_use="Open Well Paddy Pumping",
        irrigation_schedule_summary="Morning: 07:00-11:00",
        meter_id="MTR_AGRI_03",
        upstream_branch_id="U_06",
        is_active=True,
        registration_date="2024-01-10",
        is_simulated=True,
    ),
    AgriConnection(
        service_id="AGRI-TN-042-F04",
        farmer_name="P. Selvi",
        survey_number="151/4A",
        feeder_id="T1",
        transformer_id="NODE_T1",
        section_id="F",
        sanctioned_load_hp=7.5,
        sanctioned_load_kw=5.60,
        pump_type="Submersible Borewell Pump",
        permitted_use="Pulses & Cotton Irrigation",
        irrigation_schedule_summary="Morning: 07:30-11:30, Afternoon: 14:00-16:30",
        meter_id="MTR_AGRI_04",
        upstream_branch_id="U_06",
        is_active=True,
        registration_date="2023-08-04",
        is_simulated=True,
    ),
    AgriConnection(
        service_id="AGRI-TN-042-F05",
        farmer_name="V. Natarajan",
        survey_number="153/2",
        feeder_id="T1",
        transformer_id="NODE_T1",
        section_id="F",
        sanctioned_load_hp=5.0,
        sanctioned_load_kw=3.73,
        pump_type="Submersible Borewell Pump",
        permitted_use="Vegetable Crop Drip Irrigation",
        irrigation_schedule_summary="Morning: 06:00-09:30, Evening: 16:00-18:30",
        meter_id="MTR_AGRI_05",
        upstream_branch_id="U_06",
        is_active=True,
        registration_date="2024-02-18",
        is_simulated=True,
    ),
    AgriConnection(
        service_id="AGRI-TN-042-F06",
        farmer_name="R. Chinnasamy",
        survey_number="156/1A",
        feeder_id="T1",
        transformer_id="NODE_T1",
        section_id="F",
        sanctioned_load_hp=10.0,
        sanctioned_load_kw=7.46,
        pump_type="Deep Borewell Submersible Pump",
        permitted_use="Paddy Nursery & Coconut Grove",
        irrigation_schedule_summary="Morning: 07:00-12:00, Afternoon: 14:30-17:30",
        meter_id="MTR_AGRI_06",
        upstream_branch_id="U_06",
        is_active=True,
        registration_date="2021-09-30",
        is_simulated=True,
    ),
]


class AgriDiversionEngine:
    def __init__(self, seed: int = 42):
        self.seed = seed
        self.rng = np.random.RandomState(seed)
        self.connections: Dict[str, AgriConnection] = {c.service_id: c.model_copy() for c in DEFAULT_AGRI_CONNECTIONS}
        self.telemetry_series: Dict[str, List[AgriTelemetryReading]] = {}
        self.multi_point_balances: List[MultiPointEnergyBalance] = []
        self.evaluations: List[AgriAnomalyEvaluation] = []
        self.alerts: Dict[str, AgriAlert] = {}
        self.active_scenario: str = "COMMERCIAL_DIVERSION_OFF_HOURS"
        
        # Pre-train baseline Isolation Forest on synthetic normal pump profiles
        self.iso_forest = self._train_baseline_model()
        # Initialize telemetry and balances with default scenario
        self.run_simulation(self.active_scenario)

    def simulate_day(self, scenario: str = "COMMERCIAL_DIVERSION_OFF_HOURS", seed: Optional[int] = None) -> Dict[str, Any]:
        """Convenience alias for running simulation with optional seed."""
        if seed is not None:
            self.seed = seed
        return self.run_simulation(scenario=scenario)


    def _train_baseline_model(self) -> IsolationForest:
        """
        Trains an unsupervised IsolationForest model on clean baseline agricultural operating cycles:
        Features: [active_kw, power_factor, pump_on_flag, is_night, load_ratio]
        """
        rng = np.random.RandomState(self.seed)
        samples = []
        # Generate 1200 normal agricultural intervals
        for _ in range(1200):
            hour = rng.uniform(0, 24)
            is_irrigation_hour = (7 <= hour <= 11) or (14 <= hour <= 17)
            pump_on = 1.0 if (is_irrigation_hour and rng.rand() < 0.85) else 0.0
            
            if pump_on:
                kw = rng.normal(5.5, 0.4)
                pf = rng.normal(0.78, 0.03)  # Inductive induction motor PF
                ratio = kw / 5.60
            else:
                kw = rng.uniform(0.01, 0.05)  # Idle control panel standby
                pf = rng.uniform(0.60, 0.75)
                ratio = kw / 5.60

            is_night = 1.0 if (hour >= 20 or hour < 6) else 0.0
            samples.append([kw, pf, pump_on, is_night, ratio])

        X = np.array(samples)
        model = IsolationForest(n_estimators=60, contamination=0.04, random_state=self.seed)
        model.fit(X)
        return model

    def run_simulation(self, scenario: str = "COMMERCIAL_DIVERSION_OFF_HOURS") -> Dict[str, Any]:
        """
        Generates full 96-interval 24h telemetry for all registered agricultural connections,
        performs multi-point energy balance across boundaries, evaluates anomalies,
        and generates evidence-based alerts with alternative engineering explanations.
        """
        self.active_scenario = scenario
        self.rng = np.random.RandomState(self.seed)
        self.telemetry_series = {c: [] for c in self.connections}
        self.multi_point_balances = []
        self.evaluations = []
        self.alerts = {}

        total_intervals = 96
        # Section F incoming feeder base (supplies both rural hamlet F households and the 6 agri pumps)
        sec_f_incoming = np.zeros(total_intervals)
        sum_agri_metered = np.zeros(total_intervals)
        sum_downstream_branch = np.zeros(total_intervals)

        # 1. Generate individual connection telemetry
        for s_idx, (service_id, conn) in enumerate(self.connections.items()):
            sanctioned_kw = conn.sanctioned_load_kw
            conn_series: List[AgriTelemetryReading] = []
            cumulative_kwh = 0.0

            for i in range(total_intervals):
                time_hours = i * 0.25
                h = int(time_hours)
                m = int((time_hours - h) * 60)
                time_str = f"{h:02d}:{m:02d}"
                timestamp = f"2026-10-10T{time_str}:00+05:30"

                # Standard permitted irrigation windows
                # Morning: 07:00-11:00 (intervals 28-44)
                # Afternoon: 14:00-17:00 (intervals 56-68)
                is_morning = 28 <= i <= 44
                is_afternoon = 56 <= i <= 68

                # Base normal pump state
                if is_morning or is_afternoon:
                    pump_status = "ON"
                    # Inductive motor draw matches pump rating
                    base_kw = sanctioned_kw * self.rng.uniform(0.92, 1.05)
                    base_pf = self.rng.uniform(0.76, 0.83)
                    voltage = self.rng.uniform(218.0, 226.0)  # Moderate voltage sag under pump load
                else:
                    pump_status = "OFF"
                    base_kw = self.rng.uniform(0.01, 0.04)   # Standby electronics / timer
                    base_pf = self.rng.uniform(0.65, 0.75)
                    voltage = self.rng.uniform(228.0, 235.0)

                # Inject Scenario Conditions
                data_quality = "simulated"
                upstream_spur_unmetered = 0.0
                downstream_branch_draw = base_kw

                if scenario == "COMMERCIAL_DIVERSION_OFF_HOURS":
                    # In connection F01, pump is OFF, but flat non-agricultural commercial load (welders/mills) is drawn between 19:30 and 23:00 (intervals 78 to 92)
                    if service_id == "AGRI-TN-042-F01" and 78 <= i <= 92:
                        pump_status = "OFF"
                        base_kw = 5.20 + self.rng.uniform(-0.15, 0.20)
                        base_pf = 0.97  # Flat resistive load (heaters/commercial processing)
                        voltage = 222.0
                        downstream_branch_draw = 0.05  # Pump discharge line has zero water flow!

                elif scenario == "UNAUTHORIZED_BRANCH_TAP":
                    # An unauthorized physical tap is tapped upstream of pump meter F02 on lateral U-06 between 19:00 and 22:30 (intervals 76 to 90)
                    if service_id == "AGRI-TN-042-F02" and 76 <= i <= 90:
                        upstream_spur_unmetered = 6.40 + self.rng.uniform(-0.25, 0.30)
                        # Meter F02 itself shows normal OFF state
                        pump_status = "OFF"
                        base_kw = 0.03
                        downstream_branch_draw = 0.03

                elif scenario == "LEGITIMATE_DROUGHT_SHIFT":
                    # Legitimate off-schedule irrigation shift in night window (01:00-04:30)
                    if service_id == "AGRI-TN-042-F01" and 4 <= i <= 18:
                        pump_status = "ON"
                        base_kw = sanctioned_kw * 0.98
                        base_pf = 0.78  # Pure inductive motor PF
                        downstream_branch_draw = base_kw  # Full water delivery verified!

                elif scenario == "MOTOR_FAULT_OVERLOAD":
                    # Pump motor mechanical bearing wear / silt ingress in F03
                    if service_id == "AGRI-TN-042-F03" and (is_morning or is_afternoon):
                        pump_status = "FAULT"
                        base_kw = sanctioned_kw * 1.38  # Excessive draw due to mechanical friction
                        base_pf = 0.58  # Very poor power factor
                        voltage = 208.0  # Severe voltage drop due to motor stall current

                elif scenario == "TELEMETRY_PACKET_LOSS":
                    # 25% packets lost in rural RF mesh
                    if self.rng.rand() < 0.25:
                        data_quality = "missing"
                        base_kw = 0.0
                        voltage = 0.0

                current_a = (base_kw * 1000.0) / max(1.0, voltage * base_pf) if voltage > 0 else 0.0
                kwh_interval = base_kw * 0.25
                cumulative_kwh += kwh_interval

                reading = AgriTelemetryReading(
                    service_id=service_id,
                    interval_index=i,
                    time_str=time_str,
                    timestamp=timestamp,
                    voltage_v=round(voltage, 1),
                    current_a=round(current_a, 2),
                    active_power_kw=round(base_kw, 2),
                    cumulative_energy_kwh=round(cumulative_kwh, 2),
                    power_factor=round(base_pf, 2),
                    pump_operating_status=pump_status,
                    upstream_section_energy_kwh=round(kwh_interval * 1.08, 3),
                    upstream_branch_residual_kwh=round(upstream_spur_unmetered * 0.25, 3),
                    downstream_branch_energy_kwh=round(downstream_branch_draw * 0.25, 3),
                    data_quality=data_quality,
                    is_simulated=True,
                )
                conn_series.append(reading)

                sum_agri_metered[i] += kwh_interval
                sum_downstream_branch[i] += downstream_branch_draw * 0.25
                sec_f_incoming[i] += (base_kw + upstream_spur_unmetered) * 0.25 * 1.045  # includes 4.5% line loss

            self.telemetry_series[service_id] = conn_series

        # 2. Multi-Point Energy Balance across Boundaries
        for i in range(total_intervals):
            time_hours = i * 0.25
            h = int(time_hours)
            m = int((time_hours - h) * 60)
            time_str = f"{h:02d}:{m:02d}"

            feeder_supply = sec_f_incoming[i] * 1.03
            sec_in = sec_f_incoming[i]
            metered = sum_agri_metered[i]
            downstream = sum_downstream_branch[i]
            tech_loss = sec_in * 0.045
            unaccounted = max(0.0, sec_in - metered - tech_loss)

            # Determine smallest confirmed monitoring zone
            if unaccounted > 0.40:
                zone = "Section F - Borewell Spur Lateral U-06 (Spur Poles F-04 to F-08)"
                coverage = "HIGH"
            elif unaccounted > 0.15:
                zone = "Section F - General Agricultural Feeder Header"
                coverage = "MEDIUM"
            else:
                zone = "Feeder T1 - Section F (Within Standard Tolerance)"
                coverage = "HIGH"

            self.multi_point_balances.append(
                MultiPointEnergyBalance(
                    time_str=time_str,
                    interval_index=i,
                    feeder_supplied_kwh=round(feeder_supply, 3),
                    section_incoming_kwh=round(sec_in, 3),
                    sum_agri_metered_kwh=round(metered, 3),
                    sum_downstream_branch_kwh=round(downstream, 3),
                    estimated_technical_loss_kwh=round(tech_loss, 3),
                    unaccounted_boundary_residual_kwh=round(unaccounted, 3),
                    smallest_confirmed_monitoring_zone=zone,
                    sensor_coverage_confidence=coverage,
                )
            )

        # 3. AI Anomaly Evaluation & Evidence-Based Alerting
        self._evaluate_anomalies_and_generate_alerts(scenario)

        return self.get_overview()

    def _evaluate_anomalies_and_generate_alerts(self, scenario: str):
        """
        Executes machine learning pattern recognition + physical boundary checks + presumption of innocence.
        """
        total_intervals = 96

        for service_id, readings in self.telemetry_series.items():
            conn = self.connections[service_id]
            for r in readings:
                i = r.interval_index
                time_hours = i * 0.25
                is_night = 1.0 if (time_hours >= 20.0 or time_hours < 06.0) else 0.0
                pump_on = 1.0 if r.pump_operating_status in ["ON", "FAULT"] else 0.0
                ratio = r.active_power_kw / max(0.1, conn.sanctioned_load_kw)

                # Feature vector for ML model
                feat = np.array([[r.active_power_kw, r.power_factor, pump_on, is_night, ratio]])
                # Isolation Forest decision function: negative means outlier
                raw_score = -float(self.iso_forest.decision_function(feat)[0])
                # Normalize anomaly score to [0, 10]
                norm_score = max(0.0, min(10.0, (raw_score + 0.25) * 16.0))

                # Presumption of Innocence & Anomaly Classification
                risk = "NOMINAL"
                suspected_type = "NORMAL_AGRICULTURAL_CONSUMPTION"
                alt_explanations = []
                rec_steps = ["Routine telemetry monitoring."]
                confidence = "HIGH"

                # Condition 1: High load while pump state is OFF and high resistive PF (Commercial Diversion)
                if r.pump_operating_status == "OFF" and r.active_power_kw > 2.0:
                    if r.power_factor >= 0.92:
                        risk = "HIGH"
                        suspected_type = "COMMERCIAL_DIVERSION_OFF_HOURS"
                        norm_score = max(norm_score, 8.4)
                        alt_explanations = [
                            "Pump starter auxiliary contactor failure falsely indicating pump is OFF while pump is running.",
                            "Emergency drinking water booster pump operated during scheduled agricultural rest period.",
                            "Possible diversion of subsidized power to high-resistive commercial heaters or cottage industry."
                        ]
                        rec_steps = [
                            "Verify pump contactor feedback telemetry on switchboard.",
                            "Check downstream water meter / flow transducer to confirm zero irrigation discharge.",
                            "Authorize physical field audit of farm premises by Assistant Engineer."
                        ]
                    else:
                        risk = "MEDIUM"
                        suspected_type = "UNREGISTERED_INDUCTIVE_LOAD"
                        alt_explanations = [
                            "Farmer operated unmetered de-watering pump due to local waterlogging.",
                            "Defective pump motor capacitor bank resulting in high standby current draw."
                        ]
                        rec_steps = ["Inspect power factor capacitor bank at agricultural service pole."]

                # Condition 2: Upstream Lateral Energy Gap (Unauthorized Tapping on Branch)
                elif r.upstream_branch_residual_kwh > 0.8:
                    risk = "HIGH"
                    suspected_type = "UNAUTHORIZED_LATERAL_BRANCH_TAP"
                    norm_score = max(norm_score, 8.8)
                    alt_explanations = [
                        "Conductor insulation breakdown causing sustained ground fault leakage to earth.",
                        "Overhead LT line jumper overheating or high-impedance splice joint.",
                        "Unauthorized hook/bypass tapped directly on LT agricultural spur upstream of consumer meter."
                    ]
                    rec_steps = [
                        "Perform thermal imaging inspection along LT line from Pole F-04 to F-08.",
                        "Execute simultaneous clamp ammeter check between spur junction and service entrance.",
                        "Check for unauthorized service drop cable spliced into bare overhead conductors."
                    ]

                # Condition 3: Motor Overload / Mechanical Fault
                elif r.pump_operating_status == "FAULT" or (r.active_power_kw > conn.sanctioned_load_kw * 1.3):
                    risk = "MEDIUM"
                    suspected_type = "PUMP_MOTOR_FAULT_OR_OVERLOAD"
                    norm_score = max(norm_score, 5.8)
                    alt_explanations = [
                        "Severe borewell silt deposition causing impeller friction and motor overload.",
                        "Voltage sag on rural tail-end feeder causing elevated motor operating current (P = V*I).",
                        "Submersible motor winding insulation degradation."
                    ]
                    rec_steps = [
                        "Notify farmer regarding motor overload and voltage drop.",
                        "Test motor insulation resistance (Megger test) and phase-to-phase balance."
                    ]

                # Condition 4: Night Pumping (Legitimate Seasonal Shift)
                elif is_night and r.pump_operating_status == "ON":
                    if 0.74 <= r.power_factor <= 0.84:
                        # Classic inductive motor signature!
                        risk = "LOW"
                        suspected_type = "OFF_PEAK_LEGITIMATE_IRRIGATION"
                        norm_score = 2.2
                        alt_explanations = [
                            "Farmer utilizing night power supply window due to three-phase agricultural roster scheduling.",
                            "Drought water-table drop requiring night irrigation to reduce evaporation loss."
                        ]
                        rec_steps = [
                            "Verify electricity board agricultural supply roster for Section F.",
                            "No investigation required - consumption matches verified agricultural motor profile."
                        ]

                eval_item = AgriAnomalyEvaluation(
                    service_id=service_id,
                    timestamp=r.timestamp,
                    interval_index=i,
                    time_str=r.time_str,
                    anomaly_score=round(norm_score, 2),
                    risk_category=risk,
                    suspected_anomaly_type=suspected_type,
                    observed_power_kw=r.active_power_kw,
                    expected_power_kw=conn.sanctioned_load_kw if r.pump_operating_status == "ON" else 0.05,
                    power_factor=r.power_factor,
                    pump_status=r.pump_operating_status,
                    confidence_level=confidence,
                    smallest_confirmed_monitoring_area="Section F - Borewell Spur Lateral U-06",
                    supporting_readings={
                        "voltage_v": r.voltage_v,
                        "current_a": r.current_a,
                        "upstream_branch_residual_kwh": r.upstream_branch_residual_kwh,
                        "downstream_branch_kwh": r.downstream_branch_energy_kwh,
                    },
                    alternative_engineering_explanations=alt_explanations,
                    recommended_verification_steps=rec_steps,
                )
                self.evaluations.append(eval_item)

        # 4. Consolidate Evidence-Based Alerts for High/Medium Risk Episodes
        high_risk_evals = [e for e in self.evaluations if e.risk_category in ["HIGH", "MEDIUM"]]
        grouped_by_service: Dict[str, List[AgriAnomalyEvaluation]] = {}
        for e in high_risk_evals:
            grouped_by_service.setdefault(e.service_id, []).append(e)

        alert_counter = 1
        for sid, evals_list in grouped_by_service.items():
            if len(evals_list) >= 3:  # Persistence gate: requires at least 3 intervals (45 mins)
                conn = self.connections[sid]
                peak_eval = max(evals_list, key=lambda x: x.anomaly_score)
                alert_id = f"AGRI-ALT-2026-{alert_counter:03d}"
                alert_counter += 1

                total_diverted = sum(
                    max(0.0, e.observed_power_kw - e.expected_power_kw) * 0.25 for e in evals_list
                )

                alert = AgriAlert(
                    id=alert_id,
                    service_id=sid,
                    farmer_name=conn.farmer_name,
                    section_id=conn.section_id,
                    feeder_id=conn.feeder_id,
                    timestamp=peak_eval.timestamp,
                    time_window=f"{evals_list[0].time_str} - {evals_list[-1].time_str} ({len(evals_list)} intervals)",
                    interval_index=peak_eval.interval_index,
                    severity="CRITICAL" if peak_eval.risk_category == "HIGH" else "HIGH",
                    risk_category=peak_eval.risk_category,
                    anomaly_score=peak_eval.anomaly_score,
                    suspected_diversion_type=peak_eval.suspected_anomaly_type,
                    diverted_energy_estimate_kwh=round(total_diverted, 2),
                    observed_power_kw=peak_eval.observed_power_kw,
                    sanctioned_load_kw=conn.sanctioned_load_kw,
                    power_factor=peak_eval.power_factor,
                    smallest_confirmed_monitoring_zone="Section F - Borewell Spur Lateral U-06 (Spur Poles F-04 to F-08)",
                    alternative_explanations=peak_eval.alternative_engineering_explanations,
                    status="New",
                    created_at=datetime.now(timezone.utc).isoformat(),
                    is_simulated=True,
                )
                self.alerts[alert_id] = alert

    def get_overview(self) -> Dict[str, Any]:
        """Returns overall KPI summary for the agricultural diversion dashboard."""
        high_count = sum(1 for a in self.alerts.values() if a.risk_category == "HIGH")
        med_count = sum(1 for a in self.alerts.values() if a.risk_category == "MEDIUM")
        low_count = sum(1 for a in self.alerts.values() if a.risk_category == "LOW")
        pending_insp = sum(1 for a in self.alerts.values() if a.status in ["New", "Under Review", "Inspection Scheduled"])
        confirmed = sum(1 for a in self.alerts.values() if a.status == "Diversion Confirmed")
        total_diverted = sum(a.diverted_energy_estimate_kwh for a in self.alerts.values())

        feeder_supplied = sum(b.section_incoming_kwh for b in self.multi_point_balances)
        metered_total = sum(b.sum_agri_metered_kwh for b in self.multi_point_balances)
        residual_total = sum(b.unaccounted_boundary_residual_kwh for b in self.multi_point_balances)

        return {
            "total_registered_connections": len(self.connections),
            "connections_monitored": len([c for c in self.connections.values() if c.is_active]),
            "high_risk_anomalies_count": high_count,
            "medium_risk_anomalies_count": med_count,
            "low_risk_anomalies_count": low_count,
            "pending_field_inspections": pending_insp,
            "confirmed_diversion_cases": confirmed,
            "total_diverted_energy_estimate_kwh": round(total_diverted, 2),
            "feeder_agri_energy_supplied_kwh": round(feeder_supplied, 2),
            "registered_agri_energy_consumed_kwh": round(metered_total, 2),
            "section_agri_residual_kwh": round(residual_total, 2),
            "active_scenario": self.active_scenario,
            "is_simulated_mode": True,
            "disconnection_safeguard_active": True,
        }

    def register_connection(self, data: Dict[str, Any]) -> AgriConnection:
        """Registers a new agricultural service connection."""
        sid = data.get("service_id")
        if not sid:
            sid = f"AGRI-TN-042-F{len(self.connections) + 1:02d}"
        
        hp = float(data.get("sanctioned_load_hp", 7.5))
        kw = round(hp * 0.746, 2)

        conn = AgriConnection(
            service_id=sid,
            farmer_name=data.get("farmer_name", "New Farmer"),
            survey_number=data.get("survey_number", "100/1"),
            feeder_id="T1",
            transformer_id="NODE_T1",
            section_id=data.get("section_id", "F"),
            sanctioned_load_hp=hp,
            sanctioned_load_kw=kw,
            pump_type=data.get("pump_type", "Submersible Borewell Pump"),
            permitted_use=data.get("permitted_use", "Agricultural Irrigation"),
            irrigation_schedule_summary=data.get("irrigation_schedule_summary", "Day Window: 07:00-11:00"),
            meter_id=f"MTR_{sid.replace('-', '_')}",
            upstream_branch_id="U_06",
            is_active=True,
            registration_date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            is_simulated=True,
        )
        self.connections[sid] = conn
        return conn

    def update_connection(self, service_id: str, updates: Dict[str, Any]) -> Optional[AgriConnection]:
        """Updates agricultural connection metadata."""
        conn = self.connections.get(service_id)
        if not conn:
            return None
        
        if "farmer_name" in updates and updates["farmer_name"]:
            conn.farmer_name = updates["farmer_name"]
        if "sanctioned_load_hp" in updates and updates["sanctioned_load_hp"]:
            conn.sanctioned_load_hp = float(updates["sanctioned_load_hp"])
            conn.sanctioned_load_kw = round(conn.sanctioned_load_hp * 0.746, 2)
        if "pump_type" in updates and updates["pump_type"]:
            conn.pump_type = updates["pump_type"]
        if "permitted_use" in updates and updates["permitted_use"]:
            conn.permitted_use = updates["permitted_use"]
        if "irrigation_schedule_summary" in updates and updates["irrigation_schedule_summary"]:
            conn.irrigation_schedule_summary = updates["irrigation_schedule_summary"]
        if "is_active" in updates and updates["is_active"] is not None:
            conn.is_active = bool(updates["is_active"])

        return conn

    def update_inspection_outcome(self, alert_id: str, update_data: Dict[str, Any]) -> Optional[AgriAlert]:
        """Updates alert inspection status with authorized field notes."""
        alert = self.alerts.get(alert_id)
        if not alert:
            return None

        alert.status = update_data.get("status", alert.status)
        alert.assigned_inspector = update_data.get("inspector_name", alert.assigned_inspector or "Assistant Engineer")
        alert.inspection_outcome_notes = update_data.get("findings_notes", "")
        return alert


# Singleton instance
agri_engine = AgriDiversionEngine()
