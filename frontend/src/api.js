/**
 * GridGuard AI: Frontend API Service
 */

const API_BASE = '/api';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Failed to fetch system health');
  return res.json();
}

export async function fetchFeederSummary() {
  const res = await fetch(`${API_BASE}/feeders/T1/summary`);
  if (!res.ok) throw new Error('Failed to fetch feeder summary');
  return res.json();
}

export async function fetchFeederReadings() {
  const res = await fetch(`${API_BASE}/feeders/T1/readings`);
  if (!res.ok) throw new Error('Failed to fetch feeder readings');
  return res.json();
}

export async function runSimulation(scenario = 'EVENING_UNMETERED', seed = 42, customUnmeteredKw = null) {
  const res = await fetch(`${API_BASE}/simulation/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scenario,
      seed: Number(seed),
      custom_unmetered_kw: customUnmeteredKw ? Number(customUnmeteredKw) : null,
    }),
  });
  if (!res.ok) throw new Error('Failed to trigger simulation');
  return res.json();
}

export async function fetchNetworkTree() {
  const res = await fetch(`${API_BASE}/network/tree`);
  if (!res.ok) throw new Error('Failed to fetch network tree');
  return res.json();
}

export async function fetchNodeDetail(nodeId) {
  const res = await fetch(`${API_BASE}/network/node/${encodeURIComponent(nodeId)}`);
  if (!res.ok) throw new Error(`Failed to fetch node detail for ${nodeId}`);
  return res.json();
}

export async function fetchAlerts(status = null, severity = null) {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (severity) params.append('severity', severity);
  const res = await fetch(`${API_BASE}/alerts?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch alerts');
  return res.json();
}

export async function fetchAlert(alertId) {
  const res = await fetch(`${API_BASE}/alerts/${encodeURIComponent(alertId)}`);
  if (!res.ok) throw new Error(`Failed to fetch alert ${alertId}`);
  return res.json();
}

export async function updateAlertStatus(alertId, status, notes = '', operatorName = 'Grid Operator') {
  const res = await fetch(`${API_BASE}/alerts/${encodeURIComponent(alertId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, notes, operator_name: operatorName }),
  });
  if (!res.ok) throw new Error('Failed to update alert status');
  return res.json();
}

export async function fetchAlertAudits(alertId) {
  const res = await fetch(`${API_BASE}/alerts/${encodeURIComponent(alertId)}/audits`);
  if (!res.ok) throw new Error('Failed to fetch audit records');
  return res.json();
}

export async function explainAlert(alertId, question = null) {
  const res = await fetch(`${API_BASE}/alerts/${encodeURIComponent(alertId)}/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error('Failed to generate AI explanation');
  return res.json();
}

export async function chatAI(question) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error('Failed to query AI assistant');
  return res.json();
}

export async function fetchMeasurementRecommendation() {
  const res = await fetch(`${API_BASE}/measurement-planner/recommendation`);
  if (!res.ok) throw new Error('Failed to fetch measurement plan recommendation');
  return res.json();
}

export async function fetchMeasurementSensors() {
  const res = await fetch(`${API_BASE}/measurement-planner/sensors`);
  if (!res.ok) throw new Error('Failed to fetch sensors');
  return res.json();
}

export async function toggleSensor(sensorId, isActive) {
  const res = await fetch(`${API_BASE}/measurement-planner/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sensor_id: sensorId, is_active: isActive }),
  });
  if (!res.ok) throw new Error('Failed to toggle sensor');
  return res.json();
}

export async function fetchLiveStep(interval = 0) {
  const res = await fetch(`${API_BASE}/simulation/live/step?interval=${Number(interval)}`);
  if (!res.ok) throw new Error('Failed to fetch live simulation step');
  return res.json();
}

// ============================================================================
// AGRICULTURAL DIVERSION DETECTION API CLIENT
// ============================================================================

export async function fetchAgriOverview() {
  const res = await fetch(`${API_BASE}/agri/overview`);
  if (!res.ok) throw new Error('Failed to fetch agricultural diversion overview');
  return res.json();
}

export async function fetchAgriConnections(sectionId = null, isActive = null) {
  const params = new URLSearchParams();
  if (sectionId) params.append('section_id', sectionId);
  if (isActive !== null) params.append('is_active', isActive);
  const res = await fetch(`${API_BASE}/agri/connections?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch agricultural connections');
  return res.json();
}

export async function registerAgriConnection(connData) {
  const res = await fetch(`${API_BASE}/agri/connections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(connData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to register agricultural connection');
  }
  return res.json();
}

export async function updateAgriConnection(serviceId, updates) {
  const res = await fetch(`${API_BASE}/agri/connections/${encodeURIComponent(serviceId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update agricultural connection');
  }
  return res.json();
}

export async function fetchAgriTelemetry(serviceId) {
  const res = await fetch(`${API_BASE}/agri/connections/${encodeURIComponent(serviceId)}/telemetry`);
  if (!res.ok) throw new Error(`Failed to fetch telemetry for ${serviceId}`);
  return res.json();
}

export async function fetchMultiPointBalances() {
  const res = await fetch(`${API_BASE}/agri/multi-point-balances`);
  if (!res.ok) throw new Error('Failed to fetch multi-point energy balances');
  return res.json();
}

export async function fetchAgriEvaluations(serviceId = null, riskCategory = null) {
  const params = new URLSearchParams();
  if (serviceId) params.append('service_id', serviceId);
  if (riskCategory) params.append('risk_category', riskCategory);
  const res = await fetch(`${API_BASE}/agri/evaluations?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch anomaly evaluations');
  return res.json();
}

export async function fetchAgriAlerts(riskCategory = null, status = null, serviceId = null) {
  const params = new URLSearchParams();
  if (riskCategory) params.append('risk_category', riskCategory);
  if (status) params.append('status', status);
  if (serviceId) params.append('service_id', serviceId);
  const res = await fetch(`${API_BASE}/agri/alerts?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch agricultural alerts');
  return res.json();
}

export async function fetchAgriAlert(alertId) {
  const res = await fetch(`${API_BASE}/agri/alerts/${encodeURIComponent(alertId)}`);
  if (!res.ok) throw new Error(`Failed to fetch alert ${alertId}`);
  return res.json();
}

export async function updateAgriInspection(alertId, inspectionData) {
  const res = await fetch(`${API_BASE}/agri/alerts/${encodeURIComponent(alertId)}/inspection`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inspectionData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to record inspection outcome');
  }
  return res.json();
}

export async function fetchAgriAuditLogs(serviceId = null, alertId = null) {
  const params = new URLSearchParams();
  if (serviceId) params.append('service_id', serviceId);
  if (alertId) params.append('alert_id', alertId);
  const res = await fetch(`${API_BASE}/agri/audit-logs?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch agricultural audit logs');
  return res.json();
}

export async function triggerAgriSimulationScenario(scenario, seed = 42) {
  const res = await fetch(`${API_BASE}/agri/simulation/scenario`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario, seed: Number(seed) }),
  });
  if (!res.ok) throw new Error('Failed to simulate agricultural scenario');
  return res.json();
}

export async function verifySwitchAction(payload) {
  const res = await fetch(`${API_BASE}/agri/actions/verify-switch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Action failed or was rejected by safety policy');
  }
  return res.json();
}


