from pages.dashboard_page import DashboardPage
from pages.login_page import LoginPage


def test_logout_redirects_and_blocks_protected_routes(authenticated_driver, base_url):
    """TEST 12: Click Logout, verify redirect to /login, and verify protected routes are inaccessible."""
    dash = DashboardPage(authenticated_driver, base_url)
    dash.open_dashboard()
    dash.logout()

    login_page = LoginPage(authenticated_driver, base_url)
    login_page.find_visible(login_page.HEADING)
    assert "/login" in authenticated_driver.current_url

    # Verify protected pages immediately redirect back to /login without authentication
    for protected_route in ["/", "/inventory", "/findings", "/reports"]:
        authenticated_driver.get(f"{base_url}{protected_route}")
        login_page.wait_for_url_contains("/login")
        assert "/login" in authenticated_driver.current_url, (
            f"Protected route '{protected_route}' did not redirect unauthenticated user to /login"
        )
