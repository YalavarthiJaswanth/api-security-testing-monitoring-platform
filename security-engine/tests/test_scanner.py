import pytest
from app.models.schemas import ScanRequest, EndpointItem, AuthPayload
from app.scanner import scanner_instance

@pytest.mark.asyncio
async def test_scanner_structure_and_health():
    """Verify scanner engine handles standard request schema and produces structured findings."""
    req = ScanRequest(
        scan_id="test_scan_001",
        scan_type="misconfiguration",
        base_url="https://jsonplaceholder.typicode.com",
        is_lab=False,
        endpoints=[
            EndpointItem(path="/posts", method="GET", auth_required=False)
        ],
        auth=AuthPayload(auth_type="none")
    )
    result = await scanner_instance.run_scan(req)
    assert result.scan_id == "test_scan_001"
    assert result.status == "completed"
    assert isinstance(result.findings, list)

@pytest.mark.asyncio
async def test_vulnerable_lab_sensitive_data_detection():
    """Verify security engine detects excessive data exposure on vulnerable profile endpoint."""
    req = ScanRequest(
        scan_id="test_scan_lab_002",
        scan_type="full_owasp",
        base_url="http://127.0.0.1:5050",
        is_lab=True,
        endpoints=[
            EndpointItem(path="/api/v1/lab/accounts/profile", method="GET", auth_required=False)
        ],
        auth=AuthPayload(auth_type="none")
    )
    result = await scanner_instance.run_scan(req)
    assert result.status == "completed"
    assert result.findings_count > 0
    categories = [f.owasp_category for f in result.findings]
    assert any("API3:2023" in cat or "API8:2023" in cat for cat in categories)

@pytest.mark.asyncio
async def test_headers_and_cors_misconfiguration():
    """Verify scanner flags missing security headers and server version leakage."""
    req = ScanRequest(
        scan_id="test_scan_lab_003",
        scan_type="misconfiguration",
        base_url="http://127.0.0.1:5050",
        is_lab=True,
        endpoints=[
            EndpointItem(path="/api/v1/lab/public/info", method="GET", auth_required=False)
        ],
        auth=AuthPayload(auth_type="none")
    )
    result = await scanner_instance.run_scan(req)
    assert result.status == "completed"
    assert any("Security Misconfiguration" in f.owasp_category for f in result.findings)
