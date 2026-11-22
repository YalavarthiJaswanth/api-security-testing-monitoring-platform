import pytest
from app.models.schemas import ScanRequest, EndpointItem, AuthPayload
from app.scanner import scanner_instance

@pytest.mark.asyncio
async def test_scanner_structure_and_health():
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
