import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  SkipForward, 
  ChevronRight, 
  ChevronLeft,
  AlertTriangle, 
  Zap, 
  Activity, 
  Clock, 
  Sliders, 
  Sparkles, 
  CheckCircle2, 
  Flame, 
  ShieldCheck, 
  Compass, 
  ArrowRight,
  TrendingUp,
  FileSearch,
  Radio,
  RefreshCw,
  Cpu,
  Layers,
  HelpCircle,
  Eye
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
  ReferenceLine, 
  ReferenceArea 
} from 'recharts';
import { fetchLiveStep, chatAI } from '../api';

export default function LiveSimulationPage({ 
  readings, 
  summary, 
  alerts, 
  onNavigateToInvestigation,
  onNavigateToNetwork,
  onNavigateToPlanner
}) {
  const [currentInterval, setCurrentInterval] = useState(76); // Default near evening surge window (19:00)
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(800); // 800ms per interval tick
  const [autoPauseOnAnomaly, setAutoPauseOnAnomaly] = useState(true);
  const [stepData, setStepData] = useState(null);
  const [loadingStep, setLoadingStep] = useState(false);
  
  // AI explanation state for active interval
  const [aiExplanation, setAiExplanation] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');

  // Mobile tab state: 'controls', 'charts', 'review'
  const [mobileTab, setMobileTab] = useState('review');

  const timerRef = useRef(null);
  const wasAnomalousRef = useRef(false);

  // Fetch detailed live step data when currentInterval changes
  useEffect(() => {
    let isMounted = true;
    setLoadingStep(true);
    fetchLiveStep(currentInterval)
      .then((data) => {
        if (isMounted) {
          setStepData(data);
          
          // Auto-pause if transitioned into a critical anomaly
          if (autoPauseOnAnomaly && data.is_anomaly && !wasAnomalousRef.current) {
            setIsPlaying(false);
          }
          wasAnomalousRef.current = data.is_anomaly;
        }
      })
      .catch((err) => console.error('Failed to fetch live step:', err))
      .finally(() => {
        if (isMounted) setLoadingStep(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentInterval, autoPauseOnAnomaly]);

  // Interval timer tick for live playback
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentInterval((prev) => {
          if (prev >= 95) {
            setIsPlaying(false);
            return 95;
          }
          return prev + 1;
        });
      }, speedMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, speedMs]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (currentInterval >= 95) {
      setCurrentInterval(0);
    }
    setIsPlaying(!isPlaying);
  };

  // Jump to start of anomaly surge window (Interval 76 / 19:00)
  const jumpToAnomaly = () => {
    setIsPlaying(false);
    setCurrentInterval(76);
  };

  // Step -1 interval
  const stepBack = () => {
    setIsPlaying(false);
    setCurrentInterval((prev) => Math.max(0, prev - 1));
  };

  // Step +1 interval
  const stepForward = () => {
    setIsPlaying(false);
    setCurrentInterval((prev) => Math.min(95, prev + 1));
  };

  // Reset to 00:00
  const handleReset = () => {
    setIsPlaying(false);
    setCurrentInterval(0);
  };

  // Ask AI for explanation of current live interval
  const handleAskAI = async (customQuestion = null) => {
    if (!stepData) return;
    const q = customQuestion || aiQuestion || `Explain the energy residual anomaly at simulated interval ${currentInterval} (${stepData.time_str}).`;
    try {
      setAiLoading(true);
      const res = await chatAI(
        `[Interval ${currentInterval} - ${stepData.time_str}] Unexplained loss is ${stepData.unexplained_kwh} kWh (${stepData.unexplained_pct}%). Anomaly score is z=${stepData.anomaly_score}sigma. Suspected section is Section ${stepData.dominant_section}. Top candidate tap is ${stepData.localization.top_candidate.label}. Question: ${q}`
      );
      setAiExplanation(res);
      if (customQuestion) setAiQuestion('');
    } catch (err) {
      console.error('Failed to get AI diagnosis:', err);
    } finally {
      setAiLoading(false);
    }
  };

  // Downsample or slice historical readings up to currentInterval for live chart animation
  const activeReadings = (readings || []).slice(0, currentInterval + 1);
  const liveChartData = activeReadings.map((r) => ({
    time: r.time_str,
    interval: r.interval_index,
    transformer: r.transformer_kwh,
    household: r.household_total_kwh,
    unexplained: r.unexplained_kwh,
    anomalyScore: r.anomaly_score,
    isAnomaly: r.is_anomaly,
  }));

  // Section breakdown for active interval
  const sectionBreakdownData = stepData?.section_breakdown ? Object.entries(stepData.section_breakdown).map(([sec, val]) => ({
    section: `Sec ${sec}`,
    residual: val,
    isSuspect: sec === stepData.dominant_section,
  })) : [];

  const timeStr = stepData?.time_str || (readings && readings[currentInterval]?.time_str) || '19:00';
  const isAnomaly = stepData?.is_anomaly || false;
  const anomalyScore = stepData?.anomaly_score || 0;
  const severity = stepData?.severity || 'NORMAL';
  const dominantSec = stepData?.dominant_section || 'C';
  const topCandidate = stepData?.localization?.top_candidate;

  return (
    <div className="page-container">
      
      {/* Hero Live Status & Control Banner */}
      <div className="card live-simulation-hero-card" style={{ marginBottom: '16px', padding: '16px 20px', borderLeft: isAnomaly ? '5px solid #dc2626' : '5px solid #10b981' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          
          {/* Left: Live Ticker & Time Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className={`live-pulse-indicator ${isPlaying ? 'running' : 'paused'} ${isAnomaly ? 'anomaly-pulse' : ''}`}>
              <Radio size={20} color={isAnomaly ? '#dc2626' : (isPlaying ? '#10b981' : '#64748b')} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="live-pill-tag">
                  {isPlaying ? '🔴 LIVE SIMULATION STREAM' : '⏸ SIMULATION PAUSED'}
                </span>
                <span className={`badge ${
                  severity === 'CRITICAL' ? 'badge-critical' :
                  severity === 'HIGH' ? 'badge-warning' : 'badge-normal'
                }`}>
                  {severity === 'CRITICAL' ? 'CRITICAL ANOMALY' : (severity === 'HIGH' ? 'WARNING' : 'NORMAL STATUS')}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                <span className="live-clock-time">{timeStr}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Interval #{currentInterval} of 95 (15-min cadence)
                </span>
              </div>
            </div>
          </div>

          {/* Right: Quick Action Buttons & Anomaly Shortcut */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button 
              className="btn-secondary" 
              onClick={jumpToAnomaly}
              title="Jump directly to 19:00 surge onset"
              style={{ fontSize: '0.8rem', padding: '7px 12px', borderColor: '#fca5a5', color: '#b91c1c' }}
            >
              <Flame size={14} color="#dc2626" />
              <span>Jump to Anomaly (19:00)</span>
            </button>

            <button 
              className="btn-secondary" 
              onClick={handleReset}
              title="Reset simulation to 00:00"
              style={{ fontSize: '0.8rem', padding: '7px 12px' }}
            >
              <RotateCcw size={14} />
              <span>Reset (00:00)</span>
            </button>
          </div>
        </div>

        {/* Timeline Slider with Surge Zone Highlight */}
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
            <span>00:00 (Start)</span>
            <span style={{ color: '#dc2626', fontWeight: 600 }}>19:00 - 22:00 (Evening Surge Window)</span>
            <span>23:45 (Midnight)</span>
          </div>

          <div className="timeline-slider-wrapper" style={{ position: 'relative' }}>
            <input 
              type="range"
              min={0}
              max={95}
              value={currentInterval}
              onChange={(e) => {
                setIsPlaying(false);
                setCurrentInterval(Number(e.target.value));
              }}
              className="timeline-range-input"
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* Playback Controls Deck */}
        <div className="playback-controls-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              className="btn-secondary playback-btn"
              onClick={stepBack}
              disabled={currentInterval === 0}
              title="Step backward 15 minutes"
            >
              <ChevronLeft size={16} />
              <span>-15m</span>
            </button>

            <button 
              className={`btn-primary playback-play-btn ${isPlaying ? 'playing' : ''}`}
              onClick={togglePlay}
              title={isPlaying ? 'Pause Simulation' : 'Run Live Simulation'}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              <span>{isPlaying ? 'Pause' : 'Play Live'}</span>
            </button>

            <button 
              className="btn-secondary playback-btn"
              onClick={stepForward}
              disabled={currentInterval >= 95}
              title="Step forward 15 minutes"
            >
              <span>+15m</span>
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Speed Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Speed:</span>
            <div className="speed-pills-group">
              {[
                { ms: 1500, label: '0.5x' },
                { ms: 800, label: '1x (Normal)' },
                { ms: 350, label: '2.5x (Fast)' },
              ].map((s) => (
                <button
                  key={s.ms}
                  className={`speed-pill ${speedMs === s.ms ? 'active' : ''}`}
                  onClick={() => setSpeedMs(s.ms)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <label className="auto-pause-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', cursor: 'pointer', marginLeft: '10px' }}>
              <input 
                type="checkbox"
                checked={autoPauseOnAnomaly}
                onChange={(e) => setAutoPauseOnAnomaly(e.target.checked)}
              />
              <span>Auto-pause on Anomaly</span>
            </label>
          </div>
        </div>
      </div>

      {/* Real-Time Telemetry HUD (Heads-Up Display) - 5 Live Metric Cards */}
      <div className="kpi-grid live-hud-grid" style={{ marginBottom: '16px' }}>
        <div className="kpi-card">
          <div className="kpi-label">
            <span>Supplied (T1)</span>
            <Zap size={16} color="#0284c7" />
          </div>
          <div className="kpi-value">
            {stepData ? stepData.transformer_kwh : (readings && readings[currentInterval]?.transformer_kwh) || '0.00'}
            <span className="kpi-unit">kWh</span>
          </div>
          <div className="kpi-subtext">
            <span>Feeder Input at {timeStr}</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">
            <span>Metered Households</span>
            <Activity size={16} color="#16a34a" />
          </div>
          <div className="kpi-value">
            {stepData ? stepData.household_total_kwh : (readings && readings[currentInterval]?.household_total_kwh) || '0.00'}
            <span className="kpi-unit">kWh</span>
          </div>
          <div className="kpi-subtext">
            <span>60 Consumer AMI Meters</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">
            <span>Est. Tech Loss</span>
            <Flame size={16} color="#d97706" />
          </div>
          <div className="kpi-value">
            {stepData ? stepData.technical_loss_kwh : (readings && readings[currentInterval]?.technical_loss_kwh) || '0.00'}
            <span className="kpi-unit">kWh</span>
          </div>
          <div className="kpi-subtext">
            <span>I²R line loss model</span>
          </div>
        </div>

        <div className={`kpi-card ${isAnomaly ? 'anomaly-kpi-highlight' : ''}`}>
          <div className="kpi-label">
            <span>Unexplained Gap</span>
            <AlertTriangle size={16} color={isAnomaly ? '#dc2626' : '#64748b'} />
          </div>
          <div className="kpi-value" style={{ color: isAnomaly ? '#dc2626' : 'inherit' }}>
            {stepData ? stepData.unexplained_kwh : (readings && readings[currentInterval]?.unexplained_kwh) || '0.00'}
            <span className="kpi-unit">kWh</span>
          </div>
          <div className="kpi-subtext">
            <span>Gap: {stepData ? stepData.unexplained_pct : (readings && readings[currentInterval]?.unexplained_pct) || '0.0'}% of input</span>
          </div>
        </div>

        <div className={`kpi-card ${isAnomaly ? 'anomaly-kpi-highlight' : ''}`}>
          <div className="kpi-label">
            <span>Anomaly Z-Score</span>
            <TrendingUp size={16} color={anomalyScore >= 3.2 ? '#dc2626' : (anomalyScore >= 2.0 ? '#d97706' : '#16a34a')} />
          </div>
          <div className="kpi-value" style={{ color: anomalyScore >= 3.2 ? '#dc2626' : (anomalyScore >= 2.0 ? '#d97706' : '#16a34a') }}>
            {anomalyScore}
            <span className="kpi-unit">&sigma;</span>
          </div>
          <div className="kpi-subtext">
            <span>Threshold: &ge; 3.2&sigma; Critical</span>
          </div>
        </div>
      </div>

      {/* Mobile Tab Switcher */}
      <div className="mobile-view-toggle live-sim-mobile-tabs">
        <button 
          className={`mobile-tab-btn ${mobileTab === 'review' ? 'active' : ''}`}
          onClick={() => setMobileTab('review')}
        >
          <FileSearch size={14} /> Anomaly Review & AI
        </button>
        <button 
          className={`mobile-tab-btn ${mobileTab === 'charts' ? 'active' : ''}`}
          onClick={() => setMobileTab('charts')}
        >
          <TrendingUp size={14} /> Dynamic Charts ({currentInterval + 1}/96)
        </button>
      </div>

      {/* Main Layout: Left = Real-time Charts, Right = Live Anomaly Review & AI Diagnostic */}
      <div className="grid-2 live-simulation-layout" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
        
        {/* Left Column: Real-Time Dynamic Charts (Growing with simulation progress) */}
        <div className={`live-charts-column ${mobileTab !== 'charts' ? 'mobile-hidden' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Dynamic Chart 1: Energy Divergence Up to Current Time */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Live Energy Trajectory (00:00 to {timeStr})</h2>
                <p className="card-description">Dynamically plots incoming feeder power vs recorded household consumption</p>
              </div>
              <span className="badge badge-telemetry">Interval {currentInterval + 1} / 96</span>
            </div>

            <div style={{ height: '240px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={liveChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={Math.max(2, Math.floor(currentInterval / 6))} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip 
                    formatter={(val, name) => [`${val} kWh`, name]}
                    contentStyle={{ fontSize: '11px', borderRadius: '6px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                  {/* Highlight evening anomaly window */}
                  <ReferenceArea x1="19:00" x2="22:00" fill="#fee2e2" fillOpacity={0.4} />
                  <Line type="monotone" dataKey="transformer" name="Feeder Input" stroke="#0284c7" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="household" name="Household Recorded" stroke="#16a34a" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="unexplained" name="Unexplained Loss" stroke="#dc2626" strokeWidth={2.5} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Dynamic Chart 2: Statistical Anomaly Score Progression */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Statistical Z-Score Progression</h2>
                <p className="card-description">Outlier departure trajectory against persistence thresholds</p>
              </div>
              <span className={`badge ${anomalyScore >= 3.2 ? 'badge-critical' : 'badge-normal'}`}>
                z = {anomalyScore}&sigma;
              </span>
            </div>

            <div style={{ height: '200px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={liveChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={Math.max(2, Math.floor(currentInterval / 6))} />
                  <YAxis tick={{ fontSize: 10 }} domain={[-1, 7]} />
                  <Tooltip 
                    formatter={(val, name) => [`${val} σ`, name]}
                    contentStyle={{ fontSize: '11px', borderRadius: '6px' }}
                  />
                  <ReferenceLine y={2.0} stroke="#d97706" strokeDasharray="3 3" label={{ value: 'Warn 2.0σ', position: 'insideTopRight', fontSize: 10, fill: '#d97706' }} />
                  <ReferenceLine y={3.2} stroke="#dc2626" strokeDasharray="3 3" label={{ value: 'Crit 3.2σ', position: 'insideTopRight', fontSize: 10, fill: '#dc2626' }} />
                  <Line type="monotone" dataKey="anomalyScore" name="Robust Z-Score" stroke="#dc2626" strokeWidth={2.2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Dynamic Chart 3: Real-Time Section Residuals at this interval */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Section Residual Breakdown at {timeStr}</h2>
                <p className="card-description">Real-time discrepancy distribution across hamlets A through F</p>
              </div>
              <span className="badge badge-telemetry">Section {dominantSec} Suspect</span>
            </div>

            <div style={{ height: '180px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sectionBreakdownData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <XAxis dataKey="section" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip 
                    formatter={(val, name) => [`${val} kWh`, name]}
                    contentStyle={{ fontSize: '11px', borderRadius: '6px' }}
                  />
                  <Bar dataKey="residual" name="Unexplained Residual" fill="#0284c7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Column: Live Anomaly Review & Instant AI Root-Cause Diagnostic */}
        <div className={`live-review-column ${mobileTab !== 'review' ? 'mobile-hidden' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Live Anomaly Detection Card */}
          <div className="card" style={{ 
            borderColor: isAnomaly ? '#fca5a5' : 'var(--border-subtle)',
            backgroundColor: isAnomaly ? '#fffaf0' : 'var(--bg-surface)',
            boxShadow: isAnomaly ? '0 4px 14px rgba(220, 38, 38, 0.08)' : 'var(--shadow-sm)'
          }}>
            <div className="card-header">
              <div>
                <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isAnomaly ? '#b91c1c' : 'inherit' }}>
                  {isAnomaly ? <AlertTriangle size={18} color="#dc2626" /> : <CheckCircle2 size={18} color="#16a34a" />}
                  <span>{isAnomaly ? 'Live Anomaly Review' : 'Interval Normal'}</span>
                </h2>
                <p className="card-description">
                  {isAnomaly 
                    ? `Active loss departure identified at Interval #${currentInterval} (${timeStr})`
                    : `Closed energy balance within acceptable tolerance at ${timeStr}`}
                </p>
              </div>

              <span className={`badge ${isAnomaly ? 'badge-critical' : 'badge-normal'}`}>
                {isAnomaly ? 'PERSISTENT ANOMALY' : 'NOMINAL'}
              </span>
            </div>

            {isAnomaly ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                {/* Localization Path */}
                <div style={{ padding: '12px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>
                    Hierarchical Localization Path
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span>Feeder T1</span>
                    <ArrowRight size={14} />
                    <span style={{ color: '#b91c1c' }}>Section {dominantSec}</span>
                    <ArrowRight size={14} />
                    <span style={{ color: '#b91c1c' }}>{topCandidate?.candidate_id || 'Candidate U-03'}</span>
                  </div>
                </div>

                {/* Root Cause Details */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  <div style={{ padding: '10px', backgroundColor: 'var(--bg-surface)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Suspected Cause</span>
                    <p style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '2px' }}>
                      Unmetered Lateral Load
                    </p>
                  </div>

                  <div style={{ padding: '10px', backgroundColor: 'var(--bg-surface)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Top Candidate Branch</span>
                    <p style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '2px', color: '#b91c1c' }}>
                      {topCandidate?.candidate_id || 'U-03'} (Conf: {topCandidate?.confidence || 'HIGH'})
                    </p>
                  </div>
                </div>

                {/* Key Metrics */}
                <div style={{ padding: '12px', backgroundColor: '#fee2e2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                    <span>Unexplained Loss Rate:</span>
                    <strong style={{ color: '#b91c1c' }}>{stepData?.unexplained_kwh} kWh / interval</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                    <span>Discrepancy Share:</span>
                    <strong style={{ color: '#b91c1c' }}>{stepData?.unexplained_pct}% of supplied energy</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span>Statistical Significance:</span>
                    <strong style={{ color: '#b91c1c' }}>z = {stepData?.anomaly_score} &sigma; (&gt; 3.2&sigma;)</strong>
                  </div>
                </div>

                {/* Operational Dispatch Recommendation */}
                <div style={{ padding: '12px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>
                    Recommended Field Action
                  </div>
                  <p style={{ fontSize: '0.82rem', lineHeight: '1.4' }}>
                    {stepData?.localization?.recommended_next_measurement || 
                     `Deploy portable clamp CT sensor at Section ${dominantSec} header and inspect Candidate Branch U-03.`}
                  </p>
                </div>

                {/* Action Links */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <button 
                    className="btn-primary" 
                    style={{ flex: '1 1 140px', fontSize: '0.78rem' }}
                    onClick={() => onNavigateToInvestigation(stepData?.matching_alert_id || null)}
                  >
                    <FileSearch size={14} /> Open Investigation
                  </button>

                  <button 
                    className="btn-secondary" 
                    style={{ flex: '1 1 140px', fontSize: '0.78rem' }}
                    onClick={() => onNavigateToNetwork(`SEC_${dominantSec}`)}
                  >
                    <Compass size={14} /> Inspect Section {dominantSec}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
                <CheckCircle2 size={36} color="#16a34a" style={{ margin: '0 auto 8px auto' }} />
                <p style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-primary)' }}>Telemetry Nominal at {timeStr}</p>
                <p style={{ fontSize: '0.78rem', marginTop: '4px', maxWidth: '320px', margin: '4px auto 0 auto' }}>
                  No loss departure detected. Use the controls above or click "Jump to Anomaly" to fast-forward to 19:00.
                </p>
              </div>
            )}
          </div>

          {/* Live AI Engineering Diagnostic (Gemini Explainer) */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={16} color="var(--accent-primary)" />
                  <span>Live AI Engineering Diagnostic</span>
                </h2>
                <p className="card-description">Instant natural-language root-cause analysis for this specific interval</p>
              </div>
            </div>

            {/* Preset Question Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
              {[
                'Why did the loss surge at this hour?',
                `Why is Section ${dominantSec} suspect?`,
                'Could a meter fault explain this?',
                'Which measurement resolves ambiguity?',
              ].map((q) => (
                <button
                  key={q}
                  className="preset-q-btn"
                  onClick={() => handleAskAI(q)}
                  disabled={aiLoading}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '16px',
                    fontSize: '0.74rem',
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    textAlign: 'left'
                  }}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Custom Question Input */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <input 
                type="text"
                placeholder="Ask AI about this live interval..."
                className="control-input"
                style={{ flex: 1, fontSize: '0.8rem' }}
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAskAI(); }}
                disabled={aiLoading}
              />
              <button 
                className="btn-primary" 
                onClick={() => handleAskAI()}
                disabled={aiLoading}
                style={{ fontSize: '0.78rem', padding: '6px 12px' }}
              >
                {aiLoading ? 'Analyzing...' : 'Diagnose'}
              </button>
            </div>

            {/* AI Explanation Result */}
            {aiExplanation ? (
              <div style={{ 
                padding: '14px', 
                backgroundColor: 'var(--bg-subtle)', 
                borderRadius: '8px', 
                border: '1px solid var(--border-subtle)',
                fontSize: '0.82rem',
                lineHeight: '1.5'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--accent-primary)', fontWeight: 600 }}>
                  <Sparkles size={14} />
                  <span>AI Engineering Assessment (Interval #{currentInterval} • {timeStr})</span>
                </div>
                <p style={{ whiteSpace: 'pre-wrap', marginBottom: '10px' }}>
                  {aiExplanation.explanation}
                </p>

                {aiExplanation.key_findings && aiExplanation.key_findings.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <strong style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Key Findings:</strong>
                    <ul style={{ paddingLeft: '18px', marginTop: '4px', gap: '4px', display: 'flex', flexDirection: 'column' }}>
                      {aiExplanation.key_findings.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ marginTop: '10px', fontSize: '0.7rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
                  Presumption of innocence safeguard: Physical verification required before non-technical loss determination.
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', backgroundColor: 'var(--bg-subtle)', borderRadius: '8px' }}>
                <p style={{ fontSize: '0.78rem' }}>
                  Click any question above or type your prompt to generate an instant engineering explanation of this simulated interval.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
