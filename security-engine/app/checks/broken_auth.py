from typing import List, Dict, Any
import httpx
from ..models.schemas import EndpointItem, AuthPayload

async def check_broken_authentication(
    client: httpx.AsyncClient,
    base_url: str,
    endpoints: List[EndpointItem],
    auth: AuthPayload
) -> List[Dict[str, Any]]:
    findings = []

    # 1. Check for Plaintext HTTP with Authentication
    if base_url.startswith("http://") and auth and auth.auth_type != "none":
        findings.append({
            "title": "Cleartext HTTP Transmission of API Credentials",
            "owasp_category": "API2:2023 - Broken Authentication",
            "severity": "critical",
            "endpoint": base_url,
            "method": "ANY",
            "evidence": {
                "baseUrl": base_url,
                "authType": auth.auth_type,
                "protocol": "HTTP (Unencrypted)"
            },
            "explanation": "Authentication credentials are transmitted over unencrypted HTTP, allowing network eavesdroppers to intercept tokens.",
            "potential_impact": "Complete credential theft and unauthorized account impersonation.",
            "remediation": "Enforce HTTPS (TLS 1.2 or 1.3) across all API endpoints and redirect all HTTP traffic to HTTPS.",
            "confidence": "confirmed"
        })

    # 2. Check each endpoint marked auth_required for missing authentication enforcement
    clean_base = base_url.rstrip("/")
    for ep in endpoints:
        if ep.auth_required:
            target_url = f"{clean_base}/{ep.path.lstrip('/')}"
            try:
                # Deliberately send request without authentication headers
                resp = await client.request(ep.method, target_url, timeout=4.0)

                # If the server returned 200 OK without credentials, that is Broken Authentication
                if resp.status_code == 200:
                    findings.append({
                        "title": f"Broken Authentication: Protected Endpoint Accessible Anonymously ({ep.path})",
                        "owasp_category": "API2:2023 - Broken Authentication",
                        "severity": "critical",
                        "endpoint": ep.path,
                        "method": ep.method,
                        "evidence": {
                            "requestUrl": target_url,
                            "sentHeaders": {"Authorization": "(Omitted)"},
                            "responseStatus": resp.status_code,
                            "responseSnippet": resp.text[:300]
                        },
                        "explanation": f"The endpoint '{ep.path}' was expected to require credentials but responded with HTTP 200 OK when requested unauthenticated.",
                        "potential_impact": "Full unauthenticated access to sensitive business data.",
                        "remediation": "Apply authentication verification middleware to all private routes prior to endpoint controllers.",
                        "confidence": "confirmed"
                    })
            except Exception:
                pass

        # 3. Check for query parameter token exposure in documented endpoints
        for p in (ep.parameters or []):
            param_name = str(p.get("name", "")).lower()
            if param_name in ["token", "access_token", "api_key", "apikey", "secret"] and p.get("in") == "query":
                findings.append({
                    "title": f"Sensitive Authentication Token in Query Parameters ({ep.path})",
                    "owasp_category": "API2:2023 - Broken Authentication",
                    "severity": "medium",
                    "endpoint": ep.path,
                    "method": ep.method,
                    "evidence": {
                        "parameterName": p.get("name"),
                        "parameterLocation": "query"
                    },
                    "explanation": f"API accepts sensitive token '{p.get('name')}' via query parameters, causing tokens to be logged in server logs, proxy caches, and browser history.",
                    "potential_impact": "Token leakage via server access logs, referrer headers, and HTTP proxies.",
                    "remediation": "Pass API credentials exclusively via the Authorization header or request body.",
                    "confidence": "confirmed"
                })

    return findings
