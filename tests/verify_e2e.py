import urllib.request
import json

def check(url, method='GET', data=None):
    req = urllib.request.Request(url, method=method)
    if data:
        req.add_header('Content-Type', 'application/json')
        body = json.dumps(data).encode('utf-8')
    else:
        body = None
    with urllib.request.urlopen(req, data=body) as resp:
        code = resp.getcode()
        ct = resp.headers.get('Content-Type', '')
        content = resp.read().decode('utf-8')
        print(f"{method} {url} -> {code} ({ct[:25]})")
        return content

if __name__ == '__main__':
    print("--- Verifying GridGuard AI End-to-End ---")
    
    # 1. Frontend Root
    html = check("http://localhost:5173/")
    assert "GridGuard AI" in html
    
    # 2. Health via Vite Proxy
    health = json.loads(check("http://localhost:5173/api/health"))
    print(f"Health Status: {health['status']}, DB: {health['database_mode']}, AI: {health['ai_engine_mode']}")
    
    # 3. Feeder Summary
    sum_data = json.loads(check("http://localhost:5173/api/feeders/T1/summary"))
    print(f"Summary: Supplied={sum_data['transformer_energy_supplied_kwh']} kWh, Discrepancy={sum_data['unexplained_discrepancy_pct']}%, Alerts={sum_data['active_alerts_count']}")
    
    # 4. Network Tree
    tree = json.loads(check("http://localhost:5173/api/network/tree"))
    print(f"Topology: Feeder={tree['feeder_id']}, Sections={len(tree['sections'])}, Houses/Section={len(tree['sections'][0]['households'])}")
    
    # 5. Alerts & Investigation
    alerts = json.loads(check("http://localhost:5173/api/alerts"))
    print(f"Alerts: Found {len(alerts)} active alerts.")
    if alerts:
        first = alerts[0]
        print(f"Top Alert: {first['id']} in Section {first['section_id']}, Severity: {first['severity']}, Gap: {first['unexplained_kwh']} kWh")
        
        # Explain alert
        explain = json.loads(check(f"http://localhost:5173/api/alerts/{first['id']}/explain", method='POST', data={"question": "Why Section C?"}))
        print(f"AI Explainer Mode: {explain['mode']}")
        print(f"Key Findings: {explain['key_findings']}")
    
    # 6. Measurement Planner
    plan = json.loads(check("http://localhost:5173/api/measurement-planner/recommendation"))
    print(f"Planner: Sequential={plan['sequential_steps_required']} steps vs Hierarchical={plan['hierarchical_steps_required']} steps ({plan['step_reduction_pct']}% reduction)")
    print(f"Next Sensor Recommendation: {plan['next_recommended_sensor']}")
    
    print("\n>>> ALL SYSTEM VERIFICATION CHECKS PASSED SUCCESSFULLY! <<<")
