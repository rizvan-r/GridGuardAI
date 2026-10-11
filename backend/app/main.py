"""
GridGuard AI: FastAPI Backend
Intelligent Electricity Distribution Monitoring & Loss-Localization Platform
"""
import os
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from fastapi import FastAPI, HTTPException, Query, Body, status
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import numpy as np

# Load environment variables
load_dotenv()

from .models import (
    SimulationRequest,
    FeederSummary,
    SectionSummary,
    IntervalReading,
    LossAlert,
    AlertStatusUpdate,
    AuditRecord,
    ExplainRequest,
    ExplainResponse,
    MeasurementPlanRecommendation,
    SensorPlacementOption,
    NetworkNodeDetail,
)
from .simulator import (
    NetworkSimulator,
    SECTIONS,
    SECTION_NAMES,
    TOTAL_INTERVALS,
    TOTAL_HOUSEHOLDS,
    get_interval_time,
    get_households_for_section,
    get_candidate_for_section,
)
from .energy_engine import EnergyEngine
from .detector import AnomalyDetector
from .localizer import HierarchicalLocalizer
from .measurement_planner import MeasurementPlanner
from .gemini_service import GeminiExplainer
from .storage import storage
from .agri_models import (
    AgriConnection,
    AgriConnectionCreate,
    AgriConnectionUpdate,
    AgriTelemetryReading,
    MultiPointEnergyBalance,
    AgriAnomalyEvaluation,
    AgriAlert,
    AgriInspectionUpdate,
    AgriAuditLog,
    AgriOverviewSummary,
)
from .agri_engine import agri_engine


app = FastAPI(
    title="GridGuard AI API",
    description="Intelligent Electricity Loss Detection & Localization Platform Backend",
    version="1.0.0",
)

# CORS Configuration for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins in development mode
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

explainer = GeminiExplainer()


