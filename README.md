# GridGuard AI: Intelligent Electricity Loss Localization

**GridGuard AI** is a smart electricity distribution monitoring, loss-detection, and hierarchical loss-localization platform designed for rural distribution networks. It pinpoints unmetered losses and physical anomalies through statistical physics, hierarchical measurement placement, and explainable AI.

---

## 1. Problem Statement & Architecture

A rural distribution feeder supplying **60 households across 6 distribution sections (A–F)** records an unmetered energy loss where the transformer bulk meter registers ~18% more energy than all 60 household meters record collectively. The discrepancy intensifies between **7:00 PM and 10:00 PM** and normalizes by midnight.

### Core Engineering Principles:
1. **Presumption of Innocence**: Statistical energy discrepancies indicate mathematical residuals across physical boundaries, not verified theft. Alternative engineering explanations (localized conductor degradation, current transformer saturation, meter firmware drift, and packet loss) are formally evaluated before accusations.
2. **Measurement Placement over Frequency**: Pinpointing missing energy requires strategic spatial measurement placement rather than solely increasing polling rates.
3. **Hierarchical 3-Level Decomposition**:
   - **Level 1 (Feeder Level)**: Detect persistent unexplained feeder bulk discrepancy ($E_{\text{transformer}} - \sum E_h - E_{\text{tech}}$).
   - **Level 2 (Section Level)**: Compare synchronized header measurements across sections A–F to isolate the culprit hamlet.
   - **Level 3 (Candidate Branch Level)**: Evaluate branch boundary measurements (U-01 to U-06) to rank candidate connection points without ground-truth leakage.

---

## 2. Monorepo Project Structure

```text
gridguard-ai/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI server with all analytical REST endpoints
│   │   ├── models.py                # Pydantic schemas and response models
│   │   ├── simulator.py             # 24h (96 interval) physics & energy simulator
│   │   ├── energy_engine.py         # Energy conservation balance calculations & I²R loss models
│   │   ├── detector.py              # Robust Z-Score anomaly detector with persistence filter
│   │   ├── localizer.py             # Hierarchical 3-level localization engine
│   │   ├── measurement_planner.py   # Tree observability & sensor placement engine
│   │   ├── gemini_service.py        # Gemini Live API & Deterministic Demo Explainer
│   │   └── storage.py               # In-memory store & Supabase PostgreSQL client
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx           # Responsive header, scenario picker, seed control, status badge
│   │   │   ├── Sidebar.jsx          # Fixed desktop navigation sidebar & off-canvas drawer
│   │   │   ├── BottomNav.jsx        # 6-item mobile bottom navigation bar with alert badges
│   │   │   └── NodeDrawer.jsx       # Interactive slide-over / bottom-sheet telemetry inspector
│   │   ├── pages/
│   │   │   ├── OverviewPage.jsx     # Executive KPI cards, 24h & 7-10 PM surge charts, mobile alert cards
│   │   │   ├── LiveSimulationPage.jsx# Interactive real-time playback studio with interval scrubber
│   │   │   ├── NetworkExplorerPage.jsx # SVG interactive network tree & mobile section card view
│   │   │   ├── AnomalyDetectionPage.jsx# Z-score trajectory & 96-interval telemetry cards/ledger
│   │   │   ├── MeasurementPlannerPage.jsx# Observability & inspection strategy simulator
│   │   │   ├── InvestigationCenterPage.jsx# Incident dossier, status workflow, AI explainer
│   │   │   └── SettingsPage.jsx     # Physical constants & backend health
│   │   ├── api.js                   # REST client with automatic /api proxy
│   │   ├── App.jsx                  # Main view coordinator
│   │   ├── index.css                # Polished design system with responsive tokens
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js               # Dev server with proxy to backend port 8000
├── sql/
│   ├── schema.sql                   # Supabase / PostgreSQL tables, constraints, RLS policies
│   └── seed.sql                     # Synthetic network topology seed script
├── tests/
│   ├── test_energy_engine.py        # Energy conservation balance & signed residual tests
│   ├── test_simulator.py            # Reproducibility & scenario tests
│   ├── test_detection.py            # False-alarm & evening anomaly detection tests
│   ├── test_localizer.py            # Hierarchical candidate ranking & accuracy tests
│   ├── test_api.py                  # FastAPI endpoint integration tests
│   └── verify_e2e.py                # Full stack end-to-end integration verifier
├── .env.example
└── README.md
```

---

## 3. Supported Simulation Scenarios

Switchable in real time via the UI or `POST /api/simulation/run`:

1. **Scenario A: Normal Baseline Day**  
   Nominal household consumption with ordinary technical losses (~4.5%) and minor instrument noise ($\sigma = 0.015$). Zero persistent alarms.
2. **Scenario B: Evening Unmetered Load (Default Challenge)**  
   Simulates unmetered load injected at candidate branch **U-03 (Section C)** between **19:00 and 22:00**, spiking transformer discrepancy up to ~18% and normalizing past 22:30.
3. **Scenario C: Household Meter Fault**  
   Simulates meter **H-24 (Section C)** reporting only 25% of actual consumed power. The system flags the discrepancy and diagnoses a potential CT saturation/fault rather than automatically accusing theft.
4. **Scenario D: Multiple Lateral Anomalies**  
   Abnormal loads injected at two candidate locations (**U-02** in Section B and **U-05** in Section E).
5. **Scenario E: Noisy & Missing Telemetry**  
   Simulates 8% communication packet drops and high noise variance. Flags data degradation and reduces localization confidence accordingly.

---

