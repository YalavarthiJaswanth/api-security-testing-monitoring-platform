from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from .base_page import BasePage


class MonitoringPage(BasePage):
    HEADER = (By.XPATH, "//header//h1[contains(., 'Real-Time API Monitoring')]")
    UPTIME_VALUE = (By.XPATH, "//span[contains(., 'Target Uptime')]/parent::div/following-sibling::div")
    AVG_LATENCY_VALUE = (By.XPATH, "//span[contains(., 'Average Latency')]/parent::div/following-sibling::div")
    HEALTH_BADGE = (By.XPATH, "//span[contains(., 'Health Classification')]/parent::div/following-sibling::div")
    LAST_CHECKED = (By.XPATH, "//p[contains(., 'Last checked:')]")
    PING_NOW_BTN = (By.XPATH, "//button[contains(., 'Ping Now')]")
    TABLE_ROWS = (By.CSS_SELECTOR, "main table tbody tr")
    EMPTY_STATE = (By.XPATH, "//h3[contains(., 'No Monitored APIs Found')]")

    def open_monitoring(self) -> None:
        self.open("/monitoring")
        self.find_visible(self.HEADER)
        WebDriverWait(self.driver, self.timeout).until(
            lambda d: d.find_elements(*self.UPTIME_VALUE) or d.find_elements(*self.EMPTY_STATE)
        )

    def has_configs(self) -> bool:
        return len(self.driver.find_elements(*self.UPTIME_VALUE)) > 0

    def get_uptime_text(self) -> str:
        return self.find_visible(self.UPTIME_VALUE).text.strip()

    def get_average_latency_text(self) -> str:
        return self.find_visible(self.AVG_LATENCY_VALUE).text.strip()

    def get_health_status_text(self) -> str:
        return self.find_visible(self.HEALTH_BADGE).text.strip()

    def get_last_checked_text(self) -> str:
        return self.find_visible(self.LAST_CHECKED).text.strip()

    def trigger_manual_ping(self) -> None:
        btn = self.find_clickable(self.PING_NOW_BTN)
        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", btn)
        btn.click()
        # Wait for Pinging... state to resolve back to Ping Now
        WebDriverWait(self.driver, 20).until(
            lambda d: "Ping Now" in d.find_element(*self.PING_NOW_BTN).text
        )
