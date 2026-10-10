import React from 'react';
import { 
  LayoutDashboard, 
  Network, 
  AlertTriangle, 
  SlidersHorizontal, 
  FileSearch, 
  Settings, 
  Zap,
  ShieldCheck
} from 'lucide-react';

export default function Sidebar({ activePage, setActivePage, activeAlertsCount, systemStatus }) {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'network', label: 'Network Explorer', icon: Network },
    { id: 'anomaly', label: 'Anomaly Detection', icon: AlertTriangle },
    { id: 'planner', label: 'Measurement Planner', icon: SlidersHorizontal },
    { id: 'investigation', label: 'Investigation Center', icon: FileSearch, badge: activeAlertsCount },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-title">
          <Zap size={20} color="#0284c7" />
          <span>GridGuard AI</span>
          <span className="brand-badge">PROTOTYPE</span>
        </div>
        <p className="brand-subtitle">Loss Localization & Grid Integrity</p>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setActivePage(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldCheck size={16} color="#16a34a" />
          <span style={{ fontWeight: 600 }}>Ethical Loss Guard</span>
        </div>
        <p>Statistical anomaly ≠ verified theft. Preserves household presumption of innocence.</p>
        <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>
          v1.0.0 • Rural Feeder T1 (60 Nodes)
        </span>
      </div>
    </aside>
  );
}
