"""
Hierarchical Localization Engine for GridGuard AI
Strictly infers suspect section and candidate connection branch from available measurements.
Level 1: Feeder Discrepancy Evaluation
Level 2: Distribution Section Energy Residuals
Level 3: Candidate Connection Branch Residuals & Ranking
Never accesses simulator ground truth labels as detection inputs.
"""
from typing import Dict, List, Any, Optional
import numpy as np
from .models import CandidateRanking


CANDIDATE_SECTION_MAP = {
    "U_01": "A",
    "U_02": "B",
    "U_03": "C",
    "U_04": "D",
    "U_05": "E",
    "U_06": "F",
}

CANDIDATE_LABELS = {
    "U_01": "Candidate U-01 (Pole A-07 Tap, Section A)",
    "U_02": "Candidate U-02 (Pole B-04 Junction, Section B)",
    "U_03": "Candidate U-03 (Service Line C-08, Section C)",
    "U_04": "Candidate U-04 (Pole D-03 Span, Section D)",
    "U_05": "Candidate U-05 (Pole E-06 Lateral, Section E)",
    "U_06": "Candidate U-06 (Agri Borewell Spur, Section F)",
}


class HierarchicalLocalizer:
    @staticmethod
    def localize(
        feeder_unexplained_residuals: np.ndarray,
        section_residuals: Dict[str, Dict[str, np.ndarray]],
        candidate_branch_residuals: Dict[str, Dict[str, np.ndarray]],
        interval_data_quality: List[str],
        active_interval_index: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Executes hierarchical 3-level localization.
        If active_interval_index is specified, evaluates that specific window;
        otherwise evaluates the aggregate daily pattern.
        """
        n = len(feeder_unexplained_residuals)

        # ---------------------------------------------------------------------
        # LEVEL 1: Feeder Level Assessment
        # ---------------------------------------------------------------------
        if active_interval_index is not None:
            f_residual = float(feeder_unexplained_residuals[active_interval_index])
            feeder_anomaly = f_residual > 0.4
            feeder_persistence = 1 if feeder_anomaly else 0
        else:
            # Full day evaluation
            positive_intervals = np.sum(feeder_unexplained_residuals > 0.3)
            f_residual = float(np.sum(feeder_unexplained_residuals))
            feeder_persistence = int(positive_intervals)
            feeder_anomaly = feeder_persistence >= 4

        feeder_status = {
            "level": "Level 1: Feeder Level",
            "feeder_id": "T1",
            "anomaly_detected": bool(feeder_anomaly),
            "unexplained_residual_kwh": round(f_residual, 3),
            "persistence_intervals": feeder_persistence,
            "description": (
                f"Feeder T1 records sustained unexplained residual of {round(f_residual, 2)} kWh "
                f"across {feeder_persistence} intervals."
                if feeder_anomaly else "Feeder T1 energy balance is within standard technical tolerance."
            ),
        }

        # ---------------------------------------------------------------------
        # LEVEL 2: Distribution Section Energy Residuals
        # ---------------------------------------------------------------------
        section_scores = {}
        for sec, data in section_residuals.items():
            if active_interval_index is not None:
                sec_res = float(data["residual"][active_interval_index])
                pers = 1 if sec_res > 0.15 else 0
            else:
                sec_res = float(np.sum(np.maximum(0, data["residual"])))
                pers = int(np.sum(data["residual"] > 0.15))

            section_scores[sec] = {
                "section_id": sec,
                "total_residual_kwh": round(sec_res, 3),
                "persistence_intervals": pers,
            }

        sorted_sections = sorted(
            section_scores.values(),
            key=lambda x: (x["total_residual_kwh"], x["persistence_intervals"]),
            reverse=True,
        )

        top_section = sorted_sections[0]
        second_section = sorted_sections[1] if len(sorted_sections) > 1 else None

        # Determine section level confidence
        sec_ratio = (
            top_section["total_residual_kwh"] / max(0.01, second_section["total_residual_kwh"])
            if second_section else 1.0
        )
        if top_section["total_residual_kwh"] > 0.5 and sec_ratio > 2.0:
            section_confidence = "HIGH"
        elif top_section["total_residual_kwh"] > 0.3:
            section_confidence = "MEDIUM"
        else:
            section_confidence = "LOW"

        section_status = {
            "level": "Level 2: Distribution Section",
            "top_section_id": top_section["section_id"],
            "section_confidence": section_confidence,
            "section_residual_kwh": top_section["total_residual_kwh"],
            "ranked_sections": sorted_sections,
            "description": (
                f"Section {top_section['section_id']} displays the largest persistent energy discrepancy "
                f"({top_section['total_residual_kwh']} kWh, ratio {round(sec_ratio, 1)}x over other sections)."
            ),
        }

        # ---------------------------------------------------------------------
        # LEVEL 3: Candidate Connection Branch Localization & Ranking
        # ---------------------------------------------------------------------
        candidate_scores = []
        for cand_id, data in candidate_branch_residuals.items():
            parent_sec = CANDIDATE_SECTION_MAP[cand_id]
            parent_sec_info = section_scores[parent_sec]

            if active_interval_index is not None:
                branch_res = float(data["residual"][active_interval_index])
                pers = 1 if branch_res > 0.15 else 0
            else:
                branch_res = float(np.sum(np.maximum(0, data["residual"])))
                pers = int(np.sum(data["residual"] > 0.15))

            # Quality check
            has_missing = any(q == "missing_data" for q in interval_data_quality)
            has_fault = any(q == "meter_fault_suspected" for q in interval_data_quality)
            has_noise = any(q == "noisy_measurements" for q in interval_data_quality)

            data_qual = "Good (Telemetry synchronized)"
            if has_missing:
                data_qual = "Degraded (Missing packet drops)"
            elif has_fault:
                data_qual = "Meter diagnostic warning"
            elif has_noise:
                data_qual = "Noisy (Elevated measurement variance)"

            # Scoring: combination of branch residual, persistence, and parent section consistency
            parent_sec_kwh = parent_sec_info["total_residual_kwh"]
            score = (branch_res * 1.5) + (pers * 0.2) + (parent_sec_kwh * 0.5)

            # Assign candidate confidence
            if pers >= 6 and branch_res > 3.0 and not has_missing:
                cand_conf = "HIGH"
            elif pers >= 2 and branch_res > 1.0:
                cand_conf = "MEDIUM"
            elif branch_res > 0.4:
                cand_conf = "LOW"
            else:
                cand_conf = "AMBIGUOUS"

            # Recommended additional measurement to reduce ambiguity
            rec_meas = f"Deploy high-speed clamp CT meter at {CANDIDATE_LABELS[cand_id].split(',')[0]} tap line"

            candidate_scores.append({
                "candidate_id": cand_id,
                "section_id": parent_sec,
                "label": CANDIDATE_LABELS[cand_id],
                "score": score,
                "measured_residual_kwh": round(branch_res, 3),
                "persistence_intervals": pers,
                "confidence": cand_conf,
                "data_quality": data_qual,
                "parent_section_residual": parent_sec_kwh,
                "supporting_evidence": (
                    f"Measured branch boundary discrepancy of {round(branch_res, 2)} kWh across {pers} intervals. "
                    f"Consistent with Section {parent_sec} unaccounted loss profile."
                ),
                "recommended_measurement": rec_meas,
            })

        # Sort candidate rankings by score
        candidate_scores.sort(key=lambda x: x["score"], reverse=True)

        ranked_output: List[CandidateRanking] = []
        for idx, item in enumerate(candidate_scores):
            ranked_output.append(
                CandidateRanking(
                    rank=idx + 1,
                    candidate_id=item["candidate_id"],
                    section_id=item["section_id"],
                    label=item["label"],
                    measured_residual_kwh=item["measured_residual_kwh"],
                    persistence_intervals=item["persistence_intervals"],
                    confidence=item["confidence"],
                    data_quality=item["data_quality"],
                    supporting_evidence=item["supporting_evidence"],
                    recommended_measurement=item["recommended_measurement"],
                )
            )

        top_cand = ranked_output[0]
        # Ambiguity determination
        if len(ranked_output) > 1 and abs(top_cand.measured_residual_kwh - ranked_output[1].measured_residual_kwh) < 0.2:
            ambiguity_note = "Close residuals between top candidates; physical field measurement required to disambiguate."
        else:
            ambiguity_note = f"Top candidate {top_cand.candidate_id} demonstrates significant residual separation."

        return {
            "feeder_status": feeder_status,
            "section_status": section_status,
            "candidate_rankings": ranked_output,
            "ambiguity_note": ambiguity_note,
            "top_candidate": top_cand,
            "recommended_next_measurement": top_cand.recommended_measurement,
        }
