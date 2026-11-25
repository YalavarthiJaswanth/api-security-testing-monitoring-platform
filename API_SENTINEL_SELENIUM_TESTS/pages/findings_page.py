from typing import List
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select, WebDriverWait
from .base_page import BasePage


class FindingsPage(BasePage):
    HEADER = (By.XPATH, "//header//h1[contains(., 'Security Vulnerabilities & Findings')]")
    SEVERITY_FILTER = (By.XPATH, "(//main//select)[1]")
    API_FILTER = (By.XPATH, "(//main//select)[2]")
    STATUS_FILTER = (By.XPATH, "(//main//select)[3]")
    SEARCH_INPUT = (By.CSS_SELECTOR, "input[placeholder='Search findings, endpoints...']")
    LOADING_TEXT = (By.XPATH, "//main//*[contains(text(),'Querying security findings database')]")
    TABLE_ROWS = (By.CSS_SELECTOR, "main table tbody tr")
    EMPTY_STATE = (By.XPATH, "//p[contains(., 'No Security Findings Match Criteria')]")
    FIRST_VIEW_DETAILS_BTN = (By.XPATH, "(//main//table//tbody/tr)[1]//button[contains(., 'View Details')]")

    MODAL = (By.CSS_SELECTOR, "div.fixed.inset-0")
    MODAL_EVIDENCE_PRE = (By.CSS_SELECTOR, "div.fixed.inset-0 pre")
    MODAL_REMEDIATION_P = (By.XPATH, "//div[contains(@class,'fixed')]//span[contains(., 'Recommended Remediation')]/following-sibling::p")
    MODAL_CLOSE_BTN = (By.XPATH, "//div[contains(@class,'fixed')]//button[normalize-space()='Close']")

    def open_findings(self) -> None:
        self.open("/findings")
        self.find_visible(self.HEADER)
        self.wait_until_loaded()

    def wait_until_loaded(self) -> None:
        WebDriverWait(self.driver, self.timeout).until(
            lambda d: len(d.find_elements(*self.LOADING_TEXT)) == 0
        )

    def filter_by_severity(self, severity: str) -> None:
        Select(self.find_visible(self.SEVERITY_FILTER)).select_by_value(severity)
        self.wait_until_loaded()

    def get_row_count(self) -> int:
        return len(self.driver.find_elements(*self.TABLE_ROWS))

    def is_empty_state_visible(self) -> bool:
        return self.is_visible(self.EMPTY_STATE, timeout=3)

    def get_severity_badges_text(self) -> List[str]:
        rows = self.driver.find_elements(*self.TABLE_ROWS)
        return [r.find_element(By.CSS_SELECTOR, "td:first-child").text.strip() for r in rows]

    def open_first_finding_details(self) -> None:
        self.click(self.FIRST_VIEW_DETAILS_BTN)
        self.find_visible(self.MODAL)

    def get_modal_evidence_text(self) -> str:
        return self.find_visible(self.MODAL_EVIDENCE_PRE).text.strip()

    def get_modal_remediation_text(self) -> str:
        return self.find_visible(self.MODAL_REMEDIATION_P).text.strip()

    def close_modal(self) -> None:
        self.click(self.MODAL_CLOSE_BTN)
        WebDriverWait(self.driver, 5).until(lambda d: len(d.find_elements(*self.MODAL)) == 0)
