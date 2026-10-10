"""
Tests for FastAPI API Endpoints & Request/Response Validation
"""
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def test_api_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "database_mode" in data


def test_feeder_summary(client):
    res = client.get("/api/feeders/T1/summary")
    assert res.status_code == 200
    data = res.json()
    assert data["feeder_id"] == "T1"
    assert len(data["sections"]) == 6
    assert data["transformer_energy_supplied_kwh"] > 0
    assert data["unexplained_discrepancy_pct"] >= 0


def test_feeder_readings(client):
    res = client.get("/api/feeders/T1/readings")
    assert res.status_code == 200
    readings = res.json()
    assert len(readings) == 96
    assert readings[0]["time_str"] == "00:00"
    assert readings[95]["time_str"] == "23:45"


def test_simulation_run(client):
    res = client.post(
        "/api/simulation/run",
        json={"scenario": "NORMAL", "seed": 100},
    )
    assert res.status_code == 200
    assert res.json()["scenario"] == "NORMAL"


def test_network_tree(client):
    res = client.get("/api/network/tree")
    assert res.status_code == 200
    tree = res.json()
    assert len(tree["sections"]) == 6
    # Each section has 10 households
    assert len(tree["sections"][0]["households"]) == 10


def test_alerts_and_investigation_patch(client):
    # Trigger evening unmetered to ensure alerts exist
    client.post("/api/simulation/run", json={"scenario": "EVENING_UNMETERED", "seed": 42})

    res = client.get("/api/alerts")
    assert res.status_code == 200
    alerts = res.json()
    assert len(alerts) > 0

    first_alert_id = alerts[0]["id"]
    # Update status to Under Review
    patch_res = client.patch(
        f"/api/alerts/{first_alert_id}",
        json={"status": "Under Review", "notes": "Investigating lateral span with field crew"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "Under Review"

    # Verify audit trail
    audits_res = client.get(f"/api/alerts/{first_alert_id}/audits")
    assert audits_res.status_code == 200
    audits = audits_res.json()
    assert len(audits) >= 1
    assert audits[-1]["new_status"] == "Under Review"


def test_alert_explain_endpoint(client):
    alerts = client.get("/api/alerts").json()
    if alerts:
        alt_id = alerts[0]["id"]
        exp_res = client.post(
            f"/api/alerts/{alt_id}/explain",
            json={"question": "Why did the discrepancy surge between 7 PM and 10 PM?"},
        )
        assert exp_res.status_code == 200
        data = exp_res.json()
        assert "explanation" in data
        assert len(data["key_findings"]) > 0
        assert "safeguard_note" in data


def test_node_detail_404(client):
    res = client.get("/api/network/node/NON_EXISTENT_NODE_999")
    assert res.status_code == 404


def test_live_simulation_step(client):
    res = client.get("/api/simulation/live/step?interval=80")
    assert res.status_code == 200
    data = res.json()
    assert data["interval_index"] == 80
    assert data["time_str"] == "20:00"
    assert "transformer_kwh" in data
    assert "unexplained_kwh" in data
    assert "anomaly_score" in data
    assert "localization" in data
    assert "top_candidate" in data["localization"]
    assert "cumulative" in data