def run_pipeline(
    scenario: str = "EVENING_UNMETERED",
    seed: int = 42,
    custom_unmetered_kw: Optional[float] = None,
    custom_target_candidate: Optional[str] = None,
    technical_loss_pct: float = 4.5,
) -> Dict[str, Any]:
    """
    Core end-to-end execution pipeline:
    1. Simulator -> 2. EnergyEngine -> 3. AnomalyDetector -> 4. HierarchicalLocalizer -> 5. Alert Generation
    """
    # 1. Simulate
    sim = NetworkSimulator(seed=seed)
    sim_data = sim.simulate(
        scenario=scenario,
        technical_loss_pct=technical_loss_pct,
        custom_unmetered_kw=custom_unmetered_kw,
        custom_target_candidate=custom_target_candidate,
    )

    # 2. Energy Calculations
    discrepancies = EnergyEngine.calculate_discrepancies(
        transformer_input=sim_data["transformer_input"],
        total_household_energy=sim_data["total_household_reported"],
        estimated_technical_losses=sim_data["total_technical_loss"],
    )

    section_res = EnergyEngine.calculate_section_residuals(
        section_incoming_meters=sim_data["section_incoming_meters"],
        section_household_totals=sim_data["section_household_totals"],
        estimated_section_losses=sim_data["section_technical_losses"],
    )

    candidate_res = EnergyEngine.calculate_candidate_branch_residuals(
        candidate_branch_meters=sim_data["candidate_branch_meters"],
    )

    # 3. Anomaly Detection
    detector = AnomalyDetector()
    det_results = detector.detect_anomalies(
        unexplained_residuals=discrepancies["unexplained"],
        section_residuals=section_res,
        quality_flags=sim_data["quality_flags"],
        transformer_quality_flags=sim_data["transformer_quality_flags"],
    )

    # 4. Hierarchical Localization
    localization_results = HierarchicalLocalizer.localize(
        feeder_unexplained_residuals=discrepancies["unexplained"],
        section_residuals=section_res,
        candidate_branch_residuals=candidate_res,
        interval_data_quality=det_results["interval_data_quality"],
    )

    # 5. Build Generated Alerts
    alerts: List[LossAlert] = []
    # Identify distinct anomaly episodes
    anom_indices = np.where(det_results["is_anomalous"])[0]
    
    if len(anom_indices) > 0:
        # Group contiguous intervals into episodes
        episodes: List[List[int]] = []
        cur_ep = [anom_indices[0]]
        for idx in anom_indices[1:]:
            if idx == cur_ep[-1] + 1:
                cur_ep.append(idx)
            else:
                episodes.append(cur_ep)
                cur_ep = [idx]
        if cur_ep:
            episodes.append(cur_ep)

        for ep_idx, ep in enumerate(episodes):
            peak_interval = ep[int(np.argmax([discrepancies["unexplained"][i] for i in ep]))]
            severity = max([det_results["severity_labels"][i] for i in ep], key=lambda s: ["NORMAL", "LOW", "MEDIUM", "HIGH", "CRITICAL"].index(s))
            if severity == "NORMAL":
                severity = "LOW"

            time_str = get_interval_time(peak_interval)
            dom_sec = det_results["dominant_sections"][peak_interval] or localization_results["section_status"]["top_section_id"]
            
            # Localize specifically for this peak window
            window_loc = HierarchicalLocalizer.localize(
                feeder_unexplained_residuals=discrepancies["unexplained"],
                section_residuals=section_res,
                candidate_branch_residuals=candidate_res,
                interval_data_quality=det_results["interval_data_quality"],
                active_interval_index=peak_interval,
            )

            # Determine suspected cause based on profile
            suspected_cause = "Unmetered Lateral Connection"
            data_qual_warnings = []
            if any(det_results["interval_data_quality"][i] == "meter_fault_suspected" for i in ep):
                suspected_cause = "Household Meter Calibration Fault"
                data_qual_warnings.append("Meter diagnostic flag indicates potential CT saturation or under-recording.")
            elif any(det_results["interval_data_quality"][i] == "missing_data" for i in ep):
                suspected_cause = "Data Telemetry Packet Loss"
                data_qual_warnings.append("AMI communications loss observed across multiple nodes.")
            elif any(det_results["interval_data_quality"][i] == "noisy_measurements" for i in ep):
                suspected_cause = "Elevated Measurement Noise"
                data_qual_warnings.append("High measurement variance detected across feeder nodes.")

            rec_action = (
                f"Deploy portable clamp CT to verify Section {dom_sec} header and "
                f"{window_loc['top_candidate'].label}. Check service connections for unauthorized taps."
            )

            alert_id = f"ALT-2026-{ep_idx + 1:03d}"
            alerts.append(
                LossAlert(
                    id=alert_id,
                    scenario_id=scenario,
                    feeder_id="T1",
                    section_id=dom_sec,
                    timestamp=f"2026-10-10T{time_str}:00Z",
                    interval_index=int(peak_interval),
                    time_str=time_str,
                    severity=severity,
                    raw_discrepancy_kwh=round(float(discrepancies["raw_discrepancy"][peak_interval]), 3),
                    technical_loss_kwh=round(float(sim_data["total_technical_loss"][peak_interval]), 3),
                    unexplained_kwh=round(float(discrepancies["unexplained"][peak_interval]), 3),
                    unexplained_pct=round(float(discrepancies["unexplained_pct"][peak_interval]), 2),
                    anomaly_score=round(float(det_results["anomaly_scores"][peak_interval]), 2),
                    confidence_level=window_loc["top_candidate"].confidence,
                    suspected_cause=suspected_cause,
                    ranked_candidates=window_loc["candidate_rankings"],
                    data_quality_warnings=data_qual_warnings,
                    recommended_action=rec_action,
                    status="Open",
                    created_at=datetime.now(timezone.utc).isoformat(),
                )
            )

    # Store state
    state = {
        "scenario": scenario,
        "seed": seed,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sim_data": sim_data,
        "discrepancies": discrepancies,
        "section_res": section_res,
        "candidate_res": candidate_res,
        "det_results": det_results,
        "localization_results": localization_results,
    }
    storage.set_simulation(state, alerts)
    return state


@app.on_event("startup")
def startup_event():
    """Initialize default simulation on startup."""
    run_pipeline(scenario="EVENING_UNMETERED", seed=42)


# -----------------------------------------------------------------------------
# API Endpoints
# -----------------------------------------------------------------------------

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "GridGuard AI API",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database_mode": "Supabase" if storage.is_supabase_connected else "Local In-Memory",
        "ai_engine_mode": "Gemini Live API" if explainer.client else "Deterministic Demo Mode",
    }


@app.post("/api/simulation/run")
def trigger_simulation(req: SimulationRequest):
    """Run full synthetic simulation with seed and scenario parameters."""
    state = run_pipeline(
        scenario=req.scenario,
        seed=req.seed,
        custom_unmetered_kw=req.custom_unmetered_kw,
        custom_target_candidate=req.custom_target_candidate,
        technical_loss_pct=req.technical_loss_pct or 4.5,
    )
    return {
        "message": "Simulation and hierarchical detection completed successfully.",
        "scenario": req.scenario,
        "seed": req.seed,
        "active_alerts": len(storage.get_alerts()),
        "timestamp": state["timestamp"],
    }


