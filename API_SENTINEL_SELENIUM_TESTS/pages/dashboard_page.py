from typing import List
from selenium.webdriver.common.by import By
from .base_page import BasePage


class DashboardPage(BasePage):
    HEADER_TITLE = (By.XPATH, "//header//h1[contains(., 'Security Operations Center')]")
    SIDEBAR_BRAND = (By.XPATH, "//aside//span[contains(., 'API SENTINEL')]")
    SIDEBAR_LINKS = (By.CSS_SELECTOR, "aside nav a")
    SIDEBAR_USER_NAME = (By.CSS_SELECTOR, "aside div.border-t p.font-semibold")
    LOGOUT_BTN = (By.CSS_SELECTOR, "aside button[title='Sign out']")
    STAT_CARDS = (By.XPATH, "//main//div[contains(@class,'grid')][1]/div")
    SECTION_HEADINGS = (By.CSS_SELECTOR, "main h2")

    def open_dashboard(self) -> None:
        self.open("/")
        self.wait_loaded()

    def wait_loaded(self) -> None:
        self.find_visible(self.HEADER_TITLE)
        self.find_visible(self.SIDEBAR_BRAND)

    def get_stat_card_titles(self) -> List[str]:
        self.find_visible(self.STAT_CARDS)
        cards = self.driver.find_elements(*self.STAT_CARDS)
        return [c.text.strip() for c in cards]

    def get_chart_and_section_headings(self) -> List[str]:
        headings = self.driver.find_elements(*self.SECTION_HEADINGS)
        return [h.text.strip() for h in headings]

    def get_sidebar_hrefs(self) -> List[str]:
        links = self.driver.find_elements(*self.SIDEBAR_LINKS)
        return [link.get_attribute("href") or "" for link in links]

    def get_sidebar_labels(self) -> List[str]:
        links = self.driver.find_elements(*self.SIDEBAR_LINKS)
        return [link.text.strip() for link in links]

    def get_authenticated_username(self) -> str:
        return self.find_visible(self.SIDEBAR_USER_NAME).text.strip()

    def navigate_to(self, path: str) -> None:
        locator = (By.CSS_SELECTOR, f"aside nav a[href='{path}']")
        self.click(locator)

    def logout(self) -> None:
        self.click(self.LOGOUT_BTN)
        self.wait_for_url_contains("/login")
