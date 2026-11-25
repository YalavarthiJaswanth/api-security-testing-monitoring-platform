from typing import List, Optional
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select, WebDriverWait
from selenium.common.exceptions import TimeoutException
from .base_page import BasePage


class ApiInventoryPage(BasePage):
    INVENTORY_HEADER = (By.XPATH, "//header//h1[contains(., 'API Inventory')]")
    ADD_NEW_API_BTN = (By.XPATH, "//header//a[@href='/apis/new']")
    TABLE_ROWS = (By.CSS_SELECTOR, "main table tbody tr")
    EMPTY_STATE = (By.XPATH, "//h2[contains(., 'No APIs Registered Yet')]")
    LOADING_INDICATOR = (By.XPATH, "//main//*[contains(text(),'Loading API inventory')]")
    SEARCH_OR_FILTER_INPUTS = (By.CSS_SELECTOR, "main input[type='text'], main input[type='search'], main select")

    # Add New API page locators (/apis/new)
    ADD_API_HEADER = (By.XPATH, "//header//h1[contains(., 'Register New API Target')]")
    NAME_INPUT = (By.CSS_SELECTOR, "input[placeholder='e.g., Core Payment Gateway']")
    BASE_URL_INPUT = (By.CSS_SELECTOR, "input[placeholder='https://api.example.com']")
    ENV_SELECT = (By.CSS_SELECTOR, "form select")
    DESC_INPUT = (By.CSS_SELECTOR, "input[placeholder='Brief summary of API scope']")
    PRESET_VULN_LAB_BTN = (By.XPATH, "//button[contains(., 'Vulnerable Lab')]")
    SUBMIT_API_BTN = (By.XPATH, "//button[@type='submit' and contains(., 'Register API Target')]")

    def open_inventory(self) -> None:
        self.open("/inventory")
        self.find_visible(self.INVENTORY_HEADER)
        # Wait until loading indicator disappears
        WebDriverWait(self.driver, self.timeout).until(
            lambda d: len(d.find_elements(*self.LOADING_INDICATOR)) == 0
        )

    def open_add_api(self) -> None:
        self.open("/apis/new")
        self.find_visible(self.ADD_API_HEADER)

    def register_api(
        self,
        name: str,
        base_url: str,
        environment: str = "testing",
        description: str = "Automated Selenium test API"
    ) -> None:
        self.find_visible(self.NAME_INPUT)
        self.type_text(self.NAME_INPUT, name)
        self.type_text(self.BASE_URL_INPUT, base_url)
        Select(self.find_visible(self.ENV_SELECT)).select_by_value(environment)
        self.type_text(self.DESC_INPUT, description)
        self.click(self.SUBMIT_API_BTN)
        self.wait_for_url_contains("/inventory")
        self.find_visible(self.INVENTORY_HEADER)
        WebDriverWait(self.driver, self.timeout).until(
            lambda d: len(d.find_elements(*self.LOADING_INDICATOR)) == 0
        )

    def register_vulnerable_lab_via_preset(
        self,
        custom_name: Optional[str] = None,
        custom_base_url: str = "http://vulnerable-lab:5050",
    ) -> None:
        self.click(self.PRESET_VULN_LAB_BTN)
        if custom_name:
            self.type_text(self.NAME_INPUT, custom_name)
        if custom_base_url:
            self.type_text(self.BASE_URL_INPUT, custom_base_url)
        self.click(self.SUBMIT_API_BTN)
        self.wait_for_url_contains("/inventory")
        self.find_visible(self.INVENTORY_HEADER)
        WebDriverWait(self.driver, self.timeout).until(
            lambda d: len(d.find_elements(*self.LOADING_INDICATOR)) == 0
        )

    def get_registered_api_names(self) -> List[str]:
        rows = self.driver.find_elements(*self.TABLE_ROWS)
        names = []
        for r in rows:
            first_cell = r.find_element(By.CSS_SELECTOR, "td:first-child div.font-bold")
            names.append(first_cell.text.strip())
        return names

    def has_api(self, name: str) -> bool:
        try:
            WebDriverWait(self.driver, 8).until(
                lambda d: any(name in n for n in self.get_registered_api_names())
            )
            return True
        except TimeoutException:
            return False

    def delete_api_by_name(self, name: str) -> bool:
        rows = self.driver.find_elements(*self.TABLE_ROWS)
        for row in rows:
            if name in row.text:
                del_btn = row.find_element(By.CSS_SELECTOR, "button[title='Delete API']")
                del_btn.click()
                alert = WebDriverWait(self.driver, 5).until(lambda d: d.switch_to.alert)
                alert.accept()
                WebDriverWait(self.driver, 8).until(
                    lambda d: not any(name in r.text for r in d.find_elements(*self.TABLE_ROWS))
                )
                return True
        return False

    def has_search_or_filter(self) -> bool:
        return len(self.driver.find_elements(*self.SEARCH_OR_FILTER_INPUTS)) > 0
