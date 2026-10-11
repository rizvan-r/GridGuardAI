-- ============================================================================
-- GridGuard AI: Synthetic Network Topology Seed Script
-- 1 Transformer (T1) -> 1 Feeder -> 6 Sections (SEC-A..F)
-- 10 Households per section (H-01..H-60)
-- 6 Candidate Points (U-01..U-06)
-- ============================================================================

-- 1. Insert Feeder
INSERT INTO feeders (id, name, substation, nominal_voltage_kv, transformer_capacity_kva)
VALUES ('T1', 'Feeder-01 (Kaveri Rural Distribution)', 'Kaveri 33/11kV Substation', 11.0, 250.0)
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Transformer Node
INSERT INTO network_nodes (id, feeder_id, parent_node_id, node_type, section_id, label, coordinates_x, coordinates_y)
VALUES ('NODE_T1', 'T1', NULL, 'transformer', NULL, 'Distribution Transformer T1 (250 kVA)', 500, 50)
ON CONFLICT (id) DO NOTHING;

INSERT INTO meters (id, node_id, meter_type, is_active, accuracy_class)
VALUES ('MTR_T1', 'NODE_T1', 'transformer_meter', TRUE, 0.5)
ON CONFLICT (id) DO NOTHING;

-- 3. Insert 6 Distribution Sections
INSERT INTO network_nodes (id, feeder_id, parent_node_id, node_type, section_id, label, coordinates_x, coordinates_y) VALUES
('SEC_A', 'T1', 'NODE_T1', 'section', 'A', 'Section A (North Hamlet)', 150, 150),
('SEC_B', 'T1', 'NODE_T1', 'section', 'B', 'Section B (Central Hamlet)', 300, 150),
('SEC_C', 'T1', 'NODE_T1', 'section', 'C', 'Section C (East Extension)', 450, 150),
('SEC_D', 'T1', 'NODE_T1', 'section', 'D', 'Section D (South Hamlet)', 600, 150),
('SEC_E', 'T1', 'NODE_T1', 'section', 'E', 'Section E (West Hamlet)', 750, 150),
('SEC_F', 'T1', 'NODE_T1', 'section', 'F', 'Section F (Agri Pump Cluster)', 900, 150)
ON CONFLICT (id) DO NOTHING;

INSERT INTO meters (id, node_id, meter_type, is_active, accuracy_class) VALUES
('MTR_SEC_A', 'SEC_A', 'section_meter', TRUE, 1.0),
('MTR_SEC_B', 'SEC_B', 'section_meter', TRUE, 1.0),
('MTR_SEC_C', 'SEC_C', 'section_meter', TRUE, 1.0),
('MTR_SEC_D', 'SEC_D', 'section_meter', TRUE, 1.0),
('MTR_SEC_E', 'SEC_E', 'section_meter', TRUE, 1.0),
('MTR_SEC_F', 'SEC_F', 'section_meter', TRUE, 1.0)
ON CONFLICT (id) DO NOTHING;

-- 4. Insert Candidate Connection Nodes (One per section)
INSERT INTO network_nodes (id, feeder_id, parent_node_id, node_type, section_id, label, coordinates_x, coordinates_y) VALUES
('NODE_U01', 'T1', 'SEC_A', 'candidate_point', 'A', 'Candidate Branch U-01 (Pole A-07 Tap)', 150, 220),
('NODE_U02', 'T1', 'SEC_B', 'candidate_point', 'B', 'Candidate Branch U-02 (Pole B-04 Junction)', 300, 220),
('NODE_U03', 'T1', 'SEC_C', 'candidate_point', 'C', 'Candidate Branch U-03 (Service Line C-08)', 450, 220),
('NODE_U04', 'T1', 'SEC_D', 'candidate_point', 'D', 'Candidate Branch U-04 (Pole D-03 Span)', 600, 220),
('NODE_U05', 'T1', 'SEC_E', 'candidate_point', 'E', 'Candidate Branch U-05 (Pole E-06 Lateral)', 750, 220),
('NODE_U06', 'T1', 'SEC_F', 'candidate_point', 'F', 'Candidate Branch U-06 (Agri Borewell Spur)', 900, 220)
ON CONFLICT (id) DO NOTHING;