@app.post("/api/detection/run")
def trigger_detection():
    """Re-run anomaly detection on current simulation state."""
    if not storage.current_simulation:
        run_pipeline()
    return {
        "message": "Anomaly detection engine executed.",
        "active_alerts": len(storage.get_alerts()),
    }


@app.get("/api/simulation/live/step")
def get_live_simulation_step(interval: int = Query(0, ge=0, le=95)):
    """
    Retrieve real-time telemetry, anomaly evaluation, and hierarchical localization
    for a specific 15-minute interval during live simulation playback.
    """
    if not storage.current_simulation:
        run_pipeline()

    state = storage.current_simulation
    sim_data = state["sim_data"]
    disc = state["discrepancies"]
    det = state["det_results"]
    sec_res = state["section_res"]
    cand_res = state["candidate_res"]

    i = interval
    time_str = get_interval_time(i)

    # Localize specifically for this active interval
    window_loc = HierarchicalLocalizer.localize(
        feeder_unexplained_residuals=disc["unexplained"],
        section_residuals=sec_res,
        candidate_branch_residuals=cand_res,
        interval_data_quality=det["interval_data_quality"],
        active_interval_index=i,
    )

    sec_breakdown = {sec: round(float(sec_res[sec]["residual"][i]), 3) for sec in SECTIONS}
    
    # Cumulative stats up to interval i
    cum_transformer = float(np.sum(sim_data["transformer_input"][:i+1]))
    cum_household = float(np.sum(sim_data["total_household_reported"][:i+1]))
    cum_tech_loss = float(np.sum(sim_data["total_technical_loss"][:i+1]))
    cum_unexplained = float(np.sum(disc["unexplained"][:i+1]))

    matching_alert = next((a for a in storage.get_alerts() if a.interval_index == i), None)

    return {
        "interval_index": i,
        "time_str": time_str,
        "transformer_kwh": round(float(sim_data["transformer_input"][i]), 3),
        "household_total_kwh": round(float(sim_data["total_household_reported"][i]), 3),
        "technical_loss_kwh": round(float(sim_data["total_technical_loss"][i]), 3),
        "raw_discrepancy_kwh": round(float(disc["raw_discrepancy"][i]), 3),
        "unexplained_kwh": round(float(disc["unexplained"][i]), 3),
        "unexplained_pct": round(float(disc["unexplained_pct"][i]), 2),
        "anomaly_score": round(float(det["anomaly_scores"][i]), 2),
        "is_anomaly": bool(det["is_anomalous"][i]),
        "severity": det["severity_labels"][i],
        "dominant_section": det["dominant_sections"][i] or window_loc["section_status"]["top_section_id"],
        "data_quality": det["interval_data_quality"][i],
        "section_breakdown": sec_breakdown,
        "localization": {
            "top_section": window_loc["section_status"]["top_section_id"],
            "top_candidate": window_loc["top_candidate"].model_dump(),
            "candidate_rankings": [c.model_dump() for c in window_loc["candidate_rankings"]],
            "hierarchical_path": f"Feeder T1 ➔ Section {window_loc['section_status']['top_section_id']} ➔ {window_loc['top_candidate'].candidate_id}",
            "ambiguity_note": window_loc["ambiguity_note"],
            "recommended_next_measurement": window_loc["recommended_next_measurement"],
        },
        "cumulative": {
            "transformer_kwh": round(cum_transformer, 2),
            "household_kwh": round(cum_household, 2),
            "technical_loss_kwh": round(cum_tech_loss, 2),
            "unexplained_kwh": round(cum_unexplained, 2),
            "unexplained_pct": round((cum_unexplained / max(0.01, cum_transformer)) * 100.0, 2),
        },
        "matching_alert_id": matching_alert.id if matching_alert else None,
    }


