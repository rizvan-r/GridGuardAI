import React from 'react';
import { X, Zap, AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function NodeDrawer({ nodeData, onClose, onInvestigate }) {
  if (!nodeData) return null;

  const chartData = (nodeData.hourly_readings || []).map((val, idx) => ({
    hour: `${idx}:00`,
    kwh: val,
  }));

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SUSPICIOUS':
      case 'ANOMALY':
        return <span className="badge badge-critical"><AlertTriangle size={12} /> Suspicious Anomaly</span>;
      case 'FAULT':
        return <span className="badge badge-telemetry"><Zap size={12} /> Meter Fault Diagnostic</span>;
      default:
        return <span className="badge badge-normal"><ShieldCheck size={12} /> Normal Operation</span>;
    }
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {nodeData.node_type} Telemetry
            </span>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {nodeData.label}
            </h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          {getStatusBadge(nodeData.status)}
          {nodeData.section_id && (
            <span className="badge badge-telemetry">Section {nodeData.section_id}</span>
          )}
        </div>

        <div className="card" style={{ padding: '14px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>24h Total Energy</span>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {nodeData.total_energy_kwh} kWh
            </span>
          </div>

          {nodeData.residual_kwh !== undefined && nodeData.residual_kwh !== null && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Unexplained Energy Residual</span>
              <span style={{ 
                fontSize: '0.95rem', 
                fontWeight: 700, 
                fontFamily: 'var(--font-mono)',
                color: nodeData.residual_kwh > 1.0 ? 'var(--status-critical)' : 'inherit'
              }}>
                {nodeData.residual_kwh} kWh
              </span>
            </div>
          )}
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '10px' }}>
            24-Hour Load Profile (Hourly kWh)
          </h3>
          <div style={{ height: '180px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={3} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip 
                  formatter={(val) => [`${val} kWh`, 'Energy']} 
                  contentStyle={{ fontSize: '11px', borderRadius: '4px' }}
                />
                <Bar 
                  dataKey="kwh" 
                  fill={nodeData.residual_kwh > 2.0 ? '#ef4444' : '#0284c7'} 
                  radius={[2, 2, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {nodeData.recent_alerts && nodeData.recent_alerts.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '8px', color: 'var(--status-critical)' }}>
              Active Related Alerts
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {nodeData.recent_alerts.map((altId) => (
                <div 
                  key={altId} 
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--status-critical-bg)',
                    border: '1px solid var(--status-critical-border)',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.82rem'
                  }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--status-critical)' }}>{altId}</span>
                  <button 
                    className="btn-secondary" 
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    onClick={() => {
                      onClose();
                      if (onInvestigate) onInvestigate(altId);
                    }}
                  >
                    Open Investigation
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            <HelpCircle size={14} />
            <span>Inspection Protocol: Clamp CT validation recommended before physical contact.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