-- 5. Insert 60 Household Nodes (10 per section)
DO $$
DECLARE
    sections TEXT[] := ARRAY['A', 'B', 'C', 'D', 'E', 'F'];
    sec_code TEXT;
    i INT;
    h_idx INT := 1;
    h_id TEXT;
    sec_id TEXT;
    x_pos NUMERIC;
    y_pos NUMERIC;
BEGIN
    FOR s_idx IN 1..6 LOOP
        sec_code := sections[s_idx];
        sec_id := 'SEC_' || sec_code;
        FOR h IN 1..10 LOOP
            h_id := 'H_' || LPAD(h_idx::TEXT, 2, '0');
            x_pos := (s_idx - 1) * 160 + 80 + ((h - 1) % 2) * 50;
            y_pos := 280 + ((h - 1) / 2) * 45;
            
            INSERT INTO network_nodes (id, feeder_id, parent_node_id, node_type, section_id, label, coordinates_x, coordinates_y)
            VALUES (h_id, 'T1', sec_id, 'household', sec_code, 'Household ' || h_id || ' (Sec ' || sec_code || ')', x_pos, y_pos)
            ON CONFLICT (id) DO NOTHING;

            INSERT INTO meters (id, node_id, meter_type, is_active, accuracy_class)
            VALUES ('MTR_' || h_id, h_id, 'household_meter', TRUE, 1.0)
            ON CONFLICT (id) DO NOTHING;

            h_idx := h_idx + 1;
        END LOOP;
    END LOOP;
END $$;

-- 6. Insert Seed Registered Agricultural Connections (Section F Agri Cluster)
INSERT INTO agri_connections (service_id, farmer_name, survey_number, feeder_id, transformer_id, section_id, sanctioned_load_hp, sanctioned_load_kw, pump_type, permitted_use, irrigation_schedule_summary, meter_id, upstream_branch_id, is_active, is_simulated) VALUES
('AGRI-TN-042-F01', 'S. Murugesan', '142/2A', 'T1', 'NODE_T1', 'F', 7.5, 5.60, 'Submersible Borewell Pump', 'Paddy & Groundnut Irrigation', 'Day: 07:00-11:00, Afternoon: 14:00-17:00', 'MTR_AGRI_01', 'U_06', TRUE, TRUE),
('AGRI-TN-042-F02', 'K. Ramasamy', '145/1B', 'T1', 'NODE_T1', 'F', 10.0, 7.46, 'Deep Borewell Submersible Pump', 'Sugarcane & Banana Plantation', 'Morning: 06:30-10:30, Evening: 15:00-18:00', 'MTR_AGRI_02', 'U_06', TRUE, TRUE),
('AGRI-TN-042-F03', 'M. Anbazhagan', '148/3', 'T1', 'NODE_T1', 'F', 5.0, 3.73, 'Surface Centrifugal Pump', 'Open Well Paddy Pumping', 'Morning: 07:00-11:00', 'MTR_AGRI_03', 'U_06', TRUE, TRUE),
('AGRI-TN-042-F04', 'P. Selvi', '151/4A', 'T1', 'NODE_T1', 'F', 7.5, 5.60, 'Submersible Borewell Pump', 'Pulses & Cotton Irrigation', 'Morning: 07:30-11:30, Afternoon: 14:00-16:30', 'MTR_AGRI_04', 'U_06', TRUE, TRUE),
('AGRI-TN-042-F05', 'V. Natarajan', '153/2', 'T1', 'NODE_T1', 'F', 5.0, 3.73, 'Submersible Borewell Pump', 'Vegetable Crop Drip Irrigation', 'Morning: 06:00-09:30, Evening: 16:00-18:30', 'MTR_AGRI_05', 'U_06', TRUE, TRUE),
('AGRI-TN-042-F06', 'R. Chinnasamy', '156/1A', 'T1', 'NODE_T1', 'F', 10.0, 7.46, 'Deep Borewell Submersible Pump', 'Paddy Nursery & Coconut Grove', 'Morning: 07:00-12:00, Afternoon: 14:30-17:30', 'MTR_AGRI_06', 'U_06', TRUE, TRUE)
ON CONFLICT (service_id) DO NOTHING;

