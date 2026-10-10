import React from 'react';
import { 
  LayoutDashboard, 
  Network, 
  AlertTriangle, 
  SlidersHorizontal, 
  FileSearch, 
  Settings 
} from 'lucide-react';

export default function BottomNav({ activePage, setActivePage, activeAlertsCount }) {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'network', label: 'Network', icon: Network },
    { id: 'anomaly', label: 'Anomalies', icon: AlertTriangle },
    { id: 'planner', label: 'Planner', icon: SlidersHorizontal },
    { id: 'investigation', label: 'Alerts', icon: FileSearch, badge: activeAlertsCount },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activePage === item.id;
        return (
          <button
            key={item.id}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setActivePage(item.id)}
            aria-label={item.label}
          >
            <Icon size={19} />
            <span>{item.label}</span>
            {item.badge > 0 && <span className="bottom-nav-badge">{item.badge}</span>}
          </button>
        );
      })}
    </nav>
  );
}
