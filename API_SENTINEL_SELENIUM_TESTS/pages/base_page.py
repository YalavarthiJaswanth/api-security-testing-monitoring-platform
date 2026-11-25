from typing import Tuple
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException


class BasePage:
    """Shared Page Object helper wrapping explicit WebDriverWait actions."""

    def __init__(self, driver: WebDriver, base_url: str, timeout: int = 15):
        self.driver = driver
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.wait = WebDriverWait(driver, timeout)

    def open(self, path: str = "/") -> None:
        target = f"{self.base_url}/{path.lstrip('/')}" if path != "/" else f"{self.base_url}/"
        self.driver.get(target)

    def find_visible(self, locator: Tuple[str, str], timeout: int = None) -> WebElement:
        wait = self.wait if timeout is None else WebDriverWait(self.driver, timeout)
        return wait.until(EC.visibility_of_element_located(locator))

    def find_clickable(self, locator: Tuple[str, str], timeout: int = None) -> WebElement:
        wait = self.wait if timeout is None else WebDriverWait(self.driver, timeout)
        return wait.until(EC.element_to_be_clickable(locator))

    def find_present(self, locator: Tuple[str, str], timeout: int = None) -> WebElement:
        wait = self.wait if timeout is None else WebDriverWait(self.driver, timeout)
        return wait.until(EC.presence_of_element_located(locator))

    def click(self, locator: Tuple[str, str], timeout: int = None) -> None:
        el = self.find_clickable(locator, timeout=timeout)
        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", el)
        el.click()

    def type_text(self, locator: Tuple[str, str], text: str, clear_first: bool = True) -> None:
        el = self.find_visible(locator)
        if clear_first:
            el.clear()
        el.send_keys(text)

    def is_visible(self, locator: Tuple[str, str], timeout: int = 3) -> bool:
        try:
            WebDriverWait(self.driver, timeout).until(EC.visibility_of_element_located(locator))
            return True
        except TimeoutException:
            return False

    def wait_for_url_contains(self, fragment: str, timeout: int = None) -> bool:
        wait = self.wait if timeout is None else WebDriverWait(self.driver, timeout)
        return wait.until(EC.url_contains(fragment))

    def wait_for_text(self, locator: Tuple[str, str], text: str, timeout: int = None) -> bool:
        wait = self.wait if timeout is None else WebDriverWait(self.driver, timeout)
        return wait.until(EC.text_to_be_present_in_element(locator, text))
