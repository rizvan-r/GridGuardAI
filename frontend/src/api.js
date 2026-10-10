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

