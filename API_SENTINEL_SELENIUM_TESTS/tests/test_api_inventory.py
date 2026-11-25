import pytest
from pages.api_inventory_page import ApiInventoryPage


def test_register_new_api_and_verify_in_inventory(authenticated_driver, base_url, session_state):
    """TEST 5: Open Add New API, register an authorized local lab API, and verify it in Inventory."""
    inv = ApiInventoryPage(authenticated_driver, base_url)
    inv.open_add_api()

    inv.register_vulnerable_lab_via_preset(custom_name=session_state["test_api_name"])

    assert "/inventory" in authenticated_driver.current_url
    assert inv.has_api(session_state["test_api_name"]), (
        f"Expected newly registered API '{session_state['test_api_name']}' to appear in inventory"
    )


def test_api_inventory_displays_registered_records(authenticated_driver, base_url, session_state):
    """TEST 4a: Open API Inventory and verify registered API records are rendered."""
    inv = ApiInventoryPage(authenticated_driver, base_url)
    inv.open_inventory()

    names = inv.get_registered_api_names()
    assert len(names) >= 1, "Expected at least one registered API record in inventory"
    assert any(session_state["test_api_name"] in n for n in names)


def test_api_inventory_search_and_filter_availability(authenticated_driver, base_url):
    """TEST 4b: Verify whether search/filtering exists on ApiInventory page."""
    inv = ApiInventoryPage(authenticated_driver, base_url)
    inv.open_inventory()

    if not inv.has_search_or_filter():
        pytest.skip(
            "NOT IMPLEMENTED: ApiInventory.tsx does not render search or filter inputs "
            "(filtering is implemented on SecurityFindings page)."
        )
