import React, { useState, useEffect } from 'react';
import { 
  SlidersHorizontal, 
  Layers, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Cpu, 
  TrendingDown, 
  ShieldAlert,
  Info
} from 'lucide-react';
import { fetchMeasurementSensors, fetchMeasurementRecommendation, toggleSensor } from '../api';

export default function MeasurementPlannerPage() {
  const [sensors, setSensors] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobilePlannerTab, setMobilePlannerTab] = useState('recommendation');

  const loadPlannerData = async () => {
    try {
      setLoading(true);
      const [sData, rData] = await Promise.all([
        fetchMeasurementSensors(),
        fetchMeasurementRecommendation(),
      ]);
      setSensors(sData);
      setRecommendation(rData);
    } catch (err) {
      console.error('Failed to load planner data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlannerData();
  }, []);

  const handleToggle = async (sensorId, currentActive) => {
    try {
      const updatedRec = await toggleSensor(sensorId, !currentActive);
      setRecommendation(updatedRec);
      setSensors((prev) =>
        prev.map((s) => (s.sensor_id === sensorId ? { ...s, is_active: !currentActive } : s))
      );
    } catch (err) {
      console.error('Failed to toggle sensor', err);
    }
  };

  if (loading && !recommendation) {
    return <div className="page-container"><p>Evaluating network observability graph...</p></div>;
  }

  return (
    <div className="page-container">
      {/* Strategy Comparison Highlights */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">
            <span>Sequential Inspection Strategy</span>
            <Layers size={16} color="#64748b" />
          </div>
          <div className="kpi-value">
            {recommendation ? recommendation.sequential_steps_required : 60}
            <span className="kpi-unit">Steps</span>
          </div>
          <div className="kpi-subtext">
            <span>Door-to-door audit of all 60 households</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">
            <span>Hierarchical Targeted Strategy</span>
            <Cpu size={16} color="#0284c7" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--accent-primary)' }}>
            {recommendation ? recommendation.hierarchical_steps_required : 3}
            <span className="kpi-unit">Steps</span>
          </div>
          <div className="kpi-subtext">
            <span>Feeder &rarr; Section &rarr; Branch localization</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">
            <span>Inspection Effort Saved</span>
            <TrendingDown size={16} color="#16a34a" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--status-normal)' }}>
            {recommendation ? recommendation.step_reduction_pct : 95.0}%
          </div>
          <div className="kpi-subtext">
            <span>Technician field hours reduced</span>
          </div>
        </div>
      </div>

      {/* Mobile Tab Switcher: Optimal Strategy vs Sensor Toggles */}
      <div className="mobile-view-toggle mobile-planner-tabs">
        <button 
          className={`mobile-tab-btn ${mobilePlannerTab === 'recommendation' ? 'active' : ''}`}
          onClick={() => setMobilePlannerTab('recommendation')}
        >
          <Cpu size={14} /> Optimal Strategy
        </button>
        <button 
          className={`mobile-tab-btn ${mobilePlannerTab === 'sensors' ? 'active' : ''}`}
          onClick={() => setMobilePlannerTab('sensors')}
        >
          <SlidersHorizontal size={14} /> Sensors ({sensors.filter((s) => s.is_active).length}/{sensors.length})
        </button>
      </div>

      {/* Main Grid: Sensors on Left, Recommendation & Ambiguity on Right */}
      <div className="grid-2">
        {/* Available Measurement Points (Interactive Toggles) */}
        <div className={`card ${mobilePlannerTab !== 'sensors' ? 'mobile-hidden-planner-sensors' : ''}`}>
          <div className="card-header">
            <div>
              <h2 className="card-title">Simulate Sensor Availability</h2>
              <p className="card-description">Toggle sub-meter telemetry to test network observability changes</p>
            </div>
            <span className="badge badge-telemetry">
              {sensors.filter((s) => s.is_active).length} / {sensors.length} Active
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {sensors.map((sensor) => (
              <div 
                key={sensor.sensor_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  backgroundColor: sensor.is_active ? '#f0fdf4' : '#f8fafc',
                  border: `1px solid ${sensor.is_active ? '#bbf7d0' : '#e2e8f0'}`,
                  borderRadius: 'var(--radius-md)',
                  transition: 'all 0.15s ease'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    {sensor.label}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    ID: {sensor.sensor_id} • Target: {sensor.target_id} • Uncertainty Cut: -{sensor.uncertainty_reduction_pct}%
                  </div>
                </div>

                <button
                  className={sensor.is_active ? 'btn-primary' : 'btn-secondary'}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    backgroundColor: sensor.is_active ? '#16a34a' : 'inherit'
                  }}
                  onClick={() => handleToggle(sensor.sensor_id, sensor.is_active)}
                >
                  {sensor.is_active ? 'Active' : 'Deploy'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Observability & Optimal Next Measurement */}
        <div 
          className={mobilePlannerTab !== 'recommendation' ? 'mobile-hidden-planner-rec' : ''} 
          style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
        >
          {/* Optimal Recommendation Card */}
          <div className="card" style={{ borderColor: 'var(--accent-primary)' }}>
            <div className="card-header">
              <div>
                <h2 className="card-title" style={{ color: 'var(--accent-primary)' }}>
                  Recommended Next Measurement
                </h2>
                <p className="card-description">Optimal single sensor placement to minimize search entropy</p>
              </div>
              <Cpu size={20} color="#0284c7" />
            </div>

            <div style={{ 
              padding: '14px', 
              backgroundColor: 'var(--accent-primary-light)', 
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.88rem',
              color: 'var(--accent-primary-hover)',
              marginBottom: '12px'
            }}>
              {recommendation ? recommendation.next_recommended_sensor : 'Evaluating...'}
            </div>

            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              <strong>Engineering Rationale:</strong> {recommendation ? recommendation.rationale : ''}
            </div>

            <div style={{ 
              padding: '10px 12px', 
              backgroundColor: '#fffbeb', 
              border: '1px solid #fde68a',
              borderRadius: '6px',
              fontSize: '0.75rem',
              color: '#92400e',
              display: 'flex',
              gap: '8px'
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                {recommendation ? recommendation.limitations : ''}
              </div>
            </div>
          </div>

          {/* Ambiguity Groups */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Network Ambiguity Groups</h2>
                <p className="card-description">Network segments that cannot be separated with current telemetry</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recommendation && recommendation.ambiguity_groups ? (
                recommendation.ambiguity_groups.map((grp, i) => (
                  <div 
                    key={i}
                    style={{
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-subtle)',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{grp.label}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Group ID: {grp.group_id} • Unobservable Nodes: {grp.unobservable_nodes}
                      </div>
                    </div>
                    <span className={`badge ${
                      grp.status === 'FULLY_OBSERVABLE' ? 'badge-normal' :
                      grp.status === 'SECTION_ISOLATED' ? 'badge-warning' : 'badge-critical'
                    }`}>
                      {grp.status.replace('_', ' ')}
                    </span>
                  </div>
                ))
              ) : (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No ambiguity groups.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
