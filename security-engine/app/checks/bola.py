from typing import List, Dict, Any
import httpx
import re
from ..models.schemas import EndpointItem, AuthPayload

ID_PATTERN = re.compile(r"/(?:users|orders|accounts|documents|profiles|invoices|items)/([0-9a-zA-Z_-]+)", re.IGNORECASE)

async def check_bola(
    client: httpx.AsyncClient,
    base_url: str,
    endpoints: List[EndpointItem],
    auth: AuthPayload,
    is_lab: bool = False
) -> List[Dict[str, Any]]:
    findings = []
    clean_base = base_url.rstrip("/")

    for ep in endpoints:
        match = ID_PATTERN.search(ep.path)
        if match or "{id}" in ep.path.lower() or ":id" in ep.path.lower():
            original_id = match.group(1) if match else "123"
            test_path = ep.path.replace("{id}", "9921").replace(":id", "9921")
            target_url = f"{clean_base}/{test_path.lstrip('/')}"

            try:
                # Test request with modified identifier
                headers = {}
                if auth and auth.token:
                    headers["Authorization"] = f"Bearer {auth.token}"

                resp = await client.request(ep.method, target_url, headers=headers, timeout=4.0)

                # In BOLA, if access to modified ID succeeds (HTTP 200) without explicit authorization error
                if resp.status_code == 200 and ("user" in resp.text.lower() or "id" in resp.text.lower()):
                    findings.append({
                        "title": f"Potential BOLA / IDOR Flaw on Resource Identifier ({ep.path})",
                        "owasp_category": "API1:2023 - Broken Object Level Authorization",
                        "severity": "critical",
                        "endpoint": ep.path,
                        "method": ep.method,
                        "evidence": {
                            "testedUrl": target_url,
                            "originalIdentifier": original_id,
                            "modifiedIdentifier": "9921",
                            "responseStatus": resp.status_code,
                            "responseSnippet": resp.text[:250]
                        },
                        "explanation": f"Endpoint '{ep.path}' allowed retrieval of arbitrary resource object '9921' without verifying ownership.",
                        "potential_impact": "Unauthorized access to other users' private records, PII, and financial documents.",
                        "remediation": "Validate user permissions at the database query level to ensure the requesting identity owns the requested object ID.",
                        "confidence": "confirmed" if is_lab else "probable"
                    })
            except Exception:
                pass

    return findings
