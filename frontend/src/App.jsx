import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import NodeDrawer from './components/NodeDrawer';

import OverviewPage from './pages/OverviewPage';
import NetworkExplorerPage from './pages/NetworkExplorerPage';
import AnomalyDetectionPage from './pages/AnomalyDetectionPage';
import MeasurementPlannerPage from './pages/MeasurementPlannerPage';
import InvestigationCenterPage from './pages/InvestigationCenterPage';
import SettingsPage from './pages/SettingsPage';

import { 
  fetchFeederSummary, 
  fetchFeederReadings, 
  fetchAlerts, 
  fetchNetworkTree, 
  fetchNodeDetail, 
  runSimulation 
} from './api';

export default function App() {
  const [activePage, setActivePage] = useState('overview');
  const [scenario, setScenario] = useState('EVENING_UNMETERED');
  const [seed, setSeed] = useState(42);

  const [summary, setSummary] = useState(null);
  const [readings, setReadings] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [networkTree, setNetworkTree] = useState(null);

  const [selectedAlertId, setSelectedAlertId] = useState(null);
  const [drawerNodeData, setDrawerNodeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load state from backend
  const refreshData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [sumData, readData, altData, treeData] = await Promise.all([
        fetchFeederSummary(),
        fetchFeederReadings(),
        fetchAlerts(),
        fetchNetworkTree(),
      ]);
      setSummary(sumData);
      setReadings(readData);
      setAlerts(altData);
      setNetworkTree(treeData);
    } catch (err) {
      console.error('Failed to load application data:', err);
      setError('Could not connect to GridGuard AI backend. Ensure FastAPI server is running on port 8000.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleRunSimulation = async () => {
    try {
      setLoading(true);
      await runSimulation(scenario, seed);
      await refreshData();
    } catch (err) {
      console.error('Failed to run simulation:', err);
      setError('Failed to execute simulation pipeline.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectNode = async (nodeId) => {
    try {
      const detail = await fetchNodeDetail(nodeId);
      setDrawerNodeData(detail);
    } catch (err) {
      console.error(`Failed to fetch node detail for ${nodeId}:`, err);
    }
  };

  const handleNavigateToInvestigation = (alertId = null) => {
    if (alertId) setSelectedAlertId(alertId);
    setActivePage('investigation');
  };

  const getPageTitle = () => {
    switch (activePage) {
      case 'overview': return 'Executive Overview';
      case 'network': return 'Distribution Network Explorer';
      case 'anomaly': return 'Statistical Anomaly Detection';
      case 'planner': return 'Measurement Placement Planner';
      case 'investigation': return 'Investigation & Audit Center';
      case 'settings': return 'System Settings & Architecture';
      default: return 'GridGuard AI';
    }
  };

  return (
    <div className="app-container">
      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage}
        activeAlertsCount={alerts.filter(a => a.status === 'Open').length}
        systemStatus={summary?.system_status}
      />

      <div className="main-wrapper">
        <Header 
          pageTitle={getPageTitle()}
          scenario={scenario}
          setScenario={setScenario}
          seed={seed}
          setSeed={setSeed}
          onRunSimulation={handleRunSimulation}
          loading={loading}
          systemStatus={summary?.system_status}
        />

        {error && (
          <div style={{
            margin: '16px 28px 0 28px',
            padding: '12px 16px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#b91c1c',
            fontSize: '0.85rem'
          }}>
            {error}
          </div>
        )}

        <main style={{ flex: 1 }}>
          {activePage === 'overview' && (
            <OverviewPage 
              summary={summary}
              readings={readings}
              alerts={alerts}
              onNavigateToInvestigation={handleNavigateToInvestigation}
            />
          )}

          {activePage === 'network' && (
            <NetworkExplorerPage 
              networkTree={networkTree}
              readings={readings}
              onSelectNode={handleSelectNode}
            />
          )}

          {activePage === 'anomaly' && (
            <AnomalyDetectionPage 
              readings={readings}
            />
          )}

          {activePage === 'planner' && (
            <MeasurementPlannerPage />
          )}

          {activePage === 'investigation' && (
            <InvestigationCenterPage 
              alerts={alerts}
              selectedAlertId={selectedAlertId}
              onAlertUpdated={refreshData}
            />
          )}

          {activePage === 'settings' && (
            <SettingsPage />
          )}
        </main>
      </div>

      {/* Slide-over Node Detail Drawer */}
      {drawerNodeData && (
        <NodeDrawer 
          nodeData={drawerNodeData}
          onClose={() => setDrawerNodeData(null)}
          onInvestigate={handleNavigateToInvestigation}
        />
      )}
    </div>
  );
}
