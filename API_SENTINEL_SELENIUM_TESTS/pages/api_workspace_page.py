from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select, WebDriverWait
from .base_page import BasePage


class ApiWorkspacePage(BasePage):
    HEADER = (By.XPATH, "//header//h1[contains(., 'API Testing Workspace')]")
    API_SELECT = (By.CSS_SELECTOR, "header select")
    METHOD_SELECT = (By.XPATH, "//main//select[option[@value='GET']]")
    URL_INPUT = (By.CSS_SELECTOR, "input[placeholder='https://api.example.com/v1/endpoint']")
    SEND_BTN = (By.XPATH, "//button[contains(., 'Send Request')]")
    BODY_TAB_BTN = (By.XPATH, "//main//button[contains(., 'Request Body')]")
    BODY_TEXTAREA = (By.CSS_SELECTOR, "main textarea")
    STATUS_BADGE = (By.XPATH, "//span[contains(., 'Response Inspector')]/following-sibling::div/span[1]")
    DURATION_BADGE = (By.XPATH, "//span[contains(., 'Response Inspector')]/following-sibling::div/span[2]")
    RESPONSE_BODY_PRE = (By.CSS_SELECTOR, "main div.bg-slate-950 pre")

    def open_workspace(self) -> None:
        self.open("/workspace")
        self.find_visible(self.HEADER)

    def select_registered_api(self, api_name_substring: str) -> None:
        select_el = self.find_visible(self.API_SELECT)
        WebDriverWait(self.driver, self.timeout).until(
            lambda d: any(api_name_substring in opt.text for opt in select_el.find_elements(By.TAG_NAME, "option"))
        )
        sel = Select(select_el)
        for opt in sel.options:
            if api_name_substring in opt.text:
                sel.select_by_visible_text(opt.text)
                return
        raise AssertionError(f"API '{api_name_substring}' not found in workspace selector")

    def send_request(self, method: str, target_url: str, json_body: str = None) -> None:
        Select(self.find_visible(self.METHOD_SELECT)).select_by_value(method.upper())
        self.type_text(self.URL_INPUT, target_url)
        if json_body is not None:
            self.click(self.BODY_TAB_BTN)
            self.type_text(self.BODY_TEXTAREA, json_body)
        self.click(self.SEND_BTN)
        self.find_visible(self.STATUS_BADGE, timeout=20)

    def get_status_text(self) -> str:
        return self.find_visible(self.STATUS_BADGE).text.strip()

    def get_duration_text(self) -> str:
        return self.find_visible(self.DURATION_BADGE).text.strip()

    def get_response_body(self) -> str:
        return self.find_visible(self.RESPONSE_BODY_PRE).text.strip()
