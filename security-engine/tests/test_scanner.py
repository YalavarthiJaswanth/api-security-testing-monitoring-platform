import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import pytest

from app.models.schemas import ScanRequest, EndpointItem, AuthPayload
from app.scanner import scanner_instance


class _MockTargetHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_GET(self):
        if self.path == "/api/v1/lab/accounts/profile":
            payload = {
                "id": "usr_7718",
                "username": "alice_developer",
                "password_hash": "$2b$12$testmockhash",
                "ssn": "987-65-4321",
                "internal_api_secret": "sec_test_99"
            }
            body = json.dumps(payload).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if self.path == "/api/v1/lab/public/info" or self.path == "/":
            payload = {"status": "online", "service": "Mock Gateway"}
            body = json.dumps(payload).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Server", "Express/4.21.2")
            origin = self.headers.get("Origin")
            if origin:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Access-Control-Allow-Credentials", "true")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        self.send_response(404)
        self.end_headers()


@pytest.fixture
def mock_target_server():
    server = ThreadingHTTPServer(("127.0.0.1", 0), _MockTargetHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_address[1]}"
    finally:
        server.shutdown()
        server.server_close()


@pytest.mark.asyncio
async def test_scanner_structure_and_health(mock_target_server):
    """Verify scanner engine handles standard request schema and produces structured findings."""
    req = ScanRequest(
        scan_id="test_scan_001",
        scan_type="misconfiguration",
        base_url=mock_target_server,
        is_lab=False,
        endpoints=[
            EndpointItem(path="/", method="GET", auth_required=False)
        ],
        auth=AuthPayload(auth_type="none")
    )
    result = await scanner_instance.run_scan(req)
    assert result.scan_id == "test_scan_001"
    assert result.status == "completed"
    assert isinstance(result.findings, list)


@pytest.mark.asyncio
async def test_vulnerable_lab_sensitive_data_detection(mock_target_server):
    """Verify security engine detects excessive data exposure on vulnerable profile endpoint."""
    req = ScanRequest(
        scan_id="test_scan_lab_002",
        scan_type="full_owasp",
        base_url=mock_target_server,
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
async def test_headers_and_cors_misconfiguration(mock_target_server):
    """Verify scanner flags missing security headers and server version leakage."""
    req = ScanRequest(
        scan_id="test_scan_lab_003",
        scan_type="misconfiguration",
        base_url=mock_target_server,
        is_lab=True,
        endpoints=[
            EndpointItem(path="/api/v1/lab/public/info", method="GET", auth_required=False)
        ],
        auth=AuthPayload(auth_type="none")
    )
    result = await scanner_instance.run_scan(req)
    assert result.status == "completed"
    assert any("Security Misconfiguration" in f.owasp_category for f in result.findings)
