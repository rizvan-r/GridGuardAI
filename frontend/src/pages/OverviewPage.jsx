import React from 'react';
import { 
  Zap, 
  Home, 
  Flame, 
  AlertTriangle, 
  Clock, 
  ArrowUpRight, 
  CheckCircle2,
  ChevronRight
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

export default function OverviewPage({ summary, readings, alerts, onNavigateToInvestigation }) {
  if (!summary || !readings) {
    return <div className="page-container"><p>Loading live energy calculations...</p></div>;
  }

  // Downsample 96 intervals to 24 hourly averages or sample for smooth rendering
  const timeChartData = readings.map((r) => ({
    time: r.time_str,
    interval: r.interval_index,
    transformer: r.transformer_kwh,
    household: r.household_total_kwh,
    technicalLoss: r.technical_loss_kwh,
    unexplained: r.unexplained_kwh,
    anomaly: r.is_anomaly,
  }));

  // Hourly discrepancy chart focused around evening peak (16:00 to 23:45)
  const eveningData = readings.filter((r) => r.interval_index >= 64 && r.interval_index <= 95);

  // Section comparison data
  const sectionChartData = (summary.sections || []).map((sec) => ({
    name: `Sec ${sec.section_id}`,
    incoming: sec.incoming_kwh,
    household: sec.household_kwh,
    residual: sec.residual_kwh,
    status: sec.status,
  }));

  return (
    <div className="page-container">
      {/* Simulation Context Banner */}
      <div className="simulation-context-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span><strong>Active Feeder:</strong> {summary.feeder_name}</span>
          <span>•</span>
          <span><strong>Scenario:</strong> {summary.scenario} (Seed {summary.seed})</span>
          <span>•</span>
          <span><strong>Simulated Peak Loss:</strong> {summary.peak_discrepancy_window} (~{summary.peak_discrepancy_kw} kW)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
          <Clock size={14} />
          <span>Calculated at {new Date(summary.simulation_timestamp).toLocaleTimeString()}</span>
        </div>
      </div>

      {/* 6 Core KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">
            <span>Transformer Energy Supplied</span>
            <Zap size={16} color="#0284c7" />
          </div>
          <div className="kpi-value">
            {summary.transformer_energy_supplied_kwh.toLocaleString()}
            <span className="kpi-unit">kWh</span>
          </div>
          <div className="kpi-subtext">
            <span>Class 0.5 Feeder Bulk Meter T1</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">
            <span>Total Household Recorded</span>
            <Home size={16} color="#16a34a" />
          </div>
          <div className="kpi-value">
            {summary.total_household_energy_kwh.toLocaleString()}
            <span className="kpi-unit">kWh</span>
          </div>
          <div className="kpi-subtext">
            <span>Aggregated 60 consumer meters</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">
            <span>Estimated Technical Losses</span>
            <Flame size={16} color="#d97706" />
          </div>
          <div className="kpi-value">
            {summary.estimated_technical_losses_kwh.toLocaleString()}
            <span className="kpi-unit">kWh</span>
          </div>
          <div className="kpi-subtext">
            <span>I²R resistive + core line loss</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">
            <span>Unexplained Discrepancy</span>
            <AlertTriangle size={16} color={summary.unexplained_discrepancy_kwh > 5.0 ? '#dc2626' : '#64748b'} />
          </div>
          <div className="kpi-value" style={{ color: summary.unexplained_discrepancy_kwh > 5.0 ? 'var(--status-critical)' : 'inherit' }}>
            {summary.unexplained_discrepancy_kwh.toLocaleString()}
            <span className="kpi-unit">kWh</span>
          </div>
          <div className="kpi-subtext">
            <span>Raw loss minus technical losses</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">
            <span>Unexplained Discrepancy %</span>
            <ArrowUpRight size={16} color={summary.unexplained_discrepancy_pct > 8.0 ? '#dc2626' : '#16a34a'} />
          </div>
          <div className="kpi-value" style={{ color: summary.unexplained_discrepancy_pct > 8.0 ? 'var(--status-critical)' : 'inherit' }}>
            {summary.unexplained_discrepancy_pct}%
          </div>
          <div className="kpi-subtext">
            <span>Denominator: Transformer Input</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">
            <span>Active Alerts</span>
            <AlertTriangle size={16} color={summary.active_alerts_count > 0 ? '#dc2626' : '#16a34a'} />
          </div>
          <div className="kpi-value">
            {summary.active_alerts_count}
          </div>
          <div className="kpi-subtext">
            <span>Requires operational review</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid-2">
        {/* Chart 1: 24h Energy Balance Line Chart */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">24-Hour Energy Balance</h2>
              <p className="card-description">Synchronized comparison of input, consumption, and unexplained gap (15-min intervals)</p>
            </div>
          </div>
          <div style={{ height: '280px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <XAxis dataKey="time" tick={{ fontSize: 11 }} interval={15} />
                <YAxis tick={{ fontSize: 11 }} label={{ value: 'kWh / 15-min', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }} />
                <Tooltip 
                  formatter={(val, name) => [`${val} kWh`, name]}
                  contentStyle={{ fontSize: '11px', borderRadius: '6px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="transformer" name="Transformer Input" stroke="#0284c7" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="household" name="Household Consumption" stroke="#16a34a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="unexplained" name="Unexplained Discrepancy" stroke="#dc2626" strokeWidth={2} strokeDasharray="3 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Hourly Evening Window Discrepancy Chart (7 PM - 10 PM Focus) */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Evening Discrepancy Surge (19:00 - 22:00)</h2>
              <p className="card-description">Zoomed inspection highlighting the anomalous surge window (Intervals 76–88)</p>
            </div>
            <span className="badge badge-critical">7 PM - 10 PM Surge</span>
          </div>
          <div style={{ height: '280px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={eveningData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <XAxis dataKey="time_str" tick={{ fontSize: 11 }} interval={3} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip 
                  formatter={(val, name) => [`${val} kWh`, name]}
                  contentStyle={{ fontSize: '11px', borderRadius: '6px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                {/* Highlight shaded area between 19:00 and 22:00 */}
                <ReferenceArea x1="19:00" x2="22:00" fill="#fee2e2" fillOpacity={0.6} />
                <Line type="monotone" dataKey="unexplained_kwh" name="Unexplained Loss" stroke="#dc2626" strokeWidth={3} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="technical_loss_kwh" name="Expected Tech Loss" stroke="#d97706" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Chart 3 & Section Comparison */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Distribution Section Energy Residuals</h2>
            <p className="card-description">Aggregated section incoming vs. household metered power across all 6 hamlets</p>
          </div>
        </div>
        <div style={{ height: '240px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sectionChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip 
                formatter={(val, name) => [`${val} kWh`, name]}
                contentStyle={{ fontSize: '11px', borderRadius: '6px' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Bar dataKey="incoming" name="Section Incoming" fill="#94a3b8" radius={[3, 3, 0, 0]} />
              <Bar dataKey="household" name="Household Metered" fill="#16a34a" radius={[3, 3, 0, 0]} />
              <Bar dataKey="residual" name="Unaccounted Residual" fill="#dc2626" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Alerts Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Recent Loss Discrepancy Alerts</h2>
            <p className="card-description">Statistically verified anomalies requiring operational investigation</p>
          </div>
          <button 
            className="btn-secondary" 
            style={{ fontSize: '0.78rem' }}
            onClick={() => onNavigateToInvestigation()}
          >
            Open Investigation Center <ChevronRight size={14} />
          </button>
        </div>

        {alerts && alerts.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Alert ID</th>
                  <th>Timestamp</th>
                  <th>Severity</th>
                  <th>Suspected Section</th>
                  <th>Unexplained kWh</th>
                  <th>Discrepancy %</th>
                  <th>Anomaly Score</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alt) => (
                  <tr key={alt.id}>
                    <td><strong>{alt.id}</strong></td>
                    <td>{alt.time_str} (Interval {alt.interval_index})</td>
                    <td>
                      <span className={`badge ${
                        alt.severity === 'CRITICAL' ? 'badge-critical' :
                        alt.severity === 'HIGH' ? 'badge-warning' : 'badge-normal'
                      }`}>
                        {alt.severity}
                      </span>
                    </td>
                    <td>Section {alt.section_id || 'Feeder Wide'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{alt.unexplained_kwh} kWh</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{alt.unexplained_pct}%</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>z = {alt.anomaly_score}</td>
                    <td>
                      <span style={{ 
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: alt.status === 'Open' ? '#fee2e2' : '#e0f2fe',
                        color: alt.status === 'Open' ? '#b91c1c' : '#0369a1'
                      }}>
                        {alt.status}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="btn-primary" 
                        style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        onClick={() => onNavigateToInvestigation(alt.id)}
                      >
                        Investigate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
            <CheckCircle2 size={32} color="#16a34a" style={{ margin: '0 auto 8px auto' }} />
            <p>No active loss alerts. Energy balance is within acceptable tolerance.</p>
          </div>
        )}
      </div>
    </div>
  );
}
