-- ============================================================================
-- GridGuard AI: Intelligent Electricity Loss Localization Database Schema
-- Supabase / PostgreSQL Schema Definition
-- ============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. FEEDERS TABLE
CREATE TABLE IF NOT EXISTS feeders (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    substation VARCHAR(100) NOT NULL,
    nominal_voltage_kv NUMERIC(5, 2) DEFAULT 11.0,
    transformer_capacity_kva NUMERIC(10, 2) DEFAULT 250.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. NETWORK NODES TABLE (Transformer, Sections, Branches, Service Drops)
CREATE TABLE IF NOT EXISTS network_nodes (
    id VARCHAR(50) PRIMARY KEY,
    feeder_id VARCHAR(50) NOT NULL REFERENCES feeders(id) ON DELETE CASCADE,
    parent_node_id VARCHAR(50) REFERENCES network_nodes(id) ON DELETE SET NULL,
    node_type VARCHAR(30) NOT NULL CHECK (node_type IN ('transformer', 'section', 'branch', 'household', 'candidate_point')),
    section_id VARCHAR(10),
    label VARCHAR(100) NOT NULL,
    coordinates_x NUMERIC(8, 2),
    coordinates_y NUMERIC(8, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. METERS TABLE
CREATE TABLE IF NOT EXISTS meters (
    id VARCHAR(50) PRIMARY KEY,
    node_id VARCHAR(50) NOT NULL REFERENCES network_nodes(id) ON DELETE CASCADE,
    meter_type VARCHAR(30) NOT NULL CHECK (meter_type IN ('transformer_meter', 'section_meter', 'branch_meter', 'household_meter')),
    is_active BOOLEAN DEFAULT TRUE,
    accuracy_class NUMERIC(3, 1) DEFAULT 1.0,
    installation_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. METER READINGS TABLE
CREATE TABLE IF NOT EXISTS meter_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scenario_id VARCHAR(50) NOT NULL,
    meter_id VARCHAR(50) NOT NULL REFERENCES meters(id) ON DELETE CASCADE,
    interval_index INT NOT NULL CHECK (interval_index >= 0 AND interval_index < 96),
    timestamp TIMESTAMPTZ NOT NULL,
    active_energy_kwh NUMERIC(10, 4) NOT NULL,
    voltage_v NUMERIC(6, 2) DEFAULT 230.0,
    current_a NUMERIC(6, 2) DEFAULT 0.0,
    power_factor NUMERIC(4, 2) DEFAULT 0.95,
    quality_flag VARCHAR(20) DEFAULT 'good' CHECK (quality_flag IN ('good', 'noisy', 'missing', 'estimated')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Enforce unique reading per meter, interval, and scenario
    CONSTRAINT unique_meter_interval_scenario UNIQUE (meter_id, interval_index, scenario_id)
);

-- 5. LOSS ALERTS TABLE
CREATE TABLE IF NOT EXISTS loss_alerts (
    id VARCHAR(50) PRIMARY KEY,
    scenario_id VARCHAR(50) NOT NULL,
    feeder_id VARCHAR(50) NOT NULL REFERENCES feeders(id) ON DELETE CASCADE,
    section_id VARCHAR(10),
    timestamp TIMESTAMPTZ NOT NULL,
    interval_index INT NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    raw_discrepancy_kwh NUMERIC(10, 4) NOT NULL,
    technical_loss_kwh NUMERIC(10, 4) NOT NULL,
    unexplained_kwh NUMERIC(10, 4) NOT NULL,
    unexplained_pct NUMERIC(6, 2) NOT NULL,
    anomaly_score NUMERIC(6, 2) NOT NULL,
    confidence_level VARCHAR(20) NOT NULL CHECK (confidence_level IN ('LOW', 'MEDIUM', 'HIGH', 'AMBIGUOUS')),
    suspected_cause VARCHAR(50) NOT NULL,
    ranked_candidates JSONB DEFAULT '[]'::JSONB,
    data_quality_warnings JSONB DEFAULT '[]'::JSONB,
    recommended_action TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'Open' CHECK (status IN ('Open', 'Under Review', 'Verified', 'False Alarm', 'Resolved')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. INVESTIGATION AUDIT RECORDS TABLE
CREATE TABLE IF NOT EXISTS investigation_audit_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id VARCHAR(50) NOT NULL REFERENCES loss_alerts(id) ON DELETE CASCADE,
    previous_status VARCHAR(20) NOT NULL,
    new_status VARCHAR(20) NOT NULL,
    operator_name VARCHAR(100) DEFAULT 'Grid Operator',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_readings_scenario_interval ON meter_readings(scenario_id, interval_index);
CREATE INDEX IF NOT EXISTS idx_readings_meter ON meter_readings(meter_id);
CREATE INDEX IF NOT EXISTS idx_alerts_scenario ON loss_alerts(scenario_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON loss_alerts(status);
CREATE INDEX IF NOT EXISTS idx_audit_alert_id ON investigation_audit_records(alert_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE feeders ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE meter_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE loss_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE investigation_audit_records ENABLE ROW LEVEL SECURITY;

-- Read policies for authenticated / anon users in public demo read context
CREATE POLICY "Allow read on feeders" ON feeders FOR SELECT USING (true);
CREATE POLICY "Allow read on network_nodes" ON network_nodes FOR SELECT USING (true);
CREATE POLICY "Allow read on meters" ON meters FOR SELECT USING (true);
CREATE POLICY "Allow read on meter_readings" ON meter_readings FOR SELECT USING (true);
CREATE POLICY "Allow read on loss_alerts" ON loss_alerts FOR SELECT USING (true);
CREATE POLICY "Allow read on investigation_audit_records" ON investigation_audit_records FOR SELECT USING (true);

-- Update and insert policies (typically authenticated service-role or operator)
CREATE POLICY "Allow operator update on loss_alerts" ON loss_alerts FOR UPDATE USING (true);
CREATE POLICY "Allow operator insert on investigation_audit_records" ON investigation_audit_records FOR INSERT WITH CHECK (true);

-- ============================================================================
-- 7. AGRICULTURAL DIVERSION DETECTION MODULE TABLES
-- ============================================================================

-- 7.1 AGRICULTURAL CONNECTIONS REGISTRY
CREATE TABLE IF NOT EXISTS agri_connections (
    service_id VARCHAR(50) PRIMARY KEY,
    farmer_name VARCHAR(100) NOT NULL,
    survey_number VARCHAR(50) NOT NULL,
    feeder_id VARCHAR(50) NOT NULL REFERENCES feeders(id) ON DELETE CASCADE,
    transformer_id VARCHAR(50) NOT NULL,
    section_id VARCHAR(10) NOT NULL DEFAULT 'F',
    sanctioned_load_hp NUMERIC(6, 2) NOT NULL,
    sanctioned_load_kw NUMERIC(6, 2) NOT NULL,
    pump_type VARCHAR(100) DEFAULT 'Submersible Borewell Pump',
    permitted_use VARCHAR(100) DEFAULT 'Paddy & Groundnut Irrigation',
    irrigation_schedule_summary VARCHAR(200) DEFAULT 'Day: 07:00-11:00, Afternoon: 14:00-17:00',
    meter_id VARCHAR(50) NOT NULL,
    upstream_branch_id VARCHAR(50) DEFAULT 'U_06',
    is_active BOOLEAN DEFAULT TRUE,
    is_simulated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7.2 AGRICULTURAL SMART TELEMETRY READINGS
CREATE TABLE IF NOT EXISTS agri_telemetry_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id VARCHAR(50) NOT NULL REFERENCES agri_connections(service_id) ON DELETE CASCADE,
    interval_index INT NOT NULL CHECK (interval_index >= 0 AND interval_index < 96),
    timestamp TIMESTAMPTZ NOT NULL,
    voltage_v NUMERIC(6, 2) DEFAULT 230.0,
    current_a NUMERIC(6, 2) DEFAULT 0.0,
    active_power_kw NUMERIC(8, 3) NOT NULL,
    cumulative_energy_kwh NUMERIC(10, 3) NOT NULL,
    power_factor NUMERIC(4, 2) DEFAULT 0.80,
    pump_operating_status VARCHAR(20) DEFAULT 'OFF' CHECK (pump_operating_status IN ('ON', 'OFF', 'IDLE', 'FAULT')),
    upstream_section_energy_kwh NUMERIC(8, 3) DEFAULT 0.0,
    upstream_branch_residual_kwh NUMERIC(8, 3) DEFAULT 0.0,
    downstream_branch_energy_kwh NUMERIC(8, 3) DEFAULT 0.0,
    data_quality VARCHAR(20) DEFAULT 'simulated',
    is_simulated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7.3 EVIDENCE-BASED AGRICULTURAL ALERTS
CREATE TABLE IF NOT EXISTS agri_alerts (
    id VARCHAR(50) PRIMARY KEY,
    service_id VARCHAR(50) NOT NULL REFERENCES agri_connections(service_id) ON DELETE CASCADE,
    section_id VARCHAR(10) NOT NULL DEFAULT 'F',
    feeder_id VARCHAR(50) NOT NULL DEFAULT 'T1',
    timestamp TIMESTAMPTZ NOT NULL,
    time_window VARCHAR(100) NOT NULL,
    interval_index INT NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    risk_category VARCHAR(20) NOT NULL CHECK (risk_category IN ('LOW', 'MEDIUM', 'HIGH')),
    anomaly_score NUMERIC(5, 2) NOT NULL,
    suspected_diversion_type VARCHAR(100) NOT NULL,
    diverted_energy_estimate_kwh NUMERIC(8, 2) NOT NULL,
    observed_power_kw NUMERIC(8, 2) NOT NULL,
    sanctioned_load_kw NUMERIC(8, 2) NOT NULL,
    power_factor NUMERIC(4, 2) NOT NULL,
    smallest_confirmed_monitoring_zone TEXT NOT NULL,
    alternative_explanations JSONB DEFAULT '[]'::JSONB,
    status VARCHAR(30) DEFAULT 'New' CHECK (status IN (
        'New', 'Under Review', 'Inspection Scheduled', 'Inspection Completed',
        'Diversion Confirmed', 'No Diversion Found', 'Inconclusive', 'Closed'
    )),
    assigned_inspector VARCHAR(100),
    inspection_outcome_notes TEXT,
    is_simulated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7.4 AUTHORIZED AGRICULTURAL FIELD INSPECTION RECORDS
CREATE TABLE IF NOT EXISTS agri_inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id VARCHAR(50) NOT NULL REFERENCES agri_alerts(id) ON DELETE CASCADE,
    service_id VARCHAR(50) NOT NULL REFERENCES agri_connections(service_id) ON DELETE CASCADE,
    inspector_name VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL,
    findings_notes TEXT,
    corrective_action_taken TEXT,
    is_meter_tampered BOOLEAN DEFAULT FALSE,
    is_bypass_detected BOOLEAN DEFAULT FALSE,
    non_agricultural_load_found_kw NUMERIC(6, 2) DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7.5 AUDIT TRAIL FOR AGRICULTURAL SECURITY ACTIONS
CREATE TABLE IF NOT EXISTS agri_audit_logs (
    id VARCHAR(50) PRIMARY KEY,
    alert_id VARCHAR(50),
    service_id VARCHAR(50) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    actor_name VARCHAR(100) NOT NULL,
    actor_role VARCHAR(100) NOT NULL,
    details TEXT NOT NULL,
    pre_state JSONB,
    post_state JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agri_telemetry_service ON agri_telemetry_readings(service_id, interval_index);
CREATE INDEX IF NOT EXISTS idx_agri_alerts_service ON agri_alerts(service_id);
CREATE INDEX IF NOT EXISTS idx_agri_alerts_status ON agri_alerts(status);

-- RLS
ALTER TABLE agri_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE agri_telemetry_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agri_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agri_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE agri_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read on agri_connections" ON agri_connections FOR SELECT USING (true);
CREATE POLICY "Allow read on agri_telemetry_readings" ON agri_telemetry_readings FOR SELECT USING (true);
CREATE POLICY "Allow read on agri_alerts" ON agri_alerts FOR SELECT USING (true);
CREATE POLICY "Allow read on agri_inspections" ON agri_inspections FOR SELECT USING (true);
CREATE POLICY "Allow read on agri_audit_logs" ON agri_audit_logs FOR SELECT USING (true);

