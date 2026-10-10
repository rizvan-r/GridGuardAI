"""
Tests for Energy Balance Engine & Technical Loss Calculations
"""
import pytest
import numpy as np
from backend.app.energy_engine import EnergyEngine


def test_energy_balance_conservation():
    """Verify raw_discrepancy, unexplained_kwh, and percentage formulas."""
    transformer_input = np.array([10.0, 20.0, 30.0])
    household_energy = np.array([8.0, 16.0, 24.0])
    technical_losses = np.array([0.5, 1.0, 1.5])

    res = EnergyEngine.calculate_discrepancies(
        transformer_input=transformer_input,
        total_household_energy=household_energy,
        estimated_technical_losses=technical_losses,
    )

    # raw = input - hh
    expected_raw = np.array([2.0, 4.0, 6.0])
    np.testing.assert_allclose(res["raw_discrepancy"], expected_raw)

    # unexplained = raw - tech_loss
    expected_unexplained = np.array([1.5, 3.0, 4.5])
    np.testing.assert_allclose(res["unexplained"], expected_unexplained)

    # unexplained_pct = unexplained / input * 100
    expected_pct = np.array([15.0, 15.0, 15.0])
    np.testing.assert_allclose(res["unexplained_pct"], expected_pct)


def test_signed_residuals_retained():
    """Verify signed residuals are not clamped to zero."""
    # When households consume slightly more than measured (due to instrument error)
    transformer_input = np.array([10.0])
    household_energy = np.array([10.2])
    technical_losses = np.array([0.3])

    res = EnergyEngine.calculate_discrepancies(
        transformer_input=transformer_input,
        total_household_energy=household_energy,
        estimated_technical_losses=technical_losses,
    )

    assert res["raw_discrepancy"][0] < 0  # -0.2
    assert res["unexplained"][0] < 0  # -0.5
    assert res["unexplained_pct"][0] < 0


def test_zero_denominator_guard():
    """Ensure zero input does not raise ZeroDivisionError."""
    transformer_input = np.array([0.0])
    household_energy = np.array([0.0])
    technical_losses = np.array([0.0])

    res = EnergyEngine.calculate_discrepancies(
        transformer_input=transformer_input,
        total_household_energy=household_energy,
        estimated_technical_losses=technical_losses,
    )
    assert not np.isnan(res["unexplained_pct"][0])
