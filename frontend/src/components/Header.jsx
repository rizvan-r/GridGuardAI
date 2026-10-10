import React, { useState } from 'react';
import { Play, RotateCcw, Activity, Menu, SlidersHorizontal, ChevronDown, ChevronUp, Radio } from 'lucide-react';

export default function Header({ 
  pageTitle, 
  scenario, 
  setScenario, 
  seed, 
  setSeed, 
  onRunSimulation, 
  loading,
  systemStatus,
  onToggleMobileMenu,
  onOpenLiveSimulation
}) {
  const [showMobileParams, setShowMobileParams] = useState(false);

  const scenarios = [
    { id: 'EVENING_UNMETERED', label: 'Scenario B: Evening Unmetered Load (19:00 - 22:00)', shortLabel: 'Scen B: Evening Unmetered (7-10 PM)' },
    { id: 'NORMAL', label: 'Scenario A: Normal Baseline Day', shortLabel: 'Scen A: Normal Day' },
    { id: 'METER_FAULT', label: 'Scenario C: Household Meter Fault (H-24)', shortLabel: 'Scen C: Meter Fault (H-24)' },
    { id: 'MULTIPLE_ANOMALIES', label: 'Scenario D: Multiple Lateral Anomalies', shortLabel: 'Scen D: Multiple Anomalies' },
    { id: 'NOISY_MEASUREMENTS', label: 'Scenario E: Noisy & Missing Telemetry', shortLabel: 'Scen E: Noisy Telemetry' },
  ];

  return (
    <header className="top-header">
      <div className="header-top-row">
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
              <span className="badge-text">{systemStatus.replace('_', ' ')}</span>
            </span>
          )}
        </div>

        {/* Mobile Quick Actions (Live Sim, Run & Parameters Toggle) */}
        <div className="mobile-header-quick-actions">
          {onOpenLiveSimulation && (
            <button 
              className="btn-secondary header-live-btn"
              onClick={onOpenLiveSimulation}
              title="Open Real-time Live Simulation"
            >
              <Radio size={13} color="#dc2626" />
              <span>Live</span>
              <span className="live-header-pulse" />
            </button>
          )}

          <button 
            className="btn-primary mobile-quick-run-btn"
            onClick={onRunSimulation}
            disabled={loading}
            title="Run Simulation"
          >
            <Play size={13} />
            <span>{loading ? '...' : 'Run'}</span>
          </button>
          <button 
            className={`btn-secondary mobile-params-toggle-btn ${showMobileParams ? 'active' : ''}`}
            onClick={() => setShowMobileParams(!showMobileParams)}
            aria-label="Toggle simulation parameters"
            title="Simulation Parameters"
          >
            <SlidersHorizontal size={14} />
            {showMobileParams ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {/* Header Controls (Always visible on Desktop, collapsible on Mobile) */}
      <div className={`header-controls ${showMobileParams ? 'mobile-expanded' : ''}`}>
        <div className="header-control-group scenario-group">
          <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Scenario:</label>
          <select 
            className="control-select" 
            value={scenario} 
            onChange={(e) => setScenario(e.target.value)}
            disabled={loading}
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="header-control-group seed-group">
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

        <div className="header-control-buttons">
          {onOpenLiveSimulation && (
            <button 
              className="btn-secondary header-live-btn desktop-only-btn"
              onClick={onOpenLiveSimulation}
              title="Open Real-time Live Simulation"
            >
              <Radio size={14} color="#dc2626" />
              <span>Live Sim</span>
              <span className="live-header-pulse" />
            </button>
          )}

          <button 
            className="btn-primary desktop-run-btn" 
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
      </div>
    </header>
  );
}
