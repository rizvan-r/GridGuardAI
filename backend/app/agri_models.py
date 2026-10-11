"""
Agricultural Electricity Diversion Detection & Prevention: Data Models
Defines schemas for agricultural connection registration, smart energy telemetry,
multi-point energy boundary accounting, AI anomaly analysis, and authorized inspection workflows.
"""
from typing import List, Dict, Optional, Any, Literal
from pydantic import BaseModel, Field


class AgriConnection(BaseModel):
    service_id: str = Field(..., description="Unique Agricultural Service Connection ID, e.g. AGRI-TN-042-F01")
    farmer_name: str = Field(..., description="Registered farmer / consumer name")
    survey_number: str = Field(..., description="Land survey parcel number")
    feeder_id: str = Field(default="T1", description="Supplying 11kV distribution feeder ID")
    transformer_id: str = Field(default="NODE_T1", description="Distribution transformer ID (250 kVA)")
    section_id: str = Field(default="F", description="Distribution section / hamlet ID (Section F Agri cluster)")
    sanctioned_load_hp: float = Field(..., description="Sanctioned agricultural pump load in Horsepower (HP)")
    sanctioned_load_kw: float = Field(..., description="Sanctioned load in kW (1 HP = 0.746 kW)")
    pump_type: str = Field(default="Submersible Borewell Pump", description="Registered pump type")
    permitted_use: str = Field(default="Paddy & Groundnut Irrigation", description="Subsidized permitted agricultural activity")
    irrigation_schedule_summary: str = Field(
        default="Day Window: 07:00-11:00, Afternoon Window: 14:00-17:00",
        description="Expected normal irrigation operating hours"
    )
    meter_id: str = Field(..., description="AMI smart meter serial ID installed at pump switchboard")
    upstream_branch_id: str = Field(default="U_06", description="Upstream candidate lateral / branch node ID")
    is_active: bool = Field(default=True, description="Connection active energization status")
    registration_date: str = Field(default="2024-03-15", description="Registration timestamp")
    is_simulated: bool = Field(default=True, description="Flag designating simulated readings vs live field meter")


class AgriConnectionCreate(BaseModel):
    service_id: str
    farmer_name: str
    survey_number: str
    sanctioned_load_hp: float
    pump_type: Optional[str] = "Submersible Borewell Pump"
    permitted_use: Optional[str] = "Paddy & Groundnut Irrigation"
    irrigation_schedule_summary: Optional[str] = "Day Window: 07:00-11:00, Afternoon Window: 14:00-17:00"
    section_id: Optional[str] = "F"
    upstream_branch_id: Optional[str] = "U_06"


class AgriConnectionUpdate(BaseModel):
    farmer_name: Optional[str] = None
    sanctioned_load_hp: Optional[float] = None
    pump_type: Optional[str] = None
    permitted_use: Optional[str] = None
    irrigation_schedule_summary: Optional[str] = None
    is_active: Optional[bool] = None


class AgriTelemetryReading(BaseModel):
    service_id: str
    interval_index: int
    time_str: str
    timestamp: str
    voltage_v: float
    current_a: float
    active_power_kw: float
    cumulative_energy_kwh: float
    power_factor: float
    pump_operating_status: Literal["ON", "OFF", "IDLE", "FAULT"]
    upstream_section_energy_kwh: float
    upstream_branch_residual_kwh: float
    downstream_branch_energy_kwh: float
    data_quality: Literal["good", "noisy", "missing", "simulated"]
    is_simulated: bool = True


class MultiPointEnergyBalance(BaseModel):
    time_str: str
    interval_index: int
    feeder_supplied_kwh: float
    section_incoming_kwh: float
    sum_agri_metered_kwh: float
    sum_downstream_branch_kwh: float
    estimated_technical_loss_kwh: float
    unaccounted_boundary_residual_kwh: float
    smallest_confirmed_monitoring_zone: str
    sensor_coverage_confidence: Literal["HIGH", "MEDIUM", "LOW", "INCOMPLETE_COVERAGE"]


class AgriAnomalyEvaluation(BaseModel):
    service_id: str
    timestamp: str
    interval_index: int
    time_str: str
    anomaly_score: float
    risk_category: Literal["LOW", "MEDIUM", "HIGH", "NOMINAL"]
    suspected_anomaly_type: str
    observed_power_kw: float
    expected_power_kw: float
    power_factor: float
    pump_status: str
    confidence_level: Literal["HIGH", "MEDIUM", "LOW", "INCONCLUSIVE"]
    smallest_confirmed_monitoring_area: str
    supporting_readings: Dict[str, Any]
    alternative_engineering_explanations: List[str]
    recommended_verification_steps: List[str]


class AgriAlert(BaseModel):
    id: str
    service_id: str
    farmer_name: str
    section_id: str
    feeder_id: str = "T1"
    timestamp: str
    time_window: str
    interval_index: int
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    risk_category: Literal["LOW", "MEDIUM", "HIGH"]
    anomaly_score: float
    suspected_diversion_type: str
    diverted_energy_estimate_kwh: float
    observed_power_kw: float
    sanctioned_load_kw: float
    power_factor: float
    smallest_confirmed_monitoring_zone: str
    alternative_explanations: List[str]
    status: Literal[
        "New",
        "Under Review",
        "Inspection Scheduled",
        "Inspection Completed",
        "Diversion Confirmed",
        "No Diversion Found",
        "Inconclusive",
        "Closed"
    ] = "New"
    assigned_inspector: Optional[str] = None
    inspection_outcome_notes: Optional[str] = None
    created_at: str
    is_simulated: bool = True


class AgriInspectionUpdate(BaseModel):
    status: Literal[
        "New",
        "Under Review",
        "Inspection Scheduled",
        "Inspection Completed",
        "Diversion Confirmed",
        "No Diversion Found",
        "Inconclusive",
        "Closed"
    ]
    inspector_name: str = "Assistant Engineer (O&M)"
    findings_notes: Optional[str] = None
    corrective_action_taken: Optional[str] = None
    is_meter_tampered: Optional[bool] = False
    is_bypass_detected: Optional[bool] = False
    non_agricultural_load_found_kw: Optional[float] = 0.0


class AgriAuditLog(BaseModel):
    id: str
    alert_id: Optional[str]
    service_id: str
    action_type: str
    actor_name: str
    actor_role: str
    details: str
    timestamp: str
    pre_state: Optional[Dict[str, Any]] = None
    post_state: Optional[Dict[str, Any]] = None


class AgriOverviewSummary(BaseModel):
    total_registered_connections: int
    connections_monitored: int
    high_risk_anomalies_count: int
    medium_risk_anomalies_count: int
    low_risk_anomalies_count: int
    pending_field_inspections: int
    confirmed_diversion_cases: int
    total_diverted_energy_estimate_kwh: float
    feeder_agri_energy_supplied_kwh: float
    registered_agri_energy_consumed_kwh: float
    section_agri_residual_kwh: float
    active_scenario: str
    is_simulated_mode: bool = True
    disconnection_safeguard_active: bool = True