## 4. Role of the Simulation Seed

The simulation engine uses **Pseudorandom Number Generators (PRNG)** (`np.random.RandomState(seed)`). The **seed** parameter controls the underlying mathematical random state:

- **Household Profile Jitter**: Generates natural daily behavioral variations across all 60 households so consumption curves look organic.
- **Physical Meter Instrument Noise**: Models realistic measurement noise on the Class 0.5 bulk meter and Class 1.0 residential meters.
- **Packet Loss Distribution**: In Scenario E, governs which AMI telemetry packets are dropped.
- **Deterministic Reproducibility**: Using the same seed (e.g., `seed = 42`) guarantees **identical numerical results** across runs—essential for scientific audits, regression tests, and customer disputes.
- **Stress Testing**: Changing the seed (or clicking **Random**) lets operators evaluate whether the anomaly detector catches losses under different noise and consumption conditions.

---

## 5. UI Architecture: Desktop & Mobile Optimization

GridGuard AI delivers a unified interface that adapts seamlessly between desktop and mobile devices:

### Desktop Experience (`> 768px`)
- **Fixed Sidebar Navigation**: The sidebar remains locked (`position: fixed; width: 260px; height: 100vh`) while the main dashboard canvas scrolls independently.
- **Side-by-Side Analytics**: Full multi-column grids for KPI tiles, dual 24h & evening zoom charts, interactive SVG tree map, and two-column investigation dossiers.

### Mobile Experience (`<= 768px`)
- **Compact Sticky Header (~48px)**: Streamlined bar with hamburger menu, page title, status indicator, and quick **Run** button. An expandable parameter tray lets users tweak Scenario and Seed on demand without sacrificing screen space.
- **Mobile Bottom Navigation Bar**: 6-page bottom navigation bar (`BottomNav.jsx`) with safe-area insets and live incident counter badges.
- **Touch-Friendly Alert Cards**: Replaces wide 9-column horizontal-scrolling tables with clean incident cards displaying severity, time, location, discrepancy values, Z-score, and a 1-tap **Investigate** button (with a **Cards | Table** toggle).
- **Mobile Chart Tabs**: 1-tap pill switcher between *24h Balance*, *7–10 PM Peak*, and *Distribution Sections*.
- **Section Cards & Bottom Sheet**: Mobile view toggle in Network Explorer switching between clean expandable section cards and the full SVG map, with a touch-friendly bottom sheet for node telemetry.

---

## 6. Setup & Execution Commands

### Prerequisites
- Python 3.10+
- Node.js 18+

### Step 1: Backend Setup & Run
```bash
# In project root:
python -m pip install -r backend/requirements.txt

# Run the FastAPI server:
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
API docs available at: `http://localhost:8000/docs`

### Step 2: Frontend Setup & Run
```bash
# In frontend directory:
cd frontend
npm install --legacy-peer-deps

# Start Vite dev server:
npm run dev
```
Dashboard available at: `http://localhost:5173`

### Step 3: Run Unit & Integration Tests
```bash
# In project root:
python -m pytest tests/ -v
python tests/verify_e2e.py
```
*(All 21 backend unit and integration tests passing)*

---

## 7. Mathematical Formulations

- **Raw Discrepancy**:
  $$\text{raw\_discrepancy} = E_{\text{transformer}} - \sum_{i=1}^{60} E_{\text{household}, i}$$
- **Unexplained Discrepancy**:
  $$\text{unexplained} = \text{raw\_discrepancy} - E_{\text{technical\_loss}}$$
- **Unexplained Percentage**:
  $$\text{unexplained\_pct} = \frac{\text{unexplained}}{E_{\text{transformer}}} \times 100\%$$
- **Section Residual (Level 2)**:
  $$\text{residual}_{\text{sec}} = E_{\text{sec\_incoming}} - \sum_{h \in \text{sec}} E_{h} - E_{\text{sec\_loss}}$$
- **Candidate Branch Residual (Level 3)**:
  $$\text{residual}_{\text{branch}} = E_{\text{upstream}} - E_{\text{downstream}} - E_{\text{branch\_loss}}$$

---

## 8. Demo Walkthrough

1. **Executive Overview**: Observe the 6 live calculated KPI cards (Transformer Supplied, Household Metered, Technical Losses, Unexplained Gap in kWh and %, Active Alerts). Inspect the 24h Line Chart and the 7 PM–10 PM surge window.
2. **Live Simulation Studio**: Scrub through all 96 intervals in real time with play/pause, adjustable speed (1x to 10x), and live hierarchical tree updates as the evening surge unfolds.
3. **Network Explorer**: Explore the SVG hierarchy of Transformer T1, 6 Sections, 60 Households, and 6 Candidate taps. Click on **Section C** or **Branch U-03** to slide out the detailed telemetry drawer.
4. **Anomaly Detection**: View the statistical Z-score trajectory with Warning ($2.0\sigma$) and Critical ($3.2\sigma$) threshold lines, and filter the 96-interval telemetry cards or ledger.
5. **Measurement Planner**: Toggle simulated clamp sensors and see how hierarchical placement reduces inspection steps from **60 steps down to 2–4 steps (93–96% reduction)**.
6. **Investigation Center**: Review the incident dossier for **ALT-2026-001**, check the ranked candidate table (confirming U-03 rank #1), test 1-click AI loss explanation questions, and update the status to **"Under Review"** with audit trail logging.
7. **Settings**: View backend service health, database mode (In-Memory Local Mode or Supabase), AI mode (Deterministic Demo or Gemini Live API), and ethical safeguards.


