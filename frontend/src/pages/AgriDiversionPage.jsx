import React, { useState, useEffect } from 'react';
import {
  Tractor,
  Wheat,
  Activity,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  PlusCircle,
  FileText,
  UserCheck,
  Zap,
  TrendingDown,
  Info,
  Layers,
  ArrowRight,
  RefreshCw,
  Edit3,
  Lock,
  AlertOctagon,
  HelpCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  ReferenceArea
} from 'recharts';
import {
  fetchAgriOverview,
  fetchAgriConnections,
  registerAgriConnection,
  updateAgriConnection,
  fetchAgriTelemetry,
  fetchMultiPointBalances,
  fetchAgriAlerts,
  updateAgriInspection,
  fetchAgriAuditLogs,
  triggerAgriSimulationScenario,
  verifySwitchAction
} from '../api';

export default function AgriDiversionPage() {
  const [activeTab, setActiveTab] = useState('telemetry'); // telemetry | registry | alerts | safety
  const [overview, setOverview] = useState(null);
  const [connections, setConnections] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState('AGRI-TN-042-F01');
  const [telemetry, setTelemetry] = useState([]);
  const [multiPointBalances, setMultiPointBalances] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  // Scenario Simulator State
  const [simScenario, setSimScenario] = useState('COMMERCIAL_DIVERSION_OFF_HOURS');
  const [simSeed, setSimSeed] = useState(42);

  // Filters
  const [registrySearch, setRegistrySearch] = useState('');
  const [alertRiskFilter, setAlertRiskFilter] = useState('');
  const [alertStatusFilter, setAlertStatusFilter] = useState('');

  // Selected Alert for Dossier / Modal
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [inspectionModalOpen, setInspectionModalOpen] = useState(false);
  const [inspectionForm, setInspectionForm] = useState({
    status: 'Inspection Scheduled',
    inspector_name: 'Er. K. Natarajan, AE (O&M)',
    findings_notes: '',
    is_meter_tampered: false,
    is_bypass_detected: false,
    non_agricultural_load_found_kw: 0.0,
  });

  // New Connection Modal
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [newConnForm, setNewConnForm] = useState({
    service_id: '',
    farmer_name: '',
    survey_number: '',
    sanctioned_load_hp: 7.5,
    pump_type: 'Submersible Borewell Pump',
    permitted_use: 'Paddy & Groundnut Irrigation',
    irrigation_schedule_summary: 'Day Window: 07:00-11:00, Afternoon: 14:00-17:00',
    section_id: 'F',
    upstream_branch_id: 'U_06',
  });

  // Edit Connection Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingConn, setEditingConn] = useState(null);

  // Safety Gate State
  const [safetyDialog, setSafetyDialog] = useState(null);

  // Load all page data
  const loadData = async (preferredServiceId = null) => {
    try {
      setLoading(true);
      setError(null);
      const [ovData, connsData, balancesData, alertsData, logsData] = await Promise.all([
        fetchAgriOverview(),
        fetchAgriConnections(),
        fetchMultiPointBalances(),
        fetchAgriAlerts(),
        fetchAgriAuditLogs(),
      ]);

      setOverview(ovData);
      setConnections(connsData);
      setMultiPointBalances(balancesData);
      setAlerts(alertsData);
      setAuditLogs(logsData);

      const targetSid = preferredServiceId || selectedServiceId || (connsData[0] ? connsData[0].service_id : null);
      if (targetSid) {
        setSelectedServiceId(targetSid);
        const telemData = await fetchAgriTelemetry(targetSid);
        setTelemetry(telemData);
      }
    } catch (err) {
      console.error('Failed to load agricultural diversion data:', err);
      setError(err.message || 'Error connecting to agricultural diversion backend API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When connection changes, fetch telemetry
  const handleSelectConnection = async (sid) => {
    setSelectedServiceId(sid);
    try {
      setLoading(true);
      const telemData = await fetchAgriTelemetry(sid);
      setTelemetry(telemData);
    } catch (err) {
      console.error(`Failed to load telemetry for ${sid}:`, err);
    } finally {
      setLoading(false);
    }
  };

  // Run simulation scenario
  const handleTriggerScenario = async (scenarioKey) => {
    try {
      setLoading(true);
      setSimScenario(scenarioKey);
      await triggerAgriSimulationScenario(scenarioKey, simSeed);
      setActionMessage(`Simulated scenario '${scenarioKey}' updated across Section F!`);
      setTimeout(() => setActionMessage(null), 4000);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to trigger simulation scenario.');
    } finally {
      setLoading(false);
    }
  };

  // Save new agricultural connection
  const handleCreateConnection = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await registerAgriConnection(newConnForm);
      setRegisterModalOpen(false);
      setNewConnForm({
        service_id: '',
        farmer_name: '',
        survey_number: '',
        sanctioned_load_hp: 7.5,
        pump_type: 'Submersible Borewell Pump',
        permitted_use: 'Paddy & Groundnut Irrigation',
        irrigation_schedule_summary: 'Day Window: 07:00-11:00, Afternoon: 14:00-17:00',
        section_id: 'F',
        upstream_branch_id: 'U_06',
      });
      setActionMessage('New agricultural connection registered with verified boundary metadata!');
      setTimeout(() => setActionMessage(null), 4000);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to register connection');
    } finally {
      setLoading(false);
    }
  };

  // Update existing connection
  const handleUpdateConnection = async (e) => {
    e.preventDefault();
    if (!editingConn) return;
    try {
      setLoading(true);
      await updateAgriConnection(editingConn.service_id, {
        farmer_name: editingConn.farmer_name,
        sanctioned_load_hp: Number(editingConn.sanctioned_load_hp),
        pump_type: editingConn.pump_type,
        permitted_use: editingConn.permitted_use,
        irrigation_schedule_summary: editingConn.irrigation_schedule_summary,
        is_active: editingConn.is_active,
      });
      setEditModalOpen(false);
      setActionMessage(`Updated metadata for connection ${editingConn.service_id}`);
      setTimeout(() => setActionMessage(null), 4000);
      await loadData(editingConn.service_id);
    } catch (err) {
      setError(err.message || 'Failed to update connection');
    } finally {
      setLoading(false);
    }
  };

  // Save inspection outcome
  const handleSaveInspection = async (e) => {
    e.preventDefault();
    if (!selectedAlert) return;
    try {
      setLoading(true);
      await updateAgriInspection(selectedAlert.id, inspectionForm);
      setInspectionModalOpen(false);
      setActionMessage(`Inspection status for ${selectedAlert.id} updated to '${inspectionForm.status}'!`);
      setTimeout(() => setActionMessage(null), 4000);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to update inspection');
    } finally {
      setLoading(false);
    }
  };

  // Safety Gate: Test automated disconnect refusal
  const handleTestAutomatedDisconnect = async () => {
    try {
      await verifySwitchAction({
        service_id: selectedServiceId || 'AGRI-TN-042-F01',
        action: 'REMOTE_DISCONNECT',
        is_automated_ai_request: true,
        operator_id: 'AI_AUTONOMOUS_CONTROLLER',
        verification_notes: 'Triggered solely on IsolationForest high anomaly score',
      });
      setSafetyDialog({
        type: 'UNEXPECTED_SUCCESS',
        title: 'Safety Violation Warning',
        message: 'The switch was unexpectedly authorized! Safety protocol may be bypassed.',
      });
    } catch (err) {
      // Expected refusal!
      setSafetyDialog({
        type: 'POLICY_ENFORCED',
        title: 'Disconnection Refused: Safety Regulation Enforced',
        message: err.message,
      });
    }
  };

  // Safety Gate: Test authorized manual switch
  const handleAuthorizedManualSwitch = async () => {
    try {
      setLoading(true);
      const res = await verifySwitchAction({
        service_id: selectedServiceId || 'AGRI-TN-042-F01',
        action: 'ISOLATE_FEEDER_SPUR_FOR_INSPECTION',
        is_automated_ai_request: false,
        operator_id: 'Er. S. Chandrasekar, Executive Engineer (Grid Safety)',
        authorization_token: 'EE_PERMIT_AUTH_9841',
        verification_notes: 'Spur isolated following signed Form-7 Field Inspection Report verifying commercial unmetered shed connection.',
      });
      setSafetyDialog({
        type: 'AUTHORIZED_SUCCESS',
        title: 'Manual Switching Authorized & Logged',
        message: `${res.message} Status: ${res.status}`,
      });
      await loadData();
    } catch (err) {
      setError(err.message || 'Manual switching verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const selectedConnObj = connections.find((c) => c.service_id === selectedServiceId);

  // Filtered registries and alerts
  const filteredConnections = connections.filter((c) => {
    if (!registrySearch) return true;
    const q = registrySearch.toLowerCase();
    return (
      c.service_id.toLowerCase().includes(q) ||
      c.farmer_name.toLowerCase().includes(q) ||
      c.survey_number.toLowerCase().includes(q) ||
      c.permitted_use.toLowerCase().includes(q)
    );
  });

  const filteredAlerts = alerts.filter((a) => {
    if (alertRiskFilter && a.risk_category !== alertRiskFilter) return false;
    if (alertStatusFilter && a.status !== alertStatusFilter) return false;
    return true;
  });

  // Chart data formatting for selected connection
  const telemetryChartData = telemetry.map((t) => ({
    time: t.time_str,
    interval: t.interval_index,
    observedKw: t.active_power_kw,
    expectedKw: selectedConnObj ? selectedConnObj.sanctioned_load_kw : 5.6,
    powerFactor: t.power_factor,
    status: t.pump_operating_status,
    voltage: t.voltage_v,
    isSimulated: t.is_simulated,
  }));

  // Multi-point balance comparison data
  const boundaryChartData = multiPointBalances.map((b) => ({
    time: b.time_str,
    feederSupplied: b.section_incoming_kwh,
    agriMetered: b.sum_agri_metered_kwh,
    unaccountedResidual: b.unaccounted_boundary_residual_kwh,
    technicalLoss: b.estimated_technical_loss_kwh,
    confidence: b.sensor_coverage_confidence,
  }));

  return (
    <div className="page-container" style={{ paddingBottom: '60px' }}>
      {/* Simulation Watermark & Legal Presumption Banner */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '12px 18px',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              padding: '3px 8px',
              fontSize: '0.72rem',
              fontWeight: 700,
              backgroundColor: '#1d4ed8',
              color: '#ffffff',
              borderRadius: '4px',
              letterSpacing: '0.05em',
            }}
          >
            SIMULATION MODE
          </span>
          <span style={{ fontSize: '0.86rem', color: '#1e40af', fontWeight: 500 }}>
            Agricultural Diversion Analytics • 100% telemetry labeled as simulated testbed data • Presumption of innocence active.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.78rem',
              color: '#15803d',
              backgroundColor: '#dcfce7',
              padding: '4px 10px',
              borderRadius: '20px',
              fontWeight: 600,
            }}
          >
            <ShieldCheck size={14} />
            Auto-Disconnect Lock Active
          </div>
          <button
            onClick={() => loadData()}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="Refresh latest telemetry and anomaly calculations"
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            Sync
          </button>
        </div>
      </div>

      {actionMessage && (
        <div
          style={{
            padding: '10px 16px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 'var(--radius-sm)',
            color: '#166534',
            fontSize: '0.85rem',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={16} />
          {actionMessage}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '10px 16px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 'var(--radius-sm)',
            color: '#991b1b',
            fontSize: '0.85rem',
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
      )}

      {/* Scenario Control Strip */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          backgroundColor: '#ffffff',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={18} color="var(--accent-primary)" />
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Grid Scenario Testbed (Section F Rural Feeder)</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Active Scenario: <strong>{overview?.active_scenario || simScenario}</strong>
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {[
            {
              id: 'COMMERCIAL_DIVERSION_OFF_HOURS',
              label: 'Commercial Diversion (Off-Hours PF 0.97)',
              desc: 'Pump OFF, Flat 5.2 kW resistive load on Connection F01 at 19:30',
            },
            {
              id: 'UNAUTHORIZED_BRANCH_TAP',
              label: 'Unauthorized Branch Tap (Spur U-06)',
              desc: '6.5 kW non-metered tap on borewell lateral U-06',
            },
            {
              id: 'MOTOR_FAULT_SILT',
              label: 'Motor Fault / Overload (Presumption of Innocence)',
              desc: 'Worn bearings / silt suction: PF 0.62, V drop. NOT classified as theft!',
            },
            {
              id: 'DROUGHT_NIGHT_SHIFT',
              label: 'Drought Night Shift (Legitimate Off-Peak)',
              desc: 'Farmer runs pump at 02:00 AM due to water table. Verified legitimate.',
            },
            {
              id: 'NOMINAL_OPERATION',
              label: 'Nominal Agricultural Operation',
              desc: 'Pumps run strictly within approved daytime irrigation slots.',
            },
          ].map((sc) => (
            <button
              key={sc.id}
              onClick={() => handleTriggerScenario(sc.id)}
              disabled={loading}
              style={{
                padding: '8px 14px',
                fontSize: '0.78rem',
                borderRadius: 'var(--radius-sm)',
                border: simScenario === sc.id ? '2px solid #0284c7' : '1px solid var(--border-subtle)',
                backgroundColor: simScenario === sc.id ? '#e0f2fe' : 'var(--bg-surface)',
                color: simScenario === sc.id ? '#0369a1' : 'var(--text-primary)',
                fontWeight: simScenario === sc.id ? 600 : 400,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
              title={sc.desc}
            >
              {sc.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top Level Agricultural KPI Grid */}
      <div className="kpi-grid" style={{ marginBottom: '22px' }}>
        <div className="kpi-card">
          <div className="kpi-label">Registered Agri Connections</div>
          <div className="kpi-value" style={{ color: '#0f172a' }}>
            {overview?.total_registered_connections || 6}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Section F Hamlet • Total 45.0 HP
          </span>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">AMI Monitored Meters</div>
          <div className="kpi-value" style={{ color: '#0284c7' }}>
            {overview?.connections_monitored || 6} / {overview?.total_registered_connections || 6}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#16a34a' }}>
            ● 100% Smart Meter Coverage
          </span>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">High-Risk Diversion Alerts</div>
          <div className="kpi-value" style={{ color: '#dc2626' }}>
            {overview?.high_risk_anomalies_count || 0}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#b91c1c' }}>
            Est. Loss: {overview?.total_diverted_energy_estimate_kwh || 0} kWh
          </span>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Pending Field Inspections</div>
          <div className="kpi-value" style={{ color: '#d97706' }}>
            {overview?.pending_field_inspections || 0}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Awaiting authorized human visit
          </span>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Confirmed Diversions</div>
          <div className="kpi-value" style={{ color: '#7c3aed' }}>
            {overview?.confirmed_diversion_cases || 0}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Signed by Assistant Engineer
          </span>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Section F Boundary Residual</div>
          <div className="kpi-value" style={{ color: '#0369a1' }}>
            {overview?.section_agri_residual_kwh || 0} kWh
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Feeder supplied vs sum metered
          </span>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div
        style={{
          display: 'flex',
          borderBottom: '2px solid var(--border-subtle)',
          marginBottom: '20px',
          gap: '8px',
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'telemetry', label: 'Telemetry & Multi-Point Balances', icon: Activity },
          { id: 'registry', label: 'Agri Connection Registry', icon: Tractor },
          { id: 'alerts', label: 'Evidence-Based Alerts', icon: AlertTriangle, badge: alerts.length },
          { id: 'safety', label: 'Safety Gate & Audit Trail', icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                border: 'none',
                backgroundColor: 'transparent',
                borderBottom: isActive ? '3px solid #0284c7' : '3px solid transparent',
                color: isActive ? '#0284c7' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.88rem',
                cursor: 'pointer',
                marginBottom: '-2px',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  style={{
                    backgroundColor: '#dc2626',
                    color: '#fff',
                    borderRadius: '10px',
                    padding: '2px 7px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          TAB 1: TELEMETRY & MULTI-POINT BOUNDARY BALANCES
         ========================================================================= */}
      {activeTab === 'telemetry' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Connection Selector Pill Bar */}
          <div
            className="card"
            style={{
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wheat size={18} color="#16a34a" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Select Agricultural Borewell Connection:</span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {connections.map((c) => {
                const isSelected = c.service_id === selectedServiceId;
                return (
                  <button
                    key={c.service_id}
                    onClick={() => handleSelectConnection(c.service_id)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.78rem',
                      borderRadius: 'var(--radius-sm)',
                      border: isSelected ? '2px solid #0284c7' : '1px solid var(--border-subtle)',
                      backgroundColor: isSelected ? '#e0f2fe' : '#ffffff',
                      color: isSelected ? '#0369a1' : 'var(--text-primary)',
                      fontWeight: isSelected ? 600 : 400,
                      cursor: 'pointer',
                    }}
                  >
                    {c.service_id.split('-').pop()} • {c.farmer_name} ({c.sanctioned_load_hp} HP)
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Connection Telemetry Dossier */}
          {selectedConnObj && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '16px',
              }}
            >
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Connection Metadata
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                  {selectedConnObj.farmer_name}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Service ID: <strong>{selectedConnObj.service_id}</strong> • Survey No: {selectedConnObj.survey_number}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Sanctioned Load: <strong>{selectedConnObj.sanctioned_load_hp} HP ({selectedConnObj.sanctioned_load_kw} kW)</strong>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Pump: {selectedConnObj.pump_type}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 600, marginTop: '6px' }}>
                  Permitted Use: {selectedConnObj.permitted_use}
                </div>
              </div>

              <div className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Approved Irrigation Schedule
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>
                  {selectedConnObj.irrigation_schedule_summary}
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                  AI baseline evaluates duty cycles against this schedule. Off-schedule pumping triggers load-factor and power-factor verification before raising alerts.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px' }}>
                  <span
                    style={{
                      padding: '3px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      backgroundColor: '#f1f5f9',
                      borderRadius: '4px',
                    }}
                  >
                    AMI Meter: {selectedConnObj.meter_id}
                  </span>
                  <span
                    style={{
                      padding: '3px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      backgroundColor: '#e0f2fe',
                      color: '#0369a1',
                      borderRadius: '4px',
                    }}
                  >
                    Upstream Spur: {selectedConnObj.upstream_branch_id}
                  </span>
                </div>
              </div>

              <div className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Load Signature Diagnostic
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Standard Pump Power Factor:</span>
                    <strong>0.76 - 0.83 (Lagging / Inductive)</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Commercial Diversion Signature:</span>
                    <strong style={{ color: '#dc2626' }}>0.95 - 0.99 (Resistive loads)</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Motor Bearing Fault Signature:</span>
                    <strong style={{ color: '#d97706' }}>&lt; 0.65 (High reactive / Low V)</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 24-Hour Telemetry Line Chart */}
          <div className="card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                  24-Hour Smart Energy Profile: {selectedServiceId}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Active Power (kW), Voltage, and Power Factor (96 intervals @ 15-min cadence)
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>● Active kW</span>
                <span style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: 600 }}>-- Sanctioned kW</span>
                <span style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 600 }}>● Power Factor</span>
              </div>
            </div>

            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={telemetryChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} interval={7} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: 'kW', angle: -90, position: 'insideLeft' }} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 1.0]} tick={{ fontSize: 11 }} label={{ value: 'PF', angle: 90, position: 'insideRight' }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div
                          style={{
                            backgroundColor: '#ffffff',
                            padding: '10px 14px',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            boxShadow: 'var(--shadow-md)',
                            fontSize: '0.78rem',
                          }}
                        >
                          <div style={{ fontWeight: 700, marginBottom: '4px' }}>Time: {label}</div>
                          <div>Active Load: <strong>{d.observedKw.toFixed(2)} kW</strong></div>
                          <div>Sanctioned: <strong>{d.expectedKw.toFixed(2)} kW</strong></div>
                          <div>Power Factor: <strong>{d.powerFactor.toFixed(2)}</strong></div>
                          <div>Voltage: <strong>{d.voltage.toFixed(1)} V</strong></div>
                          <div>Pump Status: <span style={{ fontWeight: 700, color: d.status === 'ON' ? '#16a34a' : '#64748b' }}>{d.status}</span></div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>[Simulated Telemetry]</div>
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="observedKw" stroke="#16a34a" strokeWidth={2} name="Active Load (kW)" dot={false} />
                  <Line yAxisId="left" type="monotone" dataKey="expectedKw" stroke="#6366f1" strokeDasharray="4 4" strokeWidth={1.5} name="Sanctioned Limit (kW)" dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="powerFactor" stroke="#d97706" strokeWidth={1.5} name="Power Factor" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Multi-Point Energy Balance Flow Card */}
          <div className="card" style={{ padding: '18px' }}>
            <div style={{ marginBottom: '14px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                Multi-Point Synchronized Energy Boundary Balances (Section F)
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Comparing Section F Header Input vs Sum of Registered Agricultural Meters vs Downstream Circuit Flows
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '12px',
                marginBottom: '16px',
                padding: '12px',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>1. Substation / Feeder T1</span>
                <div style={{ fontSize: '1rem', fontWeight: 700 }}>250 kVA Transformer</div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Supplies Hamlet & Agri</span>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>2. Section F Header Meter</span>
                <div style={{ fontSize: '1rem', fontWeight: 700 }}>Candidate Tap U-06</div>
                <span style={{ fontSize: '0.75rem', color: '#0284c7' }}>Primary boundary boundary</span>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>3. 6 Registered Agri Meters</span>
                <div style={{ fontSize: '1rem', fontWeight: 700 }}>MTR_AGRI_01 to 06</div>
                <span style={{ fontSize: '0.75rem', color: '#16a34a' }}>Direct consumer switchboards</span>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>4. Confirmed Monitoring Area</span>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#dc2626' }}>Spur Lateral U-06</div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Smallest confirmed zone</span>
              </div>
            </div>

            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={boundaryChartData.filter((_, idx) => idx % 4 === 0)}>
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} label={{ value: 'kWh / 15-min', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="feederSupplied" fill="#0284c7" name="Section F Header Energy (kWh)" />
                  <Bar dataKey="agriMetered" fill="#16a34a" name="Sum Registered Agri Meters (kWh)" />
                  <Bar dataKey="unaccountedResidual" fill="#dc2626" name="Unaccounted Boundary Residual (kWh)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: AGRICULTURAL CONNECTION REGISTRY
         ========================================================================= */}
      {activeTab === 'registry' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 260px' }}>
              <Search size={16} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Search by farmer name, survey parcel, service ID..."
                value={registrySearch}
                onChange={(e) => setRegistrySearch(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  width: '100%',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            <button
              onClick={() => setRegisterModalOpen(true)}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '8px 16px' }}
            >
              <PlusCircle size={15} />
              Register Agricultural Connection
            </button>
          </div>

          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600 }}>Service ID</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600 }}>Farmer Name</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600 }}>Survey Parcel</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600 }}>Sanctioned Load</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600 }}>Permitted Use</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600 }}>Spur Branch</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredConnections.map((conn) => (
                    <tr
                      key={conn.service_id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        backgroundColor: conn.service_id === selectedServiceId ? '#f8fafc' : '#ffffff',
                      }}
                    >
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0284c7' }}>
                        {conn.service_id}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 500 }}>
                        {conn.farmer_name}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                        {conn.survey_number}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <strong>{conn.sanctioned_load_hp} HP</strong> ({conn.sanctioned_load_kw} kW)
                      </td>
                      <td style={{ padding: '12px 14px', color: '#16a34a' }}>
                        {conn.permitted_use}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                        {conn.upstream_branch_id}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            backgroundColor: conn.is_active ? '#dcfce7' : '#fee2e2',
                            color: conn.is_active ? '#15803d' : '#b91c1c',
                          }}
                        >
                          {conn.is_active ? 'Energized' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            onClick={() => {
                              setSelectedServiceId(conn.service_id);
                              setActiveTab('telemetry');
                            }}
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                          >
                            Telemetry
                          </button>
                          <button
                            onClick={() => {
                              setEditingConn({ ...conn });
                              setEditModalOpen(true);
                            }}
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                          >
                            <Edit3 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: EVIDENCE-BASED ALERTS & ANOMALY DETECTION
         ========================================================================= */}
      {activeTab === 'alerts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Alert Filters */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '12px 16px',
              backgroundColor: '#ffffff',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <Filter size={16} color="var(--text-muted)" />
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Filter Alerts:</span>

              <select
                value={alertRiskFilter}
                onChange={(e) => setAlertRiskFilter(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.8rem',
                }}
              >
                <option value="">All Risk Categories</option>
                <option value="HIGH">HIGH Risk</option>
                <option value="MEDIUM">MEDIUM Risk</option>
                <option value="LOW">LOW Risk</option>
              </select>

              <select
                value={alertStatusFilter}
                onChange={(e) => setAlertStatusFilter(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.8rem',
                }}
              >
                <option value="">All Inspection Statuses</option>
                <option value="New">New</option>
                <option value="Under Review">Under Review</option>
                <option value="Inspection Scheduled">Inspection Scheduled</option>
                <option value="Inspection Completed">Inspection Completed</option>
                <option value="Diversion Confirmed">Diversion Confirmed</option>
                <option value="No Diversion Found">No Diversion Found</option>
                <option value="Inconclusive">Inconclusive</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Showing {filteredAlerts.length} of {alerts.length} alerts
            </span>
          </div>

          {/* Alert Cards List */}
          {filteredAlerts.length === 0 ? (
            <div className="card" style={{ padding: '36px', textAlign: 'center' }}>
              <CheckCircle2 size={36} color="#16a34a" style={{ margin: '0 auto 12px auto' }} />
              <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>No Active Agricultural Alerts Under Current Filter</h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                All observed pump loads match sanctioned ratings or legitimate off-peak agricultural activities.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {filteredAlerts.map((alert) => {
                const isHighRisk = alert.risk_category === 'HIGH';
                const isConfirmed = alert.status === 'Diversion Confirmed';
                const isNoDiversion = alert.status === 'No Diversion Found';

                return (
                  <div
                    key={alert.id}
                    className="card"
                    style={{
                      padding: '18px',
                      borderLeft: isHighRisk ? '5px solid #dc2626' : '5px solid #d97706',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
                        gap: '12px',
                        marginBottom: '12px',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{alert.id}</span>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              backgroundColor: isHighRisk ? '#fee2e2' : '#fef3c7',
                              color: isHighRisk ? '#991b1b' : '#92400e',
                            }}
                          >
                            {alert.risk_category} RISK
                          </span>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              backgroundColor: isConfirmed ? '#fee2e2' : isNoDiversion ? '#dcfce7' : '#f1f5f9',
                              color: isConfirmed ? '#991b1b' : isNoDiversion ? '#15803d' : '#334155',
                            }}
                          >
                            Status: {alert.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          Service ID: <strong>{alert.service_id}</strong> ({alert.farmer_name}) • Section {alert.section_id}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedAlert(alert);
                          setInspectionForm({
                            status: alert.status === 'New' ? 'Inspection Scheduled' : alert.status,
                            inspector_name: alert.assigned_inspector || 'Er. K. Natarajan, AE (O&M)',
                            findings_notes: alert.inspection_outcome_notes || '',
                            is_meter_tampered: false,
                            is_bypass_detected: false,
                            non_agricultural_load_found_kw: 0.0,
                          });
                          setInspectionModalOpen(true);
                        }}
                        className="btn-primary"
                        style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                      >
                        Update Inspection
                      </button>
                    </div>

                    {/* Evidence Dossier Grid */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '10px',
                        padding: '12px',
                        backgroundColor: 'var(--bg-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.8rem',
                        marginBottom: '12px',
                      }}
                    >
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Suspected Anomaly:</span>
                        <div style={{ fontWeight: 600, color: '#dc2626' }}>{alert.suspected_diversion_type}</div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Time Window:</span>
                        <div style={{ fontWeight: 600 }}>{alert.time_window}</div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Observed Load vs Sanctioned:</span>
                        <div style={{ fontWeight: 600 }}>{alert.observed_power_kw} kW / {alert.sanctioned_load_kw} kW</div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Power Factor:</span>
                        <div style={{ fontWeight: 600 }}>{alert.power_factor}</div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Smallest Confirmed Monitoring Zone:</span>
                        <div style={{ fontWeight: 600, color: '#0284c7' }}>{alert.smallest_confirmed_monitoring_zone}</div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Diverted Energy Est.:</span>
                        <div style={{ fontWeight: 600 }}>{alert.diverted_energy_estimate_kwh} kWh</div>
                      </div>
                    </div>

                    {/* Presumption of Innocence / Alternative Explanations */}
                    <div style={{ fontSize: '0.78rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
                        Alternative Engineering Explanations (Presumption of Innocence):
                      </span>
                      <ul style={{ paddingLeft: '18px', marginTop: '4px', color: 'var(--text-secondary)' }}>
                        {alert.alternative_explanations.map((alt, idx) => (
                          <li key={idx}>{alt}</li>
                        ))}
                      </ul>
                    </div>

                    {alert.inspection_outcome_notes && (
                      <div
                        style={{
                          marginTop: '10px',
                          padding: '8px 12px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '4px',
                          fontSize: '0.78rem',
                        }}
                      >
                        <strong>Inspector Notes ({alert.assigned_inspector}):</strong> {alert.inspection_outcome_notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: SAFETY GATE & AUDIT TRAIL
         ========================================================================= */}
      {activeTab === 'safety' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Statutory Safety & Anti-Disconnection Regulatory Card */}
          <div
            className="card"
            style={{
              padding: '20px',
              borderLeft: '5px solid #16a34a',
              backgroundColor: '#ffffff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <ShieldCheck size={22} color="#16a34a" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
                Consumer Protection & Grid Safety Control Gate
              </h3>
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Under Indian Electricity Regulatory Commission codes and Grid Integrity protocols, <strong>an AI model’s anomaly score or statistical prediction must never autonomously disconnect a farmer’s power connection</strong>.
              All switching operations require physical meter verification, signed Form-7 inspection findings, and verified utility engineer authorization tokens.
            </p>

            <div
              style={{
                display: 'flex',
                gap: '12px',
                marginTop: '16px',
                flexWrap: 'wrap',
              }}
            >
              <button
                onClick={handleTestAutomatedDisconnect}
                style={{
                  padding: '9px 16px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  backgroundColor: '#fee2e2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <AlertOctagon size={15} />
                Test Automated AI Disconnect (Simulate Attempt)
              </button>

              <button
                onClick={handleAuthorizedManualSwitch}
                style={{
                  padding: '9px 16px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#166534',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <UserCheck size={15} />
                Execute Authorized Manual Switch (With Signed Inspection Report)
              </button>
            </div>
          </div>

          {/* Tamper-Evident Utility Audit Trail Table */}
          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 600 }}>Tamper-Evident Investigation & Decision Audit Trail</h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Immutable log of metadata changes, inspection findings, simulation scenarios, and switching actions.
              </p>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Timestamp</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Action Type</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Service ID</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Actor & Role</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Audit Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No audit records logged yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0284c7' }}>
                          {log.action_type}
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                          {log.service_id}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {log.actor_name} <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>({log.actor_role})</span>
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                          {log.details}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS & DIALOGS
         ========================================================================= */}

      {/* Inspection Outcome Modal */}
      {inspectionModalOpen && selectedAlert && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 'var(--radius-md)',
              width: '100%',
              maxWidth: '540px',
              padding: '24px',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px' }}>
              Record Field Inspection Outcome
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Alert {selectedAlert.id} • {selectedAlert.service_id} ({selectedAlert.farmer_name})
            </p>

            <form onSubmit={handleSaveInspection} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Inspection Lifecycle Status:
                </label>
                <select
                  value={inspectionForm.status}
                  onChange={(e) => setInspectionForm({ ...inspectionForm, status: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                >
                  <option value="Under Review">Under Review</option>
                  <option value="Inspection Scheduled">Inspection Scheduled</option>
                  <option value="Inspection Completed">Inspection Completed</option>
                  <option value="Diversion Confirmed">Diversion Confirmed (Unauthorized Load Verified)</option>
                  <option value="No Diversion Found">No Diversion Found (Legitimate Pump Operation)</option>
                  <option value="Inconclusive">Inconclusive (Requires Advanced Power Quality Meter)</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Inspecting Engineer Name & Designation:
                </label>
                <input
                  type="text"
                  value={inspectionForm.inspector_name}
                  onChange={(e) => setInspectionForm({ ...inspectionForm, inspector_name: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                  <input
                    type="checkbox"
                    checked={inspectionForm.is_meter_tampered}
                    onChange={(e) => setInspectionForm({ ...inspectionForm, is_meter_tampered: e.target.checked })}
                  />
                  Meter Terminal Seal Broken
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                  <input
                    type="checkbox"
                    checked={inspectionForm.is_bypass_detected}
                    onChange={(e) => setInspectionForm({ ...inspectionForm, is_bypass_detected: e.target.checked })}
                  />
                  Unauthorized Overhead Bypass Tap Found
                </label>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Non-Agricultural Load Discovered (kW):
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={inspectionForm.non_agricultural_load_found_kw}
                  onChange={(e) => setInspectionForm({ ...inspectionForm, non_agricultural_load_found_kw: parseFloat(e.target.value) || 0 })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Inspection Findings & Notes:
                </label>
                <textarea
                  rows={3}
                  value={inspectionForm.findings_notes}
                  onChange={(e) => setInspectionForm({ ...inspectionForm, findings_notes: e.target.value })}
                  placeholder="Detail physical site verification, machinery found (e.g. rice huller, welder, domestic supply), or motor conditions..."
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setInspectionModalOpen(false)}
                  className="btn-secondary"
                  style={{ padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '8px 16px' }}>
                  Save Inspection Outcome
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Connection Modal */}
      {registerModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 'var(--radius-md)',
              width: '100%',
              maxWidth: '520px',
              padding: '24px',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px' }}>
              Register Agricultural Connection
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Enter service connection parameters and boundary feeder mapping.
            </p>

            <form onSubmit={handleCreateConnection} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Farmer / Consumer Name:
                </label>
                <input
                  type="text"
                  value={newConnForm.farmer_name}
                  onChange={(e) => setNewConnForm({ ...newConnForm, farmer_name: e.target.value })}
                  placeholder="e.g. A. Manickam"
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Land Survey No:
                  </label>
                  <input
                    type="text"
                    value={newConnForm.survey_number}
                    onChange={(e) => setNewConnForm({ ...newConnForm, survey_number: e.target.value })}
                    placeholder="e.g. 158/2"
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Sanctioned Load (HP):
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={newConnForm.sanctioned_load_hp}
                    onChange={(e) => setNewConnForm({ ...newConnForm, sanctioned_load_hp: parseFloat(e.target.value) || 5 })}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Pump Type:
                </label>
                <input
                  type="text"
                  value={newConnForm.pump_type}
                  onChange={(e) => setNewConnForm({ ...newConnForm, pump_type: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Permitted Crop / Agricultural Use:
                </label>
                <input
                  type="text"
                  value={newConnForm.permitted_use}
                  onChange={(e) => setNewConnForm({ ...newConnForm, permitted_use: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setRegisterModalOpen(false)}
                  className="btn-secondary"
                  style={{ padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '8px 16px' }}>
                  Register Connection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Connection Modal */}
      {editModalOpen && editingConn && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 'var(--radius-md)',
              width: '100%',
              maxWidth: '520px',
              padding: '24px',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px' }}>
              Edit Connection: {editingConn.service_id}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Authorized changes are written directly to the tamper-evident audit log.
            </p>

            <form onSubmit={handleUpdateConnection} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Farmer Name:
                </label>
                <input
                  type="text"
                  value={editingConn.farmer_name}
                  onChange={(e) => setEditingConn({ ...editingConn, farmer_name: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Sanctioned Load (HP):
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={editingConn.sanctioned_load_hp}
                  onChange={(e) => setEditingConn({ ...editingConn, sanctioned_load_hp: parseFloat(e.target.value) || 5 })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Permitted Use:
                </label>
                <input
                  type="text"
                  value={editingConn.permitted_use}
                  onChange={(e) => setEditingConn({ ...editingConn, permitted_use: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="active_status"
                  checked={editingConn.is_active}
                  onChange={(e) => setEditingConn({ ...editingConn, is_active: e.target.checked })}
                />
                <label htmlFor="active_status" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                  Connection Energized / Active
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="btn-secondary"
                  style={{ padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '8px 16px' }}>
                  Update Metadata
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Safety Gate Dialog */}
      {safetyDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 'var(--radius-md)',
              width: '100%',
              maxWidth: '520px',
              padding: '24px',
              boxShadow: 'var(--shadow-lg)',
              borderTop: safetyDialog.type === 'POLICY_ENFORCED' ? '6px solid #16a34a' : '6px solid #0284c7',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              {safetyDialog.type === 'POLICY_ENFORCED' ? (
                <ShieldCheck size={26} color="#16a34a" />
              ) : (
                <UserCheck size={26} color="#0284c7" />
              )}
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{safetyDialog.title}</h3>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
              {safetyDialog.message}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSafetyDialog(null)}
                className="btn-primary"
                style={{ padding: '8px 20px', fontSize: '0.85rem' }}
              >
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
