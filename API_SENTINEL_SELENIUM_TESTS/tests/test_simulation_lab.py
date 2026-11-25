from pathlib import Path
import pytest
from pages.simulation_page import SimulationPage


def test_simulation_lab_bola_execution_evidence_and_screenshot(authenticated_driver, base_url):
    """TEST 10a: Open Simulation Lab, run BOLA attack, verify vulnerable payload, evidence, and screenshot."""
    sim = SimulationPage(authenticated_driver, base_url)
    sim.open_simulation_lab()
    sim.select_bola_scenario()
    sim.execute_attack()

    payload = sim.get_vulnerable_payload()
    evidence = sim.get_evidence_text()
    remediation = sim.get_remediation_text()

    assert "user_9921" in payload or "Jane Vance" in payload, f"Unexpected BOLA response payload: {payload}"
    assert len(evidence) > 10, "Expected exploit verification evidence text"
    assert len(remediation) > 10, "Expected remediation guidance text"

    screenshot_path = Path(__file__).resolve().parent.parent / "screenshots" / "simulation_bola.png"
    authenticated_driver.save_screenshot(str(screenshot_path))
    assert screenshot_path.exists() and screenshot_path.stat().st_size > 0


def test_simulation_lab_secure_control_comparison(authenticated_driver, base_url):
    """TEST 10b: Check whether interactive secure-control execution comparison is implemented."""
    sim = SimulationPage(authenticated_driver, base_url)
    sim.open_simulation_lab()

    if not sim.has_secure_comparison_control():
        pytest.skip(
            "NOT IMPLEMENTED: SimulationLab.tsx displays vulnerable response, evidence, and Remediation Fix "
            "text, without an interactive secure-endpoint execution comparison toggle."
        )
