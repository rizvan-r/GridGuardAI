import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Activity, 
  ShieldCheck, 
  Filter, 
  Sliders, 
  HelpCircle,
  Database,
  LayoutList,
  Table as TableIcon
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  ReferenceLine 
} from 'recharts';

export default function AnomalyDetectionPage({ readings }) {
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [searchInterval, setSearchInterval] = useState('');
  const [mobileLedgerView, setMobileLedgerView] = useState('cards');

  if (!readings) {
    return <div className="page-container"><p>Loading telemetry stream...</p></div>;
  }

  const chartData = readings.map((r) => ({
    time: r.time_str,
    interval: r.interval_index,
    score: r.anomaly_score,
    unexplained: r.unexplained_kwh,
    isAnomaly: r.is_anomaly,
  }));

  const filteredReadings = readings.filter((r) => {
    if (filterSeverity === 'ANOMALIES' && !r.is_anomaly) return false;
    if (searchInterval && !r.time_str.includes(searchInterval) && !String(r.interval_index).includes(searchInterval)) return false;
    return true;
  });

  return (
    <div className="page-container">
      {/* Engine Metrics Header */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">
            <span>Statistical Model</span>
            <Activity size={16} color="#0284c7" />
          </div>
          <div className="kpi-value" style={{ fontSize: '1.25rem' }}>
            Robust Z-Score
          </div>
          <div className="kpi-subtext">
            <span>Median & MAD outlier resistance</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">
            <span>Warning Threshold</span>
            <Sliders size={16} color="#d97706" />
          </div>
          <div className="kpi-value" style={{ fontSize: '1.25rem' }}>
            z &ge; 2.0 &sigma;
          </div>
          <div className="kpi-subtext">
            <span>Initial departure detection</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">
            <span>Critical Alarm Threshold</span>
            <AlertTriangle size={16} color="#dc2626" />
          </div>
          <div className="kpi-value" style={{ fontSize: '1.25rem', color: 'var(--status-critical)' }}>
            z &ge; 3.2 &sigma;
          </div>
          <div className="kpi-subtext">
            <span>Multi-interval persistence gate</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">
            <span>Persistence Filter</span>
            <ShieldCheck size={16} color="#16a34a" />
          </div>
          <div className="kpi-value" style={{ fontSize: '1.25rem' }}>
            &ge; 3 Intervals
          </div>
          <div className="kpi-subtext">
            <span>Suppresses transient motor spikes</span>
          </div>
        </div>
      </div>

      {/* Chart: Statistical Z-Score Over 24 Hours */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">24-Hour Statistical Anomaly Score Trajectory</h2>
            <p className="card-description">Standardized discrepancy departures across 96 15-minute telemetry intervals</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span className="badge badge-warning">Warning: 2.0&sigma;</span>
            <span className="badge badge-critical">Critical: 3.2&sigma;</span>
          </div>
        </div>

        <div style={{ height: '300px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <XAxis dataKey="time" tick={{ fontSize: 11 }} interval={15} />
              <YAxis tick={{ fontSize: 11 }} domain={[-1, 8]} label={{ value: 'Z-Score (σ)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }} />
              <Tooltip 
                formatter={(val, name) => [`${val} σ`, name]}
                contentStyle={{ fontSize: '11px', borderRadius: '6px' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <ReferenceLine y={2.0} stroke="#d97706" strokeDasharray="3 3" label={{ value: 'Warning (2.0σ)', position: 'insideTopRight', fontSize: 10, fill: '#d97706' }} />
              <ReferenceLine y={3.2} stroke="#dc2626" strokeDasharray="3 3" label={{ value: 'Critical (3.2σ)', position: 'insideTopRight', fontSize: 10, fill: '#dc2626' }} />
              <Line type="monotone" dataKey="score" name="Anomaly Z-Score" stroke="#dc2626" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Interval by Interval Telemetry Table & Mobile Cards */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 className="card-title">Interval Telemetry & Evidence Ledger</h2>
            <p className="card-description">Full 96-interval telemetry with raw measurements, technical losses, and data-quality indicators</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Mobile View Toggle */}
            <div className="mobile-alerts-toggle">
              <button 
                className={`mobile-tab-btn ${mobileLedgerView === 'cards' ? 'active' : ''}`}
                onClick={() => setMobileLedgerView('cards')}
                style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                title="Card View"
              >
                <LayoutList size={13} /> Cards
              </button>
              <button 
                className={`mobile-tab-btn ${mobileLedgerView === 'table' ? 'active' : ''}`}
                onClick={() => setMobileLedgerView('table')}
                style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                title="Table View"
              >
                <TableIcon size={13} /> Table
              </button>
            </div>

            <input 
              type="text" 
              placeholder="Search time (19:30)..." 
              className="control-input"
              value={searchInterval}
              onChange={(e) => setSearchInterval(e.target.value)}
              style={{ width: '140px', fontSize: '0.78rem' }}
            />
            <select 
              className="control-select"
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              style={{ fontSize: '0.78rem' }}
            >
              <option value="ALL">All Intervals (96)</option>
              <option value="ANOMALIES">Flagged Only</option>
            </select>
          </div>
        </div>

        {/* Mobile Interval Cards View */}
        <div className={`mobile-interval-cards-list ${mobileLedgerView === 'table' ? 'mobile-hidden' : ''}`}>
          {filteredReadings.map((r) => (
            <div 
              key={r.interval_index} 
              className={`mobile-interval-card ${r.is_anomaly ? 'anomaly-border' : ''}`}
            >
              <div className="mobile-interval-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{r.time_str}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    (Int #{r.interval_index})
                  </span>
                </div>
                {r.is_anomaly ? (
                  <span className="badge badge-critical">FLAGGED</span>
                ) : (
                  <span className="badge badge-normal" style={{ fontSize: '0.7rem' }}>Nominal</span>
                )}
              </div>

              <div className="mobile-alert-metrics-strip" style={{ marginTop: '8px', marginBottom: '8px' }}>
                <div className="mobile-alert-metric">
                  <span className="metric-label">Unexplained</span>
                  <span className={`metric-val ${r.is_anomaly ? 'critical' : ''}`}>{r.unexplained_kwh} kWh</span>
                </div>
                <div className="mobile-alert-metric">
                  <span className="metric-label">Gap %</span>
                  <span className={`metric-val ${r.is_anomaly ? 'critical' : ''}`}>{r.unexplained_pct}%</span>
                </div>
                <div className="mobile-alert-metric">
                  <span className="metric-label">Z-Score</span>
                  <span className="metric-val" style={{ 
                    color: r.anomaly_score >= 3.2 ? '#dc2626' : (r.anomaly_score >= 2.0 ? '#d97706' : 'inherit') 
                  }}>
                    {r.anomaly_score}&sigma;
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <span>Supplied: {r.transformer_kwh}k • Meters: {r.household_total_kwh}k</span>
                <span className={`badge ${
                  r.data_quality === 'good' ? 'badge-normal' :
                  r.data_quality === 'missing_data' ? 'badge-critical' : 'badge-telemetry'
                }`} style={{ fontSize: '0.68rem', padding: '1px 5px' }}>
                  {r.data_quality}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop / Full Table View */}
        <div className={`table-container ${mobileLedgerView === 'cards' ? 'mobile-hidden-table' : ''}`} style={{ maxHeight: '420px', overflowY: 'auto' }}>
          <table className="data-table">
            <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
              <tr>
                <th>Interval</th>
                <th>Time (HH:MM)</th>
                <th>Transformer kWh</th>
                <th>Household kWh</th>
                <th>Tech Loss kWh</th>
                <th>Unexplained kWh</th>
                <th>Discrepancy %</th>
                <th>Z-Score</th>
                <th>Data Quality</th>
                <th>Anomaly Flag</th>
              </tr>
            </thead>
            <tbody>
              {filteredReadings.map((r) => (
                <tr key={r.interval_index} style={{ backgroundColor: r.is_anomaly ? '#fff5f5' : 'transparent' }}>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>#{r.interval_index}</td>
                  <td><strong>{r.time_str}</strong></td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{r.transformer_kwh}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{r.household_total_kwh}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{r.technical_loss_kwh}</td>
                  <td style={{ 
                    fontFamily: 'var(--font-mono)', 
                    fontWeight: r.is_anomaly ? 700 : 400,
                    color: r.is_anomaly ? '#b91c1c' : 'inherit'
                  }}>
                    {r.unexplained_kwh}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{r.unexplained_pct}%</td>
                  <td style={{ 
                    fontFamily: 'var(--font-mono)',
                    color: r.anomaly_score >= 3.2 ? '#dc2626' : (r.anomaly_score >= 2.0 ? '#d97706' : 'inherit')
                  }}>
                    {r.anomaly_score} &sigma;
                  </td>
                  <td>
                    <span className={`badge ${
                      r.data_quality === 'good' ? 'badge-normal' :
                      r.data_quality === 'missing_data' ? 'badge-critical' : 'badge-telemetry'
                    }`}>
                      {r.data_quality}
                    </span>
                  </td>
                  <td>
                    {r.is_anomaly ? (
                      <span className="badge badge-critical">FLAGGED</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Nominal</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
