import pytest
import httpx
import json

from app.main import health_check
from app.models.schemas import EndpointItem, AuthPayload, ScanRequest
from app.checks.headers_cors import check_headers_and_cors
from app.checks.broken_auth import check_broken_authentication
from app.checks.sensitive_data import check_sensitive_data_exposure
from app.checks.resource_consumption import check_resource_consumption
from app.checks.bola import check_bola
from app.checks.bfla import check_bfla
from app.checks.inventory import check_improper_inventory
from app.scanner import SecurityScanner


def make_mock_client(handler):
    transport = httpx.MockTransport(handler)
    return httpx.AsyncClient(transport=transport)


def test_engine_health_endpoint():
    """Verify FastAPI /health check returns expected service metadata."""
    res = health_check()
    assert res["status"] == "healthy"
    assert res["service"] == "api-sentinel-security-engine"
    assert "FastAPI" in res["engine"]


@pytest.mark.asyncio
async def test_headers_and_cors_detects_missing_headers_cors_and_banner():
    """Verify check_headers_and_cors flags missing security headers, permissive CORS, and Server banner."""
    def handler(request: httpx.Request) -> httpx.Response:
        origin = request.headers.get("origin")
        headers = {"Server": "Express/4.21.2"}
        if origin:
            headers["Access-Control-Allow-Origin"] = origin
            headers["Access-Control-Allow-Credentials"] = "true"
        return httpx.Response(200, headers=headers, json={"ok": True})

    async with make_mock_client(handler) as client:
        findings = await check_headers_and_cors(client, "https://target.example.com")

    titles = [f["title"] for f in findings]
    assert any("HSTS" in t for t in titles)
    assert any("X-Content-Type-Options" in t for t in titles)
    assert any("X-Frame-Options" in t for t in titles)
    assert any("Content-Security-Policy" in t for t in titles)
    assert any("CORS" in t for t in titles)
    assert any("Fingerprint" in t for t in titles)
    assert all(f["owasp_category"] == "API8:2023 - Security Misconfiguration" for f in findings)


