from selenium.webdriver.common.by import By
from .base_page import BasePage


class SimulationPage(BasePage):
    HEADER = (By.XPATH, "//header//h1[contains(., 'Simulation Lab')]")
    BOLA_SCENARIO_BTN = (By.XPATH, "//main//button[.//span[contains(., 'Broken Object Level Authorization')]]")
    EXECUTE_BTN = (By.XPATH, "//button[contains(., 'Execute Test Attack')]")
    RESULT_TITLE = (By.XPATH, "//span[contains(., 'Real Vulnerable Lab Response')]")
    RESPONSE_PRE = (By.XPATH, "//span[contains(., 'Actual Response Payload:')]/following-sibling::div//pre")
    EVIDENCE_P = (By.XPATH, "//span[contains(., 'Exploit Verification & Evidence')]/following-sibling::p")
    REMEDIATION_P = (By.XPATH, "//span[contains(., 'Remediation Fix')]/following-sibling::p")
    SECURE_COMPARISON_CONTROL = (By.XPATH, "//button[contains(., 'Secure') and (contains(., 'Compare') or contains(., 'Toggle'))]")

    def open_simulation_lab(self) -> None:
        self.open("/simulation")
        self.find_visible(self.HEADER)

    def select_bola_scenario(self) -> None:
        self.click(self.BOLA_SCENARIO_BTN)

    def execute_attack(self) -> None:
        self.click(self.EXECUTE_BTN)
        self.find_visible(self.RESULT_TITLE, timeout=20)

    def get_vulnerable_payload(self) -> str:
        return self.find_visible(self.RESPONSE_PRE).text.strip()

    def get_evidence_text(self) -> str:
        return self.find_visible(self.EVIDENCE_P).text.strip()

    def get_remediation_text(self) -> str:
        return self.find_visible(self.REMEDIATION_P).text.strip()

    def has_secure_comparison_control(self) -> bool:
        return len(self.driver.find_elements(*self.SECURE_COMPARISON_CONTROL)) > 0
