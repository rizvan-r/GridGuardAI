import React, { useState } from 'react';
import { 
  Network, 
  Filter, 
  Info, 
  Zap, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Search,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  GitBranch
} from 'lucide-react';

export default function NetworkExplorerPage({ networkTree, readings, onSelectNode }) {
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sliderInterval, setSliderInterval] = useState(80); // Default around 20:00 (8:00 PM)
  const [mobileViewMode, setMobileViewMode] = useState('cards'); // 'cards' or 'svg'
  const [expandedSection, setExpandedSection] = useState(null);

  if (!networkTree) {
    return <div className="page-container"><p>Loading network topology...</p></div>;
  }

  const sections = networkTree.sections || [];
  const currentIntervalReading = readings && readings[sliderInterval] ? readings[sliderInterval] : null;

  // Filter sections
  const filteredSections = sections.filter((s) => {
    if (selectedSection !== 'ALL' && s.section_id !== selectedSection) return false;
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    return true;
  });

  const getNodeColor = (status) => {
    if (status === 'SUSPICIOUS') return '#ef4444';
    if (status === 'FAULT') return '#8b5cf6';
    if (status === 'NOISY') return '#f59e0b';
    return '#10b981';
  };

  return (
    <div className="page-container">
      {/* Top Filter & Time Interval Slider Controls */}
      <div className="card" style={{ marginBottom: '16px', padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          
          {/* Section and Status filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={14} color="var(--text-muted)" />
              <label style={{ fontSize: '0.8rem', fontWeight: 500 }}>Section:</label>
              <select 
                className="control-select" 
                value={selectedSection} 
                onChange={(e) => setSelectedSection(e.target.value)}
              >
                <option value="ALL">All Sections (A - F)</option>
                {sections.map((s) => (
                  <option key={s.section_id} value={s.section_id}>Section {s.section_id}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 500 }}>Status:</label>
              <select 
                className="control-select" 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All States</option>
                <option value="NORMAL">Normal</option>
                <option value="SUSPICIOUS">Suspicious</option>
                <option value="FAULT">Fault</option>
              </select>
            </div>
          </div>

          {/* Time range slider (00:00 to 23:45) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '220px', flex: '1 1 220px' }}>
            <Clock size={16} color="var(--accent-primary)" />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '2px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Interval Time:</span>
                <strong>{currentIntervalReading ? currentIntervalReading.time_str : '20:00'}</strong>
              </div>
              <input 
                type="range" 
                min={0} 
                max={95} 
                value={sliderInterval} 
                onChange={(e) => setSliderInterval(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>
          </div>

          {/* Mobile View Mode Switcher (Visible on Mobile only) */}
          <div className="mobile-view-toggle">
            <button 
              className={`mobile-tab-btn ${mobileViewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setMobileViewMode('cards')}
            >
              <LayoutGrid size={14} /> Clean Cards
            </button>
            <button 
              className={`mobile-tab-btn ${mobileViewMode === 'svg' ? 'active' : ''}`}
              onClick={() => setMobileViewMode('svg')}
            >
              <GitBranch size={14} /> Full Map
            </button>
          </div>

          {/* Desktop Legend */}
          <div className="desktop-legend" style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#10b981' }} /> Normal
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#ef4444' }} /> Suspicious
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#8b5cf6' }} /> Fault
            </span>
          </div>
        </div>
      </div>

      {/* MOBILE-ONLY SECTION CARDS VIEW (Clean, Simple, Touch-Friendly) */}
      <div className={`mobile-section-cards-container ${mobileViewMode === 'svg' ? 'mobile-hidden' : ''}`}>
        {/* Transformer Bulk Card */}
        <div 
          onClick={() => onSelectNode('NODE_T1')}
          className="card"
          style={{
            padding: '14px',
            border: '2px solid #0284c7',
            cursor: 'pointer',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap size={20} color="#0284c7" />
            <div>
              <strong style={{ fontSize: '0.9rem' }}>{networkTree.transformer.label}</strong>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Feeder Meter MTR_T1 • Total: {networkTree.transformer.total_supplied_kwh} kWh
              </div>
            </div>
          </div>
          <span className="badge badge-normal">Bulk Meter</span>
        </div>

        {/* 6 Section Accordion Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredSections.map((sec) => {
            const isSuspicious = sec.status === 'SUSPICIOUS';
            const isExpanded = expandedSection === sec.id;

            return (
              <div 
                key={sec.id}
                className="card"
                style={{
                  padding: '14px',
                  marginBottom: 0,
                  border: `1.5px solid ${getNodeColor(sec.status)}`,
                  backgroundColor: isSuspicious ? '#fff5f5' : '#ffffff'
                }}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div 
                    onClick={() => onSelectNode(sec.id)}
                    style={{ cursor: 'pointer', flex: 1 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '0.92rem' }}>{sec.name}</strong>
                      <span className={`badge ${
                        sec.status === 'SUSPICIOUS' ? 'badge-critical' : 'badge-normal'
                      }`}>
                        {sec.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      In: {sec.incoming_kwh}k • Household: {sec.household_total_kwh}k • Residual: 
                      <strong style={{ color: sec.residual_kwh > 0.5 ? '#ef4444' : 'inherit', marginLeft: '4px' }}>
                        {sec.residual_kwh} kWh
                      </strong>
                    </div>
                  </div>

                  <button 
                    className="btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.72rem', minHeight: '30px' }}
                    onClick={() => setExpandedSection(isExpanded ? null : sec.id)}
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    <span>{sec.households.length} Nodes</span>
                  </button>
                </div>

                {/* Candidate Branch Tap (Level 3) */}
                <div 
                  onClick={() => onSelectNode(sec.candidate.id)}
                  style={{
                    marginTop: '10px',
                    padding: '8px 10px',
                    backgroundColor: sec.candidate.residual_kwh > 1.0 ? '#fee2e2' : 'var(--bg-subtle)',
                    border: `1px dashed ${sec.candidate.residual_kwh > 1.0 ? '#dc2626' : '#cbd5e1'}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.75rem'
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600 }}>Branch {sec.candidate.id} Tap Line</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>({sec.candidate.residual_kwh} kWh gap)</span>
                  </div>
                  {sec.candidate.rank === 1 ? (
                    <span className="badge badge-critical" style={{ fontSize: '0.65rem' }}>Rank #1 Suspect</span>
                  ) : (
                    <span className="badge badge-normal" style={{ fontSize: '0.65rem' }}>Rank #{sec.candidate.rank}</span>
                  )}
                </div>

                {/* Expandable 10 Households Grid */}
                {isExpanded && (
                  <div style={{ 
                    marginTop: '12px',
                    paddingTop: '10px',
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: '6px'
                  }}>
                    {sec.households.map((hh) => (
                      <div 
                        key={hh.id}
                        onClick={() => onSelectNode(hh.id)}
                        style={{
                          padding: '6px 4px',
                          textAlign: 'center',
                          backgroundColor: hh.is_faulty ? '#f3e8ff' : '#ffffff',
                          border: `1px solid ${hh.is_faulty ? '#a855f7' : '#cbd5e1'}`,
                          borderRadius: '4px',
                          fontSize: '0.68rem',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontWeight: 600, color: hh.is_faulty ? '#7e22ce' : 'inherit' }}>
                          {hh.id}
                        </div>
                        <div style={{ color: 'var(--text-muted)' }}>{hh.total_kwh}k</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SVG TREE DIAGRAM (Permanent on Desktop, Switchable on Mobile) */}
      <div className={`card desktop-svg-network-card ${mobileViewMode === 'cards' ? 'mobile-hidden-svg' : ''}`} style={{ padding: '24px', overflowX: 'auto' }}>
        <div style={{ minWidth: '980px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          
          {/* Transformer Node at Top */}
          <div 
            onClick={() => onSelectNode('NODE_T1')}
            style={{
              padding: '12px 24px',
              backgroundColor: '#ffffff',
              border: '2px solid #0284c7',
              borderRadius: '10px',
              boxShadow: 'var(--shadow-md)',
              cursor: 'pointer',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              transition: 'transform 0.15s ease',
              marginBottom: '20px',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Zap size={18} color="#0284c7" />
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{networkTree.transformer.label}</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Bulk Feeder Meter MTR_T1 • {networkTree.transformer.total_supplied_kwh} kWh
            </div>
          </div>

          {/* SVG Tree Trunk Connector */}
          <svg width="980" height="40" style={{ overflow: 'visible' }}>
            <line x1="490" y1="0" x2="490" y2="20" stroke="#94a3b8" strokeWidth="2" />
            <line x1="80" y1="20" x2="900" y2="20" stroke="#94a3b8" strokeWidth="2" />
            {filteredSections.map((s, idx) => {
              const xPos = 80 + idx * (820 / Math.max(1, filteredSections.length - 1));
              return (
                <line key={s.id} x1={xPos} y1="20" x2={xPos} y2="40" stroke="#94a3b8" strokeWidth="2" />
              );
            })}
          </svg>

          {/* 6 Section Columns */}
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '16px' }}>
            {filteredSections.map((sec) => {
              const isSectionSuspicious = sec.status === 'SUSPICIOUS';

              return (
                <div 
                  key={sec.id} 
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    backgroundColor: isSectionSuspicious ? '#fff5f5' : '#f8fafc',
                    border: `1px solid ${isSectionSuspicious ? '#fca5a5' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    padding: '12px 8px',
                  }}
                >
                  {/* Section Node Header */}
                  <div 
                    onClick={() => onSelectNode(sec.id)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      backgroundColor: '#ffffff',
                      border: `1.5px solid ${getNodeColor(sec.status)}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      boxShadow: 'var(--shadow-sm)',
                      marginBottom: '10px'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Sec {sec.section_id}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {sec.residual_kwh > 0.5 ? (
                        <span style={{ color: '#ef4444', fontWeight: 600 }}>+{sec.residual_kwh} kWh gap</span>
                      ) : (
                        <span>Balanced</span>
                      )}
                    </div>
                  </div>

                  {/* Candidate Connection Node (Level 3 Branch) */}
                  <div 
                    onClick={() => onSelectNode(sec.candidate.id)}
                    style={{
                      width: '90%',
                      padding: '6px 8px',
                      backgroundColor: sec.candidate.residual_kwh > 1.0 ? '#fee2e2' : '#ffffff',
                      border: `1px dashed ${sec.candidate.residual_kwh > 1.0 ? '#dc2626' : '#94a3b8'}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      fontSize: '0.72rem',
                      marginBottom: '12px',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: sec.candidate.residual_kwh > 1.0 ? '#b91c1c' : 'var(--text-primary)' }}>
                      Branch {sec.candidate.id}
                    </div>
                    <div>Res: {sec.candidate.residual_kwh} kWh</div>
                    {sec.candidate.rank === 1 && (
                      <span className="badge badge-critical" style={{ marginTop: '2px', fontSize: '0.62rem' }}>
                        Rank #1 Suspect
                      </span>
                    )}
                  </div>

                  {/* 10 Household Nodes */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '6px', 
                    width: '100%' 
                  }}>
                    {sec.households.map((hh) => {
                      const isFaulty = hh.is_faulty;
                      return (
                        <div 
                          key={hh.id}
                          onClick={() => onSelectNode(hh.id)}
                          style={{
                            padding: '6px 4px',
                            backgroundColor: isFaulty ? '#f3e8ff' : '#ffffff',
                            border: `1px solid ${isFaulty ? '#a855f7' : '#cbd5e1'}`,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            textAlign: 'center',
                            fontSize: '0.68rem',
                            transition: 'all 0.1s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = '#0284c7'}
                          onMouseLeave={(e) => e.currentTarget.style.borderColor = isFaulty ? '#a855f7' : '#cbd5e1'}
                        >
                          <div style={{ fontWeight: 600, color: isFaulty ? '#7e22ce' : 'inherit' }}>
                            {hh.id}
                          </div>
                          <div style={{ color: 'var(--text-muted)' }}>
                            {hh.total_kwh}k
                          </div>
                          {isFaulty && (
                            <span style={{ fontSize: '0.58rem', color: '#7e22ce', fontWeight: 700 }}>
                              FAULT
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
