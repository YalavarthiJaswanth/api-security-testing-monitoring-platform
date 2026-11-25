from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select, WebDriverWait
from .base_page import BasePage


class ScannerPage(BasePage):
    HEADER = (By.XPATH, "//header//h1[contains(., 'Vulnerability Scanner')]")
    TARGET_API_SELECT = (By.XPATH, "(//main//select)[1]")
    PROFILE_SELECT = (By.XPATH, "(//main//select)[2]")
    LAUNCH_BTN = (By.XPATH, "//button[contains(., 'Launch Security Assessment')]")
    SCAN_FINISHED_HEADING = (By.XPATH, "//h3[contains(., 'Scan Finished Successfully')]")
    TOTAL_FINDINGS_COUNT = (By.XPATH, "//p[contains(., 'vulnerabilities identified')]/span")
    INSPECT_FINDINGS_BTN = (By.XPATH, "//button[contains(., 'Inspect Findings')]")

    def open_scanner(self) -> None:
        self.open("/scanner")
        self.find_visible(self.HEADER)

    def select_target_api(self, name_substring: str) -> None:
        el = self.find_visible(self.TARGET_API_SELECT)
        WebDriverWait(self.driver, self.timeout).until(
            lambda d: any(name_substring in opt.text for opt in el.find_elements(By.TAG_NAME, "option"))
        )
        sel = Select(el)
        for opt in sel.options:
            if name_substring in opt.text:
                sel.select_by_visible_text(opt.text)
                return
        raise AssertionError(f"Target API '{name_substring}' not found in scanner select")

    def select_profile(self, profile: str = "full_owasp") -> None:
        Select(self.find_visible(self.PROFILE_SELECT)).select_by_value(profile)

    def run_scan_and_wait(self, timeout: int = 45) -> int:
        self.click(self.LAUNCH_BTN)
        self.find_visible(self.SCAN_FINISHED_HEADING, timeout=timeout)
        count_text = self.find_visible(self.TOTAL_FINDINGS_COUNT).text.strip()
        return int(count_text)
