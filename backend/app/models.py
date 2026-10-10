"""
Data models and schemas for GridGuard AI
"""
from typing import List, Dict, Optional, Any, Literal
from pydantic import BaseModel, Field


class ScenarioType(str):
    NORMAL = "NORMAL"
    EVENING_UNMETERED = "EVENING_UNMETERED"
    METER_FAULT = "METER_FAULT"
    MULTIPLE_ANOMALIES = "MULTIPLE_ANOMALIES"
    NOISY_MEASUREMENTS = "NOISY_MEASUREMENTS"


class SimulationRequest(BaseModel):
    scenario: str = Field(default="EVENING_UNMETERED", description="Scenario type: NORMAL, EVENING_UNMETERED, METER_FAULT, MULTIPLE_ANOMALIES, NOISY_MEASUREMENTS")
    seed: int = Field(default=42, description="Random seed for deterministic reproducibility")
    custom_unmetered_kw: Optional[float] = Field(default=None, description="Optional override for unmetered load peak kW")
    custom_target_candidate: Optional[str] = Field(default=None, description="Optional target candidate e.g. U-03")
    technical_loss_pct: Optional[float] = Field(default=4.5, description="Expected baseline technical loss percentage")


class IntervalReading(BaseModel):
    interval_index: int
    time_str: str  # e.g. "19:15"
    transformer_kwh: float
    household_total_kwh: float
    technical_loss_kwh: float
    raw_discrepancy_kwh: float
    unexplained_kwh: float
    unexplained_pct: float
    anomaly_score: float
    is_anomaly: bool
    section_breakdown: Dict[str, float]
    data_quality: str = "good"  # "good", "noisy", "missing"


class SectionSummary(BaseModel):
    section_id: str
    section_name: str
    incoming_kwh: float
    household_kwh: float
    technical_loss_kwh: float
    residual_kwh: float
    residual_pct: float
    anomaly_count: int
    status: str  # "NORMAL", "SUSPICIOUS", "FAULT", "NOISY"
    households: List[str]
    candidate_point: str


class FeederSummary(BaseModel):
    feeder_id: str
    feeder_name: str
    scenario: str
    seed: int
    simulation_timestamp: str
    transformer_energy_supplied_kwh: float
    total_household_energy_kwh: float
    estimated_technical_losses_kwh: float
    unexplained_discrepancy_kwh: float
    unexplained_discrepancy_pct: float
    active_alerts_count: int
    sections_count: int
    households_count: int
    peak_discrepancy_window: str
    peak_discrepancy_kw: float
    system_status: str
    sections: List[SectionSummary]


class CandidateRanking(BaseModel):
    rank: int
    candidate_id: str
    section_id: str
    label: str
    measured_residual_kwh: float
    persistence_intervals: int
    confidence: str  # "HIGH", "MEDIUM", "LOW", "AMBIGUOUS"
    data_quality: str
    supporting_evidence: str
    recommended_measurement: str


class LossAlert(BaseModel):
    id: str
    scenario_id: str
    feeder_id: str
    section_id: Optional[str]
    timestamp: str
    interval_index: int
    time_str: str
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    raw_discrepancy_kwh: float
    technical_loss_kwh: float
    unexplained_kwh: float
    unexplained_pct: float
    anomaly_score: float
    confidence_level: Literal["LOW", "MEDIUM", "HIGH", "AMBIGUOUS"]
    suspected_cause: str
    ranked_candidates: List[CandidateRanking] = []
    data_quality_warnings: List[str] = []
    recommended_action: str
    status: Literal["Open", "Under Review", "Verified", "False Alarm", "Resolved"] = "Open"
    created_at: str


class AlertStatusUpdate(BaseModel):
    status: Literal["Open", "Under Review", "Verified", "False Alarm", "Resolved"]
    notes: Optional[str] = None
    operator_name: Optional[str] = "Grid Operator"


class AuditRecord(BaseModel):
    id: str
    alert_id: str
    previous_status: str
    new_status: str
    operator_name: str
    notes: Optional[str]
    timestamp: str


class ExplainRequest(BaseModel):
    question: Optional[str] = None


class ExplainResponse(BaseModel):
    alert_id: Optional[str]
    explanation: str
    mode: Literal["GEMINI_LIVE", "DETERMINISTIC_DEMO"]
    key_findings: List[str]
    safeguard_note: str


class SensorPlacementOption(BaseModel):
    sensor_id: str
    location_type: str  # "feeder", "section", "branch"
    target_id: str
    label: str
    cost_units: int
    uncertainty_reduction_pct: float
    is_active: bool


class MeasurementPlanRecommendation(BaseModel):
    active_meters: List[str]
    ambiguity_groups: List[Dict[str, Any]]
    sequential_steps_required: int
    hierarchical_steps_required: int
    step_reduction_pct: float
    next_recommended_sensor: str
    rationale: str
    limitations: str


class NetworkNodeDetail(BaseModel):
    id: str
    label: str
    node_type: str
    section_id: Optional[str]
    parent_id: Optional[str]
    status: str
    total_energy_kwh: float
    hourly_readings: List[float]
    residual_kwh: Optional[float] = None
    anomaly_score: Optional[float] = None
    recent_alerts: List[str] = []
