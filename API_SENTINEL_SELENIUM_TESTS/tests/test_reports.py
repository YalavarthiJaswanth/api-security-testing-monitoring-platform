from pathlib import Path
from selenium.webdriver.support.ui import WebDriverWait
from pages.api_inventory_page import ApiInventoryPage
from pages.scanner_page import ScannerPage
from pages.reports_page import ReportsPage


def _ensure_scan_exists(driver, base_url, api_name):
    reports = ReportsPage(driver, base_url)
    reports.open_reports()
    if reports.select_first_available_scan_if_present():
        return
    inv = ApiInventoryPage(driver, base_url)
    inv.open_inventory()
    if not any(api_name in n for n in inv.get_registered_api_names()):
        inv.open_add_api()
        inv.register_vulnerable_lab_via_preset(custom_name=api_name)
    scanner = ScannerPage(driver, base_url)
    scanner.open_scanner()
    scanner.select_target_api(api_name)
    scanner.select_profile("quick_audit")
    scanner.run_scan_and_wait(timeout=45)


def test_reports_generate_and_download_pdf(authenticated_driver, base_url, session_state):
    """TEST 11: Open Reports page, generate Executive PDF report, and verify valid PDF saved."""
    _ensure_scan_exists(authenticated_driver, base_url, session_state["test_api_name"])

    downloads_dir = Path(__file__).resolve().parent.parent / "reports" / "downloads"
    downloads_dir.mkdir(parents=True, exist_ok=True)
    for existing in downloads_dir.glob("API-Sentinel-Security-Report-*.pdf"):
        existing.unlink()

    reports = ReportsPage(authenticated_driver, base_url)
    reports.open_reports()
    reports.select_first_available_scan_if_present()
    reports.click_download_pdf()

    def _pdf_downloaded(_driver):
        pdfs = [p for p in downloads_dir.glob("API-Sentinel-Security-Report-*.pdf") if p.stat().st_size > 500]
        return pdfs[0] if pdfs else False

    downloaded_pdf = WebDriverWait(authenticated_driver, 20).until(_pdf_downloaded)
    assert downloaded_pdf.exists()
    header = downloaded_pdf.read_bytes()[:5]
    assert header == b"%PDF-", f"Downloaded file is not a valid PDF (header={header!r})"
