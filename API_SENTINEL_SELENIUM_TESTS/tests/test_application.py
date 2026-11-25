from pages.login_page import LoginPage


def test_application_availability_and_login_screen(driver, base_url):
    """TEST 1: Verify API Sentinel loads, title matches, and Login page is rendered."""
    driver.get(base_url)
    login_page = LoginPage(driver, base_url)
    login_page.find_visible(login_page.HEADING)

    assert "API Sentinel" in driver.title, f"Unexpected page title: {driver.title}"
    assert "/login" in driver.current_url or login_page.is_visible(login_page.SUBMIT_BTN)
