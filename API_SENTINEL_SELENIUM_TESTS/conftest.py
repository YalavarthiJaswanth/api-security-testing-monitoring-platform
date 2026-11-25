import json
import os
import secrets
import shutil
import time
import urllib.request
from pathlib import Path
from typing import Dict

import pytest
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

ROOT_DIR = Path(__file__).resolve().parent
load_dotenv(ROOT_DIR / ".env")

SCREENSHOTS_DIR = ROOT_DIR / "screenshots"
DOWNLOADS_DIR = ROOT_DIR / "reports" / "downloads"
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)


def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption(
        "--headless",
        action="store_true",
        default=os.getenv("SELENIUM_HEADLESS", "false").lower() == "true",
        help="Run Chrome in headless mode (defaults to visible browser window)",
    )
    parser.addoption(
        "--base-url",
        action="store",
        default=os.getenv("SENTINEL_BASE_URL", "http://localhost:3000"),
        help="Base URL of the running API Sentinel frontend",
    )


@pytest.fixture(scope="session")
def base_url(request: pytest.FixtureRequest) -> str:
    return str(request.config.getoption("--base-url")).rstrip("/")


@pytest.fixture(scope="session")
def isolated_credentials(base_url: str) -> Dict[str, str]:
    """
    Provides credentials for an isolated test account.
    Uses SENTINEL_TEST_USERNAME / SENTINEL_TEST_PASSWORD if provided in env;
    otherwise registers a fresh isolated test account dynamically without
    hardcoding any real password or touching existing user data.
    """
    env_user = os.getenv("SENTINEL_TEST_USERNAME", "").strip()
    env_pass = os.getenv("SENTINEL_TEST_PASSWORD", "").strip()
    if env_user and env_pass:
        return {"username": env_user, "email": env_user, "password": env_pass, "is_ephemeral": False}

    unique_suffix = f"{int(time.time())}_{secrets.token_hex(3)}"
    username = f"selenium_qa_{unique_suffix}"
    email = f"{username}@qa-isolated.local"
    # Generated strictly at runtime; never stored or hardcoded
    password = f"Qa!{secrets.token_urlsafe(12)}"

    req_body = json.dumps(
        {"username": username, "email": email, "password": password, "role": "security_engineer"}
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{base_url}/api/v1/auth/register",
        data=req_body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status not in (200, 201):
                raise RuntimeError(f"Unexpected registration status {resp.status}")
            payload = json.loads(resp.read().decode("utf-8"))
            token = payload.get("token", "")
    except Exception as exc:
        raise RuntimeError(
            f"Unable to provision isolated test account at {base_url}/api/v1/auth/register: {exc}"
        ) from exc

    return {"username": username, "email": email, "password": password, "token": token, "is_ephemeral": True}


@pytest.fixture(scope="session")
def session_state() -> Dict[str, str]:
    """Shared non-secret metadata created during the E2E flow (e.g., test API name)."""
    return {
        "test_api_name": f"Selenium QA Lab Target {int(time.time())}",
        "test_api_url": os.getenv("SENTINEL_LAB_TARGET_URL", "http://vulnerable-lab:5050"),
    }


def _build_chrome_driver(headless: bool) -> webdriver.Chrome:
    options = Options()
    if headless:
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1440,920")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")

    prefs = {
        "download.default_directory": str(DOWNLOADS_DIR),
        "download.prompt_for_download": False,
        "download.directory_upgrade": True,
        "plugins.always_open_pdf_externally": True,
    }
    options.add_experimental_option("prefs", prefs)

    # Selenium Manager resolves matching ChromeDriver automatically
    driver = webdriver.Chrome(options=options)
    driver.set_page_load_timeout(25)
    return driver


@pytest.fixture(scope="session")
def driver(request: pytest.FixtureRequest, base_url: str, isolated_credentials: Dict[str, str]):
    """
    Shared visible/headless Chrome WebDriver session for smooth end-to-end demonstrations,
    cleaning up only test-created API artifacts upon completion.
    """
    headless = bool(request.config.getoption("--headless"))
    drv = _build_chrome_driver(headless=headless)
    yield drv

    # Safe cleanup of ONLY test-prefixed APIs belonging to the isolated test account
    token = isolated_credentials.get("token")
    if token:
        try:
            list_req = urllib.request.Request(
                f"{base_url}/api/v1/apis",
                headers={"Authorization": f"Bearer {token}"},
                method="GET",
            )
            with urllib.request.urlopen(list_req, timeout=8) as resp:
                apis = json.loads(resp.read().decode("utf-8")).get("apis", [])
            for item in apis:
                if str(item.get("name", "")).startswith("Selenium QA "):
                    del_req = urllib.request.Request(
                        f"{base_url}/api/v1/apis/{item['id']}",
                        headers={"Authorization": f"Bearer {token}"},
                        method="DELETE",
                    )
                    urllib.request.urlopen(del_req, timeout=8).read()
        except Exception:
            pass

    drv.quit()


@pytest.fixture
def authenticated_driver(driver: webdriver.Chrome, base_url: str, isolated_credentials: Dict[str, str]):
    """Ensures browser session is authenticated as the isolated test user before test execution."""
    from pages.login_page import LoginPage
    from pages.dashboard_page import DashboardPage

    current_url = driver.current_url or ""
    if not current_url.startswith(base_url) or "/login" in current_url:
        login_page = LoginPage(driver, base_url)
        login_page.open_login()
        login_page.login(isolated_credentials["username"], isolated_credentials["password"])
        DashboardPage(driver, base_url).wait_loaded()
    else:
        # Ensure we are not stuck on /login due to a prior logout test
        dash = DashboardPage(driver, base_url)
        if not dash.is_visible(dash.SIDEBAR_BRAND, timeout=2):
            login_page = LoginPage(driver, base_url)
            login_page.open_login()
            login_page.login(isolated_credentials["username"], isolated_credentials["password"])
            dash.wait_loaded()
    return driver


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item: pytest.Item, call):
    """Automatically capture a screenshot inside screenshots/ whenever any UI test fails."""
    outcome = yield
    rep = outcome.get_result()

    if rep.when == "call" and rep.failed:
        drv = item.funcargs.get("driver") or item.funcargs.get("authenticated_driver")
        if drv is not None:
            safe_name = "".join(c if c.isalnum() or c in ("_", "-") else "_" for c in item.name)
            filename = f"FAIL_{safe_name}_{int(time.time())}.png"
            dest = SCREENSHOTS_DIR / filename
            try:
                drv.save_screenshot(str(dest))
                item.user_properties.append(("screenshot", f"screenshots/{filename}"))
            except Exception:
                pass