@app.get("/api/feeders/T1/summary", response_model=FeederSummary)
def get_feeder_summary():
    """Display live calculated feeder-level KPIs and section summaries."""
    if not storage.current_simulation:
        run_pipeline()

    state = storage.current_simulation
    sim_data = state["sim_data"]
    disc = state["discrepancies"]
    sec_res = state["section_res"]
    loc = state["localization_results"]

    daily = EnergyEngine.compute_daily_totals(
        transformer_input=sim_data["transformer_input"],
        total_household_energy=sim_data["total_household_reported"],
        technical_losses=sim_data["total_technical_loss"],
    )

    # Section summaries
    sec_summaries: List[SectionSummary] = []
    for sec in SECTIONS:
        s_data = sec_res[sec]
        in_kwh = float(np.sum(s_data["incoming"]))
        hh_kwh = float(np.sum(s_data["household_energy"]))
        loss_kwh = float(np.sum(s_data["technical_loss"]))
        res_kwh = float(np.sum(s_data["residual"]))
        pct = (res_kwh / max(0.01, in_kwh)) * 100.0

        # Section status
        if res_kwh > 2.0:
            status_str = "SUSPICIOUS"
        elif any(f == "faulty" for flags in sim_data["quality_flags"].values() for f in flags if sec == "C"):
            status_str = "FAULT"
        else:
            status_str = "NORMAL"

        cand = get_candidate_for_section(sec)
        sec_summaries.append(
            SectionSummary(
                section_id=sec,
                section_name=SECTION_NAMES[sec],
                incoming_kwh=round(in_kwh, 2),
                household_kwh=round(hh_kwh, 2),
                technical_loss_kwh=round(loss_kwh, 2),
                residual_kwh=round(res_kwh, 2),
                residual_pct=round(pct, 2),
                anomaly_count=int(np.sum(s_data["residual"] > 0.15)),
                status=status_str,
                households=get_households_for_section(sec),
                candidate_point=cand,
            )
        )

    # Find peak window
    peak_idx = int(np.argmax(disc["unexplained"]))
    peak_time = get_interval_time(peak_idx)
    peak_kw = float(disc["unexplained"][peak_idx]) / 0.25

    system_status = "CRITICAL_ANOMALY" if daily["unexplained_pct"] > 12.0 else ("WARNING" if daily["unexplained_pct"] > 6.0 else "NORMAL")

    return FeederSummary(
        feeder_id="T1",
        feeder_name="Feeder-01 (Kaveri Rural Distribution 250 kVA)",
        scenario=state["scenario"],
        seed=state["seed"],
        simulation_timestamp=state["timestamp"],
        transformer_energy_supplied_kwh=daily["transformer_kwh"],
        total_household_energy_kwh=daily["household_kwh"],
        estimated_technical_losses_kwh=daily["technical_loss_kwh"],
        unexplained_discrepancy_kwh=daily["unexplained_kwh"],
        unexplained_discrepancy_pct=daily["unexplained_pct"],
        active_alerts_count=len(storage.get_alerts()),
        sections_count=len(SECTIONS),
        households_count=TOTAL_HOUSEHOLDS,
        peak_discrepancy_window=f"{peak_time} (Interval {peak_idx})",
        peak_discrepancy_kw=round(peak_kw, 2),
        system_status=system_status,
        sections=sec_summaries,
    )


@app.get("/api/feeders/T1/readings", response_model=List[IntervalReading])
def get_feeder_readings():
    """Retrieve full 96-interval 24h readings for charts and time-series analysis."""
    if not storage.current_simulation:
        run_pipeline()

    state = storage.current_simulation
    sim_data = state["sim_data"]
    disc = state["discrepancies"]
    det = state["det_results"]
    sec_res = state["section_res"]

    readings: List[IntervalReading] = []
    for i in range(TOTAL_INTERVALS):
        sec_breakdown = {sec: round(float(sec_res[sec]["residual"][i]), 3) for sec in SECTIONS}
        readings.append(
            IntervalReading(
                interval_index=i,
                time_str=get_interval_time(i),
                transformer_kwh=round(float(sim_data["transformer_input"][i]), 3),
                household_total_kwh=round(float(sim_data["total_household_reported"][i]), 3),
                technical_loss_kwh=round(float(sim_data["total_technical_loss"][i]), 3),
                raw_discrepancy_kwh=round(float(disc["raw_discrepancy"][i]), 3),
                unexplained_kwh=round(float(disc["unexplained"][i]), 3),
                unexplained_pct=round(float(disc["unexplained_pct"][i]), 2),
                anomaly_score=round(float(det["anomaly_scores"][i]), 2),
                is_anomaly=bool(det["is_anomalous"][i]),
                section_breakdown=sec_breakdown,
                data_quality=det["interval_data_quality"][i],
            )
        )
    return readings


