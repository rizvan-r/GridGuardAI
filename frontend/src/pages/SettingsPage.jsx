import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Database, 
  Sparkles, 
  Server, 
  CheckCircle2, 
  Info,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { fetchHealth } from '../api';

export default function SettingsPage() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHealth()
      .then((data) => setHealth(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-container">
      <div className="grid-2">
        {/* System Backend Services */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Backend Architecture & Services</h2>
              <p className="card-description">Runtime execution engines and telemetry pipeline</p>
            </div>
            <Server size={18} color="#0284c7" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ 
              padding: '12px 16px', 
              backgroundColor: 'var(--bg-subtle)', 
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <strong style={{ fontSize: '0.85rem' }}>FastAPI Backend</strong>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Python 3.11 • High-performance analytical REST API
                </p>
              </div>
              <span className="badge badge-normal">Active (Port 8000)</span>
            </div>

            <div style={{ 
              padding: '12px 16px', 
              backgroundColor: 'var(--bg-subtle)', 
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <strong style={{ fontSize: '0.85rem' }}>Database Persistence</strong>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {health?.database_mode || 'Local In-Memory Mode'} • SQL scripts in /sql
                </p>
              </div>
              <span className={`badge ${health?.database_mode === 'Supabase' ? 'badge-telemetry' : 'badge-normal'}`}>
                {health?.database_mode || 'Local Demo Mode'}
              </span>
            </div>

            <div style={{ 
              padding: '12px 16px', 
              backgroundColor: 'var(--bg-subtle)', 
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <strong style={{ fontSize: '0.85rem' }}>AI Explanation Engine</strong>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {health?.ai_engine_mode || 'Deterministic Demo Mode'}
                </p>
              </div>
              <span className="badge badge-normal">
                {health?.ai_engine_mode || 'Demo Fallback Active'}
              </span>
            </div>
          </div>
        </div>

        {/* Network & Physical Constants */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Network Physical Specifications</h2>
              <p className="card-description">Distribution engineering constants for Feeder T1</p>
            </div>
            <Database size={18} color="#16a34a" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Distribution Substation</span>
              <strong>Kaveri 33/11 kV Grid Station</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Transformer Rating</span>
              <strong>250 kVA Dyn11 (Feeder T1)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Distribution Sections</span>
              <strong>6 Hamlets (Sections A, B, C, D, E, F)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Household Smart Meters</span>
              <strong>60 Nodes (Class 1.0 AMI)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Sampling Interval Resolution</span>
              <strong>15 Minutes (96 Intervals / 24h)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span style={{ color: 'var(--text-muted)' }}>Nominal Technical Line Losses</span>
              <strong>4.5% (I²R + Transformer Core)</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Ethical AI and Presumption of Innocence Policy */}
      <div className="card" style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <ShieldCheck size={24} color="#16a34a" style={{ flexShrink: 0 }} />
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#166534', marginBottom: '4px' }}>
              Presumption of Innocence & Responsible Localization Guardrails
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#15803d', lineHeight: 1.5 }}>
              GridGuard AI operates under strict ethical guidelines. Statistical energy discrepancies indicate mathematical
              inconsistencies across physical boundaries—they do not constitute legal proof of electricity theft.
              The platform considers multiple alternate engineering hypotheses (such as localized conductor degradation,
              CT saturation, meter firmware drift, and communication packet drops) and mandates physical verification by
              authorized utility personnel before any customer notification.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
