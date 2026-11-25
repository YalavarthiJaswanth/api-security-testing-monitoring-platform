from pages.dashboard_page import DashboardPage


def test_dashboard_cards_statistics_and_sidebar_navigation(authenticated_driver, base_url):
    """TEST 3: Verify Dashboard loads telemetry cards, stats sections, and all 11 sidebar routes."""
    dash = DashboardPage(authenticated_driver, base_url)
    dash.open_dashboard()

    cards_text = "\n".join(dash.get_stat_card_titles())
    for expected_card in [
        "REGISTERED APIS",
        "SECURITY SCANS",
        "TOTAL FINDINGS",
        "CRITICAL & HIGH",
        "API AVAILABILITY",
        "AVG LATENCY",
        "HEALTH STATUS",
        "SEVERITY TIERS",
    ]:
        assert expected_card in cards_text.upper(), f"Missing dashboard card: {expected_card}"

    headings = "\n".join(dash.get_chart_and_section_headings()).upper()
    assert "FINDINGS BY SEVERITY LEVEL" in headings
    assert "OWASP API SECURITY TOP 10" in headings

    hrefs = dash.get_sidebar_hrefs()
    for path in [
        "/inventory",
        "/apis/new",
        "/workspace",
        "/scanner",
        "/findings",
        "/monitoring",
        "/history",
        "/reports",
        "/simulation",
        "/settings",
    ]:
        assert any(h.endswith(path) for h in hrefs), f"Missing sidebar route: {path}"
