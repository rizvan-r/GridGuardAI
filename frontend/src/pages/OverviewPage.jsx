import React, { useState } from 'react';
import { 
  Zap, 
  Home, 
  Flame, 
  AlertTriangle, 
  Clock, 
  ArrowUpRight, 
  CheckCircle2,
  ChevronRight,
  BarChart3,
  TrendingUp,
  Activity,
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
  BarChart, 
  Bar, 
  ReferenceArea 
} from 'recharts';

export default function OverviewPage({ summary, readings, alerts, onNavigateToInvestigation }) {
  const [mobileChartTab, setMobileChartTab] = useState('balance');
  const [mobileAlertView, setMobileAlertView] = useState('cards');

  if (!summary || !readings) {
    return <div className="page-container"><p>Loading live energy calculations...</p></div>;
  }

  // Downsample 96 intervals for smooth rendering
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span><strong>Feeder:</strong> {summary.feeder_name}</span>
          <span>•</span>
          <span><strong>Scenario:</strong> {summary.scenario} (Seed {summary.seed})</span>
          <span>•</span>
          <span><strong>Simulated Peak:</strong> {summary.peak_discrepancy_window}</span>
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
            <span>Transformer Supplied</span>
            <Zap size={16} color="#0284c7" />
          </div>
          <div className="kpi-value">
            {summary.transformer_energy_supplied_kwh.toLocaleString()}
            <span className="kpi-unit">kWh</span>
          </div>
          <div className="kpi-subtext">
            <span>Class 0.5 Feeder Meter T1</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">
            <span>Household Recorded</span>
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
            <span>Estimated Tech Losses</span>
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
            <span>Raw loss minus tech losses</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">
            <span>Unexplained Gap %</span>
            <ArrowUpRight size={16} color={summary.unexplained_discrepancy_pct > 8.0 ? '#dc2626' : '#16a34a'} />
          </div>
          <div className="kpi-value" style={{ color: summary.unexplained_discrepancy_pct > 8.0 ? 'var(--status-critical)' : 'inherit' }}>
            {summary.unexplained_discrepancy_pct}%
          </div>
          <div className="kpi-subtext">
            <span>vs Transformer Input</span>
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

      {/* Mobile Chart Navigation Tabs (Hidden on Desktop via CSS) */}
      <div className="mobile-chart-tabs">
        <button 
          className={`mobile-tab-btn ${mobileChartTab === 'balance' ? 'active' : ''}`}
          onClick={() => setMobileChartTab('balance')}
        >
          <Activity size={14} /> 24h Balance
        </button>
        <button 
          className={`mobile-tab-btn ${mobileChartTab === 'surge' ? 'active' : ''}`}
          onClick={() => setMobileChartTab('surge')}
        >
          <TrendingUp size={14} /> 7-10 PM Peak
        </button>
        <button 
          className={`mobile-tab-btn ${mobileChartTab === 'sections' ? 'active' : ''}`}
          onClick={() => setMobileChartTab('sections')}
        >
          <BarChart3 size={14} /> Sections
        </button>
      </div>

      {/* Charts Grid: Responsive display on desktop, Tab-driven on mobile */}
      <div className="charts-responsive-wrapper">
        {/* Chart 1: 24h Energy Balance Line Chart */}
        <div className={`card chart-card-item ${mobileChartTab !== 'balance' ? 'mobile-hidden' : ''}`}>
          <div className="card-header">
            <div>
              <h2 className="card-title">24-Hour Energy Balance</h2>
              <p className="card-description">Comparison of input, consumption, and unexplained gap (15-min intervals)</p>
            </div>
          </div>
          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={15} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip 
                  formatter={(val, name) => [`${val} kWh`, name]}
                  contentStyle={{ fontSize: '11px', borderRadius: '6px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                <Line type="monotone" dataKey="transformer" name="Transformer" stroke="#0284c7" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="household" name="Household Sum" stroke="#16a34a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="unexplained" name="Unexplained Gap" stroke="#dc2626" strokeWidth={2} strokeDasharray="3 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Hourly Evening Window Discrepancy Chart (7 PM - 10 PM Focus) */}
        <div className={`card chart-card-item ${mobileChartTab !== 'surge' ? 'mobile-hidden' : ''}`}>
          <div className="card-header">
            <div>
              <h2 className="card-title">Evening Surge (19:00 - 22:00)</h2>
              <p className="card-description">Zoomed inspection highlighting the anomalous surge window (Intervals 76–88)</p>
            </div>
            <span className="badge badge-critical">7 PM - 10 PM</span>
          </div>
          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={eveningData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <XAxis dataKey="time_str" tick={{ fontSize: 10 }} interval={3} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip 
                  formatter={(val, name) => [`${val} kWh`, name]}
                  contentStyle={{ fontSize: '11px', borderRadius: '6px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                <ReferenceArea x1="19:00" x2="22:00" fill="#fee2e2" fillOpacity={0.6} />
                <Line type="monotone" dataKey="unexplained_kwh" name="Unexplained Loss" stroke="#dc2626" strokeWidth={2.5} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="technical_loss_kwh" name="Expected Loss" stroke="#d97706" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Chart 3 & Section Comparison */}
      <div className={`card ${mobileChartTab !== 'sections' ? 'mobile-hidden-chart-3' : ''}`}>
        <div className="card-header">
          <div>
            <h2 className="card-title">Distribution Section Energy Residuals</h2>
            <p className="card-description">Aggregated section incoming vs. household metered power across all 6 hamlets</p>
          </div>
        </div>
        <div style={{ height: '240px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sectionChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip 
                formatter={(val, name) => [`${val} kWh`, name]}
                contentStyle={{ fontSize: '11px', borderRadius: '6px' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
              <Bar dataKey="incoming" name="Section Incoming" fill="#94a3b8" radius={[3, 3, 0, 0]} />
              <Bar dataKey="household" name="Household Sum" fill="#16a34a" radius={[3, 3, 0, 0]} />
              <Bar dataKey="residual" name="Unaccounted Gap" fill="#dc2626" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Alerts Table / Mobile Cards */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 className="card-title">Recent Loss Discrepancy Alerts</h2>
            <p className="card-description">Statistically verified anomalies requiring operational investigation</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Mobile View Toggle (Cards vs Table) */}
            <div className="mobile-alerts-toggle">
              <button 
                className={`mobile-tab-btn ${mobileAlertView === 'cards' ? 'active' : ''}`}
                onClick={() => setMobileAlertView('cards')}
                style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                title="Card View"
              >
                <LayoutList size={13} /> Cards
              </button>
              <button 
                className={`mobile-tab-btn ${mobileAlertView === 'table' ? 'active' : ''}`}
                onClick={() => setMobileAlertView('table')}
                style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                title="Table View"
              >
                <TableIcon size={13} /> Table
              </button>
            </div>
            <button 
              className="btn-secondary" 
              style={{ fontSize: '0.78rem' }}
              onClick={() => onNavigateToInvestigation()}
            >
              Open Investigation <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {alerts && alerts.length > 0 ? (
          <>
            {/* Mobile Touch-Friendly Alert Cards (Visible on mobile when cards view is active) */}
            <div className={`mobile-alerts-cards-list ${mobileAlertView === 'table' ? 'mobile-hidden' : ''}`}>
              {alerts.map((alt) => (
                <div key={alt.id} className="mobile-alert-card">
                  <div className="mobile-alert-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`badge ${
                        alt.severity === 'CRITICAL' ? 'badge-critical' :
                        alt.severity === 'HIGH' ? 'badge-warning' : 'badge-normal'
                      }`}>
                        {alt.severity}
                      </span>
                      <strong style={{ fontSize: '0.85rem' }}>{alt.id}</strong>
                    </div>
                    <span style={{ 
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      backgroundColor: alt.status === 'Open' ? '#fee2e2' : '#e0f2fe',
                      color: alt.status === 'Open' ? '#b91c1c' : '#0369a1'
                    }}>
                      {alt.status}
                    </span>
                  </div>

                  <div className="mobile-alert-card-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Time:</span>
                      <strong style={{ fontFamily: 'var(--font-mono)' }}>{alt.time_str} (Int {alt.interval_index})</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '8px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Location:</span>
                      <span className="badge badge-telemetry">Section {alt.section_id || 'Feeder Wide'}</span>
                    </div>

                    <div className="mobile-alert-metrics-strip">
                      <div className="mobile-alert-metric">
                        <span className="metric-label">Unexplained Gap</span>
                        <span className="metric-val critical">{alt.unexplained_kwh} kWh</span>
                      </div>
                      <div className="mobile-alert-metric">
                        <span className="metric-label">Gap %</span>
                        <span className="metric-val critical">{alt.unexplained_pct}%</span>
                      </div>
                      <div className="mobile-alert-metric">
                        <span className="metric-label">Z-Score</span>
                        <span className="metric-val">{alt.anomaly_score}&sigma;</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    className="btn-primary mobile-alert-investigate-btn"
                    onClick={() => onNavigateToInvestigation(alt.id)}
                  >
                    <span>Investigate Incident</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Desktop Full Table (and mobile if table toggle is chosen) */}
            <div className={`table-container ${mobileAlertView === 'cards' ? 'mobile-hidden-table' : ''}`}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Alert ID</th>
                    <th>Time</th>
                    <th>Severity</th>
                    <th>Section</th>
                    <th>Gap</th>
                    <th>Gap %</th>
                    <th>Z-Score</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alt) => (
                    <tr key={alt.id}>
                      <td><strong>{alt.id}</strong></td>
                      <td>{alt.time_str}</td>
                      <td>
                        <span className={`badge ${
                          alt.severity === 'CRITICAL' ? 'badge-critical' :
                          alt.severity === 'HIGH' ? 'badge-warning' : 'badge-normal'
                        }`}>
                          {alt.severity}
                        </span>
                      </td>
                      <td>Sec {alt.section_id || 'Feeder'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{alt.unexplained_kwh}k</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{alt.unexplained_pct}%</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{alt.anomaly_score}&sigma;</td>
                      <td>
                        <span style={{ 
                          display: 'inline-block',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
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
                          style={{ padding: '4px 8px', fontSize: '0.72rem' }}
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
          </>
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
