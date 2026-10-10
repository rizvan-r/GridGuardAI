import React, { useState, useEffect } from 'react';
import { 
  FileSearch, 
  AlertTriangle, 
  ShieldCheck, 
  CheckCircle2, 
  MessageSquare, 
  History, 
  Send, 
  Sparkles,
  HelpCircle,
  Clock,
  ArrowRight
} from 'lucide-react';
import { updateAlertStatus, fetchAlertAudits, explainAlert } from '../api';

export default function InvestigationCenterPage({ alerts, selectedAlertId, onAlertUpdated }) {
  const [activeAlertId, setActiveAlertId] = useState(selectedAlertId || (alerts && alerts[0]?.id) || null);
  const [operatorNotes, setOperatorNotes] = useState('');
  const [audits, setAudits] = useState([]);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiExplanation, setAiExplanation] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const activeAlert = (alerts || []).find((a) => a.id === activeAlertId) || (alerts && alerts[0]) || null;

  useEffect(() => {
    if (selectedAlertId) {
      setActiveAlertId(selectedAlertId);
    } else if (alerts && alerts.length > 0 && !activeAlertId) {
      setActiveAlertId(alerts[0].id);
    }
  }, [selectedAlertId, alerts]);

  useEffect(() => {
    if (activeAlert?.id) {
      fetchAlertAudits(activeAlert.id)
        .then((data) => setAudits(data))
        .catch((err) => console.error(err));
      // Load initial AI explanation for this alert
      handleAskAI(null, activeAlert.id);
    }
  }, [activeAlert?.id]);

  const handleStatusChange = async (newStatus) => {
    if (!activeAlert) return;
    try {
      setStatusUpdating(true);
      await updateAlertStatus(activeAlert.id, newStatus, operatorNotes || `Status updated to ${newStatus}`);
      setOperatorNotes('');
      if (onAlertUpdated) onAlertUpdated();
      const updatedAudits = await fetchAlertAudits(activeAlert.id);
      setAudits(updatedAudits);
    } catch (err) {
      console.error('Failed to update status', err);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleAskAI = async (customQ = null, targetAlertId = null) => {
    const aid = targetAlertId || activeAlert?.id;
    if (!aid) return;
    const q = customQ || aiQuestion || null;
    try {
      setAiLoading(true);
      const res = await explainAlert(aid, q);
      setAiExplanation(res);
      if (customQ) setAiQuestion('');
    } catch (err) {
      console.error('Failed to get AI explanation', err);
    } finally {
      setAiLoading(false);
    }
  };

  const presetQuestions = [
    'Why did the loss increase between 7 PM and 10 PM?',
    'Why was Section C flagged?',
    'What evidence supports the U-03 candidate?',
    'Could a meter fault explain this anomaly?',
    'Which additional measurement would best narrow the location?',
  ];

  if (!alerts || alerts.length === 0) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <CheckCircle2 size={48} color="#16a34a" style={{ margin: '0 auto 12px auto' }} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Zero Active Loss Discrepancies</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px', maxWidth: '480px', margin: '4px auto 0 auto' }}>
            The active feeder simulation reports closed energy balances within standard technical tolerance.
            Switch to Scenario B (Evening Unmetered Load) in the top header to trigger an investigation workflow.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="grid-3" style={{ gridTemplateColumns: '320px 1fr' }}>
        
        {/* Left Column: Alert Docket Selector */}
        <div className="card" style={{ padding: '16px' }}>
          <div className="card-header" style={{ marginBottom: '12px' }}>
            <h2 className="card-title">Investigation Docket</h2>
            <span className="badge badge-critical">{alerts.length} Incidents</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {alerts.map((alt) => {
              const isSelected = alt.id === activeAlert?.id;
              return (
                <div
                  key={alt.id}
                  onClick={() => setActiveAlertId(alt.id)}
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                    backgroundColor: isSelected ? 'var(--accent-primary-light)' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '0.85rem' }}>{alt.id}</strong>
                    <span className={`badge ${
                      alt.severity === 'CRITICAL' ? 'badge-critical' : 'badge-warning'
                    }`}>
                      {alt.severity}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {alt.time_str} • Section {alt.section_id || 'Feeder'} • {alt.unexplained_kwh} kWh gap
                  </div>
                  <div style={{ 
                    marginTop: '6px', 
                    fontSize: '0.72rem', 
                    fontWeight: 600, 
                    color: alt.status === 'Open' ? '#b91c1c' : '#0369a1' 
                  }}>
                    Status: {alt.status}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Case File & Evidence Dossier */}
        {activeAlert && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Case File Overview Card */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 className="card-title" style={{ fontSize: '1.1rem' }}>
                      Incident Dossier: {activeAlert.id}
                    </h2>
                    <span className={`badge ${
                      activeAlert.status === 'Open' ? 'badge-critical' : 'badge-telemetry'
                    }`}>
                      {activeAlert.status}
                    </span>
                  </div>
                  <p className="card-description">
                    Detected at {activeAlert.time_str} UTC • Interval #{activeAlert.interval_index} • Confidence: {activeAlert.confidence_level}
                  </p>
                </div>
              </div>

              {/* Energy Decomposition KPI strip */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(4, 1fr)', 
                gap: '12px',
                padding: '14px',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Raw Discrepancy</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {activeAlert.raw_discrepancy_kwh} kWh
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Technical Loss</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {activeAlert.technical_loss_kwh} kWh
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Unexplained Discrepancy</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--status-critical)' }}>
                    {activeAlert.unexplained_kwh} kWh ({activeAlert.unexplained_pct}%)
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Anomaly Score</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    z = {activeAlert.anomaly_score} &sigma;
                  </div>
                </div>
              </div>

              {/* Recommended Field Verification */}
              <div style={{ 
                padding: '12px 16px', 
                backgroundColor: '#eff6ff', 
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                marginBottom: '16px',
                fontSize: '0.82rem'
              }}>
                <strong style={{ color: '#1e40af' }}>Recommended Action: </strong>
                <span>{activeAlert.recommended_action}</span>
              </div>

              {/* Ranked Candidate Locations Table */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '8px' }}>
                  Ranked Candidate Locations (Level 3 Hierarchical Decomposition)
                </h3>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Candidate ID</th>
                        <th>Section</th>
                        <th>Residual Gap</th>
                        <th>Persistence</th>
                        <th>Confidence</th>
                        <th>Supporting Evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeAlert.ranked_candidates.map((cand) => (
                        <tr key={cand.candidate_id} style={{ backgroundColor: cand.rank === 1 ? '#fef2f2' : 'transparent' }}>
                          <td>
                            <strong>#{cand.rank}</strong>
                          </td>
                          <td>
                            <strong>{cand.candidate_id}</strong> ({cand.label.split('(')[1]?.replace(')', '') || cand.label})
                          </td>
                          <td>Section {cand.section_id}</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>{cand.measured_residual_kwh} kWh</td>
                          <td>{cand.persistence_intervals} intervals</td>
                          <td>
                            <span className={`badge ${
                              cand.confidence === 'HIGH' ? 'badge-critical' :
                              cand.confidence === 'MEDIUM' ? 'badge-warning' : 'badge-normal'
                            }`}>
                              {cand.confidence}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.75rem' }}>{cand.supporting_evidence}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Status Update Actions & Audit Trail */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '10px' }}>
                  Update Investigation Status
                </h3>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  {['Open', 'Under Review', 'Verified', 'False Alarm', 'Resolved'].map((st) => (
                    <button
                      key={st}
                      className={activeAlert.status === st ? 'btn-primary' : 'btn-secondary'}
                      style={{ 
                        fontSize: '0.78rem',
                        backgroundColor: activeAlert.status === st ? '#0284c7' : 'inherit'
                      }}
                      disabled={statusUpdating || activeAlert.status === st}
                      onClick={() => handleStatusChange(st)}
                    >
                      Mark as {st}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <input
                    type="text"
                    placeholder="Add operator inspection notes for audit log..."
                    className="control-input"
                    value={operatorNotes}
                    onChange={(e) => setOperatorNotes(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button 
                    className="btn-secondary" 
                    onClick={() => handleStatusChange(activeAlert.status)}
                    disabled={statusUpdating || !operatorNotes.trim()}
                  >
                    Log Note
                  </button>
                </div>

                {/* Audit Trail Timeline */}
                {audits && audits.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <History size={14} /> Audit Trail
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {audits.map((rec) => (
                        <div 
                          key={rec.id}
                          style={{
                            padding: '8px 12px',
                            backgroundColor: 'var(--bg-subtle)',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <div>
                            <strong>{rec.operator_name}</strong>: {rec.notes}
                          </div>
                          <div style={{ color: 'var(--text-muted)' }}>
                            {new Date(rec.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Gemini AI Loss Explanation Assistant */}
            <div className="card" style={{ borderColor: 'var(--accent-primary)' }}>
              <div className="card-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={18} color="#0284c7" />
                    <h2 className="card-title">GridGuard AI Loss Explainer</h2>
                    {aiExplanation && (
                      <span className="badge badge-telemetry">
                        {aiExplanation.mode === 'GEMINI_LIVE' ? 'Gemini 2.5 Flash Live' : 'Deterministic Demo Mode'}
                      </span>
                    )}
                  </div>
                  <p className="card-description">
                    Audited engineering explanations adhering to presumption of consumer innocence
                  </p>
                </div>
              </div>

              {/* Preset 1-Click Questions */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                {presetQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    className="btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                    onClick={() => handleAskAI(q)}
                    disabled={aiLoading}
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* Custom Ask Bar */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="Ask a technical loss question (e.g., 'Could high technical resistance explain this?')..."
                  className="control-input"
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                  style={{ flex: 1 }}
                />
                <button
                  className="btn-primary"
                  onClick={() => handleAskAI()}
                  disabled={aiLoading || !aiQuestion.trim()}
                >
                  <Send size={14} />
                  {aiLoading ? 'Analyzing...' : 'Ask AI'}
                </button>
              </div>

              {/* AI Response Display */}
              {aiExplanation && (
                <div style={{ 
                  backgroundColor: '#f8fafc', 
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '16px'
                }}>
                  <p style={{ fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--text-primary)', marginBottom: '14px' }}>
                    {aiExplanation.explanation}
                  </p>

                  {aiExplanation.key_findings && aiExplanation.key_findings.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <strong style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Calculated Key Findings:</strong>
                      <ul style={{ paddingLeft: '18px', marginTop: '4px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {aiExplanation.key_findings.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div style={{ 
                    padding: '8px 12px', 
                    backgroundColor: '#fffbeb', 
                    borderRadius: '6px', 
                    fontSize: '0.72rem',
                    color: '#92400e',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <HelpCircle size={14} />
                    <span>{aiExplanation.safeguard_note}</span>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
