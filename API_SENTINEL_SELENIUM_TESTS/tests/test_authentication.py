import secrets
from pages.login_page import LoginPage
from pages.dashboard_page import DashboardPage


def test_login_invalid_credentials_displays_error(driver, base_url):
    """TEST 2a: Verify invalid login credentials show an authentication error banner."""
    login_page = LoginPage(driver, base_url)
    login_page.open_login()

    bogus_password = f"Invalid_{secrets.token_hex(6)}"
    login_page.login("nonexistent_qa_user", bogus_password)

    err_text = login_page.get_error_message()
    assert err_text, "Expected visible error banner on invalid credentials"
    assert "/login" in driver.current_url


def test_login_valid_credentials_navigates_to_dashboard(driver, base_url, isolated_credentials):
    """TEST 2b: Verify valid login redirects to Dashboard and renders authenticated username."""
    login_page = LoginPage(driver, base_url)
    login_page.open_login()
    login_page.login(isolated_credentials["username"], isolated_credentials["password"])

    dash = DashboardPage(driver, base_url)
    dash.wait_loaded()

    assert not driver.current_url.endswith("/login")
    assert isolated_credentials["username"] in dash.get_authenticated_username()
