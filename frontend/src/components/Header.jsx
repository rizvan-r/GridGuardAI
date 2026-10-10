import React from 'react';
import { Play, RotateCcw, Activity, Menu } from 'lucide-react';

export default function Header({ 
  pageTitle, 
  scenario, 
  setScenario, 
  seed, 
  setSeed, 
  onRunSimulation, 
  loading,
  systemStatus,
  onToggleMobileMenu
}) {
  const scenarios = [
    { id: 'EVENING_UNMETERED', label: 'Scenario B: Evening Unmetered Load (19:00 - 22:00)' },
    { id: 'NORMAL', label: 'Scenario A: Normal Baseline Day' },
    { id: 'METER_FAULT', label: 'Scenario C: Household Meter Fault (H-24)' },
    { id: 'MULTIPLE_ANOMALIES', label: 'Scenario D: Multiple Lateral Anomalies' },
    { id: 'NOISY_MEASUREMENTS', label: 'Scenario E: Noisy & Missing Telemetry' },
  ];

  return (
    <header className="top-header">
      <div className="header-left">
        <button 
          className="mobile-menu-btn" 
          onClick={onToggleMobileMenu} 
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>

        <h1 className="page-title">{pageTitle}</h1>
        {systemStatus && (
          <span className={`badge ${
            systemStatus === 'CRITICAL_ANOMALY' ? 'badge-critical' :
            systemStatus === 'WARNING' ? 'badge-warning' : 'badge-normal'
          }`}>
            <Activity size={12} />
            {systemStatus.replace('_', ' ')}
          </span>
        )}
      </div>

      <div className="header-controls">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Scenario:</label>
          <select 
            className="control-select" 
            value={scenario} 
            onChange={(e) => setScenario(e.target.value)}
            disabled={loading}
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Seed:</label>
          <input 
            type="number" 
            className="control-input" 
            style={{ width: '70px' }} 
            value={seed} 
            onChange={(e) => setSeed(e.target.value)}
            disabled={loading}
          />
        </div>

        <button 
          className="btn-primary" 
          onClick={onRunSimulation}
          disabled={loading}
        >
          <Play size={14} />
          <span>{loading ? 'Simulating...' : 'Run Simulation'}</span>
        </button>

        <button 
          className="btn-secondary" 
          title="Randomize Seed"
          onClick={() => {
            const nextSeed = Math.floor(Math.random() * 900) + 100;
            setSeed(nextSeed);
          }}
          disabled={loading}
        >
          <RotateCcw size={14} />
          <span>Random</span>
        </button>
      </div>
    </header>
  );
}
