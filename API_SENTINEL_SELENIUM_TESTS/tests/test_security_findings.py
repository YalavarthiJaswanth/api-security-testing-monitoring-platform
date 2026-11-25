from selenium.webdriver.support.ui import WebDriverWait
from pages.findings_page import FindingsPage


def test_security_findings_filtering_empty_state_and_modal(authenticated_driver, base_url):
    """
    TEST 8: Open Security Findings, test severity filters & search, inspect finding evidence
    and remediation modal when non-simulation findings exist, and verify empty-state handling.
    """
    findings = FindingsPage(authenticated_driver, base_url)
    findings.open_findings()

    initial_rows = findings.get_row_count()

    # Test Severity Filter transitions
    for sev in ("critical", "high"):
        findings.filter_by_severity(sev)
        row_count = findings.get_row_count()
        if row_count > 0:
            badges = findings.get_severity_badges_text()
            assert all(sev.upper() in b for b in badges), f"Unexpected severity badges for '{sev}': {badges}"
        else:
            assert findings.is_empty_state_visible(), f"Expected empty state banner for filter '{sev}'"

    # Reset filter to All Severities
    findings.filter_by_severity("")
    assert findings.get_row_count() == initial_rows

    if initial_rows > 0:
        findings.open_first_finding_details()
        evidence = findings.get_modal_evidence_text()
        remediation = findings.get_modal_remediation_text()
        assert len(evidence) > 2, "Expected technical evidence JSON in details modal"
        assert len(remediation) > 10, "Expected remediation recommendation in details modal"
        findings.close_modal()
    else:
        # Fresh isolated accounts only scan the local lab (isSimulation=true), so Real Mode
        # findings (/findings?isSimulation=false) cleanly render the empty state.
        assert findings.is_empty_state_visible(), "Expected empty-findings message when no non-simulation findings exist"

    # Verify search input filters cleanly to empty state on unmatched query
    findings.type_text(findings.SEARCH_INPUT, "__UNMATCHED_FINDING_QUERY_XYZ__")
    search_btn = authenticated_driver.find_element("xpath", "//button[normalize-space()='Search']")
    search_btn.click()
    WebDriverWait(authenticated_driver, 8).until(lambda d: findings.is_empty_state_visible())
    assert findings.is_empty_state_visible()