@pytest.mark.asyncio
async def test_headers_and_cors_passes_on_hardened_server():
    """Verify hardened server with all security headers and strict origin produces zero findings."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={
                "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
                "X-Content-Type-Options": "nosniff",
                "X-Frame-Options": "DENY",
                "Content-Security-Policy": "default-src 'self'",
                "Access-Control-Allow-Origin": "https://app.example.com"
            },
            json={"ok": True}
        )

    async with make_mock_client(handler) as client:
        findings = await check_headers_and_cors(client, "https://hardened.example.com")

    assert findings == []


@pytest.mark.asyncio
async def test_broken_authentication_checks():
    """Verify check_broken_authentication flags HTTP creds, unauthenticated 200 OK, and query tokens."""
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/private":
            return httpx.Response(200, json={"secret": "exposed"})
        return httpx.Response(401, json={"error": "Unauthorized"})

    endpoints = [
        EndpointItem(
            path="/api/private",
            method="GET",
            auth_required=True,
            parameters=[{"name": "access_token", "in": "query"}]
        ),
        EndpointItem(path="/api/protected-ok", method="GET", auth_required=True)
    ]
    auth = AuthPayload(auth_type="bearer", token="abc123")

    async with make_mock_client(handler) as client:
        findings = await check_broken_authentication(client, "http://insecure.example.com", endpoints, auth)

    titles = [f["title"] for f in findings]
    assert any("Cleartext HTTP" in t for t in titles)
    assert any("Accessible Anonymously" in t for t in titles)
    assert any("Query Parameters" in t for t in titles)
    # Protected endpoint returning 401 should NOT be flagged
    assert not any("/api/protected-ok" in f["endpoint"] for f in findings)


@pytest.mark.asyncio
async def test_sensitive_data_exposure_detects_keys_and_ssn_regex():
    """Verify check_sensitive_data_exposure detects password_hash, private_key, and SSN patterns."""
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/leaky":
            return httpx.Response(
                200,
                json={
                    "username": "alice",
                    "password_hash": "$2b$12$abcdef",
                    "ssn": "123-45-6789"
                }
            )
        return httpx.Response(200, json={"id": "u1", "displayName": "Alice"})

    endpoints = [
        EndpointItem(path="/leaky", method="GET"),
        EndpointItem(path="/clean-dto", method="GET")
    ]

    async with make_mock_client(handler) as client:
        findings = await check_sensitive_data_exposure(
            client, "https://api.example.com", endpoints, AuthPayload(auth_type="none")
        )

    assert len(findings) == 1
    assert findings[0]["endpoint"] == "/leaky"
    assert findings[0]["owasp_category"] == "API3:2023 - Broken Object Property Level Authorization"
    assert "password_hash" in findings[0]["evidence"]["detectedSensitiveProperties"]
    assert findings[0]["evidence"]["piiPatternDetected"] == "SSN Pattern Match"


@pytest.mark.asyncio
async def test_resource_consumption_rate_limit_and_pagination():
    """Verify check_resource_consumption detects missing rate-limit headers and unbounded limit=1000000."""
    def handler(request: httpx.Request) -> httpx.Response:
        if "limit=1000000" in str(request.url):
            return httpx.Response(200, json={"totalRecordsReturned": 1000000})
        return httpx.Response(200, json={"status": "ok"})

    endpoints = [EndpointItem(path="/orders", method="GET", parameters=[{"name": "limit", "in": "query"}])]

    async with make_mock_client(handler) as client:
        findings = await check_resource_consumption(
            client, "https://api.example.com", endpoints, AuthPayload(auth_type="none")
        )

    titles = [f["title"] for f in findings]
    assert any("Missing Rate Limiting Headers" in t for t in titles)
    assert any("Unbounded Pagination Limit" in t for t in titles)
    assert all(f["owasp_category"] == "API4:2023 - Unrestricted Resource Consumption" for f in findings)


@pytest.mark.asyncio
async def test_bola_detection_confirmed_vs_probable_and_secure_403():
    """Verify check_bola flags accessible foreign IDs and ignores endpoints enforcing 403 Forbidden."""
    def handler(request: httpx.Request) -> httpx.Response:
        if "/users/9921" in request.url.path:
            return httpx.Response(200, json={"id": "9921", "user": "victim"})
        return httpx.Response(403, json={"error": "Forbidden"})

    endpoints = [
        EndpointItem(path="/api/v1/users/{id}", method="GET"),
        EndpointItem(path="/api/v1/invoices/{id}", method="GET")
    ]

    async with make_mock_client(handler) as client:
        lab_findings = await check_bola(
            client, "https://api.example.com", endpoints, AuthPayload(auth_type="bearer", token="t1"), is_lab=True
        )
        prod_findings = await check_bola(
            client, "https://api.example.com", endpoints, AuthPayload(auth_type="bearer", token="t1"), is_lab=False
        )

    assert len(lab_findings) == 1
    assert lab_findings[0]["severity"] == "critical"
    assert lab_findings[0]["confidence"] == "confirmed"
    assert lab_findings[0]["owasp_category"] == "API1:2023 - Broken Object Level Authorization"

    assert len(prod_findings) == 1
    assert prod_findings[0]["confidence"] == "probable"


@pytest.mark.asyncio
async def test_bfla_admin_role_bypass_and_rejection():
    """Verify check_bfla flags exposed administrative routes and respects 403 authorization."""
    def handler(request: httpx.Request) -> httpx.Response:
        if "grant-admin" in request.url.path and request.method == "POST":
            return httpx.Response(200, json={"success": True, "message": "Role upgraded to admin"})
        return httpx.Response(403, json={"error": "Admin privileges required"})

    endpoints = [
        EndpointItem(path="/api/v1/admin/users/grant-admin", method="POST"),
        EndpointItem(path="/api/v1/admin/audit", method="POST")
    ]

    async with make_mock_client(handler) as client:
        findings = await check_bfla(
            client, "https://api.example.com", endpoints, AuthPayload(auth_type="none"), is_lab=True
        )

    assert len(findings) == 1
    assert findings[0]["owasp_category"] == "API5:2023 - Broken Function Level Authorization"
    assert findings[0]["severity"] == "critical"
    assert findings[0]["endpoint"] == "/api/v1/admin/users/grant-admin"


@pytest.mark.asyncio
async def test_improper_inventory_exposed_swagger_docs():
    """Verify check_improper_inventory detects public /swagger.json and passes when hidden."""
    def handler_exposed(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/swagger.json":
            return httpx.Response(200, json={"swagger": "2.0", "paths": {}})
        return httpx.Response(404)

    def handler_hidden(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404)

    async with make_mock_client(handler_exposed) as client:
        findings = await check_improper_inventory(client, "https://api.example.com", [])
        assert len(findings) == 1
        assert findings[0]["owasp_category"] == "API9:2023 - Improper Inventory Management"

    async with make_mock_client(handler_hidden) as client:
        findings_clean = await check_improper_inventory(client, "https://api.example.com", [])
        assert findings_clean == []


@pytest.mark.asyncio
async def test_scanner_run_scan_orchestration(monkeypatch):
    """Verify SecurityScanner.run_scan builds ScanResponse and differentiates scan_type profiles."""
    async def mock_headers(client, base_url):
        return [{
            "title": "Missing HSTS",
            "owasp_category": "API8:2023 - Security Misconfiguration",
            "severity": "medium",
            "endpoint": base_url,
            "method": "GET",
            "explanation": "HSTS missing",
            "potential_impact": "SSL strip",
            "remediation": "Enable HSTS"
        }]

    async def mock_inventory(client, base_url, endpoints):
        return []

    async def mock_bola(client, base_url, endpoints, auth, is_lab):
        return [{
            "title": "BOLA Flaw",
            "owasp_category": "API1:2023 - Broken Object Level Authorization",
            "severity": "critical",
            "endpoint": "/users/{id}",
            "method": "GET",
            "explanation": "IDOR",
            "potential_impact": "Data breach",
            "remediation": "Verify owner",
            "confidence": "confirmed"
        }]

    async def mock_empty(*args, **kwargs):
        return []

    import app.scanner as scanner_mod
    monkeypatch.setattr(scanner_mod, "check_headers_and_cors", mock_headers)
    monkeypatch.setattr(scanner_mod, "check_improper_inventory", mock_inventory)
    monkeypatch.setattr(scanner_mod, "check_broken_authentication", mock_empty)
    monkeypatch.setattr(scanner_mod, "check_bola", mock_bola)
    monkeypatch.setattr(scanner_mod, "check_sensitive_data_exposure", mock_empty)
    monkeypatch.setattr(scanner_mod, "check_resource_consumption", mock_empty)
    monkeypatch.setattr(scanner_mod, "check_bfla", mock_empty)

    scanner = SecurityScanner()

    # Profile 1: misconfiguration should skip BOLA/full OWASP checks
    req_basic = ScanRequest(
        scan_id="scan-basic",
        scan_type="misconfiguration",
        base_url="https://api.example.com",
        endpoints=[EndpointItem(path="/users/{id}", method="GET")]
    )
    res_basic = await scanner.run_scan(req_basic)
    assert res_basic.status == "completed"
    assert res_basic.findings_count == 1
    assert res_basic.findings[0].owasp_category == "API8:2023 - Security Misconfiguration"

    # Profile 2: full_owasp executes all checks including BOLA
    req_full = ScanRequest(
        scan_id="scan-full",
        scan_type="full_owasp",
        base_url="https://api.example.com",
        endpoints=[EndpointItem(path="/users/{id}", method="GET")]
    )
    res_full = await scanner.run_scan(req_full)
    assert res_full.findings_count == 2
    assert any(f.owasp_category == "API1:2023 - Broken Object Level Authorization" for f in res_full.findings)
