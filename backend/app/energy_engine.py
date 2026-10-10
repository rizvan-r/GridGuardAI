"""
Energy-Balance Engine for GridGuard AI
Computes exact raw discrepancies, estimated technical losses, unexplained discrepancies,
and section/candidate residuals with strict energy conservation rules.
"""
from typing import Dict, List, Any
import numpy as np


class EnergyEngine:
    @staticmethod
    def calculate_discrepancies(
        transformer_input: np.ndarray,
        total_household_energy: np.ndarray,
        estimated_technical_losses: np.ndarray,
    ) -> Dict[str, np.ndarray]:
        """
        Calculate raw and unexplained discrepancies adhering strictly to:
        raw_discrepancy_kwh = transformer_input_kwh - total_household_energy_kwh
        unexplained_kwh = raw_discrepancy_kwh - estimated_technical_losses_kwh
        unexplained_pct = (unexplained_kwh / transformer_input_kwh) * 100
        Retains signed residuals without clamping negative residuals to zero.
        """
        raw_discrepancy = transformer_input - total_household_energy
        unexplained = raw_discrepancy - estimated_technical_losses

        # Avoid zero division
        safe_denominator = np.where(transformer_input <= 0, 1e-6, transformer_input)
        unexplained_pct = (unexplained / safe_denominator) * 100.0

        return {
            "raw_discrepancy": raw_discrepancy,
            "unexplained": unexplained,
            "unexplained_pct": unexplained_pct,
        }

    @staticmethod
    def calculate_section_residuals(
        section_incoming_meters: Dict[str, np.ndarray],
        section_household_totals: Dict[str, np.ndarray],
        estimated_section_losses: Dict[str, np.ndarray],
    ) -> Dict[str, Dict[str, np.ndarray]]:
        """
        For each distribution section:
        section_residual_kwh = section_incoming_energy_kwh - sum(downstream_household_energy_kwh) - estimated_section_losses_kwh
        """
        results = {}
        for sec, incoming in section_incoming_meters.items():
            hh_energy = section_household_totals[sec]
            loss = estimated_section_losses[sec]
            residual = incoming - hh_energy - loss
            safe_den = np.where(incoming <= 0, 1e-6, incoming)
            residual_pct = (residual / safe_den) * 100.0
            
            results[sec] = {
                "incoming": incoming,
                "household_energy": hh_energy,
                "technical_loss": loss,
                "residual": residual,
                "residual_pct": residual_pct,
            }
        return results

    @staticmethod
    def calculate_candidate_branch_residuals(
        candidate_branch_meters: Dict[str, Dict[str, np.ndarray]],
        estimated_branch_loss_pct: float = 0.5,
    ) -> Dict[str, Dict[str, np.ndarray]]:
        """
        Calculates branch boundary energy balance for candidate connection points.
        candidate_residual = upstream - downstream - estimated_branch_losses
        """
        results = {}
        for cand_id, meters in candidate_branch_meters.items():
            up = meters["upstream_kwh"]
            down = meters["downstream_kwh"]
            branch_loss = up * (estimated_branch_loss_pct / 100.0)
            residual = up - down - branch_loss
            safe_den = np.where(up <= 0, 1e-6, up)
            residual_pct = (residual / safe_den) * 100.0

            results[cand_id] = {
                "upstream": up,
                "downstream": down,
                "residual": residual,
                "residual_pct": residual_pct,
            }
        return results

    @staticmethod
    def compute_daily_totals(
        transformer_input: np.ndarray,
        total_household_energy: np.ndarray,
        technical_losses: np.ndarray,
    ) -> Dict[str, float]:
        """Aggregate daily metrics in kWh and percentage."""
        t_sum = float(np.sum(transformer_input))
        hh_sum = float(np.sum(total_household_energy))
        loss_sum = float(np.sum(technical_losses))
        raw_disc = t_sum - hh_sum
        unexplained = raw_disc - loss_sum
        pct = (unexplained / max(0.001, t_sum)) * 100.0

        return {
            "transformer_kwh": round(t_sum, 2),
            "household_kwh": round(hh_sum, 2),
            "technical_loss_kwh": round(loss_sum, 2),
            "raw_discrepancy_kwh": round(raw_disc, 2),
            "unexplained_kwh": round(unexplained, 2),
            "unexplained_pct": round(pct, 2),
        }
