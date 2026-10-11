import React from 'react';
import { 
  LayoutDashboard, 
  Radio,
  Network, 
  AlertTriangle, 
  SlidersHorizontal, 
  FileSearch, 
  Settings,
  Tractor
} from 'lucide-react';

export default function BottomNav({ activePage, setActivePage, activeAlertsCount }) {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'livesim', label: 'Live Sim', icon: Radio, isLive: true },
    { id: 'network', label: 'Network', icon: Network },
    { id: 'anomaly', label: 'Anomalies', icon: AlertTriangle },
    { id: 'agridiversion', label: 'Agri', icon: Tractor },
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
            className={`bottom-nav-item ${isActive ? 'active' : ''} ${item.isLive ? 'bottom-live-item' : ''}`}
            onClick={() => setActivePage(item.id)}
            aria-label={item.label}
          >
            <Icon size={19} color={item.isLive && isActive ? '#dc2626' : 'currentColor'} />
            <span>{item.label}</span>
            {item.badge > 0 && <span className="bottom-nav-badge">{item.badge}</span>}
            {item.isLive && <span className="bottom-live-dot" />}
          </button>
        );
      })}
    </nav>
  );
}