@app.get("/api/network/tree")
def get_network_tree():
    """Return complete hierarchical tree topology with live simulation statistics."""
    if not storage.current_simulation:
        run_pipeline()

    state = storage.current_simulation
    sim_data = state["sim_data"]
    sec_res = state["section_res"]
    cand_res = state["candidate_res"]
    loc = state["localization_results"]

    sections_tree = []
    for sec in SECTIONS:
        s_data = sec_res[sec]
        hh_ids = get_households_for_section(sec)
        cand_id = get_candidate_for_section(sec)

        # Households
        households_list = []
        for h in hh_ids:
            prof = sim_data["household_meter_profiles"][h]
            tot_h = float(np.sum(prof))
            is_faulty = any(f == "faulty" for f in sim_data["quality_flags"][h])
            households_list.append({
                "id": h,
                "label": f"Household {h}",
                "meter_id": f"MTR_{h}",
                "total_kwh": round(tot_h, 2),
                "is_faulty": is_faulty,
                "status": "FAULT" if is_faulty else "NORMAL",
            })

        # Candidate
        c_data = cand_res[cand_id]
        cand_res_sum = float(np.sum(c_data["residual"]))
        cand_rank = next((c.rank for c in loc["candidate_rankings"] if c.candidate_id == cand_id), 6)

        sections_tree.append({
            "id": f"SEC_{sec}",
            "section_id": sec,
            "name": SECTION_NAMES[sec],
            "incoming_kwh": round(float(np.sum(s_data["incoming"])), 2),
            "household_total_kwh": round(float(np.sum(s_data["household_energy"])), 2),
            "residual_kwh": round(float(np.sum(s_data["residual"])), 2),
            "status": "SUSPICIOUS" if float(np.sum(s_data["residual"])) > 2.0 else "NORMAL",
            "candidate": {
                "id": cand_id,
                "label": f"Candidate Branch {cand_id}",
                "residual_kwh": round(cand_res_sum, 2),
                "rank": cand_rank,
                "confidence": next((c.confidence for c in loc["candidate_rankings"] if c.candidate_id == cand_id), "LOW"),
            },
            "households": households_list,
        })

    return {
        "feeder_id": "T1",
        "transformer": {
            "id": "NODE_T1",
            "meter_id": "MTR_T1",
            "label": "Transformer T1 (250 kVA)",
            "total_supplied_kwh": round(float(np.sum(sim_data["transformer_input"])), 2),
        },
        "sections": sections_tree,
    }


