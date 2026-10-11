"""
State Storage & Optional Supabase Connector for GridGuard AI
Provides high-performance in-memory local state management with persistent audit trails,
and optional sync with Supabase PostgreSQL if credentials are provided.
"""
import os
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from .models import LossAlert, AuditRecord, AlertStatusUpdate


class AppStorage:
    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL", "").strip()
        self.supabase_key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
        self.is_supabase_connected = bool(self.supabase_url and self.supabase_key)
        
        # Local in-memory store
        self.current_simulation: Optional[Dict[str, Any]] = None
        self.alerts: Dict[str, LossAlert] = {}
        self.audit_records: List[AuditRecord] = []
        self.active_sensor_ids: List[str] = [
            "MTR_T1",
            "MTR_SEC_A",
            "MTR_SEC_B",
            "MTR_SEC_C",
            "MTR_SEC_D",
            "MTR_SEC_E",
            "MTR_SEC_F",
        ]
        self.agri_audit_logs: List[Dict[str, Any]] = []

    def set_simulation(self, sim_data: Dict[str, Any], alerts: List[LossAlert]):
        self.current_simulation = sim_data
        self.alerts = {a.id: a for a in alerts}
        # Clear or retain audits relevant to current run
        if not self.audit_records:
            for a in alerts:
                self.audit_records.append(
                    AuditRecord(
                        id=str(uuid.uuid4()),
                        alert_id=a.id,
                        previous_status="None",
                        new_status="Open",
                        operator_name="GridGuard Auto-Detector",
                        notes=f"Automated alert generation: {a.suspected_cause}",
                        timestamp=datetime.now(timezone.utc).isoformat(),
                    )
                )

    def get_alerts(self, status: Optional[str] = None, severity: Optional[str] = None) -> List[LossAlert]:
        res = list(self.alerts.values())
        if status:
            res = [a for a in res if a.status.lower() == status.lower()]
        if severity:
            res = [a for a in res if a.severity.lower() == severity.lower()]
        return res

    def get_alert_by_id(self, alert_id: str) -> Optional[LossAlert]:
        return self.alerts.get(alert_id)

    def update_alert_status(self, alert_id: str, update: AlertStatusUpdate) -> Optional[LossAlert]:
        alert = self.alerts.get(alert_id)
        if not alert:
            return None

        old_status = alert.status
        alert.status = update.status

        # Create audit record
        audit = AuditRecord(
            id=str(uuid.uuid4()),
            alert_id=alert_id,
            previous_status=old_status,
            new_status=update.status,
            operator_name=update.operator_name or "Grid Operator",
            notes=update.notes or f"Status changed from {old_status} to {update.status}",
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
        self.audit_records.append(audit)

        # Optional Supabase sync
        if self.is_supabase_connected:
            self._sync_alert_to_supabase(alert, audit)

        return alert

    def get_audit_trail(self, alert_id: Optional[str] = None) -> List[AuditRecord]:
        if alert_id:
            return [r for r in self.audit_records if r.alert_id == alert_id]
        return self.audit_records

    def toggle_sensor(self, sensor_id: str, is_active: bool):
        if is_active and sensor_id not in self.active_sensor_ids:
            self.active_sensor_ids.append(sensor_id)
        elif not is_active and sensor_id in self.active_sensor_ids:
            self.active_sensor_ids.remove(sensor_id)

    def log_agri_action(
        self,
        service_id: str,
        action_type: str,
        actor_name: str,
        actor_role: str,
        details: str,
        alert_id: Optional[str] = None,
        pre_state: Optional[Dict[str, Any]] = None,
        post_state: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        log_entry = {
            "id": f"AGRI-AUD-{uuid.uuid4().hex[:8].upper()}",
            "alert_id": alert_id,
            "service_id": service_id,
            "action_type": action_type,
            "actor_name": actor_name,
            "actor_role": actor_role,
            "details": details,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "pre_state": pre_state,
            "post_state": post_state,
        }
        self.agri_audit_logs.append(log_entry)
        return log_entry

    def get_agri_audit_logs(self, service_id: Optional[str] = None, alert_id: Optional[str] = None) -> List[Dict[str, Any]]:
        res = self.agri_audit_logs
        if service_id:
            res = [l for l in res if l["service_id"] == service_id]
        if alert_id:
            res = [l for l in res if l.get("alert_id") == alert_id]
        return res

    def _sync_alert_to_supabase(self, alert: LossAlert, audit: AuditRecord):
        try:
            from supabase import create_client
            client = create_client(self.supabase_url, self.supabase_key)
            client.table("loss_alerts").update({"status": alert.status}).eq("id", alert.id).execute()
            client.table("investigation_audit_records").insert({
                "id": audit.id,
                "alert_id": audit.alert_id,
                "previous_status": audit.previous_status,
                "new_status": audit.new_status,
                "operator_name": audit.operator_name,
                "notes": audit.notes,
                "created_at": audit.timestamp,
            }).execute()
        except Exception as e:
            print(f"[AppStorage] Optional Supabase sync skipped/failed: {e}")


# Singleton instance
storage = AppStorage()

