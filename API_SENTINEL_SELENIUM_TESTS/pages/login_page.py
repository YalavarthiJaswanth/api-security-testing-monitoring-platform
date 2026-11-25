from selenium.webdriver.common.by import By
from .base_page import BasePage


class LoginPage(BasePage):
    HEADING = (By.XPATH, "//h1[contains(., 'API SENTINEL')]")
    SIGN_IN_TAB = (By.XPATH, "//button[normalize-space()='Sign In']")
    REGISTER_TAB = (By.XPATH, "//button[normalize-space()='Register Account']")
    USERNAME_INPUT = (By.CSS_SELECTOR, "form input[type='text']")
    EMAIL_INPUT = (By.CSS_SELECTOR, "form input[type='email']")
    PASSWORD_INPUT = (By.CSS_SELECTOR, "form input[type='password']")
    ROLE_SELECT = (By.CSS_SELECTOR, "form select")
    SUBMIT_BTN = (By.CSS_SELECTOR, "form button[type='submit']")
    QUICK_DEMO_BTN = (By.XPATH, "//button[contains(., 'Quick Demo Fill')]")
    ERROR_BANNER = (By.CSS_SELECTOR, "div.text-rose-400")

    def open_login(self) -> None:
        self.open("/login")
        self.find_visible(self.HEADING)

    def switch_to_sign_in(self) -> None:
        self.click(self.SIGN_IN_TAB)
        self.find_visible(self.USERNAME_INPUT)

    def switch_to_register(self) -> None:
        self.click(self.REGISTER_TAB)
        self.find_visible(self.EMAIL_INPUT)

    def login(self, username_or_email: str, password: str) -> None:
        self.switch_to_sign_in()
        self.type_text(self.USERNAME_INPUT, username_or_email)
        self.type_text(self.PASSWORD_INPUT, password)
        self.click(self.SUBMIT_BTN)

    def register(self, username: str, email: str, password: str, role: str = "security_engineer") -> None:
        self.switch_to_register()
        self.type_text(self.USERNAME_INPUT, username)
        self.type_text(self.EMAIL_INPUT, email)
        self.type_text(self.PASSWORD_INPUT, password)
        from selenium.webdriver.support.ui import Select
        Select(self.find_visible(self.ROLE_SELECT)).select_by_value(role)
        self.click(self.SUBMIT_BTN)

    def get_error_message(self, timeout: int = 8) -> str:
        el = self.find_visible(self.ERROR_BANNER, timeout=timeout)
        return el.text.strip()