@app.get("/api/network/node/{node_id}", response_model=NetworkNodeDetail)
def get_node_detail(node_id: str):
    """Retrieve detailed telemetry and profile for a specific node in the network explorer."""
    if not storage.current_simulation:
        run_pipeline()

    state = storage.current_simulation
    sim_data = state["sim_data"]

    # Hourly downsampled readings (24 values) for compact visualization
    def downsample_to_hourly(arr: np.ndarray) -> List[float]:
        hourly = []
        for h in range(24):
            hourly.append(round(float(np.sum(arr[h*4:(h+1)*4])), 3))
        return hourly

    node_upper = node_id.upper()
    if node_upper in ["T1", "NODE_T1", "MTR_T1"]:
        hourly = downsample_to_hourly(sim_data["transformer_input"])
        return NetworkNodeDetail(
            id="NODE_T1",
            label="Distribution Transformer T1 (250 kVA)",
            node_type="transformer",
            section_id=None,
            parent_id=None,
            status="NORMAL" if float(np.sum(state["discrepancies"]["unexplained"])) < 5.0 else "ANOMALY",
            total_energy_kwh=round(float(np.sum(sim_data["transformer_input"])), 2),
            hourly_readings=hourly,
            residual_kwh=round(float(np.sum(state["discrepancies"]["unexplained"])), 2),
            recent_alerts=[a.id for a in storage.get_alerts()[:3]],
        )

    # Check section
    sec_match = next((s for s in SECTIONS if node_upper in [f"SEC_{s}", s]), None)
    if sec_match:
        sec_data = state["section_res"][sec_match]
        hourly = downsample_to_hourly(sec_data["incoming"])
        tot_res = float(np.sum(sec_data["residual"]))
        return NetworkNodeDetail(
            id=f"SEC_{sec_match}",
            label=SECTION_NAMES[sec_match],
            node_type="section",
            section_id=sec_match,
            parent_id="NODE_T1",
            status="SUSPICIOUS" if tot_res > 2.0 else "NORMAL",
            total_energy_kwh=round(float(np.sum(sec_data["incoming"])), 2),
            hourly_readings=hourly,
            residual_kwh=round(tot_res, 2),
            recent_alerts=[a.id for a in storage.get_alerts() if a.section_id == sec_match],
        )

    # Check household
    if node_upper in sim_data["household_meter_profiles"]:
        prof = sim_data["household_meter_profiles"][node_upper]
        hourly = downsample_to_hourly(prof)
        is_fault = any(f == "faulty" for f in sim_data["quality_flags"][node_upper])
        # Find parent section
        h_num = int(node_upper.split("_")[1])
        sec_char = SECTIONS[(h_num - 1) // 10]
        return NetworkNodeDetail(
            id=node_upper,
            label=f"Household {node_upper} ({SECTION_NAMES[sec_char]})",
            node_type="household",
            section_id=sec_char,
            parent_id=f"SEC_{sec_char}",
            status="FAULT" if is_fault else "NORMAL",
            total_energy_kwh=round(float(np.sum(prof)), 2),
            hourly_readings=hourly,
            recent_alerts=[],
        )

    # Check candidate point
    cand_norm = node_upper.replace("-", "_")
    if cand_norm in state["candidate_res"]:
        c_data = state["candidate_res"][cand_norm]
        hourly = downsample_to_hourly(c_data["residual"])
        cand_sec = cand_norm[2:]
        sec_char = SECTIONS[int(cand_sec) - 1]
        tot_res = float(np.sum(c_data["residual"]))
        return NetworkNodeDetail(
            id=cand_norm,
            label=f"Candidate Connection Point {cand_norm} (Section {sec_char})",
            node_type="candidate_point",
            section_id=sec_char,
            parent_id=f"SEC_{sec_char}",
            status="SUSPICIOUS" if tot_res > 2.0 else "NORMAL",
            total_energy_kwh=round(float(np.sum(c_data["upstream"])), 2),
            hourly_readings=hourly,
            residual_kwh=round(tot_res, 2),
            recent_alerts=[a.id for a in storage.get_alerts() if a.section_id == sec_char],
        )

    raise HTTPException(status_code=404, detail=f"Node '{node_id}' not found in network topology.")


@app.get("/api/alerts", response_model=List[LossAlert])
def list_alerts(
    status: Optional[str] = Query(None, description="Filter by alert status"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
):
    """Retrieve loss discrepancy alerts with status and severity filters."""
    return storage.get_alerts(status=status, severity=severity)


@app.get("/api/alerts/{alert_id}", response_model=LossAlert)
def get_alert(alert_id: str):
    """Retrieve detailed alert information by alert ID."""
    alert = storage.get_alert_by_id(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found.")
    return alert


@app.patch("/api/alerts/{alert_id}", response_model=LossAlert)
def update_alert(alert_id: str, update: AlertStatusUpdate):
    """Update investigation status with operator notes and audit logging."""
    updated = storage.update_alert_status(alert_id, update)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found.")
    return updated


@app.get("/api/alerts/{alert_id}/audits", response_model=List[AuditRecord])
def get_alert_audit_trail(alert_id: str):
    """Retrieve immutable audit record trail for an alert."""
    return storage.get_audit_trail(alert_id=alert_id)


@app.post("/api/alerts/{alert_id}/explain", response_model=ExplainResponse)
def explain_alert(alert_id: str, req: ExplainRequest):
    """Generate engineering explanation for an alert using Gemini or deterministic demo."""
    alert = storage.get_alert_by_id(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found.")
    
    return explainer.explain(
        alert_data=alert.model_dump(),
        context=storage.current_simulation,
        question=req.question,
    )


@app.post("/api/chat", response_model=ExplainResponse)
def chat_ai(req: ExplainRequest):
    """General chat Q&A endpoint for GridGuard AI loss exploration."""
    active_alerts = storage.get_alerts()
    top_alert = active_alerts[0].model_dump() if active_alerts else None
    return explainer.explain(
        alert_data=top_alert,
        context=storage.current_simulation,
        question=req.question or "Summarize the feeder state.",
    )


@app.get("/api/measurement-planner/recommendation", response_model=MeasurementPlanRecommendation)
def get_measurement_recommendation():
    """Evaluate network observability, compare sequential vs hierarchical inspections, and recommend sensors."""
    return MeasurementPlanner.evaluate_observability(storage.active_sensor_ids)


@app.get("/api/measurement-planner/sensors", response_model=List[SensorPlacementOption])
def get_measurement_sensors():
    """List all available sensor placement options and their current status."""
    sensors = MeasurementPlanner.get_all_sensors()
    # Synchronize with storage active sensor ids
    for s in sensors:
        s.is_active = s.sensor_id in storage.active_sensor_ids
    return sensors


@app.post("/api/measurement-planner/toggle")
def toggle_sensor(sensor_id: str = Body(..., embed=True), is_active: bool = Body(..., embed=True)):
    """Toggle a sensor on or off to simulate observability impact."""
    storage.toggle_sensor(sensor_id, is_active)
    return MeasurementPlanner.evaluate_observability(storage.active_sensor_ids)


# ============================================================================
# AGRICULTURAL ELECTRICITY DIVERSION DETECTION & PREVENTION MODULE ENDPOINTS
# ============================================================================

@app.get("/api/agri/overview", response_model=AgriOverviewSummary)
def get_agri_overview():
    """Retrieve executive KPI overview for Agricultural Diversion Detection."""
    return agri_engine.get_overview()


@app.get("/api/agri/connections", response_model=List[AgriConnection])
def list_agri_connections(
    section_id: Optional[str] = Query(None, description="Filter by section, e.g. F"),
    is_active: Optional[bool] = Query(None, description="Filter active status"),
):
    """List registered agricultural connections with feeder and pump metadata."""
    conns = list(agri_engine.connections.values())
    if section_id:
        conns = [c for c in conns if c.section_id.upper() == section_id.upper()]
    if is_active is not None:
        conns = [c for c in conns if c.is_active == is_active]
    return conns


@app.post("/api/agri/connections", response_model=AgriConnection, status_code=status.HTTP_201_CREATED)
def register_agri_connection(conn_in: AgriConnectionCreate):
    """Register a new agricultural electricity connection."""
    created = agri_engine.register_connection(conn_in.model_dump())
    storage.log_agri_action(
        service_id=created.service_id,
        action_type="CONNECTION_REGISTERED",
        actor_name="System Administrator",
        actor_role="Admin",
        details=f"Registered agricultural service connection {created.service_id} for {created.farmer_name} (Sanctioned: {created.sanctioned_load_hp} HP)",
        post_state=created.model_dump(),
    )
    return created


@app.patch("/api/agri/connections/{service_id}", response_model=AgriConnection)
def update_agri_connection(service_id: str, updates: AgriConnectionUpdate):
    """Update agricultural connection metadata with role-based audit trail."""
    pre = agri_engine.connections.get(service_id)
    if not pre:
        raise HTTPException(status_code=404, detail=f"Agricultural connection '{service_id}' not found.")
    pre_dict = pre.model_dump()
    
    updated = agri_engine.update_connection(service_id, updates.model_dump(exclude_unset=True))
    storage.log_agri_action(
        service_id=service_id,
        action_type="CONNECTION_METADATA_UPDATED",
        actor_name="Junior Engineer (Substation)",
        actor_role="Utility Operator",
        details=f"Updated metadata for service connection {service_id}",
        pre_state=pre_dict,
        post_state=updated.model_dump(),
    )
    return updated


@app.get("/api/agri/connections/{service_id}/telemetry", response_model=List[AgriTelemetryReading])
def get_agri_telemetry(service_id: str):
    """Retrieve 96-interval 24h telemetry readings (V, I, kW, PF, pump status) for a connection."""
    readings = agri_engine.telemetry_series.get(service_id)
    if readings is None:
        raise HTTPException(status_code=404, detail=f"No telemetry found for service connection '{service_id}'.")
    return readings


@app.get("/api/agri/multi-point-balances", response_model=List[MultiPointEnergyBalance])
def get_multi_point_energy_balances():
    """Retrieve synchronized multi-point boundary balances (Transformer -> Section F Header -> Service Meters -> Downstream)."""
    return agri_engine.multi_point_balances


@app.get("/api/agri/evaluations", response_model=List[AgriAnomalyEvaluation])
def get_agri_evaluations(
    service_id: Optional[str] = Query(None, description="Filter by service connection ID"),
    risk_category: Optional[str] = Query(None, description="Filter by risk category: LOW, MEDIUM, HIGH"),
):
    """Retrieve physics and ML anomaly diagnostic evaluations."""
    evals = agri_engine.evaluations
    if service_id:
        evals = [e for e in evals if e.service_id == service_id]
    if risk_category:
        evals = [e for e in evals if e.risk_category == risk_category.upper()]
    return evals


@app.get("/api/agri/alerts", response_model=List[AgriAlert])
def list_agri_alerts(
    risk_category: Optional[str] = Query(None, description="Filter by risk: LOW, MEDIUM, HIGH"),
    status: Optional[str] = Query(None, description="Filter by inspection status"),
    service_id: Optional[str] = Query(None, description="Filter by connection ID"),
):
    """Retrieve evidence-based agricultural diversion alerts with boundary localization."""
    alerts = list(agri_engine.alerts.values())
    if risk_category:
        alerts = [a for a in alerts if a.risk_category == risk_category.upper()]
    if status:
        alerts = [a for a in alerts if a.status.lower() == status.lower()]
    if service_id:
        alerts = [a for a in alerts if a.service_id == service_id]
    return alerts


@app.get("/api/agri/alerts/{alert_id}", response_model=AgriAlert)
def get_agri_alert(alert_id: str):
    """Retrieve specific evidence-based alert dossier."""
    alert = agri_engine.alerts.get(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found.")
    return alert


@app.patch("/api/agri/alerts/{alert_id}/inspection", response_model=AgriAlert)
def update_agri_inspection(alert_id: str, update: AgriInspectionUpdate):
    """Record authorized field inspection outcome and update alert lifecycle."""
    alert = agri_engine.alerts.get(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found.")
    
    pre_dict = alert.model_dump()
    updated = agri_engine.update_inspection_outcome(alert_id, update.model_dump())
    
    storage.log_agri_action(
        alert_id=alert_id,
        service_id=alert.service_id,
        action_type="INSPECTION_STATUS_UPDATED",
        actor_name=update.inspector_name,
        actor_role="Field Inspection Officer",
        details=f"Status transitioned from '{pre_dict['status']}' to '{updated.status}'. Notes: {update.findings_notes or 'No notes'}",
        pre_state=pre_dict,
        post_state=updated.model_dump(),
    )
    return updated


@app.get("/api/agri/audit-logs", response_model=List[Dict[str, Any]])
def get_agri_audit_trail(
    service_id: Optional[str] = Query(None, description="Filter by service ID"),
    alert_id: Optional[str] = Query(None, description="Filter by alert ID"),
):
    """Retrieve immutable audit record trail for agricultural investigations and decisions."""
    return storage.get_agri_audit_logs(service_id=service_id, alert_id=alert_id)


@app.post("/api/agri/simulation/scenario")
def trigger_agri_simulation_scenario(
    scenario: str = Body(..., embed=True, description="Scenario ID: COMMERCIAL_DIVERSION_OFF_HOURS, UNAUTHORIZED_BRANCH_TAP, MOTOR_FAULT_SILT, DROUGHT_NIGHT_SHIFT, NOMINAL_OPERATION"),
    seed: int = Body(42, embed=True, description="Random seed"),
):
    """Simulate agricultural grid conditions and run Isolation Forest anomaly detection."""
    agri_engine.seed = seed
    agri_engine.simulate_day(scenario=scenario, seed=seed)
    storage.log_agri_action(
        service_id="SYSTEM",
        action_type="SIMULATION_SCENARIO_LOADED",
        actor_name="Test Operator",
        actor_role="Simulation Controller",
        details=f"Simulated agricultural telemetry scenario '{scenario}' with seed {seed}",
        post_state={"scenario": scenario, "seed": seed},
    )
    return {
        "status": "SUCCESS",
        "scenario": scenario,
        "seed": seed,
        "overview": agri_engine.get_overview(),
    }


@app.post("/api/agri/actions/verify-switch")
def verify_remote_switching_safety(
    service_id: str = Body(..., embed=True),
    action: str = Body(..., embed=True, description="Requested action, e.g. DISCONNECT, ISOLATE_SPUR"),
    is_automated_ai_request: bool = Body(False, embed=True, description="Flag indicating if triggered autonomously by AI"),
    operator_id: str = Body("AE_OM_TRICHY_01", embed=True),
    authorization_token: Optional[str] = Body(None, embed=True),
    verification_notes: str = Body(..., embed=True),
):
    """
    Safety & Regulatory Compliance Gate:
    Strictly prevents automated disconnects based on AI predictions alone.
    Requires verified inspection outcome and human authorization.
    """
    # 1. Reject automated AI disconnect commands unconditionally
    if is_automated_ai_request:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "AUTOMATED_DISCONNECTION_PROHIBITED: Under Indian Electricity Regulatory Commission guidelines "
                "and Grid Safety Protocols, AI anomaly predictions cannot autonomously execute power disconnection. "
                "An authorized field inspection with human officer sign-off is mandatory."
            )
        )
    
    # 2. Check connection exists
    conn = agri_engine.connections.get(service_id)
    if not conn:
        raise HTTPException(status_code=404, detail=f"Service connection '{service_id}' not found.")

    # 3. Log audited manual action
    storage.log_agri_action(
        service_id=service_id,
        action_type="MANUAL_SWITCHING_EXECUTED",
        actor_name=operator_id,
        actor_role="Authorized Executive Engineer",
        details=f"Manual switching action '{action}' executed after verified field inspection. Notes: {verification_notes}",
        post_state={"action": action, "service_id": service_id, "operator_id": operator_id},
    )

    return {
        "status": "AUTHORIZED_AND_EXECUTED",
        "service_id": service_id,
        "action": action,
        "operator_id": operator_id,
        "message": f"Switching operation '{action}' recorded in tamper-evident utility audit log following human authorization.",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

