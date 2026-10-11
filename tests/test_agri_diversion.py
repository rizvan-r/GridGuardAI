"""
Unit and Integration Tests for AI-Based Agricultural Electricity Diversion Detection & Prevention
Validates:
1. Agricultural connection registration and metadata updates.
2. 96-interval smart energy telemetry simulation (V, I, kW, PF, status).
3. Commercial diversion detection (off-hours resistive load, PF ~0.97).
4. Presumption of innocence rules (motor silt/overload, drought night pumping).
5. Multi-point energy boundary accounting and smallest confirmed zone localization.
6. Evidence-based alert generation and alternative explanations.
7. Authorized field inspection lifecycle updates and audit logging.
8. Regulatory safety gate: Strict rejection of autonomous AI disconnections.
"""
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.agri_engine import agri_engine


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def test_agri_overview_kpi(client):
    """Verify agricultural diversion overview KPI endpoint."""
    res = client.get("/api/agri/overview")
    assert res.status_code == 200
    data = res.json()
    assert "total_registered_connections" in data
    assert data["total_registered_connections"] >= 6
    assert data["connections_monitored"] >= 6
    assert data["is_simulated_mode"] is True
    assert data["disconnection_safeguard_active"] is True


def test_agri_connection_registry_and_update(client):
    """Test registering a new connection and updating its metadata with audit trails."""
    # 1. List connections
    list_res = client.get("/api/agri/connections?section_id=F")
    assert list_res.status_code == 200
    conns = list_res.json()
    assert len(conns) >= 6
    first_conn = conns[0]
    assert first_conn["service_id"].startswith("AGRI-TN-042-F")
    assert first_conn["section_id"] == "F"
    assert first_conn["is_simulated"] is True

    # 2. Register a new connection
    new_payload = {
        "service_id": "AGRI-TN-042-F07",
        "farmer_name": "V. Senthil Kumar",
        "survey_number": "159/4B",
        "sanctioned_load_hp": 7.5,
        "pump_type": "Submersible Borewell Pump",
        "permitted_use": "Turmeric & Paddy Irrigation",
        "section_id": "F",
        "upstream_branch_id": "U_06",
    }
    create_res = client.post("/api/agri/connections", json=new_payload)
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["service_id"] == "AGRI-TN-042-F07"
    assert created["sanctioned_load_kw"] == round(7.5 * 0.746, 2)

    # 3. Update connection metadata
    update_res = client.patch(
        "/api/agri/connections/AGRI-TN-042-F07",
        json={"sanctioned_load_hp": 10.0, "permitted_use": "Sugarcane Drip Irrigation"},
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["sanctioned_load_hp"] == 10.0
    assert updated["permitted_use"] == "Sugarcane Drip Irrigation"

    # 4. Verify audit trail has record of this update
    audit_res = client.get("/api/agri/audit-logs?service_id=AGRI-TN-042-F07")
    assert audit_res.status_code == 200
    audits = audit_res.json()
    assert len(audits) >= 2  # Registration + Metadata update


def test_smart_energy_telemetry_structure(client):
    """Verify 96-interval telemetry readings for a connection (V, I, kW, PF, status)."""
    res = client.get("/api/agri/connections/AGRI-TN-042-F01/telemetry")
    assert res.status_code == 200
    readings = res.json()
    assert len(readings) == 96

    first_reading = readings[0]
    assert first_reading["service_id"] == "AGRI-TN-042-F01"
    assert first_reading["time_str"] == "00:00"
    assert "voltage_v" in first_reading
    assert "current_a" in first_reading
    assert "active_power_kw" in first_reading
    assert "power_factor" in first_reading
    assert "pump_operating_status" in first_reading
    assert first_reading["is_simulated"] is True


def test_commercial_diversion_scenario(client):
    """
    Scenario: COMMERCIAL_DIVERSION_OFF_HOURS
    Connection F01 has pump status OFF but draws ~5.2 kW resistive load (PF ~0.97) off-hours.
    Must generate a HIGH-risk alert with alternative explanations.
    """
    sim_res = client.post(
        "/api/agri/simulation/scenario",
        json={"scenario": "COMMERCIAL_DIVERSION_OFF_HOURS", "seed": 42},
    )
    assert sim_res.status_code == 200
    assert sim_res.json()["status"] == "SUCCESS"

    alerts_res = client.get("/api/agri/alerts?service_id=AGRI-TN-042-F01")
    assert alerts_res.status_code == 200
    alerts = alerts_res.json()
    assert len(alerts) >= 1

    f01_alert = alerts[0]
    assert f01_alert["risk_category"] == "HIGH"
    assert f01_alert["power_factor"] >= 0.90  # Resistive signature
    assert "Section F" in f01_alert["smallest_confirmed_monitoring_zone"]
    assert len(f01_alert["alternative_explanations"]) >= 1


def test_motor_fault_presumption_of_innocence(client):
    """
    Scenario: MOTOR_FAULT_SILT
    Pump exhibits low voltage and low PF (< 0.65) due to silt suction / bearing friction.
    Presumption of innocence rule MUST NOT classify as confirmed diversion theft.
    """
    sim_res = client.post(
        "/api/agri/simulation/scenario",
        json={"scenario": "MOTOR_FAULT_SILT", "seed": 42},
    )
    assert sim_res.status_code == 200

    alerts_res = client.get("/api/agri/alerts?service_id=AGRI-TN-042-F02")
    assert alerts_res.status_code == 200
    alerts = alerts_res.json()
    if alerts:
        alert = alerts[0]
        # Should not be categorized as commercial diversion
        assert alert["risk_category"] in ["MEDIUM", "LOW"]
        assert "MOTOR_FAULT" in alert["suspected_diversion_type"] or "OVERLOAD" in alert["suspected_diversion_type"]
        # Alternative explanations must mention mechanical/grid factors
        alt_str = " ".join(alert["alternative_explanations"]).lower()
        assert "silt" in alt_str or "bearing" in alt_str or "capacitor" in alt_str or "voltage" in alt_str


def test_drought_night_shift_presumption_of_innocence(client):
    """
    Scenario: DROUGHT_NIGHT_SHIFT
    Farmer operates pump at 02:00 AM due to agricultural water table depletion.
    Power factor is inductive (~0.78). System must classify as legitimate off-peak irrigation (LOW risk).
    """
    sim_res = client.post(
        "/api/agri/simulation/scenario",
        json={"scenario": "DROUGHT_NIGHT_SHIFT", "seed": 42},
    )
    assert sim_res.status_code == 200

    # Under legitimate off-peak shifting, no high-risk theft alert should be created for F03
    alerts_res = client.get("/api/agri/alerts?service_id=AGRI-TN-042-F03&risk_category=HIGH")
    assert alerts_res.status_code == 200
    high_alerts = alerts_res.json()
    assert len(high_alerts) == 0


def test_multi_point_energy_balance_and_zone_localization(client):
    """
    Verify multi-point boundary accounting:
    Feeder Input vs Section F Header vs Registered Meters vs Unaccounted Residual.
    Must localize to smallest confirmed monitoring area without fabricating exact branch coords.
    """
    res = client.get("/api/agri/multi-point-balances")
    assert res.status_code == 200
    balances = res.json()
    assert len(balances) == 96

    b0 = balances[0]
    assert "section_incoming_kwh" in b0
    assert "sum_agri_metered_kwh" in b0
    assert "unaccounted_boundary_residual_kwh" in b0
    assert "smallest_confirmed_monitoring_zone" in b0
    assert "Section F" in b0["smallest_confirmed_monitoring_zone"]
    assert b0["sensor_coverage_confidence"] in ["HIGH", "MEDIUM", "LOW", "INCOMPLETE_COVERAGE"]


def test_authorized_inspection_workflow_lifecycle(client):
    """
    Verify full inspection lifecycle:
    New -> Inspection Scheduled -> Inspection Completed -> Diversion Confirmed.
    """
    # Trigger commercial diversion scenario to guarantee an alert
    client.post(
        "/api/agri/simulation/scenario",
        json={"scenario": "COMMERCIAL_DIVERSION_OFF_HOURS", "seed": 42},
    )
    alerts = client.get("/api/agri/alerts").json()
    assert len(alerts) > 0
    target_alert = alerts[0]
    alert_id = target_alert["id"]

    # 1. Update status to 'Inspection Scheduled'
    step1_res = client.patch(
        f"/api/agri/alerts/{alert_id}/inspection",
        json={
            "status": "Inspection Scheduled",
            "inspector_name": "Er. K. Natarajan, AE (O&M)",
            "findings_notes": "Field visit scheduled with lineman team.",
        },
    )
    assert step1_res.status_code == 200
    assert step1_res.json()["status"] == "Inspection Scheduled"

    # 2. Update status to 'Diversion Confirmed' after physical site verification
    step2_res = client.patch(
        f"/api/agri/alerts/{alert_id}/inspection",
        json={
            "status": "Diversion Confirmed",
            "inspector_name": "Er. K. Natarajan, AE (O&M)",
            "findings_notes": "Verified unauthorized 5 kW induction welding setup operating inside storage shed off agricultural meter.",
            "is_bypass_detected": False,
            "non_agricultural_load_found_kw": 5.2,
        },
    )
    assert step2_res.status_code == 200
    final_alert = step2_res.json()
    assert final_alert["status"] == "Diversion Confirmed"

    # 3. Check overview reflects confirmed case
    ov = client.get("/api/agri/overview").json()
    assert ov["confirmed_diversion_cases"] >= 1


def test_safety_gate_automated_disconnection_prevention(client):
    """
    CRITICAL SAFETY REQUIREMENT:
    Under Indian Electricity Act and Smart Grid Safety Standards,
    autonomous AI predictions MUST NOT trigger power disconnection.
    """
    # 1. Attempt automated disconnection -> MUST return HTTP 403 Forbidden
    auto_res = client.post(
        "/api/agri/actions/verify-switch",
        json={
            "service_id": "AGRI-TN-042-F01",
            "action": "REMOTE_DISCONNECT",
            "is_automated_ai_request": True,
            "operator_id": "AI_AUTONOMOUS_CONTROLLER",
            "verification_notes": "Disconnection suggested automatically by IsolationForest anomaly score",
        },
    )
    assert auto_res.status_code == 403
    err_detail = auto_res.json()["detail"]
    assert "AUTOMATED_DISCONNECTION_PROHIBITED" in err_detail

    # 2. Authorized human manual switching -> MUST succeed and create audit record
    manual_res = client.post(
        "/api/agri/actions/verify-switch",
        json={
            "service_id": "AGRI-TN-042-F01",
            "action": "ISOLATE_FEEDER_SPUR_FOR_INSPECTION",
            "is_automated_ai_request": False,
            "operator_id": "Er. S. Chandrasekar, Executive Engineer",
            "authorization_token": "EE_PERMIT_AUTH_9841",
            "verification_notes": "Spur isolated following signed Form-7 Field Inspection Report verifying commercial unmetered shed connection.",
        },
    )
    assert manual_res.status_code == 200
    res_data = manual_res.json()
    assert res_data["status"] == "AUTHORIZED_AND_EXECUTED"
