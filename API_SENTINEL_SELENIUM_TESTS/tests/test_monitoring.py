from pages.api_inventory_page import ApiInventoryPage
from pages.monitoring_page import MonitoringPage


def test_api_monitoring_health_and_manual_ping(authenticated_driver, base_url, session_state):
    """TEST 9: Open API Monitoring, verify health cards, trigger manual Ping, and check latency."""
    mon = MonitoringPage(authenticated_driver, base_url)
    mon.open_monitoring()

    if not mon.has_configs():
        inv = ApiInventoryPage(authenticated_driver, base_url)
        inv.open_add_api()
        inv.register_vulnerable_lab_via_preset(custom_name=session_state["test_api_name"])
        mon.open_monitoring()

    assert mon.has_configs(), "Expected at least one monitored API configuration"

    mon.trigger_manual_ping()

    uptime = mon.get_uptime_text()
    latency = mon.get_average_latency_text()
    health = mon.get_health_status_text()
    last_checked = mon.get_last_checked_text()

    assert "%" in uptime, f"Unexpected uptime format: {uptime}"
    assert "ms" in latency, f"Unexpected latency format: {latency}"
    assert any(state in health.upper() for state in ("HEALTHY", "DEGRADED", "DOWN", "UNMONITORED"))
    assert "Last checked:" in last_checked
