from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select, WebDriverWait
from .base_page import BasePage


class ReportsPage(BasePage):
    HEADER = (By.XPATH, "//header//h1[contains(., 'Security Reports & Deliverables')]")
    API_SELECT = (By.XPATH, "(//main//select)[1]")
    SCAN_SELECT = (By.XPATH, "(//main//select)[2]")
    DOWNLOAD_PDF_BTN = (By.XPATH, "//button[contains(., 'Download Executive PDF Report')]")
    EXPORT_JSON_BTN = (By.XPATH, "//button[contains(., 'Export JSON Dataset')]")
    ERROR_BANNER = (By.CSS_SELECTOR, "main div.text-rose-400")

    def open_reports(self) -> None:
        self.open("/reports")
        self.find_visible(self.HEADER)

    def select_first_available_scan_if_present(self) -> bool:
        sel = Select(self.find_visible(self.SCAN_SELECT))
        if len(sel.options) > 1:
            sel.select_by_index(1)
            return True
        return False

    def click_download_pdf(self) -> None:
        self.click(self.DOWNLOAD_PDF_BTN)
        # Wait until button returns from 'Generating PDF...' to 'Download Executive PDF Report'
        WebDriverWait(self.driver, 20).until(
            lambda d: "Download Executive PDF Report" in d.find_element(*self.DOWNLOAD_PDF_BTN).text
        )
